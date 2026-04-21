import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, clientIp } from '@/lib/rateLimit'

/**
 * Image proxy for book cover URLs.
 *
 * External sources (Google Books, Open Library) set short or no cache headers.
 * This route fetches the image server-side (Next.js caches the upstream fetch
 * for 7 days) and re-serves it with a 7-day browser Cache-Control so covers
 * load instantly after the first visit.
 *
 * Security: only URLs from known book-cover CDNs are allowed. Any other host
 * is rejected with 400 to prevent SSRF abuse.
 */

const ALLOWED_HOSTS = new Set([
  'books.google.com',
  'covers.openlibrary.org',
  'supabase.co', // user-uploaded covers are served from *.supabase.co
])

function isSafeUrl(raw: string): boolean {
  try {
    const { protocol, hostname } = new URL(raw)
    if (protocol !== 'https:') return false
    // Allow exact match or any subdomain of an allowed host
    return [...ALLOWED_HOSTS].some(
      (host) => hostname === host || hostname.endsWith(`.${host}`)
    )
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const { ok, retryAfter } = checkRateLimit(`cover:${clientIp(request)}`, 120, 60_000) // 120/min
  if (!ok) {
    return new NextResponse('Too many requests', {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    })
  }

  const url = request.nextUrl.searchParams.get('url')

  if (!url || !isSafeUrl(url)) {
    return new NextResponse('Missing or disallowed URL', { status: 400 })
  }

  try {
    // `next: { revalidate }` caches the upstream response in Next.js's
    // server-side data cache for 7 days (works on Vercel + local dev).
    let upstream = await fetch(url, {
      next: { revalidate: 604800 }, // 7 days
    })

    // Open Library -L (large) images sometimes 404; fall back to -M (medium)
    if (!upstream.ok && url.includes('covers.openlibrary.org') && url.includes('-L.jpg')) {
      const fallbackUrl = url.replace('-L.jpg', '-M.jpg')
      upstream = await fetch(fallbackUrl, {
        next: { revalidate: 604800 },
      })
    }

    if (!upstream.ok) {
      return new NextResponse('Upstream error', { status: upstream.status })
    }

    const body = await upstream.arrayBuffer()
    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        // Browser (and Vercel CDN) caches for 7 days.
        // stale-while-revalidate serves stale instantly while refreshing in bg.
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    console.error('[cover] Upstream fetch failed:', err)
    return new NextResponse('Error fetching image', { status: 502 })
  }
}
