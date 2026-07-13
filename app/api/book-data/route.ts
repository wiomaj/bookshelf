/**
 * GET /api/book-data?title=...&author=...
 * Server-side proxy for fetching book description, genre, and published year
 * from Google Books (with API key) and Open Library as fallback.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, clientIp } from '@/lib/rateLimit'
import { fetchWithRetry } from '@/lib/serverFetch'
import { gbUrl } from '@/lib/gbUrl'

export const runtime = 'nodejs'

const OL_UA = 'BookshelfApp/1.0 (bookshelf-app@outlook.com)'

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

export async function GET(req: NextRequest) {
  const { ok, retryAfter } = checkRateLimit(`book-data:${clientIp(req)}`, 30, 60_000) // 30/min
  if (!ok) {
    return NextResponse.json({}, {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    })
  }

  const title = req.nextUrl.searchParams.get('title')?.trim().slice(0, 200) ?? ''
  const author = req.nextUrl.searchParams.get('author')?.trim().slice(0, 100) ?? ''

  if (!title) return NextResponse.json({})

  // ── Google Books ──────────────────────────────────────────────────────────
  try {
    const q = author
      ? `intitle:"${title}" inauthor:"${author}"`
      : `intitle:"${title}"`
    const res = await fetchWithRetry(gbUrl({ q, maxResults: '5' }), {
      next: { revalidate: 86400 },
    })
    if (res.ok) {
      const data = await res.json()
      for (const item of data.items ?? []) {
        const info = item.volumeInfo ?? {}
        const desc: string | undefined = info.description
        const cats: string[] | undefined = info.categories
        const published: string | undefined = info.publishedDate
        const result: Record<string, string> = {}
        if (desc && desc.length > 30) result.description = stripHtml(desc)
        if (cats?.length) result.genre = cats[0].split(' / ')[0].trim()
        if (published) result.publishedYear = published.slice(0, 4)
        if (Object.keys(result).length > 0) {
          return NextResponse.json(result, {
            headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800' },
          })
        }
      }
    }
  } catch {
    // fall through to Open Library
  }

  // ── Open Library ──────────────────────────────────────────────────────────
  try {
    const params = new URLSearchParams({
      title,
      ...(author ? { author } : {}),
      fields: 'key,subject',
      limit: '1',
    })
    const searchRes = await fetchWithRetry(`https://openlibrary.org/search.json?${params}`, {
      headers: { 'User-Agent': OL_UA },
      next: { revalidate: 86400 },
    })
    if (searchRes.ok) {
      const searchData = await searchRes.json()
      const doc = searchData.docs?.[0]
      const key: string | undefined = doc?.key
      const result: Record<string, string> = {}

      if (doc?.subject?.length) result.genre = doc.subject[0]

      if (key) {
        const workRes = await fetchWithRetry(`https://openlibrary.org${key}.json`, {
          headers: { 'User-Agent': OL_UA },
          next: { revalidate: 86400 },
        })
        if (workRes.ok) {
          const work = await workRes.json()
          const desc = work.description
          if (typeof desc === 'string' && desc.length > 30) result.description = stripHtml(desc)
          else if (typeof desc?.value === 'string' && desc.value.length > 30) result.description = stripHtml(desc.value)
        }
      }

      if (Object.keys(result).length > 0) {
        return NextResponse.json(result, {
          headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800' },
        })
      }
    }
  } catch {
    // ignore
  }

  return NextResponse.json({})
}
