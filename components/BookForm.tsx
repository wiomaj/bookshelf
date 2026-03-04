'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera, Loader2, Search } from 'lucide-react'
import StarRating from './StarRating'
import ISBNScanner from './ISBNScanner'
import { LONG_MONTHS, SEASONS } from '@/lib/month'
import { useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'
import { normaliseGoogleCover, googleCoverFromResponse } from '@/lib/bookMetadata'

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
  return (data.docs ?? []).map((doc: any) => {
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
      isbn: doc.isbn?.find((n: string) => n.length === 13) ?? doc.isbn?.[0],
    }
  })
}


async function searchGoogleBooks(query: string, langRestrict?: string): Promise<RichSuggestion[]> {
  const lang = langRestrict ? `&langRestrict=${encodeURIComponent(langRestrict)}` : ''
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10${lang}`
  )
  if (!res.ok) throw new Error('Google Books request failed')
  const data = await res.json()
  return (data.items ?? []).map((item: any) => {
    const links = item.volumeInfo?.imageLinks
    const raw = links?.extraLarge ?? links?.large ?? links?.medium ?? links?.thumbnail
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
  if (t === q) return 100
  if (t.startsWith(q)) return 80
  if (t.includes(` ${q}`) || t.includes(`${q} `)) return 60
  if (t.includes(q)) return 40
  const words = q.split(/\s+/)
  const matched = words.filter((w) => t.includes(w)).length
  return Math.round((matched / words.length) * 20)
}

function rankAndDeduplicate(results: RichSuggestion[], query: string): RichSuggestion[] {
  const map = new Map<string, RichSuggestion>()
  for (const s of results) {
    const key = s.title.toLowerCase().trim()
    const existing = map.get(key)
    if (!existing) {
      map.set(key, s)
    } else {
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

/** Query Google Books with intitle: + inauthor: */
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

  return ranked.map(({ isbn: _isbn, ...rest }) => rest)
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BookForm({
  initialData,
  onSubmit,
  submitLabel = 'Save',
  loading = false,
}: BookFormProps) {
  const t = useT()
  const [title, setTitle]     = useState(initialData?.title ?? '')
  const [author, setAuthor]   = useState(initialData?.author ?? '')
  const [year, setYear]       = useState(initialData?.year ?? currentYear)
  const [month, setMonth]     = useState<number | null>(initialData?.month ?? null)
  const [rating, setRating]   = useState(initialData?.rating ?? 0)
  const [notes, setNotes]     = useState(initialData?.notes ?? '')
  const genreRef = useRef(initialData?.genre)
  const [coverUrl, setCoverUrl] = useState(initialData?.cover_url ?? '')

  const [suggestions, setSuggestions]     = useState<BookSuggestion[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [error, setError] = useState('')

  const debounceRef        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestionsRef     = useRef<HTMLDivElement>(null)
  const skipNextSearchRef  = useRef(false)
  const [titleFocused, setTitleFocused] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  // ── Debounced autocomplete ──────────────────────────────────────────────────
  useEffect(() => {
    if (!titleFocused) return

    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false
      return
    }

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
  }, [title, titleFocused])

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
    skipNextSearchRef.current = true
    setTitle(s.title)
    setAuthor(s.author)
    if (s.cover_url) setCoverUrl(s.cover_url)
    setShowSuggestions(false)
    if (process.env.NODE_ENV === 'development') {
      console.debug('[BookForm] suggestion selected:', {
        title: s.title,
        cover_url: s.cover_url ?? '(none)',
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Title is required'); return }
    if (rating === 0)  { setError('Please add a star rating'); return }

    if (process.env.NODE_ENV === 'development') {
      console.debug('[BookForm] submitting book:', {
        title: title.trim(),
        cover_url: coverUrl.trim() || '(none)',
      })
    }

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
  const inputBase = 'w-full px-4 h-[52px] bg-transparent focus:outline-none text-[17px] transition-colors'
  const sectionLabel = 'block text-[13px] font-semibold uppercase tracking-wide mb-2 px-1'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 pb-10">

      {/* ── Title with autocomplete ─────────────────────────────────────────── */}
      <div className="relative" ref={suggestionsRef}>
        <label className={sectionLabel} style={{ color: 'var(--label-secondary)' }}>
          {t.titleLabel}<span style={{ color: 'var(--primary)' }}> *</span>
        </label>

        <div className="flex items-center gap-2">
          {/* Camera / ISBN scan button */}
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="w-[52px] h-[52px] flex-shrink-0 flex items-center justify-center rounded-[14px]"
            style={{ backgroundColor: 'var(--fill)', color: 'var(--label-secondary)' }}
            aria-label="Scan ISBN barcode"
          >
            <Camera size={20} />
          </button>

          <div className="relative flex-1 rounded-[14px] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => setTitleFocused(true)}
              placeholder={t.titlePlaceholder}
              className={inputBase + ' pr-12'}
              style={{ color: 'var(--label)' }}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--label-tertiary)' }}>
              {searchLoading
                ? <Loader2 size={18} className="animate-spin" />
                : <Search size={18} />
              }
            </div>
          </div>
        </div>

        {/* Dropdown */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-2 rounded-[16px] z-20 overflow-hidden"
               style={{ backgroundColor: 'var(--bg-elevated)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectSuggestion(s)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:opacity-70"
                style={{ borderBottom: i < suggestions.length - 1 ? '1px solid var(--separator)' : undefined }}
              >
                {s.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.cover_url} alt="" className="w-8 h-11 object-cover rounded-[6px] flex-shrink-0" />
                ) : (
                  <div className="w-8 h-11 rounded-[6px] flex-shrink-0" style={{ backgroundColor: 'var(--fill)' }} />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-[16px] truncate" style={{ color: 'var(--label)' }}>{s.title}</p>
                  <p className="text-[13px] truncate" style={{ color: 'var(--label-secondary)' }}>{s.author}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Author ─────────────────────────────────────────────────────────── */}
      <div>
        <label className={sectionLabel} style={{ color: 'var(--label-secondary)' }}>{t.authorLabel}</label>
        <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder={t.authorPlaceholder}
            className={inputBase}
            style={{ color: 'var(--label)' }}
          />
        </div>
      </div>

      {/* ── When did you read it? (Month 2/3 + Year 1/3) ─────────────────── */}
      <div>
        <label className={sectionLabel} style={{ color: 'var(--label-secondary)' }}>{t.whenDidYouRead}</label>
        <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div className="grid grid-cols-3">
            <div className="col-span-2" style={{ borderRight: '1px solid var(--separator)' }}>
              <select
                value={month ?? ''}
                onChange={(e) => setMonth(e.target.value === '' ? null : Number(e.target.value))}
                className={inputBase + ' appearance-none cursor-pointer'}
                style={{ color: 'var(--label)' }}
              >
                <option value="">{t.unknownMonth}</option>
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
                style={{ color: 'var(--label)' }}
              >
                {Array.from({ length: 30 }, (_, i) => currentYear - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Rating ─────────────────────────────────────────────────────────── */}
      <div>
        <label className={sectionLabel} style={{ color: 'var(--label-secondary)' }}>
          {t.ratingLabel}<span style={{ color: 'var(--primary)' }}> *</span>
        </label>
        <StarRating rating={rating} onRate={setRating} size={36} />
        {rating > 0 && (
          <p className="text-[14px] mt-2 px-1" style={{ color: 'var(--label-secondary)' }}>
            {(['', ...t.ratingLabels] as string[])[rating]}
          </p>
        )}
      </div>

      {/* ── My Notes ───────────────────────────────────────────────────────── */}
      <div>
        <label className={sectionLabel} style={{ color: 'var(--label-secondary)' }}>{t.myNotesLabel}</label>
        <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.notesPlaceholder}
            rows={5}
            className="w-full px-4 py-3 bg-transparent focus:outline-none text-[17px] resize-none"
            style={{ color: 'var(--label)' }}
          />
        </div>
      </div>

      {/* Cover preview (auto-filled from search) */}
      {coverUrl && (
        <div className="flex items-center gap-4 px-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt="Cover preview"
            className="w-14 h-20 object-cover rounded-[10px] shadow-sm flex-shrink-0"
          />
          <div>
            <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--label)' }}>{t.coverPreview}</p>
            <button
              type="button"
              onClick={() => setCoverUrl('')}
              className="text-[14px]"
              style={{ color: '#FF3B30' }}
            >
              {t.removeCover}
            </button>
          </div>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <p className="text-[14px] px-1" style={{ color: '#FF3B30' }}>{error}</p>
      )}

      {/* ── ISBN Scanner overlay ───────────────────────────────────────────── */}
      {showScanner && (
        <ISBNScanner
          onScanned={(suggestion) => {
            setShowScanner(false)
            selectSuggestion(suggestion)
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* ── Submit ────────────────────────────────────────────────────────── */}
      <motion.button
        type="submit"
        disabled={loading}
        whileTap={{ scale: 0.97 }}
        className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold disabled:opacity-50"
        style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
      >
        {loading ? t.loading : submitLabel}
      </motion.button>
    </form>
  )
}
