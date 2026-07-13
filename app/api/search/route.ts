/**
 * app/api/search/route.ts
 *
 * Server-side title search via Deutsche Nationalbibliothek (DNB).
 * DNB has comprehensive coverage of German, Austrian, and Swiss books that
 * Google Books and Open Library largely miss.
 *
 * GET /api/search?q=Geh+langsam
 * Response: { results: Array<{ title, author, cover_url?, isbn? }> }
 *
 * Strategy:
 *  1. Query DNB SRU with tit="query" (MARC21-xml format for ISBNs)
 *  2. Parse title (245a), author (100a / 700a), ISBN-13 (020a)
 *  3. Fetch cover via Google Books ISBN lookup in parallel for all results
 *  4. Return enriched results, cached for 1 hour
 */

import { NextRequest, NextResponse } from 'next/server'
import { gbUrl } from '@/lib/gbUrl'
import { checkRateLimit, clientIp } from '@/lib/rateLimit'
import { fetchWithRetry } from '@/lib/serverFetch'
import { cleanDnbTitle, stripCreatorRole, normaliseCreator } from '@/lib/dnbUtils'

export const runtime = 'nodejs'

export interface SearchResult {
  title: string
  author: string
  cover_url?: string
  isbn?: string
}

// ── MARC21-xml field extractor (regex-based, no DOM needed) ───────────────────

/** Returns the text of the first matching subfield within any matching datafield. */
function marcSubfield(xml: string, tag: string, code: string): string | undefined {
  const fieldRe = new RegExp(`<[^>]*tag="${tag}"[^>]*>([\\s\\S]*?)</[^>]*datafield>`, 'g')
  let m: RegExpExecArray | null
  while ((m = fieldRe.exec(xml)) !== null) {
    const block = m[1]
    const sf = new RegExp(`<[^>]*code="${code}"[^>]*>([^<]*)</[^>]*subfield>`).exec(block)
    if (sf) return sf[1].trim()
  }
  return undefined
}

/** Returns text of all matching subfields across all matching datafields. */
function marcSubfieldAll(xml: string, tag: string, code: string): string[] {
  const out: string[] = []
  const fieldRe = new RegExp(`<[^>]*tag="${tag}"[^>]*>([\\s\\S]*?)</[^>]*datafield>`, 'g')
  let m: RegExpExecArray | null
  while ((m = fieldRe.exec(xml)) !== null) {
    const sf = new RegExp(`<[^>]*code="${code}"[^>]*>([^<]*)</[^>]*subfield>`).exec(m[1])
    if (sf) out.push(sf[1].trim())
  }
  return out
}

// ── Cover fetchers ────────────────────────────────────────────────────────────

async function gbCoverByISBN(isbn: string): Promise<string | undefined> {
  try {
    const res = await fetchWithRetry(
      gbUrl({ q: `isbn:${isbn}`, maxResults: '1', fields: 'items(volumeInfo/imageLinks)' }),
      { next: { revalidate: 86400 } }  // cache 24h to conserve GB quota
    )
    if (!res.ok) return undefined
    const data = await res.json() as {
      items?: Array<{ volumeInfo?: { imageLinks?: { thumbnail?: string; smallThumbnail?: string } } }>
    }
    const links = data.items?.[0]?.volumeInfo?.imageLinks
    const raw = links?.thumbnail ?? links?.smallThumbnail
    return raw ? raw.replace(/^http:/, 'https:').replace(/zoom=\d/, 'zoom=1') : undefined
  } catch {
    return undefined
  }
}

/** Open Library cover by ISBN — returns 404 when no cover exists (default=false). */
async function olCoverByISBN(isbn: string): Promise<string | undefined> {
  try {
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`
    const res = await fetchWithRetry(url, { method: 'HEAD', next: { revalidate: 86400 } })
    return res.ok ? url.replace('?default=false', '') : undefined
  } catch {
    return undefined
  }
}

/**
 * Fetch cover: GB by ISBN → OL by ISBN (in parallel).
 * Both results are cached 24h to avoid burning GB quota on repeated searches.
 */
async function fetchCover(isbn: string | undefined): Promise<string | undefined> {
  if (!isbn) return undefined
  const [gb, ol] = await Promise.all([gbCoverByISBN(isbn), olCoverByISBN(isbn)])
  return gb ?? ol
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * Strip characters that have special meaning in SRU CQL queries so a
 * user-supplied string cannot break out of its tit="…" context or inject
 * additional query clauses (e.g. `" OR isbn=1234`).
 *
 * Removed: double-quote (CQL string delimiter), backslash (CQL escape),
 *          and the CQL boolean/proximity operators to be safe.
 */
function sanitizeSruQuery(raw: string): string {
  return raw
    .replace(/["\\]/g, '')          // strip CQL string-delimiter and escape chars
    .replace(/\s+(AND|OR|NOT|PROX)\s+/gi, ' ')  // neutralise CQL boolean operators
    .trim()
    .slice(0, 200)                   // hard length cap
}

export async function GET(req: NextRequest) {
  const { ok, retryAfter } = checkRateLimit(`search:${clientIp(req)}`, 20, 60_000) // 20/min
  if (!ok) {
    return NextResponse.json(
      { results: [] },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const raw = req.nextUrl.searchParams.get('q')?.trim()
  if (!raw || raw.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const q = sanitizeSruQuery(raw)
  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  // Exact phrase for multi-word queries; single term otherwise
  const sruQuery = q.includes(' ') ? `tit="${q}"` : `tit=${q}`

  const params = new URLSearchParams({
    operation: 'searchRetrieve',
    version: '1.1',
    query: sruQuery,
    maximumRecords: '8',
    recordSchema: 'MARC21-xml',
  })

  try {
    const res = await fetchWithRetry(`https://services.dnb.de/sru/dnb?${params}`, {
      next: { revalidate: 3600 },
      headers: { Accept: 'application/xml, text/xml' },
    })
    if (!res.ok) return NextResponse.json({ results: [] })

    const xml = await res.text()

    // Split into individual Bibliographic record blocks
    const recordBlocks = [
      ...xml.matchAll(/<record[^>]*type="Bibliographic"[^>]*>([\s\S]*?)<\/record>/g),
    ].map((m) => m[1])

    if (recordBlocks.length === 0) return NextResponse.json({ results: [] })

    // Parse title, author, ISBN from each record
    const parsed = recordBlocks
      .map((block) => {
        const titleRaw = marcSubfield(block, '245', 'a') ?? ''
        const title = cleanDnbTitle(titleRaw)
        if (!title) return null

        const authorRaw =
          marcSubfield(block, '100', 'a') ?? marcSubfield(block, '700', 'a') ?? ''
        const author = normaliseCreator(stripCreatorRole(authorRaw))

        // Take first ISBN-13 (13 digits after stripping non-digits)
        const isbn = marcSubfieldAll(block, '020', 'a')
          .map((s) => s.replace(/\D/g, ''))
          .find((s) => s.length === 13)

        return { title, author, isbn }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && r.title.length > 0)

    // Fetch covers in parallel (GB by ISBN ∥ OL by ISBN), cached 24h
    const results: SearchResult[] = await Promise.all(
      parsed.map(async (r) => {
        const cover_url = await fetchCover(r.isbn)
        return { title: r.title, author: r.author, isbn: r.isbn, cover_url }
      })
    )

    return NextResponse.json(
      { results },
      { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } }
    )
  } catch (err) {
    console.error('[search] DNB SRU request failed:', err)
    return NextResponse.json({ results: [] })
  }
}
