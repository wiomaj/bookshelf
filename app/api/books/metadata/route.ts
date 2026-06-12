/**
 * app/api/books/metadata/route.ts
 *
 * Deep ISBN-based metadata lookup with 90-day Supabase cache.
 *
 * GET /api/books/metadata?isbn=9780261102217
 *
 * Strategy:
 *  1. Normalize ISBN (strip hyphens; convert ISBN-10 → ISBN-13)
 *  2. Check book_metadata_cache — return immediately if < 90 days old
 *  3. Fetch in parallel:
 *     a. Open Library Books API (edition data: pages, publisher, publish date, work key)
 *     b. Open Library Work API (description, subjects) — chained from (a)'s work key
 *     c. Google Books (description, categories, cover)
 *  4. Merge, upsert to cache, return BookMetadata
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, clientIp } from '@/lib/rateLimit'
import type { BookMetadata } from '@/types/book'

export const runtime = 'nodejs'

const OL_UA = 'BookshelfApp/1.0 (bookshelf-app@outlook.com)'
const CACHE_TTL_DAYS = 90
const MAX_SUBJECTS = 8

// ─── Supabase ─────────────────────────────────────────────────────────────────

function supabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// ─── ISBN helpers ─────────────────────────────────────────────────────────────

function isbn10to13(isbn10: string): string {
  const base = '978' + isbn10.slice(0, 9)
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return base + ((10 - (sum % 10)) % 10)
}

function normalizeIsbn(raw: string): string | null {
  const digits = raw.replace(/[^\dX]/gi, '')
  if (digits.length === 13) return digits
  if (digits.length === 10 && /^\d{9}[\dX]$/i.test(digits)) return isbn10to13(digits)
  return null
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
}

function resolveGbCover(links: { thumbnail?: string; smallThumbnail?: string } | undefined): string | null {
  const raw = links?.thumbnail ?? links?.smallThumbnail
  if (!raw) return null
  return raw.replace(/^http:/, 'https:').replace(/zoom=\d+/, 'zoom=3')
}

// ─── Open Library Books API (edition) ────────────────────────────────────────

interface OLEdition {
  title?: string
  publishers?: string[]
  publish_date?: string
  number_of_pages?: number
  covers?: number[]
  works?: Array<{ key: string }>
  subjects?: string[]
  isbn_13?: string[]
  isbn_10?: string[]
}

async function fetchOLEdition(isbn: string): Promise<OLEdition | null> {
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, {
      headers: { 'User-Agent': OL_UA },
    })
    if (!res.ok) return null
    return await res.json() as OLEdition
  } catch (err) {
    console.error('Open Library Books API error:', err)
    return null
  }
}

// ─── Open Library Work API (description + subjects) ──────────────────────────

interface OLWork {
  title?: string
  description?: string | { value?: string }
  subjects?: string[]
}

async function fetchOLWork(workKey: string): Promise<OLWork | null> {
  try {
    const res = await fetch(`https://openlibrary.org${workKey}.json`, {
      headers: { 'User-Agent': OL_UA },
    })
    if (!res.ok) return null
    return await res.json() as OLWork
  } catch (err) {
    console.error('Open Library Work API error:', err)
    return null
  }
}

// ─── Open Library Search fallback (for author names) ─────────────────────────

async function fetchOLSearchByISBN(isbn: string): Promise<{ authors: string[]; title?: string } | null> {
  try {
    const params = new URLSearchParams({ isbn, fields: 'title,author_name', limit: '1' })
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
      headers: { 'User-Agent': OL_UA },
    })
    if (!res.ok) return null
    const data = await res.json() as { docs?: Array<{ title?: string; author_name?: string[] }> }
    const doc = data.docs?.[0]
    if (!doc) return null
    return { authors: doc.author_name ?? [], title: doc.title }
  } catch {
    return null
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
}

function gbApiKey(): string {
  return process.env.GOOGLE_BOOKS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY ?? ''
}

async function fetchGB(isbn: string): Promise<GBVolumeInfo | null> {
  try {
    const params = new URLSearchParams({ q: `isbn:${isbn}`, maxResults: '1' })
    const key = gbApiKey()
    if (key) params.set('key', key)
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`)
    if (!res.ok) return null
    const data = await res.json() as { items?: Array<{ volumeInfo?: GBVolumeInfo }> }
    return data.items?.[0]?.volumeInfo ?? null
  } catch (err) {
    console.error('Google Books error:', err)
    return null
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { ok, retryAfter } = checkRateLimit(`books-metadata:${clientIp(request)}`, 20, 60_000)
  if (!ok) {
    return NextResponse.json({ result: null }, {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    })
  }

  const rawIsbn = request.nextUrl.searchParams.get('isbn')?.trim()
  if (!rawIsbn) return NextResponse.json({ result: null }, { status: 400 })

  const isbn = normalizeIsbn(rawIsbn)
  if (!isbn) return NextResponse.json({ result: null }, { status: 400 })

  // 1. Check Supabase cache (90-day freshness)
  const db = supabaseClient()
  if (db) {
    const { data } = await db
      .from('book_metadata_cache')
      .select('*')
      .eq('isbn13', isbn)
      .single()

    if (data) {
      const ageMs = Date.now() - new Date(data.fetched_at).getTime()
      const ageDays = ageMs / (1000 * 60 * 60 * 24)
      if (ageDays < CACHE_TTL_DAYS) {
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
        return NextResponse.json({ result: cached })
      }
    }
  }

  // 2. Fetch in parallel: OL edition + GB
  const [olEdition, gb] = await Promise.all([
    fetchOLEdition(isbn),
    fetchGB(isbn),
  ])

  // 3. Fetch OL work (description/subjects) if we have a work key
  let olWork: OLWork | null = null
  let olSearch: { authors: string[]; title?: string } | null = null

  const workKey = olEdition?.works?.[0]?.key
  if (workKey) {
    olWork = await fetchOLWork(workKey)
  }

  // Fetch author names via search (OL edition only has author keys, not names)
  olSearch = await fetchOLSearchByISBN(isbn)

  // 4. Resolve cover
  let coverUrl: string | null = resolveGbCover(gb?.imageLinks)
  if (!coverUrl && olEdition?.covers?.[0]) {
    coverUrl = `https://covers.openlibrary.org/b/id/${olEdition.covers[0]}-L.jpg`
  }
  if (!coverUrl) {
    coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
  }

  // 5. Resolve description
  let description: string | null = null
  if (gb?.description) {
    description = stripHtml(gb.description)
  } else if (olWork?.description) {
    const raw = olWork.description
    const text = typeof raw === 'string' ? raw : raw.value ?? ''
    if (text.length > 30) description = stripHtml(text)
  }

  // 6. Resolve subjects
  const subjects = (
    olWork?.subjects ?? olEdition?.subjects ?? gb?.categories ?? []
  ).slice(0, MAX_SUBJECTS)

  // 7. Resolve publish date
  const publishedDate =
    gb?.publishedDate ??
    olEdition?.publish_date ??
    null

  // 8. Build result (prefer OL for primary data, GB for enrichment)
  const title = olEdition?.title ?? olSearch?.title ?? gb?.title ?? ''
  const authors = olSearch?.authors?.length
    ? olSearch.authors
    : (gb?.authors ?? [])

  const result: BookMetadata = {
    isbn13: isbn,
    title,
    authors,
    description,
    pageCount: olEdition?.number_of_pages ?? gb?.pageCount ?? null,
    publishedDate,
    publisher: olEdition?.publishers?.[0] ?? gb?.publisher ?? null,
    subjects,
    coverUrl,
    source: olEdition ? 'openlibrary' : 'googlebooks',
  }

  if (!result.title) return NextResponse.json({ result: null })

  // 9. Upsert to cache
  if (db) {
    db.from('book_metadata_cache').upsert({
      isbn13: isbn,
      title: result.title,
      authors: result.authors,
      description: result.description,
      page_count: result.pageCount,
      published_date: result.publishedDate,
      publisher: result.publisher,
      subjects: result.subjects,
      cover_url: result.coverUrl,
      source: result.source,
      fetched_at: new Date().toISOString(),
      raw_ol: olEdition ?? undefined,
      raw_gb: gb ?? undefined,
    }, { onConflict: 'isbn13' }).then(undefined, () => {})
  }

  return NextResponse.json({ result })
}
