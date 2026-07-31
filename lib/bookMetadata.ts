/**
 * Shared book-metadata utilities used by ALL add / scan flows.
 *
 * All lookups run through server API routes (/api/books/*, /api/isbn) so:
 *   - the secret Google Books API key never ships to the browser
 *   - responses are cached server-side (Supabase + Next.js data cache)
 *   - rate limiting and retries are applied in one place
 *   - the client never hits CORS or per-IP quota issues with the upstream APIs
 */

import type { BookMetadata } from '@/types/book'
import { metadataToSuggestion, normalizeAuthorName } from '@/lib/bookSearch'
import type { BookSuggestion } from '@/lib/bookSearch'

// Re-exported so scan and search callers share one suggestion type.
export type { BookSuggestion }

// ─── URL Normalisation (pure helpers, also used by tests) ─────────────────────

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

// ─── ISBN Lookup ──────────────────────────────────────────────────────────────

/**
 * Look up a book by ISBN-13 or ISBN-10 via server routes:
 *
 *   1. /api/books/search?q=isbn:… — the SAME route the search box uses, so a
 *      scan resolves through Supabase cache → Open Library + Google Books (both
 *      ISBN forms) → DNB, and returns the identical suggestion shape: published
 *      date, publisher, description and subjects included, author names
 *      normalised out of "Lastname, Firstname" order.
 *   2. /api/isbn — a second, independent DNB-backed route, used only when the
 *      search route is unreachable or comes back empty.
 *
 * Returns `null` when no source can identify the book. Never throws.
 */
export async function fetchBookByISBN(
  isbn: string
): Promise<BookSuggestion | null> {
  // ── Step 1: the shared search route (cache + OL + GB + DNB) ─────────────────
  try {
    const res = await fetch(`/api/books/search?q=isbn:${encodeURIComponent(isbn)}`)
    if (res.ok) {
      const data = await res.json() as { results?: BookMetadata[] }
      const m = data.results?.[0]
      if (m?.title) return metadataToSuggestion(m)
    }
  } catch {
    // fall through to the DNB-backed route
  }

  // ── Step 2: DNB fallback for German/Austrian/Swiss books ───────────────────
  try {
    const res = await fetch(`/api/isbn?isbn=${encodeURIComponent(isbn)}`)
    if (res.ok) {
      const data = await res.json() as {
        result: {
          title: string
          author: string
          cover_url?: string
          publishedYear?: number
          publisher?: string
        } | null
      }
      const r = data.result
      if (r?.title) {
        return {
          title: r.title,
          author: normalizeAuthorName(r.author ?? ''),
          cover_url: r.cover_url,
          isbn13: null,
          description: null,
          pageCount: null,
          publishedDate: r.publishedYear ? String(r.publishedYear) : null,
          publisher: r.publisher ?? null,
          subjects: [],
        }
      }
    }
  } catch {
    // both sources unreachable
  }

  return null
}

// ─── Server-backed full metadata lookup ──────────────────────────────────────

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
 * Search for a cover image by title + author via /api/books/cover, which runs
 * Google Books (secret key) and Open Library in parallel server-side.
 *
 * Precise title + author only — no title-only fallback, which previously
 * caused covers of unrelated books with the same title (e.g. Miéville's
 * "Kraken" appearing on Svenja Beller's "Kraken").
 *
 * Returns `undefined` when no cover is found. Never throws.
 */
export async function fetchCoverByTitleAuthor(
  title: string,
  author: string
): Promise<string | undefined> {
  if (!title || !author) return undefined
  try {
    const params = new URLSearchParams({ title, author })
    const res = await fetch(`/api/books/cover?${params}`)
    if (!res.ok) return undefined
    const data = await res.json() as { coverUrl?: string | null }
    return data.coverUrl ?? undefined
  } catch {
    return undefined
  }
}
