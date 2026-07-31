/**
 * lib/bookSearch.ts
 *
 * Unified, paginated book search for the add flow.
 *
 * Search runs through the server route /api/books/search, which queries
 * Google Books (free-text, the relevance spine) + Open Library in parallel using
 * a SECRET server-side GOOGLE_BOOKS_API_KEY — the key is never shipped to the
 * browser. DNB (Deutsche Nationalbibliothek) is merged in client-side on page 1
 * for German/Austrian/Swiss coverage that GB/OL miss.
 *
 * Imported by BookForm (searchBooks) and the add page (searchBooksPage).
 */

import type { BookMetadata } from '@/types/book'

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

// ─── Author normalisation ─────────────────────────────────────────────────────

/** Invert "Lastname, Firstname" → "Firstname Lastname" (catalogue name order). */
export function normalizeAuthorName(name: string): string {
  if (!name) return name
  const commaIdx = name.indexOf(',')
  if (commaIdx === -1) return name
  const last = name.slice(0, commaIdx).trim()
  const first = name.slice(commaIdx + 1).trim()
  return first ? `${first} ${last}` : last
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

// ─── Server route (GB + OL, secret key) ───────────────────────────────────────

/**
 * Map a server BookMetadata record to the suggestion shape the add/scan forms
 * consume. Shared with the ISBN/scan path so a scanned book carries exactly the
 * same fields (published date, publisher, description…) as a searched one.
 */
export function metadataToSuggestion(m: BookMetadata): BookSuggestion {
  return {
    title: m.title,
    author: normalizeAuthorName(m.authors[0] ?? ''),
    cover_url: m.coverUrl ?? undefined,
    isbn13: m.isbn13,
    description: m.description,
    pageCount: m.pageCount,
    publishedDate: m.publishedDate,
    publisher: m.publisher,
    subjects: m.subjects,
  }
}

async function fetchServer(
  query: string, page: number, signal: AbortSignal,
): Promise<{ results: BookSuggestion[]; hasMore: boolean }> {
  try {
    const params = new URLSearchParams({ q: query, page: String(page) })
    const res = await fetch(`/api/books/search?${params}`, { signal })
    if (!res.ok) return { results: [], hasMore: false }
    const data = await res.json() as { results?: BookMetadata[]; hasMore?: boolean }
    return { results: (data.results ?? []).map(metadataToSuggestion), hasMore: !!data.hasMore }
  } catch {
    return { results: [], hasMore: false }
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
      isbn13: null,
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Paged search for the search-first add flow.
 *
 * GB free-text ranking (via the server route, secret key) is the spine; OL runs
 * alongside it server-side. DNB is merged in on page 1 only. Relevance order is
 * preserved — no covers-first reorder — so it reads like a search engine.
 * Never throws.
 */
export async function searchBooksPage(query: string, page = 1): Promise<SearchPage> {
  const q = query.trim()
  if (q.length < 2) return { results: [], hasMore: false }

  const isISBN = !!detectISBN(q)
  const isAuthor = !isISBN && looksLikeAuthorName(q)
  const mergeDNB = page === 1 && !isISBN && !isAuthor

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8_000)

  try {
    const [server, dnb] = await Promise.allSettled([
      fetchServer(q, page, controller.signal),
      mergeDNB ? fetchDNB(q, controller.signal) : Promise.resolve([] as BookSuggestion[]),
    ])

    const serverData = server.status === 'fulfilled' ? server.value : { results: [], hasMore: false }
    const dnbResults = dnb.status === 'fulfilled' ? dnb.value : []

    // Server (GB relevance + OL) is primary; DNB enriches existing or appends.
    const results = dedupPreserveOrder([...serverData.results, ...dnbResults])
    return { results, hasMore: serverData.hasMore }
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
