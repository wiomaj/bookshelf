/**
 * lib/bookSearch.ts
 *
 * Unified, paginated book search for the add flow.
 *
 * Runs CLIENT-SIDE: Google Books free-text + Open Library free-text in parallel,
 * plus DNB (via the server route) on page 1 for German/Austrian/Swiss coverage.
 *
 * Why client-side:
 *  - Google Books is the relevance spine; its free-text q= ranking (title + author)
 *    is what makes results feel "Google-like".
 *  - Browser fetches spread Google's daily quota across each user's IP instead of
 *    concentrating it on a single server IP, and avoid server egress limits.
 *  - The GB API key is already NEXT_PUBLIC, so nothing extra is exposed.
 *
 * The server /api/books/search + /api/books/metadata routes remain for ISBN
 * caching and deep metadata lookups.
 *
 * Imported by BookForm (searchBooks) and the add page (searchBooksPage).
 */

import { gbUrl } from '@/lib/gbUrl'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface BookSuggestion {
  title: string
  author: string
  cover_url?: string
  isbn13?: string | null
  description?: string | null
  pageCount?: number | null
  publishedDate?: string | null
  publisher?: string | null
  subjects?: string[]
}

export interface SearchPage {
  results: BookSuggestion[]
  hasMore: boolean
}

// ─── Page sizes ───────────────────────────────────────────────────────────────

const PAGE1_SIZE = 15
const PAGEN_SIZE = 20

function startIndexFor(page: number): number {
  return page <= 1 ? 0 : PAGE1_SIZE + (page - 2) * PAGEN_SIZE
}
function limitFor(page: number): number {
  return page <= 1 ? PAGE1_SIZE : PAGEN_SIZE
}

// ─── Query detection ──────────────────────────────────────────────────────────

function detectISBN(query: string): string | null {
  const stripped = query.replace(/^isbn[:\s]*/i, '').trim()
  const digits = stripped.replace(/[\s\-]/g, '').toUpperCase()
  if ((digits.length === 10 || digits.length === 13) && /^[\dX]+$/.test(digits)) return digits
  return null
}

function looksLikeAuthorName(query: string): boolean {
  const words = query.trim().split(/\s+/)
  if (words.length !== 2) return false
  return words.every((w) => w.length >= 2 && /^[A-ZÁÉÍÓÚÜÖÄ][a-záéíóúüöäß]+$/.test(w))
}

// ─── ISBN + author helpers ────────────────────────────────────────────────────

function isbn10to13(isbn10: string): string {
  const base = '978' + isbn10.replace(/[^\dX]/gi, '').slice(0, 9)
  let sum = 0
  for (let i = 0; i < 12; i++) sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3)
  return base + ((10 - (sum % 10)) % 10)
}

function firstIsbn13(isbns: string[] | undefined): string | null {
  if (!isbns) return null
  for (const isbn of isbns) {
    const d = isbn.replace(/[^\dX]/gi, '')
    if (d.length === 13) return d
    if (d.length === 10 && /^\d{9}[\dX]$/i.test(d)) return isbn10to13(d)
  }
  return null
}

function normalizeAuthorName(name: string): string {
  if (!name) return name
  const commaIdx = name.indexOf(',')
  if (commaIdx === -1) return name
  const last = name.slice(0, commaIdx).trim()
  const first = name.slice(commaIdx + 1).trim()
  return first ? `${first} ${last}` : last
}

// ─── Cover helpers ────────────────────────────────────────────────────────────

function cleanGoogleCover(url: string): string {
  return url.replace(/^http:/, 'https:').replace(/zoom=\d+/, 'zoom=3')
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
}

// ─── Dedup ────────────────────────────────────────────────────────────────────

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

function dedupKey(s: BookSuggestion): string {
  if (s.isbn13) return `isbn:${s.isbn13}`
  return `${normalizeKey(s.title)}|||${normalizeKey(normalizeAuthorName(s.author))}`
}

function mergeSuggestion(a: BookSuggestion, b: BookSuggestion): BookSuggestion {
  return {
    title: a.title || b.title,
    author: a.author || b.author,
    cover_url: a.cover_url ?? b.cover_url,
    isbn13: a.isbn13 ?? b.isbn13,
    description: a.description ?? b.description,
    pageCount: a.pageCount ?? b.pageCount,
    publishedDate: a.publishedDate ?? b.publishedDate,
    publisher: a.publisher ?? b.publisher,
    subjects: (a.subjects && a.subjects.length > 0) ? a.subjects : b.subjects,
  }
}

/** Dedup while preserving incoming (relevance) order; later dupes enrich earlier ones. */
function dedupPreserveOrder(items: BookSuggestion[]): BookSuggestion[] {
  const seen = new Map<string, number>()
  const out: BookSuggestion[] = []
  for (const s of items) {
    if (!s.title) continue
    const key = dedupKey(s)
    const idx = seen.get(key)
    if (idx === undefined) {
      seen.set(key, out.length)
      out.push(s)
    } else {
      out[idx] = mergeSuggestion(out[idx], s)
    }
  }
  return out
}

// ─── Google Books (relevance spine) ───────────────────────────────────────────

interface GBVolumeInfo {
  title?: string
  authors?: string[]
  description?: string
  pageCount?: number
  publishedDate?: string
  publisher?: string
  categories?: string[]
  imageLinks?: { thumbnail?: string; smallThumbnail?: string }
  industryIdentifiers?: Array<{ type: string; identifier: string }>
}

function gbInfoToSuggestion(info: GBVolumeInfo): BookSuggestion | null {
  if (!info.title) return null
  const ids = info.industryIdentifiers ?? []
  const isbn13Entry = ids.find((id) => id.type === 'ISBN_13')
  const isbn10Entry = ids.find((id) => id.type === 'ISBN_10')
  const isbn13 = isbn13Entry?.identifier ?? (isbn10Entry ? isbn10to13(isbn10Entry.identifier) : null)

  // Only use a real cover GB actually has. ISBN-constructed URLs 404 too often;
  // covers for cover-less results are filled in by enrichment on save.
  const rawCover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail
  const cover_url = rawCover ? cleanGoogleCover(rawCover) : undefined

  return {
    title: info.title,
    author: normalizeAuthorName(info.authors?.[0] ?? ''),
    cover_url,
    isbn13,
    description: info.description ? stripHtml(info.description) : null,
    pageCount: info.pageCount ?? null,
    publishedDate: info.publishedDate ?? null,
    publisher: info.publisher ?? null,
    subjects: (info.categories ?? []).slice(0, 8),
  }
}

async function fetchGoogleBooks(
  query: string, startIndex: number, limit: number, signal: AbortSignal,
): Promise<BookSuggestion[]> {
  try {
    const url = gbUrl({
      q: query,
      startIndex: String(startIndex),
      maxResults: String(limit),
      printType: 'books',
      orderBy: 'relevance',
    })
    const res = await fetch(url, { signal })
    if (!res.ok) return []
    const data = await res.json() as { items?: Array<{ volumeInfo?: GBVolumeInfo }> }
    return (data.items ?? [])
      .map((i) => i.volumeInfo ? gbInfoToSuggestion(i.volumeInfo) : null)
      .filter((s): s is BookSuggestion => s !== null)
  } catch {
    return []
  }
}

// ─── Open Library (parallel + resilient fallback) ─────────────────────────────

interface OLDoc {
  title?: string
  author_name?: string[]
  cover_i?: number
  cover_edition_key?: string
  isbn?: string[]
  first_publish_year?: number
  publisher?: string[]
  number_of_pages_median?: number
  subject?: string[]
}

function olDocToSuggestion(doc: OLDoc): BookSuggestion | null {
  if (!doc.title) return null
  const isbn13 = firstIsbn13(doc.isbn)
  // Only real covers (cover_i / edition key). No ISBN-guessed URLs — they 404.
  let cover_url: string | undefined
  if (doc.cover_i) cover_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
  else if (doc.cover_edition_key) cover_url = `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-M.jpg`

  return {
    title: doc.title,
    author: normalizeAuthorName(doc.author_name?.[0] ?? ''),
    cover_url,
    isbn13,
    description: null,
    pageCount: doc.number_of_pages_median ?? null,
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
    publisher: doc.publisher?.[0] ?? null,
    subjects: (doc.subject ?? []).slice(0, 8),
  }
}

const OL_FIELDS = 'title,author_name,cover_i,cover_edition_key,isbn,first_publish_year,publisher,number_of_pages_median,subject'

async function fetchOpenLibrary(
  query: string, offset: number, limit: number, signal: AbortSignal,
): Promise<{ results: BookSuggestion[]; numFound: number }> {
  try {
    const params = new URLSearchParams({ q: query, fields: OL_FIELDS, limit: String(limit), offset: String(offset) })
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, { signal })
    if (!res.ok) return { results: [], numFound: 0 }
    const data = await res.json() as { docs?: OLDoc[]; numFound?: number }
    const results = (data.docs ?? [])
      .map(olDocToSuggestion)
      .filter((s): s is BookSuggestion => s !== null)
    return { results, numFound: data.numFound ?? 0 }
  } catch {
    return { results: [], numFound: 0 }
  }
}

// ─── DNB (German coverage, page 1 only) ───────────────────────────────────────

async function fetchDNB(query: string, signal: AbortSignal): Promise<BookSuggestion[]> {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal })
    if (!res.ok) return []
    const data = await res.json() as { results?: Array<{ title: string; author: string; cover_url?: string; isbn?: string }> }
    return (data.results ?? []).map((r) => ({
      title: r.title,
      author: normalizeAuthorName(r.author),
      cover_url: r.cover_url,
      isbn13: r.isbn ? firstIsbn13([r.isbn]) : null,
      description: null,
      pageCount: null,
      publishedDate: null,
      publisher: null,
      subjects: [],
    }))
  } catch {
    return []
  }
}

// ─── ISBN single lookup (client-side GB + OL) ─────────────────────────────────

async function fetchByISBN(isbn: string, signal: AbortSignal): Promise<BookSuggestion[]> {
  const [gb, ol] = await Promise.allSettled([
    fetchGoogleBooks(`isbn:${isbn}`, 0, 3, signal),
    fetchOpenLibrary(`isbn:${isbn}`, 0, 3, signal),
  ])
  const merged = dedupPreserveOrder([
    ...(gb.status === 'fulfilled' ? gb.value : []),
    ...(ol.status === 'fulfilled' ? ol.value.results : []),
  ])
  merged.sort((a, b) => (b.cover_url ? 1 : 0) - (a.cover_url ? 1 : 0))
  return merged.slice(0, 3)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Paged search for the search-first add flow.
 *
 * GB free-text ranking is the spine; OL runs in parallel (fills gaps and covers,
 * and keeps search working if GB is rate-limited). DNB is merged on page 1 only.
 * The relevance order is preserved — no covers-first reorder — so it reads like
 * a search engine. Never throws.
 */
export async function searchBooksPage(query: string, page = 1): Promise<SearchPage> {
  const q = query.trim()
  if (q.length < 2) return { results: [], hasMore: false }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8_000)

  try {
    const isbn = detectISBN(q)
    if (isbn) {
      const results = await fetchByISBN(isbn, controller.signal)
      return { results, hasMore: false }
    }

    const startIndex = startIndexFor(page)
    const limit = limitFor(page)
    const isAuthor = looksLikeAuthorName(q)
    const mergeDNB = page === 1 && !isAuthor

    const [gb, ol, dnb] = await Promise.allSettled([
      fetchGoogleBooks(q, startIndex, limit, controller.signal),
      fetchOpenLibrary(q, startIndex, limit, controller.signal),
      mergeDNB ? fetchDNB(q, controller.signal) : Promise.resolve([] as BookSuggestion[]),
    ])

    const gbResults = gb.status === 'fulfilled' ? gb.value : []
    const olData = ol.status === 'fulfilled' ? ol.value : { results: [], numFound: 0 }
    const dnbResults = dnb.status === 'fulfilled' ? dnb.value : []

    // GB first (relevance), then OL, then DNB; dedup preserves that order.
    const results = dedupPreserveOrder([...gbResults, ...olData.results, ...dnbResults])

    const hasMore = gbResults.length >= limit || (startIndex + olData.results.length) < olData.numFound
    return { results, hasMore }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Single-shot search returning a flat list — used outside the add flow
 * (e.g. the book detail page's metadata lookup). Never throws.
 */
export async function searchBooks(query: string, maxResults = 8): Promise<BookSuggestion[]> {
  const { results } = await searchBooksPage(query, 1)
  return results.slice(0, maxResults)
}
