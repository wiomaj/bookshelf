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

export const runtime = 'nodejs'

export interface SearchResult {
  title: string
  author: string
  cover_url?: string
  isbn?: string
}

// ── Title / author cleaning (mirrors app/api/isbn/route.ts) ───────────────────

function cleanDnbTitle(raw: string): string {
  let s = raw.trim()
  // Drop optional leading parallel-title in brackets + semicolon separator
  // e.g. "[Geh langsam…] ; Geh langsam…" → "Geh langsam…"
  s = s.replace(/^\[.*?\]\s*;\s*/, '')
  // Drop subtitle (" : …") and responsibility statement (" / …")
  s = s.replace(/\s*[:/].*$/, '')
  return s.trim()
}

function stripCreatorRole(raw: string): string {
  return raw.replace(/\s*\[.*?\]/g, '').trim()
}

function normaliseCreator(raw: string): string {
  if (raw.includes(',')) {
    const [last, ...firstParts] = raw.split(',').map((p) => p.trim())
    return [...firstParts, last].join(' ')
  }
  return raw
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
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1&fields=items(volumeInfo/imageLinks)`,
      { signal: AbortSignal.timeout(3000) }
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
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
    return res.ok ? url.replace('?default=false', '') : undefined
  } catch {
    return undefined
  }
}

/** Google Books cover by title + author — fallback when ISBN lookup misses. */
async function gbCoverByTitleAuthor(title: string, author: string): Promise<string | undefined> {
  try {
    const titleHint = title.split(/\s+/).slice(0, 4).join(' ')
    const authorHint = author.split(/\s+/).slice(0, 2).join(' ')
    const q = authorHint
      ? `intitle:"${titleHint}" inauthor:"${authorHint}"`
      : `intitle:"${titleHint}"`
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1&fields=items(volumeInfo/imageLinks)`,
      { signal: AbortSignal.timeout(3000) }
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

/**
 * Fetch cover: GB by ISBN → (OL by ISBN ∥ GB by title+author).
 * Runs fallbacks in parallel once the ISBN path fails to keep latency low.
 */
async function fetchCover(isbn: string | undefined, title: string, author: string): Promise<string | undefined> {
  if (isbn) {
    const gbIsbn = await gbCoverByISBN(isbn)
    if (gbIsbn) return gbIsbn
    const [ol, gbTitle] = await Promise.all([
      olCoverByISBN(isbn),
      gbCoverByTitleAuthor(title, author),
    ])
    return ol ?? gbTitle
  }
  return gbCoverByTitleAuthor(title, author)
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
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
    const res = await fetch(`https://services.dnb.de/sru/dnb?${params}`, {
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

    // Fetch covers in parallel (GB by ISBN → OL by ISBN → GB by title+author)
    const results: SearchResult[] = await Promise.all(
      parsed.map(async (r) => {
        const cover_url = await fetchCover(r.isbn, r.title, r.author)
        return { title: r.title, author: r.author, isbn: r.isbn, cover_url }
      })
    )

    return NextResponse.json(
      { results },
      { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } }
    )
  } catch {
    return NextResponse.json({ results: [] })
  }
}
