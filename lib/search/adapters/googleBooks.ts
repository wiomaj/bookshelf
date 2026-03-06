/**
 * lib/search/adapters/googleBooks.ts
 *
 * Fetches results from the Google Books Volumes API and normalises them
 * into the shared BookSearchResult model.
 *
 * Docs: https://developers.google.com/books/docs/v1/reference/volumes/list
 */

import { normalizeText, normalizeAuthor, expandUmlauts } from '../normalize'
import { buildProviderQuery } from '../queryAnalysis'
import type { QueryAnalysis } from '../types'
import type { BookSearchResult } from '../types'

const BASE_URL = 'https://www.googleapis.com/books/v1/volumes'
const MAX_RESULTS = 20

// ── Raw API types ─────────────────────────────────────────────────────────────

interface GBImageLinks {
  smallThumbnail?: string
  thumbnail?: string
}

interface GBVolumeInfo {
  title?: string
  subtitle?: string
  authors?: string[]
  publisher?: string
  publishedDate?: string
  description?: string
  industryIdentifiers?: Array<{ type: string; identifier: string }>
  pageCount?: number
  categories?: string[]
  imageLinks?: GBImageLinks
  language?: string
}

interface GBVolume {
  id: string
  volumeInfo?: GBVolumeInfo
}

interface GBResponse {
  totalItems?: number
  items?: GBVolume[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractYear(date?: string): number | undefined {
  if (!date) return undefined
  const m = date.match(/^(\d{4})/)
  return m ? parseInt(m[1], 10) : undefined
}

function extractISBNs(
  identifiers?: GBVolumeInfo['industryIdentifiers']
): { isbn10: string[]; isbn13: string[] } {
  const isbn10: string[] = []
  const isbn13: string[] = []
  for (const id of identifiers ?? []) {
    if (id.type === 'ISBN_13') isbn13.push(id.identifier)
    if (id.type === 'ISBN_10') isbn10.push(id.identifier)
  }
  return { isbn10, isbn13 }
}

/** Prefer the larger thumbnail; strip curl parameters that force small sizes. */
function bestCoverUrl(links?: GBImageLinks): string | undefined {
  const url = links?.thumbnail ?? links?.smallThumbnail
  if (!url) return undefined
  // Upgrade to HTTPS and request a slightly larger image (zoom=1)
  return url.replace(/^http:/, 'https:').replace(/&zoom=\d/, '').replace(/zoom=\d&/, '')
}

// ── Normaliser ────────────────────────────────────────────────────────────────

function normaliseVolume(vol: GBVolume, likelyGerman: boolean): BookSearchResult | null {
  const info = vol.volumeInfo
  if (!info?.title) return null

  const title = info.title
  const subtitle = info.subtitle
  const authors = info.authors ?? []
  const { isbn10, isbn13 } = extractISBNs(info.industryIdentifiers)

  const normalTitle = normalizeText(likelyGerman ? expandUmlauts(title) : title)
  const normalSubtitle = subtitle
    ? normalizeText(likelyGerman ? expandUmlauts(subtitle) : subtitle)
    : undefined
  const normalAuthors = authors.map(normalizeAuthor)

  const primaryAuthor = normalAuthors[0] ?? ''
  const canonicalGroupKey = primaryAuthor
    ? `${normalTitle}::${primaryAuthor}`
    : normalTitle

  const language = info.language ? [info.language] : undefined

  return {
    id: `googlebooks:${vol.id}`,
    source: 'googlebooks',
    sourceIds: { googlebooks: vol.id },
    title,
    subtitle,
    authors,
    language,
    publishedYear: extractYear(info.publishedDate),
    publisher: info.publisher,
    isbn10: isbn10.length ? isbn10 : undefined,
    isbn13: isbn13.length ? isbn13 : undefined,
    pageCount: info.pageCount,
    description: info.description,
    coverImageUrl: bestCoverUrl(info.imageLinks),
    categories: info.categories,
    normalizedTitle: normalTitle,
    normalizedSubtitle: normalSubtitle,
    normalizedAuthors: normalAuthors,
    canonicalGroupKey,
    score: 0,
    confidence: 'weak',
    _raw: vol,
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Query the Google Books API and return normalised results.
 * Never throws — returns [] on network or parse errors.
 */
export async function fetchGoogleBooks(
  analysis: QueryAnalysis,
  signal?: AbortSignal
): Promise<BookSearchResult[]> {
  const q = buildProviderQuery(analysis, 'googlebooks')
  if (!q.trim()) return []

  const params = new URLSearchParams({
    q,
    maxResults: String(MAX_RESULTS),
    printType: 'books',
    langRestrict: '',
  })

  // Remove empty langRestrict so it doesn't pollute the URL
  params.delete('langRestrict')

  const url = `${BASE_URL}?${params}`

  try {
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    } as RequestInit)

    if (!res.ok) {
      console.warn(`[googleBooks] HTTP ${res.status} for query: ${q}`)
      return []
    }

    const data: GBResponse = await res.json()
    const items = data.items ?? []

    return items
      .map((v) => normaliseVolume(v, analysis.likelyGerman))
      .filter((r): r is BookSearchResult => r !== null)
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') {
      console.warn('[googleBooks] fetch error:', err)
    }
    return []
  }
}
