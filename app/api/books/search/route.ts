/**
 * app/api/books/search/route.ts
 *
 * Server-side book search across Open Library (primary) and Google Books (enrichment).
 * Runs server-side so the API key is never exposed and OL's User-Agent rate-limit applies.
 *
 * GET /api/books/search?q=the+hobbit
 * GET /api/books/search?q=isbn:9780261102217
 *
 * - ISBN queries: check Supabase cache first; upsert best result after fetch
 * - Text queries: OL + GB in parallel; no caching (too many possible queries)
 * - Returns BookMetadata[]
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, clientIp } from '@/lib/rateLimit'
import type { BookMetadata } from '@/types/book'

export const runtime = 'nodejs'

const OL_UA = 'BookshelfApp/1.0 (bookshelf-app@outlook.com)'
const MAX_SUBJECTS = 8

// ─── Supabase client (for ISBN cache) ────────────────────────────────────────

function supabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// ─── ISBN helpers ─────────────────────────────────────────────────────────────

function detectISBN(q: string): string | null {
  const stripped = q.replace(/^isbn[:\s]*/i, '').trim()
  const digits = stripped.replace(/[\s\-]/g, '')
  if ((digits.length === 10 || digits.length === 13) && /^\d+X?$/i.test(digits)) {
    return digits
  }
  return null
}

function isbn10to13(isbn10: string): string {
  const base = '978' + isbn10.slice(0, 9)
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3)
  }
  const check = (10 - (sum % 10)) % 10
  return base + check
}

function normalizeIsbn13(isbn: string): string {
  const digits = isbn.replace(/[^\dX]/gi, '')
  if (digits.length === 10) return isbn10to13(digits)
  return digits.slice(0, 13)
}

function firstIsbn13(isbns: string[] | undefined): string | null {
  if (!isbns) return null
  for (const isbn of isbns) {
    const d = isbn.replace(/[^\dX]/gi, '')
    if (d.length === 13) return d
    if (d.length === 10 && /^\d{9}[\dX]$/i.test(d)) return isbn10to13(d)
  }
  return null
}

// ─── Cover helpers ────────────────────────────────────────────────────────────

function resolveGbCover(links: { thumbnail?: string; smallThumbnail?: string } | undefined): string | null {
  const raw = links?.thumbnail ?? links?.smallThumbnail
  if (!raw) return null
  return raw.replace(/^http:/, 'https:').replace(/zoom=\d+/, 'zoom=3')
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
}

// ─── Open Library ─────────────────────────────────────────────────────────────

interface OLDoc {
  title?: string
  author_name?: string[]
  cover_i?: number
  cover_edition_key?: string
  isbn?: string[]
  first_publish_year?: number
  publisher?: string[]
  number_of_pages_median?: number
  subject?: string[]
}

async function fetchOL(query: string, isISBN: boolean, signal: AbortSignal): Promise<OLDoc[]> {
  try {
    const fields = 'title,author_name,cover_i,cover_edition_key,isbn,first_publish_year,publisher,number_of_pages_median,subject'
    const params = new URLSearchParams({ fields, limit: '10' })
    if (isISBN) {
      params.set('isbn', query)
    } else {
      params.set('title', query)
    }
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
      headers: { 'User-Agent': OL_UA },
      signal,
    })
    if (!res.ok) return []
    const data = await res.json() as { docs?: OLDoc[] }
    return data.docs ?? []
  } catch (err) {
    console.error('Open Library error:', err)
    return []
  }
}

function olDocToMetadata(doc: OLDoc): BookMetadata | null {
  if (!doc.title) return null
  const isbn13 = firstIsbn13(doc.isbn)

  let coverUrl: string | null = null
  if (doc.cover_i) {
    coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
  } else if (doc.cover_edition_key) {
    coverUrl = `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`
  } else if (isbn13) {
    coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`
  }

  return {
    isbn13,
    title: doc.title,
    authors: doc.author_name ?? [],
    description: null,
    pageCount: doc.number_of_pages_median ?? null,
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
    publisher: doc.publisher?.[0] ?? null,
    subjects: (doc.subject ?? []).slice(0, MAX_SUBJECTS),
    coverUrl,
    source: 'openlibrary',
  }
}

// ─── Google Books ──────────────────────────────────────────────────────────────

interface GBVolumeInfo {
  title?: string
  authors?: string[]
  description?: string
  pageCount?: number
  publishedDate?: string
  publisher?: string
  categories?: string[]
  imageLinks?: { thumbnail?: string; smallThumbnail?: string }
  industryIdentifiers?: Array<{ type: string; identifier: string }>
}

function gbApiKey(): string {
  return process.env.GOOGLE_BOOKS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY ?? ''
}

async function fetchGB(query: string, isISBN: boolean, signal: AbortSignal): Promise<GBVolumeInfo[]> {
  try {
    const q = isISBN
      ? `isbn:${query}`
      : query.split(/\s+/).map(w => `intitle:${w}`).join('+')
    const params = new URLSearchParams({ q, maxResults: '10', printType: 'books' })
    const key = gbApiKey()
    if (key) params.set('key', key)

    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, { signal })
    if (!res.ok) return []
    const data = await res.json() as { items?: Array<{ volumeInfo?: GBVolumeInfo }> }
    return (data.items ?? []).map(i => i.volumeInfo ?? {}).filter(i => i.title)
  } catch (err) {
    console.error('Google Books error:', err)
    return []
  }
}

function gbInfoToMetadata(info: GBVolumeInfo): BookMetadata | null {
  if (!info.title) return null
  const ids = info.industryIdentifiers ?? []
  const isbn13Entry = ids.find(id => id.type === 'ISBN_13')
  const isbn10Entry = ids.find(id => id.type === 'ISBN_10')
  const isbn13 = isbn13Entry?.identifier
    ?? (isbn10Entry ? isbn10to13(isbn10Entry.identifier) : null)

  return {
    isbn13: isbn13 ?? null,
    title: info.title,
    authors: info.authors ?? [],
    description: info.description ? stripHtml(info.description) : null,
    pageCount: info.pageCount ?? null,
    publishedDate: info.publishedDate ?? null,
    publisher: info.publisher ?? null,
    subjects: (info.categories ?? []).slice(0, MAX_SUBJECTS),
    coverUrl: resolveGbCover(info.imageLinks),
    source: 'googlebooks',
  }
}

// ─── Merge + dedup ────────────────────────────────────────────────────────────

function normalKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

function dedupKey(m: BookMetadata): string {
  if (m.isbn13) return `isbn:${m.isbn13}`
  return `${normalKey(m.title)}|||${normalKey(m.authors[0] ?? '')}`
}

function mergeMetadata(base: BookMetadata, enricher: BookMetadata): BookMetadata {
  return {
    isbn13: base.isbn13 ?? enricher.isbn13,
    title: base.title || enricher.title,
    authors: base.authors.length > 0 ? base.authors : enricher.authors,
    description: enricher.description ?? base.description,
    pageCount: base.pageCount ?? enricher.pageCount,
    publishedDate: base.publishedDate ?? enricher.publishedDate,
    publisher: base.publisher ?? enricher.publisher,
    subjects: base.subjects.length > 0 ? base.subjects : enricher.subjects,
    // GB cover takes priority (higher resolution at zoom=3)
    coverUrl: enricher.coverUrl ?? base.coverUrl,
    source: base.source,
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { ok, retryAfter } = checkRateLimit(`books-search:${clientIp(request)}`, 30, 60_000)
  if (!ok) {
    return NextResponse.json({ results: [] }, {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const isbnRaw = detectISBN(q)
  const isISBN = !!isbnRaw
  const query = isISBN ? normalizeIsbn13(isbnRaw!) : q

  // ISBN: check Supabase cache first
  if (isISBN) {
    const db = supabaseClient()
    if (db) {
      const { data } = await db
        .from('book_metadata_cache')
        .select('*')
        .eq('isbn13', query)
        .single()
      if (data) {
        const cached: BookMetadata = {
          isbn13: data.isbn13,
          title: data.title,
          authors: data.authors ?? [],
          description: data.description ?? null,
          pageCount: data.page_count ?? null,
          publishedDate: data.published_date ?? null,
          publisher: data.publisher ?? null,
          subjects: data.subjects ?? [],
          coverUrl: data.cover_url ?? null,
          source: 'cache',
        }
        return NextResponse.json({ results: [cached] })
      }
    }
  }

  // Fetch OL + GB in parallel with a 7-second timeout
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7_000)

  let olDocs: OLDoc[] = []
  let gbInfos: GBVolumeInfo[] = []
  try {
    const [olResult, gbResult] = await Promise.allSettled([
      fetchOL(query, isISBN, controller.signal),
      fetchGB(query, isISBN, controller.signal),
    ])
    if (olResult.status === 'fulfilled') olDocs = olResult.value
    if (gbResult.status === 'fulfilled') gbInfos = gbResult.value
  } finally {
    clearTimeout(timeout)
  }

  const olMeta = olDocs.map(olDocToMetadata).filter((m): m is BookMetadata => m !== null)
  const gbMeta = gbInfos.map(gbInfoToMetadata).filter((m): m is BookMetadata => m !== null)

  // Dedup: OL is primary; GB enriches existing entries or adds new ones
  const seen = new Map<string, BookMetadata>()
  for (const m of olMeta) seen.set(dedupKey(m), m)
  for (const gb of gbMeta) {
    const key = dedupKey(gb)
    const existing = seen.get(key)
    seen.set(key, existing ? mergeMetadata(existing, gb) : gb)
  }

  let results = [...seen.values()].filter(m => m.title)
  results.sort((a, b) => (b.coverUrl ? 1 : 0) - (a.coverUrl ? 1 : 0))
  results = results.slice(0, 10)

  // ISBN: upsert best result to cache
  if (isISBN && results.length > 0) {
    const best = results[0]
    const db = supabaseClient()
    if (db) {
      db.from('book_metadata_cache').upsert({
        isbn13: query,
        title: best.title,
        authors: best.authors,
        description: best.description,
        page_count: best.pageCount,
        published_date: best.publishedDate,
        publisher: best.publisher,
        subjects: best.subjects,
        cover_url: best.coverUrl,
        source: best.source,
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'isbn13' }).then(undefined, () => {})
    }
  }

  return NextResponse.json(
    { results },
    { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } }
  )
}
