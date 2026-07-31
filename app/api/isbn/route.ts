/**
 * app/api/isbn/route.ts
 *
 * Server-side ISBN lookup — the DNB-backed fallback behind /api/books/search,
 * used by the barcode scanner and by typing a raw ISBN into search.
 *
 * Strategy (in order):
 *  1. Google Books (fast, has covers, good international coverage)
 *  2. Deutsche Nationalbibliothek — DNB (comprehensive for German/Austrian/Swiss
 *     books), via lib/dnbIsbn, which also tries the ISBN-10 form and then looks
 *     for a cover on Google Books by title+author.
 *
 * Both providers are called server-side to avoid CORS restrictions and browser
 * rate limits.
 *
 * GET /api/isbn?isbn=9783649628101
 * Response: { result: IsbnResult | null }
 */

import { NextRequest, NextResponse } from 'next/server'
import { gbUrl } from '@/lib/gbUrl'
import { checkRateLimit, clientIp } from '@/lib/rateLimit'
import { fetchWithRetry } from '@/lib/serverFetch'
import { fetchDnbByIsbn } from '@/lib/dnbIsbn'
import { isbnCandidates, normalizeIsbn } from '@/lib/isbn'

export const runtime = 'nodejs'

export interface IsbnResult {
  title: string
  author: string
  cover_url?: string
  publishedYear?: number
  publisher?: string
}

// ── Google Books ──────────────────────────────────────────────────────────────

async function fromGoogleBooks(isbn: string): Promise<IsbnResult | null> {
  try {
    const res = await fetchWithRetry(
      gbUrl({ q: `isbn:${isbn}`, maxResults: '1' }),
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const data = await res.json() as { items?: Array<{ volumeInfo?: {
      title?: string
      authors?: string[]
      publishedDate?: string
      publisher?: string
      imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    } }> }

    const item = data.items?.[0]
    if (!item?.volumeInfo?.title) return null

    const info = item.volumeInfo
    const links = info.imageLinks
    const rawCover = links?.thumbnail ?? links?.smallThumbnail
    const cover_url = rawCover ? rawCover.replace(/^http:/, 'https:').replace(/zoom=\d/, 'zoom=1') : undefined

    const yearMatch = info.publishedDate?.match(/^(\d{4})/)
    return {
      title: info.title ?? '',
      author: info.authors?.[0] ?? '',
      cover_url,
      publishedYear: yearMatch ? parseInt(yearMatch[1]) : undefined,
      publisher: info.publisher,
    }
  } catch (err) {
    console.error('[isbn] Google Books fetch failed:', err)
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { ok, retryAfter } = checkRateLimit(`isbn:${clientIp(req)}`, 30, 60_000) // 30/min
  if (!ok) {
    return NextResponse.json(
      { result: null },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const raw = req.nextUrl.searchParams.get('isbn')?.trim() ?? ''
  // Reject oversized inputs before any parsing runs
  if (raw.length > 20) {
    return NextResponse.json({ result: null }, { status: 400 })
  }

  // Accepts ISBN-10 (including the "…X" check digit) and ISBN-13, with or
  // without hyphens/spaces, and normalises to ISBN-13.
  const isbn = normalizeIsbn(raw)
  if (!isbn) {
    return NextResponse.json({ result: null }, { status: 400 })
  }

  const cacheHeaders = { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800' }

  // 1. Try Google Books first — fastest and has covers. Query both ISBN forms:
  //    GB indexes older titles under the ISBN-10 actually printed on them.
  for (const candidate of isbnCandidates(isbn)) {
    const gb = await fromGoogleBooks(candidate)
    if (gb?.title) {
      return NextResponse.json({ result: gb }, { headers: cacheHeaders })
    }
  }

  // 2. Fall back to DNB — catches German/Austrian/Swiss books that GB misses
  const dnb = await fetchDnbByIsbn(isbn)
  if (dnb?.title) {
    return NextResponse.json({ result: dnb }, { headers: cacheHeaders })
  }

  return NextResponse.json({ result: null })
}
