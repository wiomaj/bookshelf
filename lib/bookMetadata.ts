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
 * Returns `undefined` when no image links are present.
 */
export function googleCoverFromResponse(data: unknown): string | undefined {
  const items = (data as Record<string, unknown>)?.items
  if (!Array.isArray(items) || items.length === 0) return undefined
  const links = (items[0] as any)?.volumeInfo?.imageLinks as
    | Record<string, string>
    | undefined
  if (!links) return undefined
  const raw =
    links.extraLarge ?? links.large ?? links.medium ?? links.thumbnail
  return raw ? normaliseGoogleCover(raw) : undefined
}

// ─── ISBN Lookup ──────────────────────────────────────────────────────────────

/**
 * Look up a book by ISBN-13 or ISBN-10 using a two-source strategy:
 *
 *   1. Google Books  (`q=isbn:{isbn}`)           — primary source for all fields
 *   2. OpenLibrary Books API (`/api/books`)       — cover + metadata fallback
 *
 * Both sources are queried only as needed:
 *   - If Google Books returns a cover, OpenLibrary is never called.
 *   - If Google Books has metadata but no cover, only the cover is pulled from OL.
 *   - If Google Books has no result at all, OL is used for everything.
 *
 * Returns `null` when neither source can identify the book.
 * Throws on unrecoverable network failure (caller should display error state).
 *
 * Dev-only `console.debug` lines log the cover resolution path so you can
 * verify the correct source is being used without touching production output.
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
      console.debug('[bookMetadata] fetchBookByISBN — Google Books fetch failed, trying OpenLibrary')
    }
  }

  // ── Step 2: OpenLibrary fallback ────────────────────────────────────────────
  // Called when we're missing a cover or missing all metadata.
  if (!cover_url || !title) {
    try {
      const olRes = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&jscmd=data&format=json`
      )
      if (olRes.ok) {
        const olData = await olRes.json()
        // The response is keyed by "ISBN:{isbn}"
        const olBook = olData[`ISBN:${isbn}`] as Record<string, unknown> | undefined

        if (olBook) {
          // Fill in metadata only if Google Books didn't return it
          if (!title && olBook.title)
            title = olBook.title as string
          if (!author) {
            const authors = olBook.authors as Array<{ name: string }> | undefined
            if (authors?.[0]?.name) author = authors[0].name
          }
          // Fill in cover only if Google Books didn't provide one
          if (!cover_url) {
            const olCover = olBook.cover as
              | { large?: string; medium?: string; small?: string }
              | undefined
            const raw = olCover?.large ?? olCover?.medium ?? olCover?.small
            if (raw) cover_url = raw
          }
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.debug('[bookMetadata] fetchBookByISBN — OpenLibrary fallback:', {
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
