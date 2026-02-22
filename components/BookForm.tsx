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

interface BookFormProps {
  initialData?: Partial<Book>
  onSubmit: (data: Omit<Book, 'id' | 'user_id' | 'created_at'>) => Promise<void>
  submitLabel?: string
  loading?: boolean
}

// ─── Book Search APIs ─────────────────────────────────────────────────────────

async function searchOpenLibrary(query: string, language?: string): Promise<BookSuggestion[]> {
  const lang = language ? `&language=${encodeURIComponent(language)}` : ''
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=title,author_name,cover_i&limit=7${lang}`
  )
  if (!res.ok) throw new Error('Open Library request failed')
  const data = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.docs ?? []).map((doc: any) => ({
    title: doc.title ?? '',
    author: doc.author_name?.[0] ?? 'Unknown Author',
    cover_url: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : undefined,
  }))
}

async function searchGoogleBooks(query: string, langRestrict?: string): Promise<BookSuggestion[]> {
  const lang = langRestrict ? `&langRestrict=${encodeURIComponent(langRestrict)}` : ''
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=7${lang}`
  )
  if (!res.ok) throw new Error('Google Books request failed')
  const data = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.items ?? []).map((item: any) => ({
    title: item.volumeInfo?.title ?? '',
    author: item.volumeInfo?.authors?.[0] ?? 'Unknown Author',
    cover_url: (() => {
      const links = item.volumeInfo?.imageLinks
      const raw = links?.extraLarge ?? links?.large ?? links?.medium ?? links?.thumbnail
      if (!raw) return undefined
      // Upgrade to https, maximise zoom, and request a larger fife size for cards
      return raw
        .replace('http:', 'https:')
        .replace(/zoom=\d+/, 'zoom=0')
        .replace(/&fife=[^&]*/g, '') + '&fife=w600'
    })(),
  }))
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

function rankAndDeduplicate(results: BookSuggestion[], query: string): BookSuggestion[] {
  // Deduplicate by normalised title, keeping the entry with a cover if available
  const map = new Map<string, BookSuggestion>()
  for (const s of results) {
    const key = s.title.toLowerCase().trim()
    const existing = map.get(key)
    if (!existing || (!existing.cover_url && s.cover_url)) map.set(key, s)
  }

  return [...map.values()]
    .sort((a, b) => {
      const scoreDiff = relevanceScore(b.title, query) - relevanceScore(a.title, query)
      if (scoreDiff !== 0) return scoreDiff
      // Tie-break: prefer entries that have a cover image
      return (b.cover_url ? 1 : 0) - (a.cover_url ? 1 : 0)
    })
    .slice(0, 8)
}

async function searchAllSources(query: string): Promise<BookSuggestion[]> {
  const [olGlobal, olGerman, googleGlobal, googleGerman] = await Promise.allSettled([
    searchOpenLibrary(query),
    searchOpenLibrary(query, 'ger'),
    searchGoogleBooks(query),
    searchGoogleBooks(query, 'de'),
  ])

  const combined: BookSuggestion[] = [
    ...(olGlobal.status    === 'fulfilled' ? olGlobal.value    : []),
    ...(olGerman.status    === 'fulfilled' ? olGerman.value    : []),
    ...(googleGlobal.status === 'fulfilled' ? googleGlobal.value : []),
    ...(googleGerman.status === 'fulfilled' ? googleGerman.value : []),
  ]

  return rankAndDeduplicate(combined, query)
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
  const [coverUrl, setCoverUrl] = useState(initialData?.cover_url ?? '')
  // Preserve genre if it exists (not shown in UI, still saved)
  const genreRef = useRef(initialData?.genre)

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
  const inputBase =
    'w-full px-4 h-[60px] rounded-[12px] border-2 border-[rgba(23,23,23,0.16)] ' +
    'focus:outline-none focus:border-[#160a9d] transition-colors ' +
    'text-[16px] text-[#171717] bg-white placeholder:text-[rgba(23,23,23,0.72)]'

  const labelClass = 'block text-[#171717] text-[18px] font-bold leading-6 mb-2'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-4 pb-10">

      {/* ── Title with autocomplete ─────────────────────────────────────────── */}
      <div className="relative" ref={suggestionsRef}>
        <label className={labelClass}>
          Title<span className="text-[#160a9d]">*</span>
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
        className="w-full py-4 bg-[#160a9d] rounded-full text-white text-[16px]
                   font-bold text-center disabled:opacity-50 disabled:cursor-not-allowed
                   shadow-[0_8px_24px_rgba(22,10,157,0.45),0_2px_6px_rgba(22,10,157,0.22)]"
      >
        {loading ? 'Saving…' : submitLabel}
      </motion.button>
    </form>
  )
}
