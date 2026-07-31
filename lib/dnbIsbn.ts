/**
 * lib/dnbIsbn.ts
 *
 * Shared server-side ISBN lookup against the Deutsche Nationalbibliothek (DNB).
 *
 * DNB is the catalogue of record for German, Austrian and Swiss books, most of
 * which Google Books and Open Library either miss entirely or hold without a
 * title. It is used as the last-resort fallback by BOTH ISBN entry points —
 * /api/books/search (which backs typed ISBN search and the barcode scanner)
 * and /api/isbn — so a scan is never worse off than a typed search.
 *
 * DNB has no cover images, so a title+author cover lookup on Google Books runs
 * afterwards.
 */

import { gbUrl } from '@/lib/gbUrl'
import { fetchWithRetry } from '@/lib/serverFetch'
import { cleanDnbTitle, stripCreatorRole, normaliseCreator } from '@/lib/dnbUtils'
import { isbnCandidates } from '@/lib/isbn'

export interface DnbBook {
  title: string
  author: string
  cover_url?: string
  publishedYear?: number
  publisher?: string
}

/** Extract text content of a Dublin Core element from SRU XML. */
function dcField(xml: string, tag: string): string | undefined {
  const m = new RegExp(`<dc:${tag}[^>]*>([^<]+)</dc:${tag}>`, 'i').exec(xml)
  return m?.[1]?.trim()
}

/**
 * Cover fallback: Google Books search by title + author.
 * Uses only the leading words of each so a long subtitle or a multi-author
 * credit does not over-constrain the query into zero results.
 */
export async function gbCoverByTitleAuthor(
  title: string,
  author: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  if (!title || !author) return undefined
  try {
    const authorHint = author.split(/\s+/).slice(0, 2).join(' ')
    const titleHint = title.split(/\s+/).slice(0, 4).join(' ')
    const q = `intitle:"${titleHint}" inauthor:"${authorHint}"`
    const res = await fetchWithRetry(gbUrl({ q, maxResults: '1' }), {
      next: { revalidate: 86400 },
      ...(signal ? { signal } : {}),
    })
    if (!res.ok) return undefined
    const data = await res.json() as { items?: Array<{ volumeInfo?: {
      imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    } }> }
    const links = data.items?.[0]?.volumeInfo?.imageLinks
    const raw = links?.thumbnail ?? links?.smallThumbnail
    return raw ? raw.replace(/^http:/, 'https:').replace(/zoom=\d/, 'zoom=1') : undefined
  } catch (err) {
    console.error('[dnb] GB title+author cover fetch failed:', err)
    return undefined
  }
}

/** One SRU searchRetrieve call for a single ISBN form. Returns null when unfound. */
async function queryDnb(isbn: string, signal?: AbortSignal): Promise<DnbBook | null> {
  const params = new URLSearchParams({
    operation: 'searchRetrieve',
    version: '1.1',
    query: `isbn=${isbn}`,
    maximumRecords: '3',
    recordSchema: 'oai_dc',
  })
  const res = await fetchWithRetry(`https://services.dnb.de/sru/dnb?${params}`, {
    next: { revalidate: 3600 },
    headers: { Accept: 'application/xml, text/xml' },
    ...(signal ? { signal } : {}),
  })
  if (!res.ok) return null

  const xml = await res.text()

  const numRecords = /<numberOfRecords>(\d+)<\/numberOfRecords>/.exec(xml)?.[1]
  if (!numRecords || numRecords === '0') return null

  const rawTitle = dcField(xml, 'title')
  if (!rawTitle) return null
  const title = cleanDnbTitle(rawTitle)
  if (!title) return null

  const creatorRaw = dcField(xml, 'creator')
  // Strip role annotations (e.g. [Illustrator]) before inverting name order
  const author = creatorRaw ? normaliseCreator(stripCreatorRole(creatorRaw)) : ''

  const dateRaw = dcField(xml, 'date')
  const yearMatch = dateRaw?.match(/\b(\d{4})\b/)
  const publishedYear = yearMatch ? parseInt(yearMatch[1]) : undefined

  return { title, author, publishedYear, publisher: dcField(xml, 'publisher') }
}

/**
 * Look a book up in DNB by ISBN, trying both the ISBN-13 and ISBN-10 forms —
 * older German titles are only indexed under the ISBN-10 actually printed on
 * them, so a single-form query silently misses them.
 *
 * `withCover` adds a Google Books title+author cover lookup (one extra request).
 * Returns null when DNB has no record. Never throws.
 */
export async function fetchDnbByIsbn(
  isbn: string,
  { withCover = true, signal }: { withCover?: boolean; signal?: AbortSignal } = {},
): Promise<DnbBook | null> {
  const candidates = isbnCandidates(isbn)
  if (candidates.length === 0) return null

  for (const candidate of candidates) {
    try {
      const book = await queryDnb(candidate, signal)
      if (!book) continue
      if (withCover && book.author) {
        book.cover_url = await gbCoverByTitleAuthor(book.title, book.author, signal)
      }
      return book
    } catch (err) {
      console.error('[dnb] ISBN lookup failed:', err)
    }
  }

  return null
}
