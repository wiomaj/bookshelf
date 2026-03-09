/**
 * lib/bookSearch.ts
 *
 * Unified book search across Open Library and Google Books.
 * Supports title, author, and ISBN queries (including raw ISBN numbers).
 *
 * Imported by BookForm and ToReadForm — both use the same function.
 *
 * Design:
 *  - ISBN queries → server-side /api/isbn (GB + DNB; handles German books OL misses)
 *  - Text queries → client-side OL + GB in parallel (both allow CORS)
 *  - Dedup key = normalised title + first author (not just title)
 *  - OL edition_count used as a popularity signal so classics rise
 *  - Results with covers are preferred in the final sort
 *  - 6-second shared abort timeout
 */

// ─── Public type ──────────────────────────────────────────────────────────────

export interface BookSuggestion {
  title: string
  author: string
  cover_url?: string
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface OLDoc {
  title?: string
  author_name?: string[]
  cover_i?: number
  cover_edition_key?: string
  isbn?: string[]
  edition_count?: number
}

interface GBIdentifier {
  type: 'ISBN_10' | 'ISBN_13' | string
  identifier: string
}

interface GBVolumeInfo {
  title?: string
  authors?: string[]
  imageLinks?: { thumbnail?: string; smallThumbnail?: string }
  industryIdentifiers?: GBIdentifier[]
}

interface GBItem {
  id: string
  volumeInfo?: GBVolumeInfo
}

interface Candidate {
  title: string
  author: string
  cover_url: string | undefined
  score: number
}

// ─── Query type detection ─────────────────────────────────────────────────────

/**
 * Returns the cleaned ISBN (digits only) if the query is a valid ISBN-10 or ISBN-13,
 * otherwise returns null.
 */
function detectISBN(query: string): string | null {
  // Strip explicit "isbn:" prefix if the user typed it
  const stripped = query.replace(/^isbn[:\s]*/i, '').trim()
  const digits = stripped.replace(/[\s\-]/g, '').toUpperCase()
  if ((digits.length === 10 || digits.length === 13) && /^[\dX]+$/.test(digits)) {
    return digits
  }
  return null
}

/**
 * Heuristic: does the query look like a person's name (author search)?
 *
 * Conditions: exactly 2 words, both ≥2 chars, both starting with an uppercase
 * letter, no digits. We keep this tight (2 words only) to avoid false positives
 * like "Dune Frank" which is really title + author.
 */
function looksLikeAuthorName(query: string): boolean {
  const words = query.trim().split(/\s+/)
  if (words.length !== 2) return false
  return words.every((w) => w.length >= 2 && /^[A-ZÁÉÍÓÚÜÖÄ][a-záéíóúüöäß]+$/.test(w))
}

// ─── Author normalisation ─────────────────────────────────────────────────────

/**
 * Normalise bibliographic "Lastname, Firstname" → "Firstname Lastname".
 * Some sources (GB for German books, OL in MARC mode) store names inverted.
 * Only inverts when exactly one comma is present (avoids "Jr., III" edge cases).
 */
function normalizeAuthorName(name: string): string {
  if (!name) return name
  const commaIdx = name.indexOf(',')
  if (commaIdx === -1) return name          // already "First Last" — nothing to do
  const last  = name.slice(0, commaIdx).trim()
  const first = name.slice(commaIdx + 1).trim()
  return first ? `${first} ${last}` : last  // "Marjolein Bastin"
}

// ─── Cover / URL helpers ──────────────────────────────────────────────────────

function cleanGoogleCover(url: string): string {
  return url.replace(/^http:/, 'https:').replace(/zoom=\d/, 'zoom=1')
}

function olCover(doc: OLDoc): string | undefined {
  if (doc.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
  if (doc.cover_edition_key) return `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-M.jpg`
  return undefined
}

// ─── Dedup key ────────────────────────────────────────────────────────────────

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

function dedupKey(title: string, author: string): string {
  // Normalise the author before keying so "Bastin, Marjolein" and "Marjolein Bastin"
  // map to the same slot and get merged rather than shown as separate results.
  return `${normalizeKey(title)}|||${normalizeKey(normalizeAuthorName(author))}`
}

// ─── Provider fetchers ────────────────────────────────────────────────────────

async function fetchOpenLibrary(query: string, _isbn: null, isAuthor: boolean, signal: AbortSignal): Promise<Candidate[]> {
  const params = new URLSearchParams({
    fields: 'title,author_name,cover_i,cover_edition_key,isbn,edition_count',
    limit: '12',
  })

  if (isAuthor) {
    // Author-focused query: OL's author field gives better results than q=
    params.set('author', query)
  } else {
    // General relevance search across title, author, subject
    params.set('q', query)
  }

  try {
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, { signal })
    if (!res.ok) return []
    const data = await res.json() as { docs?: OLDoc[] }

    return (data.docs ?? []).map((doc, position) => {
      const editionBoost = Math.min(doc.edition_count ?? 0, 60)
      const score = (12 - position) * 10 + editionBoost

      return {
        title: doc.title ?? '',
        // OL can return names in MARC "Lastname, Firstname" order — normalise to natural order
        author: normalizeAuthorName(doc.author_name?.[0] ?? ''),
        cover_url: olCover(doc),
        score,
      }
    })
  } catch {
    return []
  }
}

async function fetchGoogleBooks(query: string, _isbn: null, isAuthor: boolean, signal: AbortSignal): Promise<Candidate[]> {
  // Build the GB query string.
  // For title queries we use intitle: so GB searches the title field specifically
  // rather than doing full-text matching across descriptions, reviews, etc.
  // This makes "geh langsam" find "Geh langsam, wenn du es eilig hast" instead of
  // loosely-related books that happen to contain those words somewhere.
  // Multi-word phrases are quoted so GB treats them as an ordered phrase.
  const q = isAuthor
    ? `inauthor:"${query}"`
    : query.includes(' ')
      ? `intitle:"${query}"`   // multi-word → exact phrase in title
      : `intitle:${query}`     // single word → any title containing it

  const params = new URLSearchParams({
    q,
    maxResults: '10',
    printType: 'books',
  })

  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, { signal })
    if (!res.ok) return []
    const data = await res.json() as { items?: GBItem[] }

    return (data.items ?? []).map((item, position) => {
      const info = item.volumeInfo
      const links = info?.imageLinks
      const rawCover = links?.thumbnail ?? links?.smallThumbnail
      const cover_url = rawCover ? cleanGoogleCover(rawCover) : undefined

      const score = (10 - position) * 10

      return {
        title: info?.title ?? '',
        // GB occasionally returns German/Dutch authors in MARC inverted format
        author: normalizeAuthorName(info?.authors?.[0] ?? ''),
        cover_url,
        score,
      }
    })
  } catch {
    return []
  }
}

// ─── Merge + rank ─────────────────────────────────────────────────────────────

function merge(a: Candidate, b: Candidate): Candidate {
  return {
    title: a.title || b.title,
    author: a.author || b.author,
    cover_url: a.cover_url ?? b.cover_url,
    score: Math.max(a.score, b.score),
  }
}

// ─── ISBN lookup via server route ─────────────────────────────────────────────

/**
 * For ISBN queries, call the server-side /api/isbn route which tries:
 *  1. Google Books (no CORS/rate-limit issues server-side)
 *  2. DNB (Deutsche Nationalbibliothek) — catches German books that GB misses
 */
async function fetchByISBN(isbn: string): Promise<BookSuggestion | null> {
  try {
    const res = await fetch(`/api/isbn?isbn=${encodeURIComponent(isbn)}`)
    if (!res.ok) return null
    const data = await res.json() as { result: BookSuggestion | null }
    return data.result ?? null
  } catch {
    return null
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search for books by title, author, or ISBN.
 *
 * - Raw ISBN numbers (10 or 13 digits, with or without dashes) are routed to
 *   /api/isbn (server-side Google Books + DNB) for reliable German book support.
 * - Two-word proper-name queries use author-specific search endpoints.
 * - Everything else uses OL + GB in parallel (client-side, both allow CORS).
 *
 * Returns at most `maxResults` suggestions, covers-first, sorted by score.
 * Never throws — returns [] on network errors or empty queries.
 */
export async function searchBooks(
  query: string,
  maxResults = 8
): Promise<BookSuggestion[]> {
  const q = query.trim()
  if (!q) return []

  // ── ISBN: single exact lookup via server route ──────────────────────────────
  const isbn = detectISBN(q)
  if (isbn) {
    const result = await fetchByISBN(isbn)
    return result ? [result] : []
  }

  // ── Text search: OL + GB in parallel ───────────────────────────────────────
  const isAuthor = looksLikeAuthorName(q)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 6_000)

  let olResults: Candidate[] = []
  let gbResults: Candidate[] = []

  try {
    const [ol, gb] = await Promise.allSettled([
      fetchOpenLibrary(q, null, isAuthor, controller.signal),
      fetchGoogleBooks(q, null, isAuthor, controller.signal),
    ])
    if (ol.status === 'fulfilled') olResults = ol.value
    if (gb.status === 'fulfilled') gbResults = gb.value
  } finally {
    clearTimeout(timeoutId)
  }

  // Deduplicate: merge candidates that refer to the same work
  const seen = new Map<string, Candidate>()
  for (const c of [...olResults, ...gbResults]) {
    if (!c.title) continue
    const key = dedupKey(c.title, c.author)
    const existing = seen.get(key)
    seen.set(key, existing ? merge(existing, c) : c)
  }

  // Sort: covers first, then by score descending
  const ranked = [...seen.values()]
    .sort((a, b) => {
      const coverDiff = (b.cover_url ? 1 : 0) - (a.cover_url ? 1 : 0)
      if (coverDiff !== 0) return coverDiff
      return b.score - a.score
    })
    .slice(0, maxResults)

  return ranked.map(({ title, author, cover_url }) => ({ title, author, cover_url }))
}
