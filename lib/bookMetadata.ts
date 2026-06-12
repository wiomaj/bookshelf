/**
 * Shared book-metadata utilities used by ALL add / scan flows.
 *
 * Single source of truth for:
 *   - Google Books cover URL normalisation
 *   - ISBN → book lookup with OpenLibrary fallback for covers
 */

export type BookSuggestion = {
  title: string
  author: string
  cover_url?: string
}

// ─── URL Normalisation ────────────────────────────────────────────────────────

/**
 * Normalise a raw Google Books image URL to a high-resolution https version.
 *
 * Google Books thumbnails default to a low-res 128px image. The undocumented
 * `zoom=0` + `fife=w600` parameters unlock the full-size cover scan.
 */
export function normaliseGoogleCover(raw: string): string {
  return raw
    .replace('http:', 'https:')
    .replace(/zoom=\d+/, 'zoom=0')
    .replace(/&fife=[^&]*/g, '') + '&fife=w600'
}

// ─── Response Parsers ─────────────────────────────────────────────────────────

/**
 * Extract the best available cover URL from a parsed Google Books API response.
 * Prefers higher-resolution variants (extraLarge > large > medium > thumbnail).
 * Scans ALL returned items (not just the first) because some editions lack
 * imageLinks while a later result for the same title has one.
 * Returns `undefined` when no image links are present in any item.
 */
export function googleCoverFromResponse(data: unknown): string | undefined {
  const items = (data as Record<string, unknown>)?.items
  if (!Array.isArray(items) || items.length === 0) return undefined
  for (const item of items) {
    const links = (item as any)?.volumeInfo?.imageLinks as
      | Record<string, string>
      | undefined
    if (!links) continue
    const raw =
      links.extraLarge ?? links.large ?? links.medium ?? links.thumbnail
    if (raw) return normaliseGoogleCover(raw)
  }
  return undefined
}

/**
 * Build a cover URL from an OpenLibrary search result doc.
 * Prefers cover_i (numeric ID) → cover_edition_key (OLID) → first ISBN.
 * These are the same cover sources used by the manual title-search flow.
 */
function olCoverFromDoc(doc: any): string | undefined {
  if (doc.cover_i) {
    return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
  }
  if (doc.cover_edition_key) {
    return `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`
  }
  if (doc.isbn?.[0]) {
    return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`
  }
  return undefined
}

// ─── ISBN Lookup ──────────────────────────────────────────────────────────────

/**
 * Look up a book by ISBN-13 or ISBN-10 using a two-source strategy:
 *
 *   1. Google Books  (`q=isbn:{isbn}`)         — primary: title, author, cover
 *   2. OpenLibrary Search API (`/search.json`) — cover + metadata fallback
 *
 * The OpenLibrary fallback uses the same Search API endpoint as the manual
 * title-search flow (not the Books API), which returns `cover_i` — a reliable
 * numeric cover ID that works for the vast majority of books regardless of
 * which edition ISBN was scanned.
 *
 * Both sources are queried only as needed:
 *   - If Google Books returns a cover, OpenLibrary is never called.
 *   - If Google Books has metadata but no cover, only cover is pulled from OL.
 *   - If Google Books has no result at all, OL provides everything.
 *
 * Returns `null` when neither source can identify the book.
 * Throws on unrecoverable network failure (caller should show an error state).
 */
export async function fetchBookByISBN(
  isbn: string
): Promise<BookSuggestion | null> {
  let title = ''
  let author = ''
  let cover_url: string | undefined

  // ── Step 1: Google Books ────────────────────────────────────────────────────
  try {
    const gbRes = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1`
    )
    if (gbRes.ok) {
      const gbData = await gbRes.json()
      const item = gbData?.items?.[0]
      if (item) {
        const info = item.volumeInfo
        title = (info?.title as string) ?? ''
        author = (info?.authors as string[])?.[0] ?? ''
        cover_url = googleCoverFromResponse(gbData)
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug('[bookMetadata] fetchBookByISBN — Google Books:', {
        isbn,
        found: !!title,
        coverFound: !!cover_url,
      })
    }
  } catch {
    // Google Books unreachable — fall through to OpenLibrary
    if (process.env.NODE_ENV === 'development') {
      console.debug('[bookMetadata] fetchBookByISBN — Google Books failed, trying OpenLibrary')
    }
  }

  // ── Step 2: OpenLibrary Search API fallback ─────────────────────────────────
  // Use the same /search.json endpoint as the manual title-search flow.
  // Querying by ISBN is precise and the response includes cover_i which is far
  // more reliably populated than the cover field in the Books API (/api/books).
  if (!cover_url || !title) {
    try {
      const olRes = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(isbn)}&fields=title,author_name,cover_i,cover_edition_key,isbn&limit=1`
      )
      if (olRes.ok) {
        const olData = await olRes.json()
        const doc = olData.docs?.[0] as any

        if (doc) {
          if (!title && doc.title)             title  = doc.title as string
          if (!author && doc.author_name?.[0]) author = doc.author_name[0] as string
          if (!cover_url) cover_url = olCoverFromDoc(doc)
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.debug('[bookMetadata] fetchBookByISBN — OpenLibrary search fallback:', {
          isbn,
          titleAfterOL: title || '(empty)',
          coverFoundAfterOL: !!cover_url,
        })
      }
    } catch {
      // OpenLibrary also unreachable — proceed with whatever we have
    }
  }

  // ── Step 3: Final result ────────────────────────────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    console.debug('[bookMetadata] fetchBookByISBN — final result:', {
      isbn,
      title: title || '(empty)',
      author: author || '(empty)',
      cover_url: cover_url ?? '(none)',
    })
  }

  // Signal "not found" only when we got absolutely nothing from either source
  if (!title && !author && !cover_url) return null

  return { title, author, cover_url }
}

// ─── Server-backed full metadata lookup ──────────────────────────────────────

import type { BookMetadata } from '@/types/book'

/**
 * Fetch full metadata for a single ISBN via the /api/books/metadata route.
 * Results are cached in Supabase for 90 days — repeat calls are instant.
 * Returns null when the ISBN cannot be found or the request fails.
 */
export async function fetchBookMetadata(isbn: string): Promise<BookMetadata | null> {
  try {
    const res = await fetch(`/api/books/metadata?isbn=${encodeURIComponent(isbn)}`)
    if (!res.ok) return null
    const data = await res.json() as { result: BookMetadata | null }
    return data.result ?? null
  } catch {
    return null
  }
}

// ─── Cover-only search by title + author ──────────────────────────────────────

/**
 * Search for a cover image using title + author across multiple sources.
 *
 * Strategy (two sequential phases to avoid returning the wrong book's cover):
 *
 *   Phase 1 — Precise (title + author, both sources in parallel):
 *     1. Google Books  intitle:"…" inauthor:"…"
 *     2. OpenLibrary   title + author
 *   → If either finds a cover, return it immediately.
 *
 *   Phase 2 — Broad fallback (title only, both sources in parallel).
 *     Only reached when the author is unknown OR phase 1 found nothing.
 *     3. Google Books  intitle:"…"
 *     4. OpenLibrary   title only
 *
 * Running broad searches concurrently with precise ones (the old approach)
 * caused fast title-only results to win the race and return a cover for a
 * completely different book with the same title (e.g. Miéville's "Kraken"
 * appearing on Svenja Beller's "Kraken").
 */
export async function fetchCoverByTitleAuthor(
  title: string,
  author: string
): Promise<string | undefined> {
  const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

  const googleBooks = async (q: string): Promise<string | undefined> => {
    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`
      )
      if (!res.ok) return undefined
      return googleCoverFromResponse(await res.json())
    } catch { return undefined }
  }

  const openLibrary = async (params: Record<string, string>): Promise<string | undefined> => {
    try {
      const qs = new URLSearchParams({ ...params, fields: 'cover_i,cover_edition_key,isbn', limit: '1' })
      const res = await fetch(`https://openlibrary.org/search.json?${qs}`)
      if (!res.ok) return undefined
      const data = await res.json()
      return olCoverFromDoc(data.docs?.[0])
    } catch { return undefined }
  }

  // Returns the first non-undefined cover from a set of concurrent searches
  const firstOf = async (promises: Promise<string | undefined>[]): Promise<string | undefined> => {
    try {
      return await Promise.any(promises.map(async p => {
        const r = await p
        if (!r) throw new Error('no cover')
        return r
      }))
    } catch { return undefined }
  }

  // Phase 1: precise title + author (skip if no author)
  if (author) {
    const precise = await withTimeout(firstOf([
      googleBooks(`intitle:"${title}" inauthor:"${author}"`),
      openLibrary({ title, author }),
    ]), 4000).catch(() => undefined)
    if (precise) return precise
  }

  // Phase 2: broad title-only fallback
  return withTimeout(firstOf([
    googleBooks(`intitle:"${title}"`),
    openLibrary({ title }),
  ]), 4000).catch(() => undefined)
}
