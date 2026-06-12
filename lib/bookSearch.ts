/**
 * lib/bookSearch.ts
 *
 * Unified book search, now routing through the server-side /api/books/search route
 * (Open Library primary + Google Books enrichment, Supabase ISBN cache).
 *
 * DNB (Deutsche Nationalbibliothek) is still fetched client-side in parallel for
 * German, Austrian, and Swiss books that OL/GB miss.
 *
 * Imported by BookForm — uses the same BookSuggestion type for backward compat.
 */

// ─── Public type ──────────────────────────────────────────────────────────────

export interface BookSuggestion {
  title: string
  author: string
  cover_url?: string
  // Rich fields from /api/books/search
  isbn13?: string | null
  description?: string | null
  pageCount?: number | null
  publishedDate?: string | null
  publisher?: string | null
  subjects?: string[]
}

// ─── Internal types ───────────────────────────────────────────────────────────

import type { BookMetadata } from '@/types/book'

interface Candidate {
  title: string
  author: string
  cover_url: string | undefined
  isbn13: string | null
  description: string | null
  pageCount: number | null
  publishedDate: string | null
  publisher: string | null
  subjects: string[]
  score: number
}

import { gbUrl } from '@/lib/gbUrl'

// ─── Regex safety ─────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── Query type detection ─────────────────────────────────────────────────────

function detectISBN(query: string): string | null {
  const stripped = query.replace(/^isbn[:\s]*/i, '').trim()
  const digits = stripped.replace(/[\s\-]/g, '').toUpperCase()
  if ((digits.length === 10 || digits.length === 13) && /^[\dX]+$/.test(digits)) {
    return digits
  }
  return null
}

function looksLikeAuthorName(query: string): boolean {
  const words = query.trim().split(/\s+/)
  if (words.length !== 2) return false
  return words.every((w) => w.length >= 2 && /^[A-ZÁÉÍÓÚÜÖÄ][a-záéíóúüöäß]+$/.test(w))
}

// ─── Author normalisation ─────────────────────────────────────────────────────

function normalizeAuthorName(name: string): string {
  if (!name) return name
  const commaIdx = name.indexOf(',')
  if (commaIdx === -1) return name
  const last  = name.slice(0, commaIdx).trim()
  const first = name.slice(commaIdx + 1).trim()
  return first ? `${first} ${last}` : last
}

// ─── Dedup key ────────────────────────────────────────────────────────────────

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

function dedupKey(title: string, author: string): string {
  return `${normalizeKey(title)}|||${normalizeKey(normalizeAuthorName(author))}`
}

// ─── Title relevance scoring ──────────────────────────────────────────────────

function titleRelevanceBonus(title: string, query: string): number {
  if (!title || !query) return 0
  const t = title.toLowerCase()
  const q = query.toLowerCase()
  const words = q.split(/\s+/).filter((w) => w.length >= 2)
  if (words.length === 0) return 0

  if (t.includes(q)) return 80

  const stripArticle = (s: string) => s.replace(/^(der|die|das|ein|eine|the|a|an)\s+/i, '')
  if (stripArticle(t).startsWith(stripArticle(q))) return 60

  const regexes = words.map((w) => new RegExp(`\\b${escapeRegex(w)}\\b`))
  const matchCount = regexes.filter((re) => re.test(t)).length
  if (matchCount === words.length) return 40
  return matchCount > 0 ? Math.round((matchCount / words.length) * 15) : 0
}

// ─── Server route fetcher ─────────────────────────────────────────────────────

async function fetchServerSearch(query: string, signal: AbortSignal): Promise<Candidate[]> {
  try {
    const params = new URLSearchParams({ q: query })
    const res = await fetch(`/api/books/search?${params}`, { signal })
    if (!res.ok) return []
    const data = await res.json() as { results?: BookMetadata[] }
    return (data.results ?? []).map((m, position) => ({
      title: m.title,
      author: m.authors[0] ?? '',
      cover_url: m.coverUrl ?? undefined,
      isbn13: m.isbn13,
      description: m.description,
      pageCount: m.pageCount,
      publishedDate: m.publishedDate,
      publisher: m.publisher,
      subjects: m.subjects,
      score: (10 - position) * 10 + titleRelevanceBonus(m.title, query),
    }))
  } catch {
    return []
  }
}

// ─── DNB title search via server route ───────────────────────────────────────

async function fetchDNBSearch(query: string, signal: AbortSignal): Promise<Candidate[]> {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal })
    if (!res.ok) return []
    const data = await res.json() as {
      results?: Array<{ title: string; author: string; cover_url?: string }>
    }
    return (data.results ?? []).map((r, position) => ({
      title: r.title,
      author: normalizeAuthorName(r.author),
      cover_url: r.cover_url,
      isbn13: null,
      description: null,
      pageCount: null,
      publishedDate: null,
      publisher: null,
      subjects: [],
      score: (8 - position) * 10 + titleRelevanceBonus(r.title, query),
    }))
  } catch {
    return []
  }
}

// ─── Merge ────────────────────────────────────────────────────────────────────

function merge(a: Candidate, b: Candidate): Candidate {
  return {
    title: a.title || b.title,
    author: a.author || b.author,
    cover_url: a.cover_url ?? b.cover_url,
    isbn13: a.isbn13 ?? b.isbn13,
    description: a.description ?? b.description,
    pageCount: a.pageCount ?? b.pageCount,
    publishedDate: a.publishedDate ?? b.publishedDate,
    publisher: a.publisher ?? b.publisher,
    subjects: a.subjects.length > 0 ? a.subjects : b.subjects,
    score: Math.max(a.score, b.score),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search for books by title, author, or ISBN.
 *
 * ISBN queries and text queries both route through /api/books/search (server-side
 * OL + Google Books with Supabase ISBN caching). DNB is fetched in parallel for
 * text queries to improve German book coverage.
 *
 * Returns at most `maxResults` suggestions, covers-first, sorted by score.
 * Never throws — returns [] on network errors or empty queries.
 */
export async function searchBooks(
  query: string,
  maxResults = 8
): Promise<BookSuggestion[]> {
  const q = query.trim()
  if (!q) return []

  const isISBN = !!detectISBN(q)
  const isAuthor = !isISBN && looksLikeAuthorName(q)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 7_000)

  let serverResults: Candidate[] = []
  let dnbResults: Candidate[] = []

  try {
    const tasks: Promise<Candidate[]>[] = [
      fetchServerSearch(q, controller.signal),
      // DNB is author-agnostic, skip for ISBN and author queries
      ...(!isISBN && !isAuthor ? [fetchDNBSearch(q, controller.signal)] : []),
    ]
    const settled = await Promise.allSettled(tasks)
    if (settled[0].status === 'fulfilled') serverResults = settled[0].value
    if (settled[1]?.status === 'fulfilled') dnbResults = settled[1].value
  } finally {
    clearTimeout(timeoutId)
  }

  // Deduplicate: server results are primary, DNB enriches or adds
  const seen = new Map<string, Candidate>()
  for (const c of [...serverResults, ...dnbResults]) {
    if (!c.title) continue
    const key = dedupKey(c.title, c.author)
    const existing = seen.get(key)
    seen.set(key, existing ? merge(existing, c) : c)
  }

  const qWords = (!isISBN && !isAuthor)
    ? q.toLowerCase().split(/\s+/).filter((w) => w.length >= 2)
    : []
  const needsTitleFilter = qWords.length >= 2

  const ranked = [...seen.values()]
    .filter((c) => {
      if (!needsTitleFilter) return true
      const tl = c.title.toLowerCase()
      return qWords.every((w) => tl.includes(w))
    })
    .sort((a, b) => {
      const coverDiff = (b.cover_url ? 1 : 0) - (a.cover_url ? 1 : 0)
      if (coverDiff !== 0) return coverDiff
      return b.score - a.score
    })
    .slice(0, maxResults)

  return ranked.map(({ title, author, cover_url, isbn13, description, pageCount, publishedDate, publisher, subjects }) => ({
    title,
    author,
    cover_url,
    isbn13,
    description,
    pageCount,
    publishedDate,
    publisher,
    subjects,
  }))
}
