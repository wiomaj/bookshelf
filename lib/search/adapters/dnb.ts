/**
 * lib/search/adapters/dnb.ts
 *
 * Fetches results from the Deutsche Nationalbibliothek (DNB) SRU API
 * and normalises them into the shared BookSearchResult model.
 *
 * The DNB is queried only for German-language queries (likelyGerman === true).
 * Results are returned in MARCXML format and parsed with the DOM parser.
 *
 * Docs: https://www.dnb.de/EN/Professionell/Metadatendienste/Datenbezug/SRU/sru_node.html
 * SRU query syntax: https://www.loc.gov/standards/sru/cql/
 */

import { normalizeText, normalizeAuthor, expandUmlauts } from '../normalize'
import type { QueryAnalysis, BookSearchResult } from '../types'

const SRU_BASE = 'https://services.dnb.de/sru/dnb'
const MAX_RECORDS = 15

// ── SRU query builder ─────────────────────────────────────────────────────────

function buildDNBQuery(analysis: QueryAnalysis): string {
  const { type, titleTokens, authorTokens, raw } = analysis

  if (type === 'title+author' && titleTokens.length > 0 && authorTokens.length > 0) {
    const title = titleTokens.join(' ')
    const author = authorTokens.join(' ')
    return `tit="${title}" AND atr="${author}"`
  }

  if (type === 'author' && authorTokens.length > 0) {
    return `atr="${authorTokens.join(' ')}"`
  }

  if (type === 'title' && titleTokens.length > 0) {
    return `tit="${titleTokens.join(' ')}"`
  }

  // Fallback: keyword search across all fields
  return `all="${raw.replace(/"/g, ' ')}"`
}

// ── MARCXML parser ────────────────────────────────────────────────────────────

/**
 * Minimal MARC21 field extractor operating on raw XML text.
 * Avoids a full DOM dependency — uses regex for the SRU response structure.
 */

/** Extract all values from a MARC datafield with given tag and subfield code. */
function marcField(xml: string, tag: string, subfield: string): string[] {
  const results: string[] = []
  // Match <datafield tag="XXX" ...>…</datafield>
  const dfRegex = new RegExp(
    `<datafield[^>]+tag="${tag}"[^>]*>([\\s\\S]*?)</datafield>`,
    'g'
  )
  let dfMatch
  while ((dfMatch = dfRegex.exec(xml)) !== null) {
    const inner = dfMatch[1]
    // Match <subfield code="X">value</subfield>
    const sfRegex = new RegExp(`<subfield[^>]+code="${subfield}"[^>]*>([^<]*)</subfield>`, 'g')
    let sfMatch
    while ((sfMatch = sfRegex.exec(inner)) !== null) {
      const val = sfMatch[1].trim()
      if (val) results.push(val)
    }
  }
  return results
}

/** Extract the text of a MARC controlfield. */
function marcControl(xml: string, tag: string): string | undefined {
  const m = new RegExp(`<controlfield[^>]+tag="${tag}"[^>]*>([^<]*)</controlfield>`).exec(xml)
  return m?.[1]?.trim() || undefined
}

/** Split individual <record>…</record> elements out of a searchRetrieveResponse. */
function splitRecords(responseXml: string): string[] {
  const records: string[] = []
  const re = /<record>([\s\S]*?)<\/record>/g
  let m
  while ((m = re.exec(responseXml)) !== null) {
    records.push(m[1])
  }
  return records
}

// ── Normaliser ────────────────────────────────────────────────────────────────

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function normaliseRecord(recordXml: string): BookSearchResult | null {
  // Extract the inner <recordData> MARC XML
  const rdMatch = /<recordData[^>]*>([\s\S]*?)<\/recordData>/i.exec(recordXml)
  const marc = rdMatch ? rdMatch[1] : recordXml

  // Title: MARC 245 $a (main title) + optional $b (subtitle)
  const titleParts = marcField(marc, '245', 'a')
  if (!titleParts.length) return null
  const rawTitle = decodeXmlEntities(titleParts[0].replace(/\s*\/\s*$/, '').trim())
  const subtitleParts = marcField(marc, '245', 'b')
  const rawSubtitle = subtitleParts.length
    ? decodeXmlEntities(subtitleParts[0].replace(/\s*\/\s*$/, '').trim())
    : undefined

  // Authors: MARC 100 $a (primary) + MARC 700 $a (added entries)
  const primary = marcField(marc, '100', 'a')
  const added = marcField(marc, '700', 'a')
  const rawAuthors = [...primary, ...added].map((a) => decodeXmlEntities(a.replace(/,$/, '').trim()))

  // ISBN: MARC 020 $a
  const isbnRaw = marcField(marc, '020', 'a').map((s) => s.replace(/[^0-9X]/gi, ''))
  const isbn10 = isbnRaw.filter((s) => s.length === 10)
  const isbn13 = isbnRaw.filter((s) => s.length === 13)

  // Publisher: MARC 264 $b or 260 $b
  const pubParts = [...marcField(marc, '264', 'b'), ...marcField(marc, '260', 'b')]
  const publisher = pubParts.length
    ? decodeXmlEntities(pubParts[0].replace(/,$/, '').trim())
    : undefined

  // Year: MARC 264 $c or 260 $c or controlfield 008 chars 7-10
  const yearParts = [...marcField(marc, '264', 'c'), ...marcField(marc, '260', 'c')]
  let publishedYear: number | undefined
  for (const y of yearParts) {
    const m = y.match(/\d{4}/)
    if (m) { publishedYear = parseInt(m[0], 10); break }
  }
  if (!publishedYear) {
    const cf008 = marcControl(marc, '008')
    if (cf008 && cf008.length >= 11) {
      const y = parseInt(cf008.slice(7, 11), 10)
      if (y > 1000 && y < 2100) publishedYear = y
    }
  }

  // Language from MARC 008 chars 35-37
  const cf008 = marcControl(marc, '008')
  const langCode = cf008 && cf008.length >= 38 ? cf008.slice(35, 38).trim() : undefined
  const language = langCode ? [langCode] : undefined

  // Page count from MARC 300 $a
  const extentParts = marcField(marc, '300', 'a')
  let pageCount: number | undefined
  for (const e of extentParts) {
    const m = e.match(/(\d+)\s*(S\.|Seiten|pages|p\.)/i)
    if (m) { pageCount = parseInt(m[1], 10); break }
  }

  // DNB record ID from controlfield 001
  const recordId = marcControl(marc, '001') ?? `dnb-${Date.now()}-${Math.random()}`

  const normalTitle = normalizeText(expandUmlauts(rawTitle))
  const normalSubtitle = rawSubtitle ? normalizeText(expandUmlauts(rawSubtitle)) : undefined
  const normalAuthors = rawAuthors.map(normalizeAuthor)

  const primaryAuthor = normalAuthors[0] ?? ''
  const canonicalGroupKey = primaryAuthor
    ? `${normalTitle}::${primaryAuthor}`
    : normalTitle

  return {
    id: `dnb:${recordId}`,
    source: 'dnb',
    sourceIds: { dnb: recordId },
    title: rawTitle,
    subtitle: rawSubtitle,
    authors: rawAuthors,
    language,
    publishedYear,
    publisher,
    isbn10: isbn10.length ? isbn10 : undefined,
    isbn13: isbn13.length ? isbn13 : undefined,
    pageCount,
    normalizedTitle: normalTitle,
    normalizedSubtitle: normalSubtitle,
    normalizedAuthors: normalAuthors,
    canonicalGroupKey,
    score: 0,
    confidence: 'weak',
    _raw: recordXml,
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Query the DNB SRU endpoint and return normalised results.
 * Only called for German-language queries.
 * Never throws — returns [] on network or parse errors.
 */
export async function fetchDNB(
  analysis: QueryAnalysis,
  signal?: AbortSignal
): Promise<BookSearchResult[]> {
  // Only hit DNB for German queries
  if (!analysis.likelyGerman) return []

  const cqlQuery = buildDNBQuery(analysis)

  const params = new URLSearchParams({
    operation: 'searchRetrieve',
    version: '1.1',
    query: cqlQuery,
    maximumRecords: String(MAX_RECORDS),
    recordSchema: 'MARC21-xml',
  })

  const url = `${SRU_BASE}?${params}`

  try {
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/xml, text/xml' },
      next: { revalidate: 60 },
    } as RequestInit)

    if (!res.ok) {
      console.warn(`[dnb] HTTP ${res.status} — query: ${cqlQuery}`)
      return []
    }

    const xml = await res.text()
    const records = splitRecords(xml)

    return records
      .map(normaliseRecord)
      .filter((r): r is BookSearchResult => r !== null)
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') {
      console.warn('[dnb] fetch error:', err)
    }
    return []
  }
}
