'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera, Loader2, Search, ScanBarcode } from 'lucide-react'
import StarRating from './StarRating'
import ISBNScanner from './ISBNScanner'
import { LONG_MONTHS, SEASONS } from '@/lib/month'
import { useApp, useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'
import { googleCoverFromResponse } from '@/lib/bookMetadata'
import { uploadCoverPhoto } from '@/lib/coverUpload'
import { supabase } from '@/lib/supabase'
import { searchBooks } from '@/lib/bookSearch'
import type { BookSuggestion } from '@/lib/bookSearch'
import { gbUrl } from '@/lib/gbUrl'

// ─── Constants ───────────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear()

// ─── Types ───────────────────────────────────────────────────────────────────

interface BookFormProps {
  initialData?: Partial<Book>
  onSubmit: (data: Omit<Book, 'id' | 'user_id' | 'created_at'>) => Promise<void>
  submitLabel?: string
  loading?: boolean
}

// ─── Cover fallback ───────────────────────────────────────────────────────────
// Used only for the rare case where a suggestion has no cover after the main search.

async function fetchCoverByISBN(isbn: string): Promise<string | undefined> {
  try {
    const res = await fetch(gbUrl({ q: `isbn:${isbn}`, maxResults: '1' }))
    if (!res.ok) return undefined
    return googleCoverFromResponse(await res.json())
  } catch { return undefined }
}

async function fetchCoverByTitleAuthor(title: string, author: string): Promise<string | undefined> {
  try {
    const res = await fetch(gbUrl({ q: `intitle:"${title}" inauthor:"${author}"`, maxResults: '1' }))
    if (!res.ok) return undefined
    return googleCoverFromResponse(await res.json())
  } catch { return undefined }
}

/** Search and enrich covers for the few results that have none. */
async function searchAllSources(query: string): Promise<BookSuggestion[]> {
  // isbn is needed here for the cover-enrichment pass
  type RichSuggestion = BookSuggestion & { isbn?: string }

  // Use the shared search — it deduplicates and scores internally
  const base = await searchBooks(query)
  const rich: RichSuggestion[] = base.map((s) => ({ ...s }))

  // Cover enrichment: for suggestions still missing a cover, try a targeted GB lookup
  const needsCover = rich.filter((r) => !r.cover_url)
  if (needsCover.length > 0) {
    const coverResults = await Promise.allSettled(
      needsCover.map(async (r) => {
        const attempts: Promise<string | undefined>[] = []
        if (r.isbn) attempts.push(fetchCoverByISBN(r.isbn))
        if (r.author) attempts.push(fetchCoverByTitleAuthor(r.title, r.author))
        if (attempts.length === 0) return undefined
        const settled = await Promise.allSettled(attempts)
        for (const s of settled) {
          if (s.status === 'fulfilled' && s.value) return s.value
        }
        return undefined
      })
    )
    coverResults.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        const key = needsCover[i].title.toLowerCase().trim()
        const idx = rich.findIndex((r) => r.title.toLowerCase().trim() === key)
        if (idx !== -1) rich[idx].cover_url = result.value
      }
    })
  }

  return rich.map(({ isbn: _isbn, ...rest }) => rest)
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BookForm({
  initialData,
  onSubmit,
  submitLabel = 'Save',
  loading = false,
}: BookFormProps) {
  const t = useT()
  const { user } = useApp()
  const [title, setTitle]     = useState(initialData?.title ?? '')
  const [author, setAuthor]   = useState(initialData?.author ?? '')
  const [year, setYear]       = useState(initialData?.year ?? currentYear)
  const [month, setMonth]     = useState<number | null>(initialData?.month ?? null)
  const [rating, setRating]   = useState(initialData?.rating ?? 0)
  const [notes, setNotes]     = useState(initialData?.notes ?? '')
  const genreRef = useRef(initialData?.genre)
  const [coverUrl, setCoverUrl] = useState(initialData?.cover_url ?? '')
  const [photoLoading, setPhotoLoading] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

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

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setPhotoLoading(true)
    setError('')
    try {
      const url = await uploadCoverPhoto(supabase, user.id, file)
      setCoverUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorPhotoUploadFailed)
    } finally {
      setPhotoLoading(false)
      e.target.value = ''   // allow re-selecting the same file
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError(t.validationTitleRequired); return }
    if (rating === 0)  { setError(t.validationRatingRequired); return }

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
      setError(err instanceof Error ? err.message : t.errorSomethingWentWrong)
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
          {/* ISBN scan button */}
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="w-[52px] h-[52px] flex-shrink-0 flex items-center justify-center rounded-[14px]"
            style={{ backgroundColor: 'var(--fill)', color: 'var(--label-secondary)' }}
            aria-label="Scan ISBN barcode"
          >
            <ScanBarcode size={20} />
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

      {/* ── Cover ──────────────────────────────────────────────────────────── */}
      <div>
        <label className={sectionLabel} style={{ color: 'var(--label-secondary)' }}>
          {t.coverPreview}
        </label>
        {coverUrl ? (
          <div className="flex items-center gap-4 px-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt="Cover preview"
              className="w-14 h-20 object-cover rounded-[10px] shadow-sm flex-shrink-0"
            />
            <div className="flex flex-col gap-1">
              <button type="button" onClick={() => photoInputRef.current?.click()}
                className="text-[14px] text-left" style={{ color: 'var(--primary)' }}>
                {t.takePhoto}
              </button>
              <button type="button" onClick={() => setCoverUrl('')}
                className="text-[14px] text-left" style={{ color: '#FF3B30' }}>
                {t.removeCover}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={photoLoading}
            className="flex items-center justify-center gap-2 w-full h-[52px] rounded-[14px] text-[16px] disabled:opacity-50"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--label-secondary)' }}
          >
            {photoLoading
              ? <><Loader2 size={18} className="animate-spin" /><span>{t.uploadingPhoto}</span></>
              : <><Camera size={18} /><span>{t.takePhoto}</span></>
            }
          </button>
        )}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoCapture}
        />
      </div>

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
