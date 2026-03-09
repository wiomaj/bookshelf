/**
 * app/api/isbn/route.ts
 *
 * Server-side ISBN lookup — called by the client search when a raw ISBN is typed.
 *
 * Strategy (in order):
 *  1. Google Books (fast, has covers, good international coverage)
 *  2. Deutsche Nationalbibliothek — DNB (comprehensive for German/Austrian/Swiss books)
 *     After finding metadata in DNB, attempts a title+author cover search on Google Books.
 *
 * Both providers are called server-side to avoid CORS restrictions and browser rate limits.
 *
 * GET /api/isbn?isbn=9783649628101
 * Response: { result: IsbnResult | null }
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export interface IsbnResult {
  title: string
  author: string
  cover_url?: string
  publishedYear?: number
}

// ── Google Books ──────────────────────────────────────────────────────────────

async function fromGoogleBooks(isbn: string): Promise<IsbnResult | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const data = await res.json() as { items?: Array<{ volumeInfo?: {
      title?: string
      authors?: string[]
      publishedDate?: string
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
    }
  } catch {
    return null
  }
}

// ── Cover fallback: GB title+author search ────────────────────────────────────

async function gbCoverByTitleAuthor(title: string, author: string): Promise<string | undefined> {
  try {
    // Use first significant word of author + first 4 words of title to avoid over-constraining
    const authorHint = author.split(/\s+/).slice(0, 2).join(' ')
    const titleHint = title.split(/\s+/).slice(0, 4).join(' ')
    const q = `intitle:"${titleHint}" inauthor:"${authorHint}"`
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return undefined
    const data = await res.json() as { items?: Array<{ volumeInfo?: {
      imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    } }> }
    const links = data.items?.[0]?.volumeInfo?.imageLinks
    const raw = links?.thumbnail ?? links?.smallThumbnail
    return raw ? raw.replace(/^http:/, 'https:').replace(/zoom=\d/, 'zoom=1') : undefined
  } catch {
    return undefined
  }
}

// ── DNB (Deutsche Nationalbibliothek) ─────────────────────────────────────────

/** Extract text content of a Dublin Core element from SRU XML. */
function dcField(xml: string, tag: string): string | undefined {
  const m = new RegExp(`<dc:${tag}[^>]*>([^<]+)</dc:${tag}>`, 'i').exec(xml)
  return m?.[1]?.trim()
}

/** Invert "Lastname, Firstname" → "Firstname Lastname" */
function normaliseCreator(raw: string): string {
  if (raw.includes(',')) {
    const [last, ...firstParts] = raw.split(',').map((p) => p.trim())
    return [...firstParts, last].join(' ')
  }
  return raw
}

async function fromDNB(isbn: string): Promise<IsbnResult | null> {
  try {
    const params = new URLSearchParams({
      operation: 'searchRetrieve',
      version: '1.1',
      query: `isbn=${isbn}`,
      maximumRecords: '3',
      recordSchema: 'oai_dc',
    })
    const res = await fetch(`https://services.dnb.de/sru/dnb?${params}`, {
      next: { revalidate: 3600 },
      headers: { Accept: 'application/xml, text/xml' },
    })
    if (!res.ok) return null

    const xml = await res.text()

    // Check if any records were found
    const numRecords = /<numberOfRecords>(\d+)<\/numberOfRecords>/.exec(xml)?.[1]
    if (!numRecords || numRecords === '0') return null

    const title = dcField(xml, 'title')
    if (!title) return null

    const creatorRaw = dcField(xml, 'creator')
    const author = creatorRaw ? normaliseCreator(creatorRaw) : ''

    const dateRaw = dcField(xml, 'date')
    const yearMatch = dateRaw?.match(/\b(\d{4})\b/)
    const publishedYear = yearMatch ? parseInt(yearMatch[1]) : undefined

    // DNB has no cover images — try Google Books by title+author for a cover
    const cover_url = author
      ? await gbCoverByTitleAuthor(title, author)
      : undefined

    return { title, author, cover_url, publishedYear }
  } catch {
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('isbn')?.trim() ?? ''
  const isbn = raw.replace(/[\s\-]/g, '')

  if (!isbn || !/^\d{10,13}X?$/.test(isbn)) {
    return NextResponse.json({ result: null }, { status: 400 })
  }

  // 1. Try Google Books first — fastest and has covers
  const gb = await fromGoogleBooks(isbn)
  if (gb?.title) {
    return NextResponse.json({ result: gb })
  }

  // 2. Fall back to DNB — catches German/Austrian/Swiss books that GB misses
  const dnb = await fromDNB(isbn)
  if (dnb?.title) {
    return NextResponse.json({ result: dnb })
  }

  return NextResponse.json({ result: null })
}
