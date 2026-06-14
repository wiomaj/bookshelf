/**
 * app/api/books/search/route.ts
 *
 * Server-side book search.
 *
 * GET /api/books/search?q=the+hobbit&page=1
 * GET /api/books/search?q=isbn:9780261102217
 *
 * Text queries:
 *  - Google Books free-text (q=) is the relevance spine — it ranks title + author
 *    matches well, which is what makes the search feel "Google-like".
 *  - Paginated via startIndex. Page 1 returns 15, subsequent pages return 20.
 *  - Open Library is used only as a cover fallback (URL constructed from ISBN,
 *    no extra network round-trip).
 *  - Returns { results: BookMetadata[], hasMore: boolean }.
 *
 * ISBN queries:
 *  - Check Supabase cache → OL + GB → upsert. Single result, hasMore=false.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, clientIp } from '@/lib/rateLimit'
import type { BookMetadata } from '@/types/book'

export const runtime = 'nodejs'

const OL_UA = 'BookshelfApp/1.0 (bookshelf-app@outlook.com)'
const MAX_SUBJECTS = 8

// Page sizes: a fuller first page, then "Show more" loads 20 at a time.
const PAGE1_SIZE = 15
const PAGEN_SIZE = 20

function startIndexFor(page: number): number {
  return page <= 1 ? 0 : PAGE1_SIZE + (page - 2) * PAGEN_SIZE
}
function limitFor(page: number): number {
  return page <= 1 ? PAGE1_SIZE : PAGEN_SIZE
}

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

// ─── Cover helpers ────────────────────────────────────────────────────────────

function resolveGbCover(links: { thumbnail?: string; smallThumbnail?: string } | undefined): string | null {
  const raw = links?.thumbnail ?? links?.smallThumbnail
  if (!raw) return null
  return raw.replace(/^http:/, 'https:').replace(/zoom=\d+/, 'zoom=3')
}

function olCoverFromIsbn(isbn13: string | null): string | null {
  if (!isbn13) return null
  return `https://covers.openlibrary.org/b/isbn/${isbn13}-M.jpg`
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
}

// ─── Open Library (ISBN path only) ────────────────────────────────────────────

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

function firstIsbn13(isbns: string[] | undefined): string | null {
  if (!isbns) return null
  for (const isbn of isbns) {
    const d = isbn.replace(/[^\dX]/gi, '')
    if (d.length === 13) return d
    if (d.length === 10 && /^\d{9}[\dX]$/i.test(d)) return isbn10to13(d)
  }
  return null
}

const OL_FIELDS = 'title,author_name,cover_i,cover_edition_key,isbn,first_publish_year,publisher,number_of_pages_median,subject'

async function fetchOLByIsbn(isbn: string, signal: AbortSignal): Promise<OLDoc[]> {
  try {
    const params = new URLSearchParams({ fields: OL_FIELDS, limit: '5', isbn })
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

/**
 * Free-text Open Library search — runs in parallel with Google Books so the
 * search keeps working when GB is rate-limited (429) or missing a key.
 * Returns docs plus numFound for pagination.
 */
async function fetchOLFreeText(
  query: string,
  offset: number,
  limit: number,
  signal: AbortSignal,
): Promise<{ docs: OLDoc[]; numFound: number }> {
  try {
    const params = new URLSearchParams({
      q: query,
      fields: OL_FIELDS,
      limit: String(limit),
      offset: String(offset),
    })
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
      headers: { 'User-Agent': OL_UA },
      signal,
    })
    if (!res.ok) return { docs: [], numFound: 0 }
    const data = await res.json() as { docs?: OLDoc[]; numFound?: number }
    return { docs: data.docs ?? [], numFound: data.numFound ?? 0 }
  } catch (err) {
    console.error('Open Library error:', err)
    return { docs: [], numFound: 0 }
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
  subtitle?: string
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

/** Free-text Google Books search — the primary relevance spine for text queries. */
async function fetchGBFreeText(
  query: string,
  startIndex: number,
  limit: number,
  signal: AbortSignal,
): Promise<GBVolumeInfo[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      startIndex: String(startIndex),
      maxResults: String(limit),
      printType: 'books',
      orderBy: 'relevance',
    })
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

/** ISBN-scoped Google Books lookup (ISBN path only). */
async function fetchGBByIsbn(isbn: string, signal: AbortSignal): Promise<GBVolumeInfo[]> {
  try {
    const params = new URLSearchParams({ q: `isbn:${isbn}`, maxResults: '3', printType: 'books' })
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

  // GB cover, else construct an OL cover from the ISBN (free, no fetch).
  const coverUrl = resolveGbCover(info.imageLinks) ?? olCoverFromIsbn(isbn13)

  return {
    isbn13: isbn13 ?? null,
    title: info.title,
    authors: info.authors ?? [],
    description: info.description ? stripHtml(info.description) : null,
    pageCount: info.pageCount ?? null,
    publishedDate: info.publishedDate ?? null,
    publisher: info.publisher ?? null,
    subjects: (info.categories ?? []).slice(0, MAX_SUBJECTS),
    coverUrl,
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
    description: base.description ?? enricher.description,
    pageCount: base.pageCount ?? enricher.pageCount,
    publishedDate: base.publishedDate ?? enricher.publishedDate,
    publisher: base.publisher ?? enricher.publisher,
    subjects: base.subjects.length > 0 ? base.subjects : enricher.subjects,
    coverUrl: base.coverUrl ?? enricher.coverUrl,
    source: base.source,
  }
}

/** Dedup while preserving the incoming (relevance) order. */
function dedupPreserveOrder(items: BookMetadata[]): BookMetadata[] {
  const seen = new Map<string, number>()
  const out: BookMetadata[] = []
  for (const m of items) {
    if (!m.title) continue
    const key = dedupKey(m)
    const idx = seen.get(key)
    if (idx === undefined) {
      seen.set(key, out.length)
      out.push(m)
    } else {
      out[idx] = mergeMetadata(out[idx], m)
    }
  }
  return out
}

// ─── ISBN path ────────────────────────────────────────────────────────────────

async function handleIsbn(isbnRaw: string): Promise<BookMetadata[]> {
  const isbn = normalizeIsbn13(isbnRaw)

  // Cache first
  const db = supabaseClient()
  if (db) {
    const { data } = await db
      .from('book_metadata_cache')
      .select('*')
      .eq('isbn13', isbn)
      .single()
    if (data) {
      return [{
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
      }]
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7_000)
  let olDocs: OLDoc[] = []
  let gbInfos: GBVolumeInfo[] = []
  try {
    const [ol, gb] = await Promise.allSettled([
      fetchOLByIsbn(isbn, controller.signal),
      fetchGBByIsbn(isbn, controller.signal),
    ])
    if (ol.status === 'fulfilled') olDocs = ol.value
    if (gb.status === 'fulfilled') gbInfos = gb.value
  } finally {
    clearTimeout(timeout)
  }

  const merged = dedupPreserveOrder([
    ...olDocs.map(olDocToMetadata).filter((m): m is BookMetadata => m !== null),
    ...gbInfos.map(gbInfoToMetadata).filter((m): m is BookMetadata => m !== null),
  ])
  merged.sort((a, b) => (b.coverUrl ? 1 : 0) - (a.coverUrl ? 1 : 0))
  const results = merged.slice(0, 5)

  // Cache best result
  if (db && results.length > 0) {
    const best = results[0]
    db.from('book_metadata_cache').upsert({
      isbn13: isbn,
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

  return results
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { ok, retryAfter } = checkRateLimit(`books-search:${clientIp(request)}`, 40, 60_000)
  if (!ok) {
    return NextResponse.json({ results: [], hasMore: false }, {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [], hasMore: false })

  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') ?? '1') || 1)

  // ── ISBN query ──────────────────────────────────────────────────────────────
  const isbnRaw = detectISBN(q)
  if (isbnRaw) {
    const results = await handleIsbn(isbnRaw)
    return NextResponse.json({ results, hasMore: false })
  }

  // ── Text query: Google Books + Open Library in parallel, paginated ─────────
  // GB free-text is the relevance spine; OL runs alongside so the search still
  // works when GB is rate-limited (429) or has no API key.
  const startIndex = startIndexFor(page)
  const limit = limitFor(page)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7_000)
  let gbInfos: GBVolumeInfo[] = []
  let olDocs: OLDoc[] = []
  let olNumFound = 0
  try {
    const [gb, ol] = await Promise.allSettled([
      fetchGBFreeText(q, startIndex, limit, controller.signal),
      fetchOLFreeText(q, startIndex, limit, controller.signal),
    ])
    if (gb.status === 'fulfilled') gbInfos = gb.value
    if (ol.status === 'fulfilled') { olDocs = ol.value.docs; olNumFound = ol.value.numFound }
  } finally {
    clearTimeout(timeout)
  }

  // GB first (relevance spine), then OL appended; dedup preserves that order.
  const results = dedupPreserveOrder([
    ...gbInfos.map(gbInfoToMetadata).filter((m): m is BookMetadata => m !== null),
    ...olDocs.map(olDocToMetadata).filter((m): m is BookMetadata => m !== null),
  ])

  // More available if either source has a full page / further pages.
  const hasMore = gbInfos.length >= limit || (startIndex + olDocs.length) < olNumFound

  return NextResponse.json(
    { results, hasMore },
    { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } }
  )
}
