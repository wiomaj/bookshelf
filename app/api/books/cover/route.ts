/**
 * app/api/books/cover/route.ts
 *
 * Server-side cover lookup by title + author.
 *
 * GET /api/books/cover?title=Kraken&author=Svenja+Beller
 * Response: { coverUrl: string | null }
 *
 * Used by the client-side "self-heal" flow: when a stored cover URL stops
 * resolving, the UI asks this route for a fresh one. Runs Google Books
 * (intitle/inauthor, secret API key) and Open Library in parallel; the first
 * source with a cover wins.
 *
 * Precise title + author only — no title-only fallback, which previously
 * returned covers of unrelated books that share a title.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, clientIp } from '@/lib/rateLimit'
import { fetchWithRetry } from '@/lib/serverFetch'
import { gbUrl } from '@/lib/gbUrl'

export const runtime = 'nodejs'

const OL_UA = 'BookshelfApp/1.0 (bookshelf-app@outlook.com)'

function normaliseGbCover(raw: string): string {
  return raw
    .replace(/^http:/, 'https:')
    .replace(/zoom=\d+/, 'zoom=1')
}

async function gbCover(title: string, author: string): Promise<string | null> {
  try {
    const q = `intitle:"${title}" inauthor:"${author}"`
    const res = await fetchWithRetry(
      gbUrl({ q, maxResults: '5', printType: 'books', fields: 'items(volumeInfo/imageLinks)' }),
      { next: { revalidate: 86400 } },
    )
    if (!res.ok) return null
    const data = await res.json() as {
      items?: Array<{ volumeInfo?: { imageLinks?: Record<string, string> } }>
    }
    // Scan all items — some editions lack imageLinks while a later one has them.
    for (const item of data.items ?? []) {
      const links = item.volumeInfo?.imageLinks
      const raw = links?.extraLarge ?? links?.large ?? links?.medium ?? links?.thumbnail ?? links?.smallThumbnail
      if (raw) return normaliseGbCover(raw)
    }
    return null
  } catch {
    return null
  }
}

async function olCover(title: string, author: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      title,
      author,
      fields: 'cover_i,cover_edition_key',
      limit: '1',
    })
    const res = await fetchWithRetry(`https://openlibrary.org/search.json?${params}`, {
      headers: { 'User-Agent': OL_UA },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null
    const data = await res.json() as {
      docs?: Array<{ cover_i?: number; cover_edition_key?: string }>
    }
    const doc = data.docs?.[0]
    if (doc?.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
    if (doc?.cover_edition_key) return `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`
    return null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const { ok, retryAfter } = checkRateLimit(`books-cover:${clientIp(request)}`, 30, 60_000)
  if (!ok) {
    return NextResponse.json({ coverUrl: null }, {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    })
  }

  const title = request.nextUrl.searchParams.get('title')?.trim().slice(0, 200) ?? ''
  const author = request.nextUrl.searchParams.get('author')?.trim().slice(0, 100) ?? ''

  // Author is required — title-only matching returns wrong-book covers.
  if (!title || !author) return NextResponse.json({ coverUrl: null })

  const [gb, ol] = await Promise.allSettled([gbCover(title, author), olCover(title, author)])
  const coverUrl =
    (gb.status === 'fulfilled' ? gb.value : null) ??
    (ol.status === 'fulfilled' ? ol.value : null)

  return NextResponse.json(
    { coverUrl },
    { headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800' } },
  )
}
