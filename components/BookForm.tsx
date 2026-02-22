'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Search } from 'lucide-react'
import StarRating from './StarRating'
import { LONG_MONTHS, SEASONS } from '@/lib/month'
import type { Book } from '@/types/book'

// ─── Constants ───────────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear()

// ─── Types ───────────────────────────────────────────────────────────────────

type BookSuggestion = {
  title: string
  author: string
  cover_url?: string
}

// Internal type that carries ISBNs for the cover fallback pass
type RichSuggestion = BookSuggestion & { isbn?: string }

interface BookFormProps {
  initialData?: Partial<Book>
  onSubmit: (data: Omit<Book, 'id' | 'user_id' | 'created_at'>) => Promise<void>
  submitLabel?: string
  loading?: boolean
}

// ─── Book Search APIs ─────────────────────────────────────────────────────────

async function searchOpenLibrary(query: string, language?: string): Promise<RichSuggestion[]> {
  const lang = language ? `&language=${encodeURIComponent(language)}` : ''
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=title,author_name,cover_i,cover_edition_key,isbn&limit=10${lang}`
  )
  if (!res.ok) throw new Error('Open Library request failed')
  const data = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.docs ?? []).map((doc: any) => {
    // Fallback chain: cover_i → cover_edition_key (OLID) → first ISBN
    let cover_url: string | undefined
    if (doc.cover_i) {
      cover_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
    } else if (doc.cover_edition_key) {
      cover_url = `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`
    } else if (doc.isbn?.[0]) {
      cover_url = `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`
    }
    return {
      title: doc.title ?? '',
      author: doc.author_name?.[0] ?? 'Unknown Author',
      cover_url,
      // Carry ISBN-13 (preferred) or ISBN-10 for the Google Books fallback pass
      isbn: doc.isbn?.find((n: string) => n.length === 13) ?? doc.isbn?.[0],
    }
  })
}

/** Normalise a raw Google Books image URL to a high-res https version. */
function normaliseGoogleCover(raw: string): string {
  return raw
    .replace('http:', 'https:')
    .replace(/zoom=\d+/, 'zoom=0')
    .replace(/&fife=[^&]*/g, '') + '&fife=w600'
}

async function searchGoogleBooks(query: string, langRestrict?: string): Promise<RichSuggestion[]> {
  const lang = langRestrict ? `&langRestrict=${encodeURIComponent(langRestrict)}` : ''
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10${lang}`
  )
  if (!res.ok) throw new Error('Google Books request failed')
  const data = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.items ?? []).map((item: any) => {
    const links = item.volumeInfo?.imageLinks
    const raw = links?.extraLarge ?? links?.large ?? links?.medium ?? links?.thumbnail
    // Extract ISBN-13 (preferred) or ISBN-10 for the cover fallback pass
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids: { type: string; identifier: string }[] = item.volumeInfo?.industryIdentifiers ?? []
    const isbn =
      ids.find((id) => id.type === 'ISBN_13')?.identifier ??
      ids.find((id) => id.type === 'ISBN_10')?.identifier
    return {
      title: item.volumeInfo?.title ?? '',
      author: item.volumeInfo?.authors?.[0] ?? 'Unknown Author',
      cover_url: raw ? normaliseGoogleCover(raw) : undefined,
      isbn,
    }
  })
}

/** Score how well a title matches the query — higher is better. */
function relevanceScore(title: string, query: string): number {
  const t = title.toLowerCase().trim()
  const q = query.toLowerCase().trim()
  if (t === q) return 100                          // exact match
  if (t.startsWith(q)) return 80                  // title starts with query
  if (t.includes(` ${q}`) || t.includes(`${q} `)) return 60  // query is a whole word
  if (t.includes(q)) return 40                    // query appears anywhere
  // partial: count how many query words appear in the title
  const words = q.split(/\s+/)
  const matched = words.filter((w) => t.includes(w)).length
  return Math.round((matched / words.length) * 20)
}

function rankAndDeduplicate(results: RichSuggestion[], query: string): RichSuggestion[] {
  // Deduplicate by normalised title, keeping the richest entry (cover > isbn)
  const map = new Map<string, RichSuggestion>()
  for (const s of results) {
    const key = s.title.toLowerCase().trim()
    const existing = map.get(key)
    if (!existing) {
      map.set(key, s)
    } else {
      // Prefer whichever has a cover; also merge in isbn if missing
      const better = !existing.cover_url && s.cover_url ? s : existing
      map.set(key, { ...better, isbn: better.isbn ?? s.isbn ?? existing.isbn })
    }
  }

  return [...map.values()]
    .sort((a, b) => {
      const scoreDiff = relevanceScore(b.title, query) - relevanceScore(a.title, query)
      if (scoreDiff !== 0) return scoreDiff
      return (b.cover_url ? 1 : 0) - (a.cover_url ? 1 : 0)
    })
    .slice(0, 8)
}

/** Extract the best cover from a single Google Books API response. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function googleCoverFromResponse(data: any): string | undefined {
  const links = data.items?.[0]?.volumeInfo?.imageLinks as Record<string, string> | undefined
  if (!links) return undefined
  const raw = links.extraLarge ?? links.large ?? links.medium ?? links.thumbnail
  return raw ? normaliseGoogleCover(raw) : undefined
}

/** Query Google Books by exact ISBN — more precise than a title search. */
async function fetchCoverByISBN(isbn: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1`
    )
    if (!res.ok) return undefined
    return googleCoverFromResponse(await res.json())
  } catch { return undefined }
}

/** Query Google Books with intitle: + inauthor: — hits different index entries than a plain search. */
async function fetchCoverByTitleAuthor(title: string, author: string): Promise<string | undefined> {
  try {
    const q = `intitle:"${title}" inauthor:"${author}"`
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`
    )
    if (!res.ok) return undefined
    return googleCoverFromResponse(await res.json())
  } catch { return undefined }
}

async function searchAllSources(query: string): Promise<BookSuggestion[]> {
  // ── Pass 1: parallel title search across all sources ──────────────────────
  const [olGlobal, olGerman, googleGlobal, googleGerman] = await Promise.allSettled([
    searchOpenLibrary(query),
    searchOpenLibrary(query, 'ger'),
    searchGoogleBooks(query),
    searchGoogleBooks(query, 'de'),
  ])

  const combined: RichSuggestion[] = [
    ...(olGlobal.status     === 'fulfilled' ? olGlobal.value     : []),
    ...(olGerman.status     === 'fulfilled' ? olGerman.value     : []),
    ...(googleGlobal.status === 'fulfilled' ? googleGlobal.value : []),
    ...(googleGerman.status === 'fulfilled' ? googleGerman.value : []),
  ]

  const ranked = rankAndDeduplicate(combined, query)

  // ── Pass 2: multi-source fallback for every coverless entry ──────────────
  // For each entry without a cover, try ISBN lookup AND intitle:/inauthor: query
  // in parallel — take whichever responds first with a cover.
  const needsCover = ranked.filter((r) => !r.cover_url)
  if (needsCover.length > 0) {
    const coverResults = await Promise.allSettled(
      needsCover.map(async (r) => {
        const attempts: Promise<string | undefined>[] = []
        if (r.isbn) attempts.push(fetchCoverByISBN(r.isbn))
        if (r.author && r.author !== 'Unknown Author') {
          attempts.push(fetchCoverByTitleAuthor(r.title, r.author))
        }
        if (attempts.length === 0) return undefined
        // Run all attempts in parallel, return the first cover found
        const results = await Promise.allSettled(attempts)
        for (const res of results) {
          if (res.status === 'fulfilled' && res.value) return res.value
        }
        return undefined
      })
    )
    coverResults.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        const key = needsCover[i].title.toLowerCase().trim()
        const idx = ranked.findIndex((r) => r.title.toLowerCase().trim() === key)
        if (idx !== -1) ranked[idx].cover_url = result.value
      }
    })
  }

  // Strip internal isbn field before returning
  return ranked.map(({ isbn: _isbn, ...rest }) => rest)
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BookForm({
  initialData,
  onSubmit,
  submitLabel = 'Save',
  loading = false,
}: BookFormProps) {
  const [title, setTitle]     = useState(initialData?.title ?? '')
  const [author, setAuthor]   = useState(initialData?.author ?? '')
  const [year, setYear]       = useState(initialData?.year ?? currentYear)
  const [month, setMonth]     = useState<number | null>(initialData?.month ?? null)
  const [rating, setRating]   = useState(initialData?.rating ?? 0)
  const [notes, setNotes]     = useState(initialData?.notes ?? '')
  // Preserve genre if it exists (not shown in UI, still saved)
  const genreRef = useRef(initialData?.genre)
  const [coverUrl, setCoverUrl] = useState(initialData?.cover_url ?? '')

  const [suggestions, setSuggestions]     = useState<BookSuggestion[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [error, setError] = useState('')

  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // ── Debounced autocomplete ──────────────────────────────────────────────────
  useEffect(() => {
    if (title.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const results = await searchAllSources(title)
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
      } catch { /* All sources failed — user can type manually */ } finally {
        setSearchLoading(false)
      }
    }, 400)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [title])

  // ── Close dropdown on outside click ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function selectSuggestion(s: BookSuggestion) {
    setTitle(s.title)
    setAuthor(s.author)
    if (s.cover_url) setCoverUrl(s.cover_url)
    setShowSuggestions(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Title is required'); return }
    if (rating === 0)  { setError('Please add a star rating'); return }

    try {
      await onSubmit({
        title:     title.trim(),
        author:    author.trim(),
        genre:     genreRef.current || undefined,
        year,
        month,
        rating,
        notes:     notes.trim() || undefined,
        cover_url: coverUrl.trim() || undefined,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  // ── Shared styles ───────────────────────────────────────────────────────────
  // focus:border is handled by the CSS variable rule in globals.css
  const inputBase =
    'w-full px-4 h-[60px] rounded-[12px] border-2 border-[rgba(23,23,23,0.16)] ' +
    'focus:outline-none transition-colors ' +
    'text-[16px] text-[#171717] bg-white placeholder:text-[rgba(23,23,23,0.72)]'

  const labelClass = 'block text-[#171717] text-[18px] font-bold leading-6 mb-2'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-4 pb-10">

      {/* ── Title with autocomplete ─────────────────────────────────────────── */}
      <div className="relative" ref={suggestionsRef}>
        <label className={labelClass}>
          Title<span style={{ color: 'var(--primary)' }}>*</span>
        </label>

        <div className="relative">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Start typing to search…"
            className={inputBase + ' pr-12'}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(23,23,23,0.72)]">
            {searchLoading
              ? <Loader2 size={20} className="animate-spin" />
              : <Search size={20} />
            }
          </div>
        </div>

        {/* Dropdown */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white
                          rounded-[12px] shadow-[0_8px_32px_rgba(23,23,23,0.16)]
                          border border-gray-100 z-20 overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectSuggestion(s)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50
                           transition-colors text-left border-b border-gray-50 last:border-0"
              >
                {s.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.cover_url} alt="" className="w-8 h-11 object-cover rounded flex-shrink-0" />
                ) : (
                  <div className="w-8 h-11 bg-gray-100 rounded flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-[16px] text-[#171717] truncate">{s.title}</p>
                  <p className="text-[14px] text-[rgba(23,23,23,0.72)] truncate">{s.author}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Author ─────────────────────────────────────────────────────────── */}
      <div>
        <label className={labelClass}>Author</label>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Enter author name..."
          className={inputBase}
        />
      </div>

      {/* ── When did you read it? (Month 2/3 + Year 1/3) ─────────────────── */}
      <div>
        <label className={labelClass}>When did you read it?</label>
        <div className="grid grid-cols-3 gap-[6px]">
          <div className="col-span-2">
            <select
              value={month ?? ''}
              onChange={(e) => setMonth(e.target.value === '' ? null : Number(e.target.value))}
              className={inputBase + ' appearance-none cursor-pointer'}
            >
              <option value="">— Unknown month —</option>
              <optgroup label="Month">
                {LONG_MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </optgroup>
              <optgroup label="Season">
                {Object.entries(SEASONS).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={inputBase + ' appearance-none cursor-pointer'}
            >
              {Array.from({ length: 30 }, (_, i) => currentYear - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Rating ─────────────────────────────────────────────────────────── */}
      <div>
        <label className={labelClass}>Rating</label>
        <StarRating rating={rating} onRate={setRating} size={36} />
        {rating > 0 && (
          <p className="text-[14px] text-[rgba(23,23,23,0.72)] mt-2">
            {["", "Didn't like it", "It was okay", "Liked it", "Really liked it", "Loved it"][rating]}
          </p>
        )}
      </div>

      {/* ── My Notes ───────────────────────────────────────────────────────── */}
      <div>
        <label className={labelClass}>My Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did you think about this book?"
          rows={5}
          className="w-full px-4 py-3 rounded-[12px] border-2 border-[rgba(23,23,23,0.16)]
                     focus:outline-none focus:border-[#160a9d] transition-colors
                     text-[16px] text-[#171717] bg-white
                     placeholder:text-[rgba(23,23,23,0.72)] resize-none"
        />
      </div>

      {/* Cover preview (auto-filled from search — shows remove button) */}
      {coverUrl && (
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt="Cover preview"
            className="w-14 h-20 object-cover rounded-[8px] shadow-sm flex-shrink-0"
          />
          <div>
            <p className="text-[16px] text-[#171717] font-bold mb-1">Cover preview</p>
            <button
              type="button"
              onClick={() => setCoverUrl('')}
              className="text-[14px] text-red-500"
            >
              Remove cover
            </button>
          </div>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <p className="text-red-500 text-[14px] bg-red-50 px-4 py-3 rounded-[12px]">
          {error}
        </p>
      )}

      {/* ── Submit — full-width pill ────────────────────────────────────────── */}
      <motion.button
        type="submit"
        disabled={loading}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-full py-4 rounded-full text-white text-[16px]
                   font-bold text-center disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
      >
        {loading ? 'Saving…' : submitLabel}
      </motion.button>
    </form>
  )
}
