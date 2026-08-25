'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ScanBarcode, Search, Loader2, Camera, ChevronLeft, BookOpen } from 'lucide-react'
import ISBNScanner from '@/components/ISBNScanner'
import StarRating from '@/components/StarRating'
import { addBook, updateBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import { useApp, useT } from '@/contexts/AppContext'
import { fetchCoverByTitleAuthor } from '@/lib/bookMetadata'
import { uploadCoverPhoto } from '@/lib/coverUpload'
import { coverUrl as proxiedCoverUrl } from '@/lib/coverUrl'
import { searchBooksPage } from '@/lib/bookSearch'
import type { BookSuggestion } from '@/lib/bookSearch'

type ListTab = 'read' | 'to_read' | 'wishlist'

const currentYear = new Date().getFullYear()

// ── Helpers ────────────────────────────────────────────────────────────────────

function yearFromDate(publishedDate?: string | null): number | null {
  if (!publishedDate) return null
  const y = parseInt(publishedDate.slice(0, 4))
  return !isNaN(y) && y >= 1000 && y <= currentYear ? y : null
}

const EMPTY_SUGGESTION: BookSuggestion = { title: '', author: '' }

// ── Placeholder book icon for cover-less results ───────────────────────────────

function CoverPlaceholder({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ backgroundColor: 'var(--fill)' }}
    >
      <svg width="20" height="24" viewBox="0 0 16 20" fill="none" style={{ opacity: 0.3 }}>
        <rect x="1" y="1" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <line x1="4" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="4" y1="9.5" x2="12" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="4" y1="13" x2="9" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

/** Cover thumbnail that falls back to a placeholder when the image 404s or is blank. */
function ResultCover({ src, className, onFail }: { src?: string; className: string; onFail?: () => void }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <CoverPlaceholder className={className} />

  function handleFail() {
    setFailed(true)
    onFail?.()
  }

  // Route external covers through /api/cover: 7-day caching, and blank
  // 1×1 "no cover" images from Open Library become real 404s.
  const resolved = src.startsWith('/') ? src : proxiedCoverUrl(src)

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt=""
      loading="lazy"
      decoding="async"
      onError={handleFail}
      onLoad={(e) => {
        const img = e.currentTarget
        if (img.naturalWidth <= 1 || img.naturalHeight <= 1) handleFail()
      }}
      className={`${className} object-cover`}
      style={{ backgroundColor: 'var(--fill)' }}
    />
  )
}

// ── Main content ───────────────────────────────────────────────────────────────

function AddBookContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useApp()
  const t = useT()

  const incomingTab: ListTab = (() => {
    const p = searchParams.get('tab')
    return (p === 'to_read' || p === 'wishlist') ? p : 'read'
  })()

  // ── Search state ────────────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookSuggestion[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searched, setSearched] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const queryRef = useRef('')

  // ── Confirm state (set once a book is selected) ──────────────────────────────
  const [selected, setSelected] = useState<BookSuggestion | null>(null)
  const [tab, setTab] = useState<ListTab>(incomingTab)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [isAudiobook, setIsAudiobook] = useState(false)
  const [isEbook, setIsEbook] = useState(false)
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState<number | null>(new Date().getMonth() + 1)
  const [rating, setRating] = useState(0)
  const [notes, setNotes] = useState('')
  const [trYear, setTrYear] = useState(currentYear)
  const [trMonth, setTrMonth] = useState<number | null>(new Date().getMonth() + 1)

  const [photoLoading, setPhotoLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [error, setError] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [showScanner, setShowScanner] = useState(false)

  // Autofocus the search field on mount
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // ── Debounced search (page 1) ────────────────────────────────────────────────
  useEffect(() => {
    queryRef.current = query
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.trim().length < 3) {
      setResults([])
      setSearched(false)
      setHasMore(false)
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)
    debounceRef.current = setTimeout(async () => {
      const q = query
      try {
        const { results: r, hasMore: hm } = await searchBooksPage(q, 1)
        // Ignore stale responses if the query changed while awaiting
        if (queryRef.current !== q) return
        setResults(r)
        setPage(1)
        setHasMore(hm)
        setSearched(true)
      } catch {
        if (queryRef.current === q) { setResults([]); setSearched(true); setHasMore(false) }
      } finally {
        if (queryRef.current === q) setSearchLoading(false)
      }
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    try {
      const { results: r, hasMore: hm } = await searchBooksPage(queryRef.current, nextPage)
      setResults((prev) => {
        // Dedup against what's already shown (by title+author)
        const seen = new Set(prev.map((p) => `${p.title.toLowerCase()}|${p.author.toLowerCase()}`))
        const fresh = r.filter((b) => !seen.has(`${b.title.toLowerCase()}|${b.author.toLowerCase()}`))
        return [...prev, ...fresh]
      })
      setPage(nextPage)
      setHasMore(hm)
    } catch { /* keep current list */ } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, page])

  // ── Selecting a book → go to confirm view ────────────────────────────────────
  function selectBook(s: BookSuggestion) {
    setSelected(s)
    setTab(incomingTab)
    setTitle(s.title)
    setAuthor(s.author)
    setCoverUrl(s.cover_url ?? '')
    setIsAudiobook(false)
    setIsEbook(false)
    setRating(0)
    setNotes('')
    setError('')
    const y = yearFromDate(s.publishedDate)
    if (y && incomingTab === 'read') setYear(y)
    // Reset to-read / read dates to "now" each selection
    setMonth(new Date().getMonth() + 1)
    setTrMonth(new Date().getMonth() + 1)
    setTrYear(currentYear)
    if (incomingTab !== 'read') setYear(currentYear)
    window.scrollTo(0, 0)
  }

  function backToSearch() {
    setSelected(null)
    setError('')
    // Restore focus so the user can keep searching
    setTimeout(() => searchInputRef.current?.focus(), 0)
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
      e.target.value = ''
    }
  }

  function handleClose() {
    if (tab === 'to_read') sessionStorage.setItem('bookshelf_returnTab', 'to_read')
    if (tab === 'wishlist') sessionStorage.setItem('bookshelf_returnTab', 'wishlist')
    router.back()
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError(t.validationTitleRequired); return }
    if (!user) return

    setSaveLoading(true)
    try {
      // The picked suggestion carries subjects; keep the first as the genre so
      // the dashboard's genre breakdown has something to count. A book typed in
      // by hand has none — the detail page backfills it on first view.
      const genre = selected?.subjects?.[0]

      const enrichCover = async (id: string) => {
        if (coverUrl || !title) return
        try {
          const cover = await fetchCoverByTitleAuthor(title.trim(), author.trim())
          if (cover) await updateBook(supabase, user.id, id, { cover_url: cover })
        } catch { /* ignore */ }
      }

      if (tab === 'read') {
        const saved = await addBook(supabase, user.id, {
          title: title.trim(), author: author.trim(), genre,
          year, month, rating, notes: notes.trim() || undefined,
          cover_url: coverUrl.trim() || undefined,
          is_audiobook: isAudiobook,
          is_ebook: isEbook,
        })
        await enrichCover(saved.id)
        sessionStorage.setItem('bookshelf_returnTab', 'read')
        sessionStorage.setItem('bookshelf_flash', 'markedAsRead')
        router.push('/')
      } else if (tab === 'to_read') {
        const saved = await addBook(supabase, user.id, {
          title: title.trim(), author: author.trim(), genre,
          status: 'to_read', year: trYear, month: trMonth, rating: 0,
          notes: notes.trim() || undefined,
          cover_url: coverUrl.trim() || undefined,
          is_audiobook: isAudiobook,
          is_ebook: isEbook,
        })
        await enrichCover(saved.id)
        sessionStorage.setItem('bookshelf_returnTab', 'to_read')
        sessionStorage.setItem('bookshelf_flash', 'bookAddedToRead')
        router.push('/')
      } else {
        const saved = await addBook(supabase, user.id, {
          title: title.trim(), author: author.trim(), genre,
          status: 'wishlist', year: 0, month: null, rating: 0,
          notes: notes.trim() || undefined,
          cover_url: coverUrl.trim() || undefined,
          is_audiobook: isAudiobook,
          is_ebook: isEbook,
        })
        await enrichCover(saved.id)
        sessionStorage.setItem('bookshelf_returnTab', 'wishlist')
        sessionStorage.setItem('bookshelf_flash', 'bookAddedToWishlist')
        router.push('/')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.errorSomethingWentWrong)
    } finally {
      setSaveLoading(false)
    }
  }

  const inputBase = 'w-full px-4 h-[52px] bg-transparent focus:outline-none text-[17px] transition-colors'
  const sectionLabel = 'block text-[13px] font-semibold uppercase tracking-wide mb-2 px-1'

  // ════════════════════════════════════════════════════════════════════════════
  // Confirm view
  // ════════════════════════════════════════════════════════════════════════════
  if (selected !== null) {
    const submitLabel =
      tab === 'read' ? t.addBook :
      tab === 'to_read' ? t.addToReadingList :
      t.addToWishlist

    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        {/* Header */}
        <div className="flex items-center justify-between h-[60px] px-4">
          <button
            onClick={backToSearch}
            className="flex items-center gap-1 -ml-1 text-[17px]"
            style={{ color: 'var(--primary)' }}
          >
            <ChevronLeft size={22} />
            {t.searchCancel}
          </button>
          <button
            onClick={handleClose}
            className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--fill)', color: 'var(--label-secondary)' }}
            aria-label="Close"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <motion.form
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSave}
          className="flex flex-col gap-5 px-4 pb-10"
        >
          {/* Selected book hero */}
          <div className="flex items-center gap-4 pt-1 pb-2">
            <ResultCover src={coverUrl} onFail={() => setCoverUrl('')} className="w-16 h-24 rounded-[10px] shadow-sm flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[20px] font-bold leading-tight" style={{ color: 'var(--label)' }}>
                {title || t.titlePlaceholder}
              </p>
              {author && <p className="text-[15px] mt-1" style={{ color: 'var(--label-secondary)' }}>{author}</p>}
            </div>
          </div>

          {/* Shelf segmented control */}
          <div className="flex p-[3px] rounded-full" style={{ backgroundColor: 'var(--fill)' }}>
            {([
              { key: 'read', label: t.tabRead },
              { key: 'to_read', label: t.tabToRead },
              { key: 'wishlist', label: t.tabWishlist },
            ] as { key: ListTab; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className="flex-1 py-[6px] rounded-full text-[13px] font-medium transition-all"
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

          {/* Title (editable) */}
          <div>
            <label className={sectionLabel} style={{ color: 'var(--label-secondary)' }}>
              {t.titleLabel}<span style={{ color: 'var(--primary)' }}> *</span>
            </label>
            <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.titlePlaceholder}
                className={inputBase}
                style={{ color: 'var(--label)' }}
              />
            </div>
          </div>

          {/* Author (editable) */}
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

          {/* Format checkboxes (audiobook / ebook) */}
          <div className="flex items-center gap-6 px-1 pb-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isAudiobook}
                onChange={(e) => setIsAudiobook(e.target.checked)}
                className="w-5 h-5 rounded accent-[var(--primary)]"
              />
              <span className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--label-secondary)' }}>{t.audiobook}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isEbook}
                onChange={(e) => setIsEbook(e.target.checked)}
                className="w-5 h-5 rounded accent-[var(--primary)]"
              />
              <span className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--label-secondary)' }}>{t.ebook}</span>
            </label>
          </div>

          {/* Date read (Read tab) */}
          {tab === 'read' && (
            <div>
              <label className={sectionLabel} style={{ color: 'var(--label-secondary)' }}>{isAudiobook ? t.whenDidYouListen : t.whenDidYouRead}</label>
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
                      <optgroup label={t.optgroupMonth}>
                        {t.monthNames.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                      </optgroup>
                      <optgroup label={t.optgroupSeason}>
                        {t.seasonNames.map((s, i) => <option key={13 + i} value={13 + i}>{s}</option>)}
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
                      {Array.from({ length: 30 }, (_, i) => currentYear - i).map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Date added (To Read tab) */}
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
                      <optgroup label={t.optgroupMonth}>
                        {t.monthNames.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                      </optgroup>
                      <optgroup label={t.optgroupSeason}>
                        {t.seasonNames.map((s, i) => <option key={13 + i} value={13 + i}>{s}</option>)}
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
                      {Array.from({ length: 30 }, (_, i) => currentYear - i).map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rating (Read tab) */}
          {tab === 'read' && (
            <div>
              <label className={sectionLabel} style={{ color: 'var(--label-secondary)' }}>{t.ratingLabel}</label>
              <StarRating rating={rating} onRate={setRating} size={36} />
              {rating > 0 && (
                <p className="text-[14px] mt-2 px-1" style={{ color: 'var(--label-secondary)' }}>
                  {(['', ...t.ratingLabels] as string[])[rating]}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
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

          {/* Cover */}
          <div>
            <label className={sectionLabel} style={{ color: 'var(--label-secondary)' }}>{t.coverPreview}</label>
            {coverUrl ? (
              <div className="flex items-center gap-4 px-1">
                <ResultCover src={coverUrl} onFail={() => setCoverUrl('')} className="w-14 h-20 rounded-[10px] shadow-sm flex-shrink-0" />
                <div className="flex flex-col gap-1">
                  <button type="button" onClick={() => photoInputRef.current?.click()} className="text-[14px] text-left" style={{ color: 'var(--primary)' }}>
                    {t.takePhoto}
                  </button>
                  <button type="button" onClick={() => setCoverUrl('')} className="text-[14px] text-left" style={{ color: 'var(--danger)' }}>
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
                  : <><Camera size={18} /><span>{t.takePhoto}</span></>}
              </button>
            )}
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
          </div>

          {error && <p className="text-[14px] px-1" style={{ color: 'var(--danger)' }}>{error}</p>}

          <motion.button
            type="submit"
            disabled={saveLoading}
            whileTap={{ scale: 0.97 }}
            className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
          >
            {saveLoading ? t.loading : submitLabel}
          </motion.button>
        </motion.form>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Search view
  // ════════════════════════════════════════════════════════════════════════════
  const showEmpty = searched && !searchLoading && results.length === 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between h-[60px] px-4">
        <h1 className="text-[20px] font-bold tracking-[-0.3px]" style={{ color: 'var(--label)' }}>
          {t.addABook}
        </h1>
        <button
          onClick={handleClose}
          className="w-9 h-9 flex items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--fill)', color: 'var(--label-secondary)' }}
          aria-label="Close"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* Sticky search bar */}
      <div className="sticky top-0 z-10 px-4 pt-1 pb-3" style={{ backgroundColor: 'var(--bg)' }}>
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
            <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--label-tertiary)' }}>
              {searchLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchBooksPlaceholder}
              className="w-full pl-12 pr-10 h-[52px] bg-transparent focus:outline-none text-[17px]"
              style={{ color: 'var(--label)' }}
              autoComplete="off"
              autoCorrect="off"
              enterKeyHint="search"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); searchInputRef.current?.focus() }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--fill)', color: 'var(--label-secondary)' }}
                aria-label="Clear"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="px-4 pb-24">
        {/* Initial hint */}
        {!searched && !searchLoading && query.trim().length < 3 && (
          <div className="flex flex-col items-center text-center gap-3 pt-24 px-8">
            <Search size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p className="text-[15px]" style={{ color: 'var(--label-tertiary)' }}>{t.searchHint}</p>
          </div>
        )}

        {/* Loading skeletons */}
        {searchLoading && results.length === 0 && (
          <div className="flex flex-col">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid var(--separator)' }}>
                <div className="w-11 h-16 rounded-[6px] flex-shrink-0 animate-pulse" style={{ backgroundColor: 'var(--fill)' }} />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-4 w-3/4 rounded animate-pulse" style={{ backgroundColor: 'var(--fill)' }} />
                  <div className="h-3 w-1/2 rounded animate-pulse" style={{ backgroundColor: 'var(--fill)' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {showEmpty && (
          <div className="flex flex-col items-center text-center gap-4 pt-20 px-8">
            <BookOpen size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p className="text-[16px] font-semibold" style={{ color: 'var(--label)' }}>{t.searchNoResults}</p>
            <button
              type="button"
              onClick={() => selectBook({ ...EMPTY_SUGGESTION, title: query.trim() })}
              className="px-5 py-[10px] rounded-full text-[15px] font-medium"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            >
              {t.addManually}
            </button>
          </div>
        )}

        {/* Results list */}
        <AnimatePresence initial={false}>
          {results.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
              {results.map((s, i) => {
                const y = yearFromDate(s.publishedDate)
                const meta = [s.author, y ? String(y) : null].filter(Boolean).join(' · ')
                return (
                  <button
                    key={`${s.title}-${s.author}-${i}`}
                    type="button"
                    onClick={() => selectBook(s)}
                    className="w-full flex items-center gap-3 py-3 text-left active:opacity-60 transition-opacity"
                    style={{ borderBottom: '1px solid var(--separator)' }}
                  >
                    <ResultCover src={s.cover_url} className="w-11 h-16 rounded-[6px] flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[16px] leading-snug line-clamp-2" style={{ color: 'var(--label)' }}>{s.title}</p>
                      {meta && <p className="text-[13px] mt-0.5 truncate" style={{ color: 'var(--label-secondary)' }}>{meta}</p>}
                    </div>
                  </button>
                )
              })}

              {/* Show more */}
              {hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="mt-4 mx-auto px-6 py-[10px] rounded-full text-[15px] font-medium flex items-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: 'var(--fill)', color: 'var(--label)' }}
                >
                  {loadingMore ? <Loader2 size={16} className="animate-spin" /> : null}
                  {t.showMore}
                </button>
              )}

              {/* Manual add escape hatch under the list */}
              <button
                type="button"
                onClick={() => selectBook({ ...EMPTY_SUGGESTION, title: query.trim() })}
                className="mt-4 mb-2 mx-auto text-[14px]"
                style={{ color: 'var(--primary)' }}
              >
                {t.addManually}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showScanner && (
        <ISBNScanner
          onScanned={(s) => { setShowScanner(false); selectBook(s) }}
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
        <div className="w-7 h-7 border-2 border-[var(--fill)] rounded-full animate-spin" style={{ borderTopColor: 'var(--primary)' }} />
      </div>
    }>
      <AddBookContent />
    </Suspense>
  )
}
