'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera, Loader2, Search } from 'lucide-react'
import ISBNScanner from './ISBNScanner'
import { useT } from '@/contexts/AppContext'
import { LONG_MONTHS, SEASONS } from '@/lib/month'
import { normaliseGoogleCover } from '@/lib/bookMetadata'

const currentYear = new Date().getFullYear()

type BookSuggestion = {
  title: string
  author: string
  cover_url?: string
}

export type ToReadFormData = {
  title: string
  author: string
  month: number | null
  year: number
  cover_url?: string
}

interface ToReadFormProps {
  initialData?: Partial<ToReadFormData>
  onSubmit: (data: ToReadFormData) => Promise<void>
  submitLabel?: string
  loading?: boolean
}

// ─── Book Search ──────────────────────────────────────────────────────────────

async function searchBooks(query: string): Promise<BookSuggestion[]> {
  const [olRes, gRes] = await Promise.allSettled([
    fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=title,author_name,cover_i&limit=6`).then(r => r.json()),
    fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=6`).then(r => r.json()),
  ])

  const results: BookSuggestion[] = []

  if (olRes.status === 'fulfilled') {
    for (const doc of olRes.value.docs ?? []) {
      results.push({
        title: doc.title ?? '',
        author: doc.author_name?.[0] ?? '',
        cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined,
      })
    }
  }
  if (gRes.status === 'fulfilled') {
    for (const item of gRes.value.items ?? []) {
      const links = item.volumeInfo?.imageLinks
      const raw = links?.extraLarge ?? links?.large ?? links?.medium ?? links?.thumbnail ?? links?.smallThumbnail
      results.push({
        title: item.volumeInfo?.title ?? '',
        author: item.volumeInfo?.authors?.[0] ?? '',
        cover_url: raw ? normaliseGoogleCover(raw) : undefined,
      })
    }
  }

  const seen = new Set<string>()
  return results.filter(r => {
    const key = r.title.toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 8)
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ToReadForm({
  initialData,
  onSubmit,
  submitLabel,
  loading = false,
}: ToReadFormProps) {
  const t = useT()
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [author, setAuthor] = useState(initialData?.author ?? '')
  const [month, setMonth] = useState<number | null>(initialData?.month ?? null)
  const [year, setYear] = useState<number>(initialData?.year ?? 0)
  const [coverUrl, setCoverUrl] = useState(initialData?.cover_url ?? '')

  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [titleFocused, setTitleFocused] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [error, setError] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const skipNextSearchRef = useRef(false)

  useEffect(() => {
    if (!titleFocused) return
    if (skipNextSearchRef.current) { skipNextSearchRef.current = false; return }
    if (title.length < 3) { setSuggestions([]); setShowSuggestions(false); return }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const results = await searchBooks(title)
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
      } catch { /* ignore */ } finally { setSearchLoading(false) }
    }, 400)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [title, titleFocused])

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
      console.debug('[ToReadForm] suggestion selected:', {
        title: s.title,
        cover_url: s.cover_url ?? '(none)',
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Title is required'); return }
    if (process.env.NODE_ENV === 'development') {
      console.debug('[ToReadForm] submitting book:', {
        title: title.trim(),
        cover_url: coverUrl.trim() || '(none)',
      })
    }

    try {
      await onSubmit({ title: title.trim(), author: author.trim(), month, year, cover_url: coverUrl.trim() || undefined })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

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
          {t.titleLabel}<span style={{ color: 'var(--primary)' }}>*</span>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="w-[60px] h-[60px] flex-shrink-0 flex items-center justify-center
                       rounded-[12px] border-2 border-[rgba(23,23,23,0.16)]
                       text-[rgba(23,23,23,0.72)] transition-colors hover:border-[rgba(23,23,23,0.4)]"
            aria-label="Scan ISBN barcode"
          >
            <Camera size={22} />
          </button>

          <div className="relative flex-1">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => setTitleFocused(true)}
              placeholder={t.titlePlaceholder}
              className={inputBase + ' pr-12'}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(23,23,23,0.72)]">
              {searchLoading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            </div>
          </div>
        </div>

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
                {s.cover_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={s.cover_url} alt="" className="w-8 h-11 object-cover rounded flex-shrink-0" />
                  : <div className="w-8 h-11 bg-gray-100 rounded flex-shrink-0" />
                }
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
        <label className={labelClass}>{t.authorLabel}</label>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder={t.authorPlaceholder}
          className={inputBase}
        />
      </div>

      {/* ── When did you get it? (Month 2/3 + Year 1/3) ────────────────────── */}
      <div>
        <label className={labelClass}>{t.whenDidYouGetIt}</label>
        <div className="grid grid-cols-3 gap-[6px]">
          <div className="col-span-2">
            <select
              value={month ?? ''}
              onChange={(e) => setMonth(e.target.value === '' ? null : Number(e.target.value))}
              className={inputBase + ' appearance-none cursor-pointer'}
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
              value={year === 0 ? '' : year}
              onChange={(e) => setYear(e.target.value === '' ? 0 : Number(e.target.value))}
              className={inputBase + ' appearance-none cursor-pointer'}
            >
              <option value="">—</option>
              {Array.from({ length: 30 }, (_, i) => currentYear - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Cover preview ──────────────────────────────────────────────────── */}
      {coverUrl && (
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="Cover preview" className="w-14 h-20 object-cover rounded-[8px] shadow-sm flex-shrink-0" />
          <div>
            <p className="text-[16px] text-[#171717] font-bold mb-1">{t.coverPreview}</p>
            <button type="button" onClick={() => setCoverUrl('')} className="text-[14px] text-red-500">
              {t.removeCover}
            </button>
          </div>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <p className="text-red-500 text-[14px] bg-red-50 px-4 py-3 rounded-[12px]">{error}</p>
      )}

      {/* ── ISBN Scanner ────────────────────────────────────────────────────── */}
      {showScanner && (
        <ISBNScanner
          onScanned={(s) => { setShowScanner(false); selectSuggestion(s) }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* ── Submit ─────────────────────────────────────────────────────────── */}
      <motion.button
        type="submit"
        disabled={loading}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-full py-4 rounded-full text-white text-[16px]
                   font-bold text-center disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
      >
        {loading ? t.loading : (submitLabel ?? t.addToReadingList)}
      </motion.button>
    </form>
  )
}
