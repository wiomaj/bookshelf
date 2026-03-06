/**
 * lib/search/adapters/openLibrary.ts
 *
 * Fetches results from the Open Library Search API and normalises them
 * into the shared BookSearchResult model.
 *
 * Docs: https://openlibrary.org/dev/docs/api#anchor_searchapi
 */

import { normalizeText, normalizeAuthor, expandUmlauts } from '../normalize'
import { buildOpenLibraryParams } from '../queryAnalysis'
import type { QueryAnalysis, BookSearchResult } from '../types'

const BASE_URL = 'https://openlibrary.org/search.json'
const COVER_BASE = 'https://covers.openlibrary.org/b'
const LIMIT = 20

// ── Raw API types ─────────────────────────────────────────────────────────────

interface OLDoc {
  key: string                     // "/works/OL12345W"
  title?: string
  subtitle?: string
  author_name?: string[]
  author_key?: string[]
  first_publish_year?: number
  publisher?: string[]
  isbn?: string[]
  cover_i?: number                // cover ID for covers.openlibrary.org
  language?: string[]
  number_of_pages_median?: number
  subject?: string[]
  edition_count?: number
}

interface OLResponse {
  numFound?: number
  docs?: OLDoc[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function splitISBNs(isbns: string[]): { isbn10: string[]; isbn13: string[] } {
  const isbn10 = isbns.filter((s) => s.replace(/[- ]/g, '').length === 10)
  const isbn13 = isbns.filter((s) => s.replace(/[- ]/g, '').length === 13)
  return { isbn10, isbn13 }
}

function coverUrl(coverId?: number): string | undefined {
  if (!coverId) return undefined
  return `${COVER_BASE}/id/${coverId}-M.jpg`
}

function primaryPublisher(publishers?: string[]): string | undefined {
  if (!publishers?.length) return undefined
  // Use the shortest publisher name as the primary (avoids "Published by Penguin, New York" noise)
  return publishers.reduce((a, b) => (a.length <= b.length ? a : b))
}

// ── Normaliser ────────────────────────────────────────────────────────────────

function normaliseDoc(doc: OLDoc, likelyGerman: boolean): BookSearchResult | null {
  if (!doc.title) return null

  const title = doc.title
  const subtitle = doc.subtitle
  const authors = doc.author_name ?? []
  const isbns = doc.isbn ?? []
  const { isbn10, isbn13 } = splitISBNs(isbns)

  const normalTitle = normalizeText(likelyGerman ? expandUmlauts(title) : title)
  const normalSubtitle = subtitle
    ? normalizeText(likelyGerman ? expandUmlauts(subtitle) : subtitle)
    : undefined
  const normalAuthors = authors.map(normalizeAuthor)

  // Work key — strip leading slash for consistent format
  const workKey = doc.key?.startsWith('/works/') ? doc.key : undefined

  const primaryAuthor = normalAuthors[0] ?? ''
  const canonicalGroupKey = primaryAuthor
    ? `${normalTitle}::${primaryAuthor}`
    : normalTitle

  // Open Library stores language codes like ["eng", "ger"]
  const language = doc.language?.length ? doc.language : undefined

  return {
    id: `openlibrary:${doc.key}`,
    source: 'openlibrary',
    sourceIds: { openlibrary: doc.key },
    title,
    subtitle,
    authors,
    language,
    publishedYear: doc.first_publish_year,
    publisher: primaryPublisher(doc.publisher),
    isbn10: isbn10.length ? isbn10 : undefined,
    isbn13: isbn13.length ? isbn13 : undefined,
    pageCount: doc.number_of_pages_median,
    coverImageUrl: coverUrl(doc.cover_i),
    categories: doc.subject?.slice(0, 5),
    normalizedTitle: normalTitle,
    normalizedSubtitle: normalSubtitle,
    normalizedAuthors: normalAuthors,
    workKey,
    canonicalGroupKey,
    score: 0,
    confidence: 'weak',
    _raw: doc,
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Query the Open Library Search API and return normalised results.
 * Never throws — returns [] on network or parse errors.
 */
export async function fetchOpenLibrary(
  analysis: QueryAnalysis,
  signal?: AbortSignal
): Promise<BookSearchResult[]> {
  const fieldParams = buildOpenLibraryParams(analysis)

  const params = new URLSearchParams({
    limit: String(LIMIT),
    fields: [
      'key', 'title', 'subtitle', 'author_name', 'author_key',
      'first_publish_year', 'publisher', 'isbn', 'cover_i',
      'language', 'number_of_pages_median', 'subject', 'edition_count',
    ].join(','),
  })

  if (fieldParams.title) params.set('title', fieldParams.title)
  if (fieldParams.author) params.set('author', fieldParams.author)
  if (fieldParams.q) params.set('q', fieldParams.q)

  const url = `${BASE_URL}?${params}`

  try {
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    } as RequestInit)

    if (!res.ok) {
      console.warn(`[openLibrary] HTTP ${res.status} — q: ${JSON.stringify(fieldParams)}`)
      return []
    }

    const data: OLResponse = await res.json()
    const docs = data.docs ?? []

    return docs
      .map((d) => normaliseDoc(d, analysis.likelyGerman))
      .filter((r): r is BookSearchResult => r !== null)
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') {
      console.warn('[openLibrary] fetch error:', err)
    }
    return []
  }
}
