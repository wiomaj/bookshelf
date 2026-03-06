/**
 * app/api/search/route.ts
 *
 * Next.js App Router handler for GET /api/search
 *
 * Query params:
 *   q          — required. Raw search string.
 *   max        — optional. Max results to return (default: 8, max: 20).
 *   debug      — optional. Set to "1" to include ScoreBreakdown in results.
 *   timeout    — optional. Pipeline timeout in ms (default: 5000).
 *
 * Response (200):
 *   { results: BookSearchResult[] }
 *
 * Error responses:
 *   400  — missing or empty `q` param.
 *   500  — unexpected pipeline error.
 *
 * This route exists so that:
 *  - DNB and Europeana can be called without CORS issues (server-side only).
 *  - All four providers can be queried in parallel with a shared timeout.
 *  - BookForm and ToReadForm share a single, tested search implementation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { searchBooks } from '@/lib/search/pipeline'
import type { SearchOptions } from '@/lib/search/types'

export const runtime = 'nodejs'

// Light caching: identical queries reuse the cached response for 60 s
export const revalidate = 60

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const q = searchParams.get('q')?.trim()
  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 })
  }

  const maxRaw = parseInt(searchParams.get('max') ?? '8', 10)
  const maxResults = isNaN(maxRaw) ? 8 : Math.min(Math.max(maxRaw, 1), 20)

  const debug = searchParams.get('debug') === '1'

  const timeoutRaw = parseInt(searchParams.get('timeout') ?? '5000', 10)
  const timeoutMs = isNaN(timeoutRaw) ? 5000 : Math.min(Math.max(timeoutRaw, 1000), 15_000)

  const options: SearchOptions = { maxResults, debug, timeoutMs }

  try {
    const results = await searchBooks(q, options)
    return NextResponse.json({ results })
  } catch (err) {
    console.error('[api/search] pipeline error:', err)
    return NextResponse.json({ error: 'Search pipeline error', results: [] }, { status: 500 })
  }
}
