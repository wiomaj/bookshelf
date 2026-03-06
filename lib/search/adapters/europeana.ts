/**
 * lib/search/adapters/europeana.ts
 *
 * Fetches book records from the Europeana Search API and normalises them
 * into the shared BookSearchResult model.
 *
 * Europeana is used as a supplementary source for European (especially
 * German / French / multilingual) publications not well-covered by
 * OpenLibrary or Google Books.
 *
 * Docs: https://api.europeana.eu/console/?api=search-api
 *
 * Authentication: uses a public demo key or EUROPEANA_API_KEY env var.
 * Results with no title are silently dropped.
 */

import { normalizeText, normalizeAuthor, expandUmlauts } from '../normalize'
import type { QueryAnalysis, BookSearchResult } from '../types'

const BASE_URL = 'https://api.europeana.eu/record/v2/search.json'
const DEMO_KEY = 'api2demo'
const MAX_ROWS = 15

// ── Raw API types ─────────────────────────────────────────────────────────────

interface EuropeanaItem {
  id: string
  title?: string[]
  dcTitleLangAware?: Record<string, string[]>
  dcCreator?: string[]
  dcCreatorLangAware?: Record<string, string[]>
  dcDate?: string[]
  dcPublisher?: string[]
  dcDescription?: string[]
  dcLanguage?: string[]
  dcIdentifier?: string[]
  edmIsShownBy?: string[]
  edmPreview?: string[]
  type?: string
  provider?: string[]
  dataProvider?: string[]
}

interface EuropeanaResponse {
  success?: boolean
  itemsCount?: number
  items?: EuropeanaItem[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function firstOf(arr?: string[]): string | undefined {
  return arr?.find((s) => s.trim()) || undefined
}

function extractYear(dates?: string[]): number | undefined {
  for (const d of dates ?? []) {
    const m = d.match(/\b(\d{4})\b/)
    if (m) {
      const y = parseInt(m[1], 10)
      if (y > 1000 && y < 2100) return y
    }
  }
  return undefined
}

function extractISBNsFromIdentifiers(ids?: string[]): { isbn10: string[]; isbn13: string[] } {
  const isbn10: string[] = []
  const isbn13: string[] = []
  for (const id of ids ?? []) {
    const clean = id.replace(/[^0-9X]/gi, '')
    if (clean.length === 13) isbn13.push(clean)
    else if (clean.length === 10) isbn10.push(clean)
  }
  return { isbn10, isbn13 }
}

function bestTitle(item: EuropeanaItem): string | undefined {
  // Prefer explicit language-aware German title, else first available title
  const de = item.dcTitleLangAware?.['de']?.[0] ?? item.dcTitleLangAware?.['deu']?.[0]
  return de ?? firstOf(item.title)
}

function bestAuthors(item: EuropeanaItem): string[] {
  const explicit = item.dcCreator ?? []
  if (explicit.length > 0) return explicit
  // Some Europeana records embed creator in lang-aware map
  const deAuthors = item.dcCreatorLangAware?.['de'] ?? item.dcCreatorLangAware?.['deu'] ?? []
  if (deAuthors.length > 0) return deAuthors
  const anyAuthors = Object.values(item.dcCreatorLangAware ?? {}).flat()
  return anyAuthors
}

function bestCover(item: EuropeanaItem): string | undefined {
  return firstOf(item.edmPreview) ?? firstOf(item.edmIsShownBy)
}

// ── Normaliser ────────────────────────────────────────────────────────────────

function normaliseItem(item: EuropeanaItem, likelyGerman: boolean): BookSearchResult | null {
  const title = bestTitle(item)
  if (!title) return null

  const authors = bestAuthors(item)
  const { isbn10, isbn13 } = extractISBNsFromIdentifiers(item.dcIdentifier)

  const normalTitle = normalizeText(likelyGerman ? expandUmlauts(title) : title)
  const normalAuthors = authors.map(normalizeAuthor)

  const primaryAuthor = normalAuthors[0] ?? ''
  const canonicalGroupKey = primaryAuthor
    ? `${normalTitle}::${primaryAuthor}`
    : normalTitle

  const language = item.dcLanguage?.length ? item.dcLanguage : undefined

  const publishedYear = extractYear(item.dcDate)
  const publisher = firstOf(item.dcPublisher)
  const description = firstOf(item.dcDescription)

  return {
    id: `europeana:${item.id.replace(/^\//, '')}`,
    source: 'europeana',
    sourceIds: { europeana: item.id },
    title,
    authors,
    language,
    publishedYear,
    publisher,
    isbn10: isbn10.length ? isbn10 : undefined,
    isbn13: isbn13.length ? isbn13 : undefined,
    description,
    coverImageUrl: bestCover(item),
    normalizedTitle: normalTitle,
    normalizedAuthors: normalAuthors,
    canonicalGroupKey,
    score: 0,
    confidence: 'weak',
    _raw: item,
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Query the Europeana Search API and return normalised results.
 * Only called for German/European queries (likelyGerman === true).
 * Never throws — returns [] on network or parse errors.
 */
export async function fetchEuropeana(
  analysis: QueryAnalysis,
  signal?: AbortSignal
): Promise<BookSearchResult[]> {
  // Europeana is a supplementary source — skip for non-German queries
  if (!analysis.likelyGerman) return []

  const apiKey = process.env.EUROPEANA_API_KEY ?? DEMO_KEY

  // Build a clean query — use titleTokens + authorTokens when available
  let query: string
  if (
    analysis.type === 'title+author' &&
    analysis.titleTokens.length > 0 &&
    analysis.authorTokens.length > 0
  ) {
    query = `${analysis.titleTokens.join(' ')} ${analysis.authorTokens.join(' ')}`
  } else {
    query = analysis.raw
  }

  // Restrict to TEXT type to reduce noise from images/audio
  const params = new URLSearchParams({
    wskey: apiKey,
    query,
    qf: 'TYPE:TEXT',
    rows: String(MAX_ROWS),
    profile: 'rich',
  })

  const url = `${BASE_URL}?${params}`

  try {
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    } as RequestInit)

    if (!res.ok) {
      console.warn(`[europeana] HTTP ${res.status} — query: ${query}`)
      return []
    }

    const data: EuropeanaResponse = await res.json()
    if (!data.success || !data.items?.length) return []

    return data.items
      .map((item) => normaliseItem(item, analysis.likelyGerman))
      .filter((r): r is BookSearchResult => r !== null)
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') {
      console.warn('[europeana] fetch error:', err)
    }
    return []
  }
}
