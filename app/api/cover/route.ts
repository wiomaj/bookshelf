import { NextRequest, NextResponse } from 'next/server'

/**
 * Image proxy for book cover URLs.
 *
 * External sources (Google Books, Open Library) set short or no cache headers.
 * This route fetches the image server-side (Next.js caches the upstream fetch
 * for 7 days) and re-serves it with a 7-day browser Cache-Control so covers
 * load instantly after the first visit.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  try {
    // `next: { revalidate }` caches the upstream response in Next.js's
    // server-side data cache for 7 days (works on Vercel + local dev).
    const upstream = await fetch(url, {
      next: { revalidate: 604800 }, // 7 days
    })

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
  } catch {
    return new NextResponse('Error fetching image', { status: 502 })
  }
}
