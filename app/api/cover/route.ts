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
 * Missing covers: Open Library returns a blank 1×1 GIF (not a 404) for ISBNs
 * without a cover unless `default=false` is appended. This route always appends
 * it and additionally rejects tiny image bodies, so the client gets a real 404
 * and can render its placeholder instead of an invisible blank image.
 *
 * Security: only URLs from known book-cover CDNs are allowed. Any other host
 * is rejected with 400 to prevent SSRF abuse.
 */

const ALLOWED_HOSTS = new Set([
  'books.google.com',
  'covers.openlibrary.org',
  'supabase.co', // user-uploaded covers are served from *.supabase.co
])

const UPSTREAM_TIMEOUT_MS = 8_000

// Anything smaller than this is a tracking-pixel-style blank, not a cover.
const MIN_IMAGE_BYTES = 500

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

/** Make Open Library return 404 for missing covers instead of a blank 1×1 GIF. */
function withDefaultFalse(raw: string): string {
  try {
    const u = new URL(raw)
    if (u.hostname === 'covers.openlibrary.org' && !u.searchParams.has('default')) {
      u.searchParams.set('default', 'false')
    }
    return u.toString()
  } catch {
    return raw
  }
}

async function fetchUpstream(url: string): Promise<Response | null> {
  try {
    // `next: { revalidate }` caches the upstream response in Next.js's
    // server-side data cache for 7 days (works on Vercel + local dev).
    return await fetch(url, {
      next: { revalidate: 604800 }, // 7 days
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    return null
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

  const primary = withDefaultFalse(url)
  let upstream = await fetchUpstream(primary)

  // Open Library -L (large) images sometimes 404 while -M (medium) exists
  if ((!upstream || !upstream.ok) && primary.includes('covers.openlibrary.org') && primary.includes('-L.jpg')) {
    upstream = await fetchUpstream(primary.replace('-L.jpg', '-M.jpg'))
  }

  if (!upstream) {
    return new NextResponse('Error fetching image', { status: 502 })
  }
  if (!upstream.ok) {
    return new NextResponse('Upstream error', { status: upstream.status === 404 ? 404 : 502 })
  }

  try {
    const body = await upstream.arrayBuffer()

    // A "successful" response that is only a few bytes is a blank placeholder,
    // not a cover — report it as missing so the client can show its fallback.
    if (body.byteLength < MIN_IMAGE_BYTES) {
      return new NextResponse('No cover available', { status: 404 })
    }

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
