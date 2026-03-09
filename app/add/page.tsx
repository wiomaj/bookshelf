'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { X, ScanBarcode, Search, Loader2, Camera } from 'lucide-react'
import ISBNScanner from '@/components/ISBNScanner'
import StarRating from '@/components/StarRating'
import { addBook, updateBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import { useApp, useT } from '@/contexts/AppContext'
import { fetchCoverByTitleAuthor } from '@/lib/bookMetadata'
import { uploadCoverPhoto } from '@/lib/coverUpload'
import { LONG_MONTHS, SEASONS } from '@/lib/month'
import { searchBooks } from '@/lib/bookSearch'
import type { BookSuggestion } from '@/lib/bookSearch'
import { googleCoverFromResponse } from '@/lib/bookMetadata'
import { gbUrl } from '@/lib/gbUrl'

type ListTab = 'read' | 'to_read' | 'wishlist'

const currentYear = new Date().getFullYear()

// ── Cover enrichment (same as BookForm) ───────────────────────────────────────

async function fetchCoverByISBN(isbn: string): Promise<string | undefined> {
  try {
    const res = await fetch(gbUrl({ q: `isbn:${isbn}`, maxResults: '1' }))
    if (!res.ok) return undefined
    return googleCoverFromResponse(await res.json())
  } catch { return undefined }
}

async function searchAllSources(query: string): Promise<BookSuggestion[]> {
  type RichSuggestion = BookSuggestion & { isbn?: string }
  const base = await searchBooks(query)
  const rich: RichSuggestion[] = base.map((s) => ({ ...s }))
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

// ── Main content ───────────────────────────────────────────────────────────────

function AddBookContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useApp()
  const t = useT()

  const [tab, setTab] = useState<ListTab>(() => {
    const p = searchParams.get('tab')
    return (p === 'to_read' || p === 'wishlist') ? p : 'read'
  })

  // Shared form state
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [photoLoading, setPhotoLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Read-specific state
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState<number | null>(new Date().getMonth() + 1)
  const [rating, setRating] = useState(0)
  const [notes, setNotes] = useState('')

  // To Read-specific state
  const [trYear, setTrYear] = useState(currentYear)
  const [trMonth, setTrMonth] = useState<number | null>(new Date().getMonth() + 1)

  // Autocomplete
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [titleFocused, setTitleFocused] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
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
        const results = await searchAllSources(title)
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
      setError(err instanceof Error ? err.message : 'Photo upload failed')
    } finally {
      setPhotoLoading(false)
      e.target.value = ''
    }
  }

  function handleClose() {
    if (tab === 'to_read') sessionStorage.setItem('bookshelf_returnTab', 'to_read')
    if (tab === 'wishlist') sessionStorage.setItem('bookshelf_returnTab', 'wishlist')
    router.back()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Title is required'); return }
    if (tab === 'read' && rating === 0) { setError('Please add a star rating'); return }
    if (!user) return

    setLoading(true)
    try {
      if (tab === 'read') {
        const saved = await addBook(supabase, user.id, {
          title: title.trim(), author: author.trim(),
          year, month, rating, notes: notes.trim() || undefined,
          cover_url: coverUrl.trim() || undefined,
        })
        if (!coverUrl && title) {
          try {
            const cover = await fetchCoverByTitleAuthor(title.trim(), author.trim())
            if (cover) await updateBook(supabase, user.id, saved.id, { cover_url: cover })
          } catch { /* ignore */ }
        }
        router.push('/')
      } else if (tab === 'to_read') {
        const saved = await addBook(supabase, user.id, {
          title: title.trim(), author: author.trim(),
          status: 'to_read', year: trYear, month: trMonth, rating: 0,
          cover_url: coverUrl.trim() || undefined,
        })
        if (!coverUrl && title) {
          try {
            const cover = await fetchCoverByTitleAuthor(title.trim(), author.trim())
            if (cover) await updateBook(supabase, user.id, saved.id, { cover_url: cover })
          } catch { /* ignore */ }
        }
        sessionStorage.setItem('bookshelf_returnTab', 'to_read')
        sessionStorage.setItem('bookshelf_flash', 'bookAddedToRead')
        router.push('/')
      } else {
        const saved = await addBook(supabase, user.id, {
          title: title.trim(), author: author.trim(),
          status: 'wishlist', year: 0, month: null, rating: 0,
          cover_url: coverUrl.trim() || undefined,
        })
        if (!coverUrl && title) {
          try {
            const cover = await fetchCoverByTitleAuthor(title.trim(), author.trim())
            if (cover) await updateBook(supabase, user.id, saved.id, { cover_url: cover })
          } catch { /* ignore */ }
        }
        sessionStorage.setItem('bookshelf_returnTab', 'wishlist')
        sessionStorage.setItem('bookshelf_flash', 'bookAddedToWishlist')
        router.push('/')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const inputBase = 'w-full px-4 h-[52px] bg-transparent focus:outline-none text-[17px] transition-colors'
  const sectionLabel = 'block text-[13px] font-semibold uppercase tracking-wide mb-2 px-1'

  const pageTitle =
    tab === 'read' ? t.addABook :
    tab === 'to_read' ? t.addToReadingList :
    t.addToWishlist

  const submitLabel =
    tab === 'read' ? t.addBook :
    tab === 'to_read' ? t.addToReadingList :
    t.addToWishlist

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between h-[60px] px-4">
        <div />
        <button
          onClick={handleClose}
          className="w-9 h-9 flex items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--fill)', color: 'var(--label-secondary)' }}
          aria-label="Close"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* ── Page title ─────────────────────────────────────────────────────── */}
      <div className="px-4 pb-5">
        <h1 className="text-[28px] font-bold tracking-[-0.4px]" style={{ color: 'var(--label)' }}>
          {pageTitle}
        </h1>
      </div>

      {/* ── Form ───────────────────────────────────────────────────────────── */}
      <motion.form
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 px-4 pb-10"
      >

        {/* Title + scan button */}
        <div className="relative" ref={suggestionsRef}>
          <label className={sectionLabel} style={{ color: 'var(--label-secondary)' }}>
            {t.titleLabel}<span style={{ color: 'var(--primary)' }}> *</span>
          </label>

          <div className="flex items-center gap-2">
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
                {searchLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              </div>
            </div>
          </div>

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
                  {s.cover_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={s.cover_url} alt="" className="w-8 h-11 object-cover rounded-[6px] flex-shrink-0" />
                    : <div className="w-8 h-11 rounded-[6px] flex-shrink-0" style={{ backgroundColor: 'var(--fill)' }} />
                  }
                  <div className="min-w-0">
                    <p className="font-semibold text-[16px] truncate" style={{ color: 'var(--label)' }}>{s.title}</p>
                    <p className="text-[13px] truncate" style={{ color: 'var(--label-secondary)' }}>{s.author}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Segmented control ─────────────────────────────────────────────── */}
        <div className="flex p-[3px] rounded-[10px]" style={{ backgroundColor: 'var(--fill)' }}>
          {([
            { key: 'read',     label: t.tabRead },
            { key: 'to_read',  label: t.tabToRead },
            { key: 'wishlist', label: t.tabWishlist },
          ] as { key: ListTab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="flex-1 py-[6px] rounded-[8px] text-[13px] font-medium transition-all"
              style={
                tab === key
                  ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--label)', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }
                  : { color: 'var(--label-secondary)' }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Author ────────────────────────────────────────────────────────── */}
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

        {/* ── Date read (Read tab only) ─────────────────────────────────────── */}
        {tab === 'read' && (
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
        )}

        {/* ── Date added (To Read tab only) ─────────────────────────────────── */}
        {tab === 'to_read' && (
          <div>
            <label className={sectionLabel} style={{ color: 'var(--label-secondary)' }}>{t.whenDidYouGetIt}</label>
            <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <div className="grid grid-cols-3">
                <div className="col-span-2" style={{ borderRight: '1px solid var(--separator)' }}>
                  <select
                    value={trMonth ?? ''}
                    onChange={(e) => setTrMonth(e.target.value === '' ? null : Number(e.target.value))}
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
                    value={trYear === 0 ? '' : trYear}
                    onChange={(e) => setTrYear(e.target.value === '' ? 0 : Number(e.target.value))}
                    className={inputBase + ' appearance-none cursor-pointer'}
                    style={{ color: 'var(--label)' }}
                  >
                    <option value="">—</option>
                    {Array.from({ length: 30 }, (_, i) => currentYear - i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Rating (Read tab only) ────────────────────────────────────────── */}
        {tab === 'read' && (
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
        )}

        {/* ── Notes (Read tab only) ────────────────────────────────────────── */}
        {tab === 'read' && (
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
        )}

        {/* ── Cover ────────────────────────────────────────────────────────── */}
        <div>
          <label className={sectionLabel} style={{ color: 'var(--label-secondary)' }}>
            {t.coverPreview}
          </label>
          {coverUrl ? (
            <div className="flex items-center gap-4 px-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt="Cover preview" className="w-14 h-20 object-cover rounded-[10px] shadow-sm flex-shrink-0" />
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

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && (
          <p className="text-[14px] px-1" style={{ color: '#FF3B30' }}>{error}</p>
        )}

        {/* ── Submit ───────────────────────────────────────────────────────── */}
        <motion.button
          type="submit"
          disabled={loading}
          whileTap={{ scale: 0.97 }}
          className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
        >
          {loading ? t.loading : submitLabel}
        </motion.button>
      </motion.form>

      {/* ── ISBN Scanner ─────────────────────────────────────────────────────── */}
      {showScanner && (
        <ISBNScanner
          onScanned={(s) => { setShowScanner(false); selectSuggestion(s) }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}

export default function AddBookPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-7 h-7 border-2 border-black/10 rounded-full animate-spin"
             style={{ borderTopColor: 'var(--primary)' }} />
      </div>
    }>
      <AddBookContent />
    </Suspense>
  )
}
