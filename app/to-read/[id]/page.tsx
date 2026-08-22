'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { AnimatePresence } from 'framer-motion'
import { X, BookOpen, Book as BookIcon, Pencil, Rocket, LibraryBig, type LucideIcon } from 'lucide-react'
import { getBook, updateBook, deleteBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import { fetchBookData } from '@/lib/bookDescription'
import { fetchCoverByTitleAuthor } from '@/lib/bookMetadata'
import { LONG_MONTHS } from '@/lib/month'
import { readingDurationDays } from '@/lib/readingDuration'
import { useApp, useT } from '@/contexts/AppContext'
import ConfirmDialog from '@/components/ConfirmDialog'
import StarRating from '@/components/StarRating'
import StatusPicker, { type BookStatus } from '@/components/StatusPicker'
import BookForm from '@/components/BookForm'
import ToReadForm, { type ToReadFormData } from '@/components/ToReadForm'
import { heroCoverUrl } from '@/lib/coverUrl'
import type { Book } from '@/types/book'

const bookPatternUrl =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='-4 -4 32 32' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20'/%3E%3C/svg%3E")`

function InfoChip({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string | undefined
}) {
  if (!value) return null
  return (
    <div
      className="shrink-0 flex items-center gap-3 rounded-[16px] px-4 py-2"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <Icon size={16} strokeWidth={1.8} className="shrink-0" style={{ color: 'var(--label-secondary)' }} />
      <div className="flex flex-col gap-[3px]">
        <span className="text-[12px] leading-[16px]" style={{ color: 'var(--label-secondary)' }}>
          {label}
        </span>
        <span className="text-[12px] leading-[16px] font-medium" style={{ color: 'var(--label)' }}>
          {value}
        </span>
      </div>
    </div>
  )
}

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatAddedDate(createdAt: string): string {
  const d = new Date(createdAt)
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export default function ToReadDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { user } = useApp()
  const t = useT()

  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editStatus, setEditStatus] = useState<BookStatus>('to_read')
  const [editAudiobook, setEditAudiobook] = useState(false)
  const [updateLoading, setUpdateLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false)
  const [abandonLoading, setAbandonLoading] = useState(false)
  const [abandonRating, setAbandonRating] = useState(0)
  const [abandonNotes, setAbandonNotes] = useState('')
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveLoading, setMoveLoading] = useState(false)
  const [moveMonth, setMoveMonth] = useState<number>(new Date().getMonth() + 1)
  const [moveYear, setMoveYear] = useState<number>(new Date().getFullYear())
  const [moveRating, setMoveRating] = useState(0)
  const [moveNotes, setMoveNotes] = useState('')

  const [showStartReadingModal, setShowStartReadingModal] = useState(false)
  const [startReadingError, setStartReadingError] = useState<string | null>(null)
  const [startDay, setStartDay] = useState<number>(new Date().getDate())
  const [startMonth, setStartMonth] = useState<number>(new Date().getMonth() + 1)
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear())
  const [startReadingLoading, setStartReadingLoading] = useState(false)

  const [showCtaDropdown, setShowCtaDropdown] = useState(false)
  const ctaDropdownRef = useRef<HTMLDivElement>(null)

  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationDuration, setCelebrationDuration] = useState<string | null>(null)
  const [celebrationDays, setCelebrationDays] = useState<number | null>(null)
  const [celebrationRating, setCelebrationRating] = useState(0)
  const celebrationBookRef = useRef<Book | null>(null)

  // Pre-fill dates from stored per-status columns when book loads
  useEffect(() => {
    if (!book) return
    if (book.read_month) setMoveMonth(book.read_month)
    if (book.read_year) setMoveYear(book.read_year)
    if (book.rating) setMoveRating(book.rating)
    if (book.notes) setMoveNotes(book.notes)
    if (book.started_reading_day) setStartDay(book.started_reading_day)
    if (book.started_reading_month) setStartMonth(book.started_reading_month)
    if (book.started_reading_year) setStartYear(book.started_reading_year)
  }, [book?.id])

  const [description, setDescription] = useState<string | undefined>(undefined)
  const [apiGenre, setApiGenre] = useState<string | undefined>(undefined)
  const [publishedYear, setPublishedYear] = useState<string | undefined>(undefined)
  const [bookDataLoading, setBookDataLoading] = useState(false)
  const [coverFailed, setCoverFailed] = useState(false)
  const coverRetryRef = useRef(false)

  function handleCoverError() {
    setCoverFailed(true)
    if (coverRetryRef.current || !user || !book) return
    coverRetryRef.current = true
    fetchCoverByTitleAuthor(book.title, book.author ?? '').then((newCover) => {
      if (!newCover || newCover === book.cover_url) return
      updateBook(supabase, user.id, book.id, { cover_url: newCover }).catch(() => {})
      setBook(prev => prev ? { ...prev, cover_url: newCover } : prev)
      setCoverFailed(false)
    }).catch(() => {})
  }

  function handleCoverLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    if (img.naturalWidth <= 1 || img.naturalHeight <= 1) handleCoverError()
  }

  useEffect(() => {
    if (!user || !id) return
    let cancelled = false

    getBook(supabase, user.id, id)
      .then(b => {
        if (cancelled) return
        setBook(b)
        if (b) {
          setBookDataLoading(true)
          fetchBookData(b.title, b.author).then(data => {
            if (cancelled) return
            // Only overwrite state with truthy values — prevents a stale
            // re-run (e.g. auth token refresh) from clearing data that a
            // previous successful fetch already populated.
            if (data.description) setDescription(data.description)
            if (data.genre) setApiGenre(data.genre)
            if (data.publishedYear) setPublishedYear(data.publishedYear)
            // The genre was display-only until now, so the dashboard's genre
            // breakdown had nothing to count once this book is read. Store it
            // once, the same way the cover is backfilled below.
            if (data.genre && !b.genre) {
              const genre = data.genre
              updateBook(supabase, user.id, b.id, { genre }).catch(() => {})
              setBook(prev => prev ? { ...prev, genre } : prev)
            }
            setBookDataLoading(false)
          }).catch(() => { if (!cancelled) setBookDataLoading(false) })
          if (!b.cover_url && b.title) {
            fetchCoverByTitleAuthor(b.title, b.author ?? '').then((cover) => {
              if (cancelled || !cover || cover === b.cover_url) return
              updateBook(supabase, user.id, b.id, { cover_url: cover }).catch(() => {})
              setBook((prev) => prev ? { ...prev, cover_url: cover } : prev)
            }).catch(() => {})
          }
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, id])

  // Close dropdown on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (ctaDropdownRef.current && !ctaDropdownRef.current.contains(e.target as Node)) {
      setShowCtaDropdown(false)
    }
  }, [])
  useEffect(() => {
    if (showCtaDropdown) document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showCtaDropdown, handleOutsideClick])

  async function handleUpdate(data: ToReadFormData | Omit<Book, 'id' | 'user_id' | 'created_at'>) {
    if (!book || !user) return
    setUpdateLoading(true)
    try {
      // If the user didn't change the status picker away from to_read but the
      // book is currently_reading, preserve that status so editing metadata
      // doesn't accidentally kick it out of the "Lese ich gerade" rail.
      const effectiveStatus = (editStatus === 'to_read' && book.status === 'currently_reading')
        ? 'currently_reading'
        : editStatus

      const dateColumns: Record<string, unknown> = {}
      if (effectiveStatus === 'read') {
        dateColumns.read_month = data.month
        dateColumns.read_year = data.year
        // Stamp the finish time on the transition to read (or backfill it for
        // books that were marked read before finished_at existed).
        if (book.status !== 'read' || !book.finished_at) dateColumns.finished_at = new Date().toISOString()
      } else if (effectiveStatus === 'to_read') {
        dateColumns.acquired_month = data.month
        dateColumns.acquired_year = data.year
      }
      await updateBook(supabase, user.id, book.id, { ...data, status: effectiveStatus, ...dateColumns })
      if (effectiveStatus !== 'to_read' && effectiveStatus !== 'currently_reading') {
        sessionStorage.setItem('bookshelf_returnTab', effectiveStatus)
        sessionStorage.setItem('bookshelf_flash', 'changesSaved')
        router.replace('/')
        return
      }
      setBook(prev => prev ? { ...prev, ...data, status: effectiveStatus } : prev)
      setIsEditing(false)
    } finally {
      setUpdateLoading(false)
    }
  }

  async function handleConfirmMarkAsRead() {
    if (!user || !book) return
    setMoveLoading(true)
    setShowMoveModal(false)
    try {
      const prevMonth = book.month ?? moveMonth
      const prevYear = book.year ?? moveYear
      const finishedAt = new Date().toISOString()
      await updateBook(supabase, user.id, book.id, {
        status: 'read',
        month: moveMonth,
        year: moveYear,
        rating: moveRating,
        notes: moveNotes.trim() || undefined,
        read_month: moveMonth,
        read_year: moveYear,
        finished_at: finishedAt,
      })
      sessionStorage.setItem('bookshelf_returnTab', 'read')
      sessionStorage.setItem('bookshelf_flash', 'markedAsRead')
      sessionStorage.setItem('bookshelf_flash_undo', JSON.stringify({ bookId: book.id, month: prevMonth, year: prevYear }))

      // Reading duration, counted the same way as the "Reading time" chip on the
      // detail page: start date → the finish stamp just written.
      const rawDays = readingDurationDays({
        ...book,
        finished_at: finishedAt,
        read_month: moveMonth,
        read_year: moveYear,
      })
      let duration: string | null = null
      if (rawDays !== null) {
        if (rawDays < 30) duration = `${rawDays} ${rawDays === 1 ? t.durationDay : t.durationDays}`
        else { const m = Math.round(rawDays / 30); duration = `${m} ${m === 1 ? t.durationMonth : t.durationMonths}` }
      }
      celebrationBookRef.current = book
      setCelebrationDuration(duration)
      setCelebrationDays(rawDays)
      setCelebrationRating(moveRating)
      setShowCelebration(true)
    } finally {
      setMoveLoading(false)
    }
  }

  function handleCelebrationDismiss() {
    setShowCelebration(false)
    router.replace('/')
  }

  async function handleDelete() {
    if (!user || !book) return
    setDeleteLoading(true)
    try {
      await deleteBook(supabase, user.id, book.id)
      router.replace('/')
    } finally {
      setDeleteLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  async function handleAbandon() {
    if (!user || !book) return
    setAbandonLoading(true)
    const now = new Date()
    try {
      await updateBook(supabase, user.id, book.id, {
        status: 'abandoned',
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        ...(abandonRating > 0 && { rating: abandonRating }),
        ...(abandonNotes.trim() && { notes: abandonNotes.trim() }),
      })
      router.replace('/')
    } finally {
      setAbandonLoading(false)
      setShowAbandonConfirm(false)
    }
  }

  // Preselect today's date unless the book already carries a start date
  function openStartReadingModal() {
    const now = new Date()
    if (!book?.started_reading_day) setStartDay(now.getDate())
    if (!book?.started_reading_month) setStartMonth(now.getMonth() + 1)
    if (!book?.started_reading_year) setStartYear(now.getFullYear())
    setShowStartReadingModal(true)
  }

  async function handleStartReading() {
    if (!user || !book) return
    setStartReadingLoading(true)
    setStartReadingError(null)
    try {
      const updated = await updateBook(supabase, user.id, book.id, {
        status: 'currently_reading',
        started_reading_day: startDay || null,
        started_reading_month: startMonth,
        started_reading_year: startYear,
      })
      setBook(updated)
      setShowStartReadingModal(false)
    } catch (err) {
      console.error('[handleStartReading] DB write failed:', err)
      setStartReadingError(err instanceof Error ? err.message : t.errorSomethingWentWrong)
    } finally {
      setStartReadingLoading(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-7 h-7 border-2 border-[var(--fill)] rounded-full animate-spin"
             style={{ borderTopColor: 'var(--primary)' }} />
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (!book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4"
           style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
             style={{ backgroundColor: 'var(--fill)' }}>
          <BookOpen size={26} style={{ color: 'var(--label-tertiary)' }} />
        </div>
        <h2 className="text-[18px] font-bold" style={{ color: 'var(--label)' }}>{t.bookNotFound}</h2>
        <button
          onClick={() => router.replace('/')}
          className="text-[16px] font-medium"
          style={{ color: 'var(--primary)' }}
        >
          {t.backToBookshelf}
        </button>
      </div>
    )
  }

  // ── Edit mode ────────────────────────────────────────────────────────────────
  if (isEditing) {
    return (
      <div className="min-h-screen relative" style={{ backgroundColor: 'var(--bg)' }}>
        <button
          onClick={() => setIsEditing(false)}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center z-10"
          style={{ color: 'var(--label)' }}
        >
          <X size={24} />
        </button>
        <div className="px-4 pt-14 pb-4 flex flex-col gap-4">
          <h1 className="text-[28px] font-bold tracking-[-0.4px]" style={{ color: 'var(--label)' }}>
            {t.editBook}
          </h1>
          <StatusPicker value={editStatus} onChange={setEditStatus} />
        </div>
        <motion.div key={editStatus} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          {editStatus === 'read' ? (
            <BookForm
              initialData={{
                ...book,
                is_audiobook: editAudiobook,
                month: book.read_month ?? book.month,
                year: book.read_year ?? book.year,
              }}
              onSubmit={handleUpdate}
              submitLabel={t.saveChanges}
              loading={updateLoading}
              status="read"
              onAudiobookChange={setEditAudiobook}
            />
          ) : (
            <ToReadForm
              initialData={{
                ...book,
                is_audiobook: editAudiobook,
                month: editStatus === 'to_read' ? (book.acquired_month ?? book.month) : book.month,
                year: editStatus === 'to_read' ? (book.acquired_year ?? book.year) : book.year,
              }}
              onSubmit={handleUpdate}
              submitLabel={t.saveChanges}
              loading={updateLoading}
              hideDateField={editStatus === 'wishlist'}
              onAudiobookChange={setEditAudiobook}
            />
          )}
        </motion.div>
      </div>
    )
  }

  const showCover = book.cover_url && !coverFailed
  const displayGenre = book.genre || apiGenre
  const addedDate = (() => {
    const m = book.acquired_month ?? book.month
    const y = book.acquired_year ?? (book.year && book.year > 0 ? book.year : null)
    if (!y) return formatAddedDate(book.created_at)
    if (!m) return String(y)
    if (m >= 1 && m <= 12) return `${SHORT_MONTHS[m - 1]} ${y}`
    // Season months: 13=Spring 14=Summer 15=Fall 16=Winter
    if (m >= 13 && m <= 16) return `${t.seasonNames[m - 13]} ${y}`
    return String(y)
  })()
  const isCurrentlyReading = book.status === 'currently_reading'
  const startedDate = (() => {
    if (!isCurrentlyReading || !book.started_reading_year) return null
    const parts: string[] = []
    if (book.started_reading_day) parts.push(String(book.started_reading_day))
    if (book.started_reading_month) parts.push(SHORT_MONTHS[book.started_reading_month - 1])
    parts.push(String(book.started_reading_year))
    return parts.join(' ')
  })()

  // ── View mode ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="relative" style={{ minHeight: '100vh' }}>

        {/* ── Blurred background ──────────────────────────────────────────── */}
        {showCover ? (
          <div className="absolute top-0 left-0 right-0 h-[360px] overflow-hidden z-0">
            <img
              src={heroCoverUrl(book.cover_url)}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-[1.4] blur-[40px] opacity-90"
              onError={handleCoverError}
              onLoad={handleCoverLoad}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, transparent, transparent, color-mix(in srgb, var(--bg-elevated) 60%, transparent))' }}
            />
          </div>
        ) : (
          <div
            className="absolute top-0 left-0 right-0 h-[360px] z-0"
            style={{ background: 'linear-gradient(to bottom, var(--primary), color-mix(in srgb, var(--primary) 66%, black))' }}
          />
        )}

        {/* ── Toolbar (edit + close) ───────────────────────────────────────── */}
        <div className="relative z-30 flex justify-end gap-2 pt-4 pr-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { setEditStatus('to_read'); setEditAudiobook(book?.is_audiobook ?? false); setIsEditing(true) }}
            className="glass w-11 h-11 rounded-full flex items-center justify-center"
            aria-label="Edit"
            style={{ color: 'var(--label)' }}
          >
            <Pencil size={16} strokeWidth={2} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { sessionStorage.setItem('bookshelf_returnTab', 'to_read'); router.back() }}
            className="glass w-11 h-11 rounded-full flex items-center justify-center"
            aria-label="Close"
            style={{ color: 'var(--label)' }}
          >
            <X size={18} />
          </motion.button>
        </div>

        {/* ── Book cover floating card ─────────────────────────────────────── */}
        <motion.div
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26, mass: 0.8 }}
          className="relative z-20 flex justify-center mt-3"
        >
          <div
            className="relative w-[148px] h-[220px] rounded-[10px] overflow-hidden"
            style={{ boxShadow: '0 20px 48px rgba(0,0,0,0.30), 0 4px 8px rgba(0,0,0,0.12)' }}
          >
            {book.is_audiobook && (
              <div className="absolute top-2 left-2 z-10 w-[26px] h-[26px] rounded-full backdrop-blur-sm flex items-center justify-center" style={{ backgroundColor: 'rgba(60, 60, 67, 0.60)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
                </svg>
              </div>
            )}
            {book.is_ebook && (
              <div className="absolute top-2 z-10 w-[26px] h-[26px] rounded-full backdrop-blur-sm flex items-center justify-center" style={{ backgroundColor: 'rgba(60, 60, 67, 0.60)', left: book.is_audiobook ? '40px' : '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
                  <line x1="12" x2="12.01" y1="18" y2="18" />
                </svg>
              </div>
            )}
            {showCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroCoverUrl(book.cover_url)}
                alt={book.title}
                className="w-full h-full object-cover"
                onError={handleCoverError}
                onLoad={handleCoverLoad}
              />
            ) : (
              <div className="relative w-full h-full" style={{ backgroundColor: 'var(--primary)' }}>
                <div
                  className="absolute inset-0 opacity-[0.16]"
                  style={{
                    backgroundImage: bookPatternUrl,
                    backgroundSize: '32px 32px',
                    backgroundRepeat: 'repeat',
                  }}
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Details sheet ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
          className="relative z-10 -mt-5 px-4 pt-[48px] pb-12 flex flex-col gap-5"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            boxShadow: '0 -4px 32px rgba(0,0,0,0.10), 0 -1px 0 rgba(0,0,0,0.04)',
            minHeight: 'calc(100vh - 295px)',
          }}
        >
          {/* Title + Author */}
          <div className="flex flex-col gap-[6px]">
            <h1
              className="text-[28px] font-bold leading-[34px] tracking-[0.38px] flex items-center gap-2"
              style={{ color: 'var(--label)' }}
            >
              {book.is_audiobook && (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-40">
                  <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
                </svg>
              )}
              {book.is_ebook && (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-40">
                  <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
                  <line x1="12" x2="12.01" y1="18" y2="18" />
                </svg>
              )}
              {book.title}
            </h1>
            {book.author && (
              <p
                className="text-[17px] font-semibold leading-[22px] tracking-[-0.43px]"
                style={{ color: 'var(--label)' }}
              >
                {book.author}
              </p>
            )}
          </div>

          {/* Info chips — horizontal scroll */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            <InfoChip icon={BookIcon} label={t.chipReceived} value={addedDate} />
            {startedDate && (
              <InfoChip icon={BookOpen} label={t.startedReadingLabel} value={startedDate} />
            )}
            <InfoChip icon={Rocket} label={t.released} value={publishedYear} />
            {displayGenre && (
              <InfoChip icon={LibraryBig} label={t.genre} value={displayGenre} />
            )}
          </div>

          {/* CTAs */}
          <div className="flex gap-3">
            {/* Abandon icon */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowAbandonConfirm(true)}
              className="shrink-0 w-[52px] h-[52px] rounded-[14px] flex items-center justify-center"
              style={{ backgroundColor: 'rgba(255, 56, 60, 0.12)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
                <path d="m14.5 7-5 5" />
                <path d="m9.5 7 5 5" />
              </svg>
            </motion.button>

            {/* Split CTA — label on left, chevron on right opens dropdown */}
            <div ref={ctaDropdownRef} className="relative flex-1">
              <div
                className="flex rounded-[14px] overflow-hidden text-white text-[17px] font-semibold"
                style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
              >
                {/* Main label — triggers primary action directly */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setShowCtaDropdown(false); setShowMoveModal(true) }}
                  disabled={moveLoading}
                  className="flex-1 py-[15px] pl-4 text-left disabled:opacity-60"
                >
                  {moveLoading ? t.loading : (book.is_audiobook ? t.markAsListened : t.markAsRead)}
                </motion.button>

                {/* Divider + chevron — opens dropdown (only for to_read) */}
                {!isCurrentlyReading && (
                  <>
                    <div className="w-px my-3" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowCtaDropdown(v => !v)}
                      className="px-4 flex items-center justify-center"
                      aria-label="More options"
                    >
                      <motion.svg
                        width="14" height="14" viewBox="0 0 14 14" fill="none"
                        animate={{ rotate: showCtaDropdown ? 180 : 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <path d="M2 4.5L7 9.5L12 4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </motion.svg>
                    </motion.button>
                  </>
                )}
              </div>

              {/* Dropdown menu */}
              <AnimatePresence>
                {showCtaDropdown && (
                  <motion.div
                    key="cta-dropdown"
                    initial={{ opacity: 0, scale: 0.95, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 6 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute bottom-[calc(100%+8px)] right-0 min-w-[220px] rounded-[14px] overflow-hidden z-20"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
                    }}
                  >
                    {/* Mark as Read */}
                    <button
                      onClick={() => { setShowCtaDropdown(false); setShowMoveModal(true) }}
                      className="w-full flex items-center gap-3 px-4 py-[14px] text-left text-[16px] font-medium"
                      style={{ color: 'var(--label)' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', flexShrink: 0 }}>
                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                      {book.is_audiobook ? t.markAsListened : t.markAsRead}
                    </button>

                    {/* Separator */}
                    <div className="mx-4 h-px" style={{ backgroundColor: 'var(--separator)' }} />

                    {/* Start Reading */}
                    <button
                      onClick={() => { setShowCtaDropdown(false); openStartReadingModal() }}
                      className="w-full flex items-center gap-3 px-4 py-[14px] text-left text-[16px] font-medium"
                      style={{ color: 'var(--label)' }}
                    >
                      <BookOpen size={18} style={{ color: 'var(--label-secondary)', flexShrink: 0 }} />
                      {t.startReading}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* My notes */}
          <div className="flex flex-col gap-[6px]">
            <span className="text-[12px] leading-[16px]" style={{ color: 'var(--label-secondary)' }}>
              {t.myNotesLabel}
            </span>
            {book.notes ? (
              <p className="text-[16px] font-normal leading-6 whitespace-pre-wrap" style={{ color: 'var(--label)' }}>
                {book.notes}
              </p>
            ) : (
              <p className="text-[16px] leading-6 italic" style={{ color: 'var(--label-tertiary)' }}>
                {t.noNotesAdded}
              </p>
            )}
          </div>

          {/* About the book */}
          <div className="flex flex-col gap-[6px]">
            <span className="text-[12px] leading-[16px]" style={{ color: 'var(--label-secondary)' }}>
              {t.aboutTheBook}
            </span>
            {bookDataLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-[var(--fill)] rounded-full animate-spin"
                     style={{ borderTopColor: 'var(--primary)' }} />
                <span className="text-[14px]" style={{ color: 'var(--label-tertiary)' }}>{t.loading}</span>
              </div>
            ) : description ? (
              <p className="text-[17px] leading-[22px] tracking-[-0.43px]" style={{ color: 'var(--label)' }}>
                {description}
              </p>
            ) : (
              <p className="text-[16px] leading-6 italic" style={{ color: 'var(--label-tertiary)' }}>
                {t.noDescriptionAvailable}
              </p>
            )}
          </div>

          {/* Delete */}
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-[6px] rounded-full text-[15px]"
              style={{ backgroundColor: 'var(--fill)', color: 'var(--label)' }}
            >
              {t.deleteBook}
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* ── Start reading modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {showStartReadingModal && (
          <>
            <motion.div
              key="start-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStartReadingModal(false)}
              className="fixed inset-0 z-40"
              style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            />
            <motion.div
              key="start-sheet"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-w-[600px] mx-auto rounded-t-[28px] p-6 pb-10"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <div className="w-10 h-1 rounded-full mx-auto mb-5"
                   style={{ backgroundColor: 'var(--separator-opaque)' }} />

              <h3 className="text-[22px] font-bold tracking-[-0.3px] mb-5" style={{ color: 'var(--label)' }}>
                {t.startReadingWhen}
              </h3>

              {/* Day / Month / Year pickers */}
              <div className="rounded-[14px] overflow-hidden mb-6" style={{ backgroundColor: 'var(--fill)' }}>
                <div className="grid grid-cols-[72px_1fr_88px]">
                  {/* Day (optional) */}
                  <div style={{ borderRight: '1px solid var(--separator)' }}>
                    <select
                      value={startDay}
                      onChange={e => setStartDay(Number(e.target.value))}
                      className="w-full px-3 h-[52px] bg-transparent focus:outline-none text-[17px] appearance-none cursor-pointer"
                      style={{ color: startDay === 0 ? 'var(--label-tertiary)' : 'var(--label)' }}
                    >
                      <option value={0}>—</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  {/* Month */}
                  <div style={{ borderRight: '1px solid var(--separator)' }}>
                    <select
                      value={startMonth}
                      onChange={e => setStartMonth(Number(e.target.value))}
                      className="w-full px-4 h-[52px] bg-transparent focus:outline-none text-[17px] appearance-none cursor-pointer"
                      style={{ color: 'var(--label)' }}
                    >
                      {LONG_MONTHS.map((m, i) => (
                        <option key={i + 1} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  {/* Year */}
                  <div>
                    <select
                      value={startYear}
                      onChange={e => setStartYear(Number(e.target.value))}
                      className="w-full px-3 h-[52px] bg-transparent focus:outline-none text-[17px] appearance-none cursor-pointer"
                      style={{ color: 'var(--label)' }}
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {startReadingError && (
                <p className="text-[14px] mb-3 px-1" style={{ color: 'var(--danger)' }}>{startReadingError}</p>
              )}

              <div className="flex flex-col gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleStartReading}
                  disabled={startReadingLoading}
                  className="w-full py-[15px] rounded-[14px] text-[17px] font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
                >
                  {startReadingLoading ? t.loading : t.startReading}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowStartReadingModal(false)}
                  className="w-full py-[15px] rounded-[14px] text-[17px] font-semibold"
                  style={{ backgroundColor: 'var(--fill)', color: 'var(--label)' }}
                >
                  {t.cancel}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Mark as read modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showMoveModal && (
          <>
            <motion.div
              key="move-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMoveModal(false)}
              className="fixed inset-0 z-40"
              style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            />
            <motion.div
              key="move-sheet"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-w-[600px] mx-auto rounded-t-[28px] p-6 pb-10"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <div className="w-10 h-1 rounded-full mx-auto mb-5"
                   style={{ backgroundColor: 'var(--separator-opaque)' }} />

              <h3 className="text-[22px] font-bold tracking-[-0.3px] mb-5" style={{ color: 'var(--label)' }}>
                {book.is_audiobook ? t.whenDidYouListen : t.whenDidYouRead}
              </h3>

              {/* Month + Year pickers */}
              <div className="rounded-[14px] overflow-hidden mb-5" style={{ backgroundColor: 'var(--fill)' }}>
                <div className="grid grid-cols-3">
                  <div className="col-span-2" style={{ borderRight: '1px solid var(--separator)' }}>
                    <select
                      value={moveMonth}
                      onChange={e => setMoveMonth(Number(e.target.value))}
                      className="w-full px-4 h-[52px] bg-transparent focus:outline-none text-[17px] appearance-none cursor-pointer"
                      style={{ color: 'var(--label)' }}
                    >
                      {LONG_MONTHS.map((m, i) => (
                        <option key={i + 1} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      value={moveYear}
                      onChange={e => setMoveYear(Number(e.target.value))}
                      className="w-full px-4 h-[52px] bg-transparent focus:outline-none text-[17px] appearance-none cursor-pointer"
                      style={{ color: 'var(--label)' }}
                    >
                      {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Rating */}
              <div className="mb-5">
                <label className="block text-[13px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--label-secondary)' }}>
                  {t.ratingLabel}
                </label>
                <StarRating rating={moveRating} onRate={setMoveRating} size={36} />
                {moveRating > 0 && (
                  <p className="text-[14px] mt-2" style={{ color: 'var(--label-secondary)' }}>
                    {(['', ...t.ratingLabels] as string[])[moveRating]}
                  </p>
                )}
              </div>

              {/* Notes (optional) */}
              <div className="mb-6">
                <label className="block text-[13px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--label-secondary)' }}>
                  {t.myNotesLabel}
                </label>
                <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: 'var(--fill)' }}>
                  <textarea
                    value={moveNotes}
                    onChange={e => setMoveNotes(e.target.value)}
                    placeholder={t.notesPlaceholder}
                    rows={3}
                    className="w-full px-4 py-3 bg-transparent focus:outline-none text-[17px] resize-none"
                    style={{ color: 'var(--label)' }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleConfirmMarkAsRead}
                  className="w-full py-[15px] rounded-[14px] text-[17px] font-semibold text-white"
                  style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
                >
                  {book.is_audiobook ? t.markAsListened : t.markAsRead}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowMoveModal(false)}
                  className="w-full py-[15px] rounded-[14px] text-[17px] font-semibold"
                  style={{ backgroundColor: 'var(--fill)', color: 'var(--label)' }}
                >
                  {t.cancel}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
        {showAbandonConfirm && (
          <>
            <motion.div
              key="abandon-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAbandonConfirm(false)}
              className="fixed inset-0 z-40"
              style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            />
            <motion.div
              key="abandon-sheet"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-w-[600px] mx-auto rounded-t-[28px] p-6 pb-10"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <div className="w-10 h-1 rounded-full mx-auto mb-5"
                   style={{ backgroundColor: 'var(--separator-opaque)' }} />

              <div className="flex flex-col gap-1.5 mb-5">
                <h3 className="text-[22px] font-bold tracking-[-0.3px]" style={{ color: 'var(--label)' }}>
                  {t.abandonDialogTitle}
                </h3>
              </div>

              {/* Rating (optional) */}
              <div className="mb-5">
                <label className="block text-[13px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--label-secondary)' }}>
                  {t.ratingLabel}
                </label>
                <StarRating rating={abandonRating} onRate={setAbandonRating} size={36} />
                {abandonRating > 0 && (
                  <p className="text-[14px] mt-2" style={{ color: 'var(--label-secondary)' }}>
                    {(['', ...t.ratingLabels] as string[])[abandonRating]}
                  </p>
                )}
              </div>

              {/* Notes (optional) */}
              <div className="mb-6">
                <label className="block text-[13px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--label-secondary)' }}>
                  {t.myNotesLabel}
                </label>
                <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: 'var(--fill)' }}>
                  <textarea
                    value={abandonNotes}
                    onChange={e => setAbandonNotes(e.target.value)}
                    placeholder={t.notesPlaceholder}
                    rows={3}
                    className="w-full px-4 py-3 bg-transparent focus:outline-none text-[17px] resize-none"
                    style={{ color: 'var(--label)' }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAbandon}
                  disabled={abandonLoading}
                  className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold disabled:opacity-50"
                  style={{ backgroundColor: 'rgb(255, 59, 48)' }}
                >
                  {abandonLoading ? t.loading : t.abandonBook}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowAbandonConfirm(false)}
                  className="w-full py-[15px] rounded-[14px] text-[17px] font-semibold"
                  style={{ backgroundColor: 'var(--fill)', color: 'var(--label)' }}
                >
                  {t.cancel}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={showDeleteConfirm}
        title={t.deleteDialogTitle}
        description={`"${book.title}" ${t.deleteDialogSuffix}`}
        confirmLabel={t.deleteBook}
        loadingLabel={t.deleting}
        cancelLabel={t.cancel}
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* ── Celebration overlay ───────────────────────────────────────── */}
      <AnimatePresence>
        {showCelebration && (() => {
          const speed: ReadSpeed = celebrationDays === null ? 'unknown' : celebrationDays < 21 ? 'fast' : celebrationDays >= 60 ? 'slow' : 'unknown'
          const msg = getCelebrationMessage(celebrationRating, speed)
          return (
            <motion.div
              key="celebration"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCelebrationDismiss}
              className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden cursor-pointer"
              style={{ backgroundColor: 'var(--bg)' }}
            >
              <CelebrationConfetti />
              <motion.div
                initial={{ scale: 0.7, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.15 }}
                className="relative z-10 flex flex-col items-center text-center px-8 gap-3"
              >
                {celebrationBookRef.current?.cover_url && (
                  <motion.div
                    initial={{ y: -220, rotate: -16, scale: 0.65, opacity: 0 }}
                    animate={{ y: 0, rotate: 0, scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 210, damping: 13, delay: 0.05 }}
                  >
                    <motion.img
                      src={heroCoverUrl(celebrationBookRef.current.cover_url)}
                      alt={celebrationBookRef.current.title}
                      className="w-[96px] h-[140px] rounded-[8px] object-cover mb-2"
                      style={{ boxShadow: '0 16px 40px rgba(0,0,0,0.25)' }}
                      animate={{ y: [0, -10, 0], rotate: [0, 1.5, -1.5, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}
                    />
                  </motion.div>
                )}
                <h2 className="text-[28px] font-bold leading-[34px]" style={{ color: 'var(--label)' }}>
                  {msg.title}
                </h2>
                <p className="text-[17px]" style={{ color: 'var(--label-secondary)' }}>
                  {msg.subtitle}
                </p>
                {celebrationDuration && (
                  <p className="text-[15px] mt-1 px-4 py-2 rounded-full" style={{ backgroundColor: 'var(--fill)', color: 'var(--label-secondary)' }}>
                    {t.celebrationDuration} {celebrationDuration}{t.celebrationDurationSuffix ? ` ${t.celebrationDurationSuffix}` : ''}
                  </p>
                )}
                <p className="text-[13px] mt-6" style={{ color: 'var(--label-tertiary)' }}>
                  {t.celebrationTap}
                </p>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </>
  )
}

type ReadSpeed = 'fast' | 'slow' | 'unknown'

function getCelebrationMessage(rating: number, speed: ReadSpeed): { title: string; subtitle: string } {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]
  const msgs: Record<number, Record<ReadSpeed, { title: string; subtitles: string[] }>> = {
    0: {
      fast: { title: 'Gelesen! 📖', subtitles: [
        'Und das in Rekordzeit — weiter so!',
        'Blitzschnell durch — du bist nicht aufzuhalten!',
        'Schneller als gedacht — das nächste wartet schon!',
      ]},
      slow: { title: 'Geschafft! ✨', subtitles: [
        'Du hast dir Zeit gelassen — manchmal genau richtig.',
        'In aller Ruhe — so macht Lesen Spaß.',
        'Kein Stress, kein Druck — einfach gelesen. Schön.',
      ]},
      unknown: { title: 'Geschafft! 🎉', subtitles: [
        'Wieder ein Buch im Regal mehr!',
        'Eins nach dem anderen — du machst das großartig.',
        'Gelesen ist gelesen — auf das nächste!',
      ]},
    },
    1: {
      fast: { title: 'Schnell vorbei! 😮‍💨', subtitles: [
        'Zum Glück war es kurz — das nächste wird besser!',
        'Schnell durch und abgehakt — sehr weise.',
        'Nicht jedes Buch ist ein Gewinner — aber du bist es!',
      ]},
      slow: { title: 'Endlich! 😵‍💫', subtitles: [
        'Auch wenn es nicht toll war, du hast es durchgezogen. Gut gemacht!',
        'So eine Ausdauer verdient Respekt — auch wenn das Buch sie nicht verdient hat.',
        'Hartnäckig bis zur letzten Seite — das ist Stärke!',
      ]},
      unknown: { title: 'Respekt! 💪', subtitles: [
        'Nicht jedes Buch trifft — aber du hast es zu Ende gelesen. Das zählt.',
        'Ein Stern, aber fertig gelesen — das nennt man Charakter.',
        'Manchmal muss man durch — du hast es getan.',
      ]},
    },
    2: {
      fast: { title: 'Immerhin schnell! 😅', subtitles: [
        'War kein Highlight, aber gut — weiter geht\'s!',
        'Kurz und okay — manchmal reicht das.',
        'Nicht das Beste, aber erledigt — und das zählt!',
      ]},
      slow: { title: 'Ausdauer! 🏋️', subtitles: [
        'Manchmal kämpft man sich durch. Du hast es geschafft!',
        'Langer Weg für zwei Sterne — aber du bist am Ziel.',
        'Nicht begeistert, aber treu bis zur letzten Seite.',
      ]},
      unknown: { title: 'Abgehakt! ✅', subtitles: [
        'Nicht jedes Buch kann begeistern — das nächste vielleicht?',
        'Zwei Sterne und weiter — du gibst nicht auf!',
        'Gelesen, abgehakt, weitergezogen — so geht\'s!',
      ]},
    },
    3: {
      fast: { title: 'Solide! 👍', subtitles: [
        'Ein ordentliches Buch — und du warst dabei fix.',
        'Solide Lektüre, solides Tempo — alles passt.',
        'Nicht zu begeistert, nicht enttäuscht — und schon fertig!',
      ]},
      slow: { title: 'Gut gemacht! 🙌', subtitles: [
        'Manchmal braucht ein Buch seine Zeit. Du hast sie ihm gegeben.',
        'Mit Bedacht gelesen — drei Sterne wohl verdient.',
        'Langsam aber sicher — und das Ergebnis kann sich sehen lassen.',
      ]},
      unknown: { title: 'Geschafft! 📚', subtitles: [
        'Ein solides Buch im Regal mehr — weiter so!',
        'Drei Sterne — eine ehrliche Bewertung für ein ehrliches Buch.',
        'Nicht jedes Buch muss perfekt sein — dieses war gut genug!',
      ]},
    },
    4: {
      fast: { title: 'Kaum wegzulegen! 😍', subtitles: [
        'So ein gutes Buch liest sich einfach von selbst.',
        'Wenn man nicht aufhören kann — und dann plötzlich fertig ist!',
        'Vier Sterne und kaum zu bremsen — das sagt alles.',
      ]},
      slow: { title: 'Gut Ding will Weile! ⭐', subtitles: [
        'Du hast es ausgekostet — und vier Sterne sprechen für sich.',
        'Seite für Seite genossen — das ist die wahre Lesekunst.',
        'Langsam lesen, gut lesen — vier Sterne verdient.',
      ]},
      unknown: { title: 'Tolle Wahl! 🌟', subtitles: [
        'Ein richtig gutes Buch hast du da gelesen!',
        'Vier Sterne — da war definitiv was dabei!',
        'Fast ein Highlight — und ein klares Lesezeichen im Gedächtnis.',
      ]},
    },
    5: {
      fast: { title: 'Verschlungen! 💕', subtitles: [
        'Schon zu Ende? 🥺 Tolle Bücher lesen sich einfach zu schnell!',
        'Wenn man nicht merkt, wie die Seiten fliegen — das ist Magie.',
        'In einem Rutsch — so fühlt sich ein echtes 5-Sterne-Buch an!',
      ]},
      slow: { title: 'Ein Genuss! 🫶', subtitles: [
        'Du hast jeden Moment ausgekostet — und das zurecht!',
        'Manche Bücher verdienen es, langsam gelesen zu werden. Dieses war so eines.',
        'Jede Seite ein Genuss — und du hast keine übersprungen.',
      ]},
      unknown: { title: 'Wow! 🤩', subtitles: [
        '5 Sterne! Was für ein Buch — das bleibt im Gedächtnis.',
        'Ein absolutes Highlight — dieses Buch wirst du nicht vergessen.',
        'Selten, aber wunderbar — ein echtes 5-Sterne-Erlebnis!',
      ]},
    },
  }
  const entry = msgs[rating]?.[speed] ?? msgs[0].unknown
  return { title: entry.title, subtitle: pick(entry.subtitles) }
}

function CelebrationConfetti() {
  const particles = Array.from({ length: 70 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: 7 + Math.random() * 7,
    color: ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF922B','#CC5DE8','#20C997','#F06595'][i % 8],
    delay: Math.random() * 1.8,
    duration: 2.4 + Math.random() * 2,
    isCircle: Math.random() > 0.5,
    initialRotate: Math.random() * 360,
  }))

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <style>{`
        @keyframes confetti-drop {
          0%   { transform: translateY(-24px) rotate(var(--r0)); opacity: 1; }
          100% { transform: translateY(110vh)  rotate(var(--r1)); opacity: 0.2; }
        }
      `}</style>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: 0,
            width: p.size,
            height: p.isCircle ? p.size : p.size * 0.55,
            backgroundColor: p.color,
            borderRadius: p.isCircle ? '50%' : '2px',
            // @ts-ignore
            '--r0': `${p.initialRotate}deg`,
            '--r1': `${p.initialRotate + 540}deg`,
            animation: `confetti-drop ${p.duration}s ${p.delay}s ease-in both`,
          }}
        />
      ))}
    </div>
  )
}
