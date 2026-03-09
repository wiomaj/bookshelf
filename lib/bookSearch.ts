/**
 * lib/bookSearch.ts
 *
 * Unified book search across Open Library and Google Books.
 * Supports title, author, and ISBN queries (including raw ISBN numbers).
 *
 * Imported by BookForm and ToReadForm — both use the same function.
 *
 * Design:
 *  - Client-side only (both APIs allow CORS; no server hop needed)
 *  - ISBN is auto-detected and routed to a targeted exact lookup
 *  - Text queries hit both OL and GB in parallel; APIs handle relevance
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
  return `${normalizeKey(title)}|||${normalizeKey(author)}`
}

// ─── Provider fetchers ────────────────────────────────────────────────────────

async function fetchOpenLibrary(query: string, isbn: string | null, isAuthor: boolean, signal: AbortSignal): Promise<Candidate[]> {
  const params = new URLSearchParams({
    fields: 'title,author_name,cover_i,cover_edition_key,isbn,edition_count',
    limit: '12',
  })

  if (isbn) {
    // Exact ISBN lookup — OL's isbn field returns a precise match
    params.set('isbn', isbn)
  } else if (isAuthor) {
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
        author: doc.author_name?.[0] ?? '',
        cover_url: olCover(doc),
        score,
      }
    })
  } catch {
    return []
  }
}

async function fetchGoogleBooks(query: string, isbn: string | null, isAuthor: boolean, signal: AbortSignal): Promise<Candidate[]> {
  // Build the GB query string
  let q: string
  if (isbn) {
    q = `isbn:${isbn}`
  } else if (isAuthor) {
    q = `inauthor:"${query}"`
  } else {
    q = query
  }

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
        author: info?.authors?.[0] ?? '',
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search for books by title, author, or ISBN.
 *
 * - Raw ISBN numbers (10 or 13 digits, with or without dashes) trigger an
 *   exact ISBN lookup that reliably returns the specific edition.
 * - Two-word proper-name queries use author-specific search endpoints.
 * - Everything else uses a general relevance search.
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

  const isbn = detectISBN(q)
  const isAuthor = !isbn && looksLikeAuthorName(q)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 6_000)

  let olResults: Candidate[] = []
  let gbResults: Candidate[] = []

  try {
    const [ol, gb] = await Promise.allSettled([
      fetchOpenLibrary(q, isbn, isAuthor, controller.signal),
      fetchGoogleBooks(q, isbn, isAuthor, controller.signal),
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
