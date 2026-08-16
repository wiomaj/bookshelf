'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Heart, Pencil, BookmarkPlus, Rocket, LibraryBig, type LucideIcon } from 'lucide-react'
import { getBook, updateBook, deleteBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import { fetchBookData } from '@/lib/bookDescription'
import { enrichmentPatch, needsSynopsisLookup } from '@/lib/bookEnrichment'
import { fetchCoverByTitleAuthor } from '@/lib/bookMetadata'
import { LONG_MONTHS } from '@/lib/month'
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

const currentDate = new Date()

export default function WishlistDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { user } = useApp()
  const t = useT()

  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editStatus, setEditStatus] = useState<BookStatus>('wishlist')
  const [editAudiobook, setEditAudiobook] = useState(false)
  const [updateLoading, setUpdateLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [moveLoading, setMoveLoading] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [showMarkAsReadModal, setShowMarkAsReadModal] = useState(false)
  const [moveMonth, setMoveMonth] = useState<number>(currentDate.getMonth() + 1)
  const [moveYear, setMoveYear] = useState<number>(currentDate.getFullYear())
  const [readMonth, setReadMonth] = useState<number>(currentDate.getMonth() + 1)
  const [readYear, setReadYear] = useState<number>(currentDate.getFullYear())
  const [readRating, setReadRating] = useState(0)
  const [readNotes, setReadNotes] = useState('')

  // Pre-fill dates from stored per-status columns when book loads
  useEffect(() => {
    if (!book) return
    if (book.acquired_month) setMoveMonth(book.acquired_month)
    if (book.acquired_year) setMoveYear(book.acquired_year)
    if (book.read_month) setReadMonth(book.read_month)
    if (book.read_year) setReadYear(book.read_year)
    if (book.rating) setReadRating(book.rating)
    if (book.notes) setReadNotes(book.notes)
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
          // Nothing to fetch once the row carries the synopsis, genre and
          // release year this view renders — and what is fetched gets written
          // back, so the lookup stops after one visit.
          if (needsSynopsisLookup(b)) {
            setBookDataLoading(true)
            fetchBookData(b.title, b.author).then(data => {
              if (cancelled) return
              if (data.description) setDescription(data.description)
              if (data.genre) setApiGenre(data.genre)
              if (data.publishedYear) setPublishedYear(data.publishedYear)
              setBookDataLoading(false)

              const patch = enrichmentPatch(b, {
                description: data.description,
                genre: data.genre,
                published_date: data.publishedYear,
              })
              if (Object.keys(patch).length > 0) {
                updateBook(supabase, user.id, b.id, patch).catch(() => {})
                setBook(prev => prev ? { ...prev, ...patch } : prev)
              }
            }).catch(() => { if (!cancelled) setBookDataLoading(false) })
          }
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

  async function handleUpdate(data: ToReadFormData | Omit<Book, 'id' | 'user_id' | 'created_at'>) {
    if (!book || !user) return
    setUpdateLoading(true)
    try {
      const dateColumns: Record<string, unknown> = {}
      if (editStatus === 'read') {
        dateColumns.read_month = data.month
        dateColumns.read_year = data.year
        // Stamp the finish time on the transition to read (or backfill it for
        // books that were marked read before finished_at existed).
        if (book.status !== 'read' || !book.finished_at) dateColumns.finished_at = new Date().toISOString()
      } else if (editStatus === 'to_read') {
        dateColumns.acquired_month = data.month
        dateColumns.acquired_year = data.year
      }
      await updateBook(supabase, user.id, book.id, { ...data, status: editStatus, ...dateColumns })
      if (editStatus !== 'wishlist') {
        sessionStorage.setItem('bookshelf_returnTab', editStatus)
        sessionStorage.setItem('bookshelf_flash', 'changesSaved')
        router.replace('/')
        return
      }
      setBook(prev => prev ? { ...prev, ...data } : prev)
      setIsEditing(false)
    } finally {
      setUpdateLoading(false)
    }
  }

  async function handleDelete() {
    if (!user || !book) return
    setDeleteLoading(true)
    try {
      await deleteBook(supabase, user.id, book.id)
      sessionStorage.setItem('bookshelf_returnTab', 'wishlist')
      router.replace('/')
    } finally {
      setDeleteLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  async function handleConfirmMove(status: 'to_read' | 'read') {
    if (!user || !book) return
    if (status === 'read') {
      // Close the move modal and open the mark-as-read modal
      setShowMoveModal(false)
      setShowMarkAsReadModal(true)
      return
    }
    setMoveLoading(true)
    setShowMoveModal(false)
    try {
      await updateBook(supabase, user.id, book.id, {
        status,
        month: moveMonth,
        year: moveYear,
        acquired_month: moveMonth,
        acquired_year: moveYear,
      })
      sessionStorage.setItem('bookshelf_returnTab', 'to_read')
      router.replace('/')
    } finally {
      setMoveLoading(false)
    }
  }

  async function handleConfirmMarkAsRead() {
    if (!user || !book) return
    setMoveLoading(true)
    setShowMarkAsReadModal(false)
    try {
      await updateBook(supabase, user.id, book.id, {
        status: 'read',
        month: readMonth,
        year: readYear,
        rating: readRating,
        notes: readNotes.trim() || undefined,
        acquired_month: moveMonth,
        acquired_year: moveYear,
        read_month: readMonth,
        read_year: readYear,
        finished_at: new Date().toISOString(),
      })
      sessionStorage.setItem('bookshelf_returnTab', 'read')
      sessionStorage.setItem('bookshelf_flash', 'markedAsRead')
      router.replace('/')
    } finally {
      setMoveLoading(false)
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
          <Heart size={26} style={{ color: 'var(--label-tertiary)' }} />
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
  // Stored values first; the api* state only holds anything for books that
  // predate these columns, where the lookup above filled them in.
  const displayPublishedYear = book.published_date?.slice(0, 4) ?? publishedYear
  const displayDescription = book.description ?? description
  const addedDate = formatAddedDate(book.created_at)

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
            onClick={() => { setEditStatus('wishlist'); setEditAudiobook(book?.is_audiobook ?? false); setIsEditing(true) }}
            className="glass w-11 h-11 rounded-full flex items-center justify-center"
            aria-label="Edit"
            style={{ color: 'var(--label)' }}
          >
            <Pencil size={16} strokeWidth={2} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { sessionStorage.setItem('bookshelf_returnTab', 'wishlist'); router.back() }}
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
            <InfoChip icon={BookmarkPlus} label={t.chipAdded} value={addedDate} />
            <InfoChip icon={Rocket} label={t.released} value={displayPublishedYear} />
            {displayGenre && (
              <InfoChip icon={LibraryBig} label={t.genre} value={displayGenre} />
            )}
          </div>

          {/* Got this book CTA */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={moveLoading}
            onClick={() => setShowMoveModal(true)}
            className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold text-center disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
          >
            {moveLoading ? t.loading : t.markAsReceived}
          </motion.button>

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
            ) : displayDescription ? (
              <p className="text-[17px] leading-[22px] tracking-[-0.43px]" style={{ color: 'var(--label)' }}>
                {displayDescription}
              </p>
            ) : (
              <p className="text-[16px] leading-6 italic" style={{ color: 'var(--label-tertiary)' }}>
                {t.noDescriptionAvailable}
              </p>
            )}
          </div>

          {/* Delete CTA */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowDeleteConfirm(true)}
            className="self-start px-4 py-[6px] rounded-full text-[15px]"
            style={{ backgroundColor: 'var(--fill)', color: 'var(--label)' }}
          >
            {t.deleteBook}
          </motion.button>
        </motion.div>
      </div>

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

      {/* ── Move modal ──────────────────────────────────────────────────── */}
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
                {t.whenDidYouGetIt}
              </h3>

              {/* Month + Year pickers */}
              <div className="rounded-[14px] overflow-hidden mb-6" style={{ backgroundColor: 'var(--fill)' }}>
                <div className="grid grid-cols-3">
                  <div className="col-span-2" style={{ borderRight: '1px solid var(--separator)' }}>
                    <select
                      value={moveMonth}
                      onChange={e => setMoveMonth(Number(e.target.value))}
                      className="w-full px-4 h-[52px] bg-transparent focus:outline-none text-[17px] appearance-none cursor-pointer"
                      style={{ color: 'var(--label)' }}
                    >
                      {t.monthNames.map((m, i) => (
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
                      {Array.from({ length: 30 }, (_, i) => currentDate.getFullYear() - i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleConfirmMove('to_read')}
                  className="w-full py-[15px] rounded-[14px] text-[17px] font-semibold text-white"
                  style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
                >
                  {t.markAsReceived}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleConfirmMove('read')}
                  className="w-full py-[15px] rounded-[14px] text-[17px] font-semibold text-white"
                  style={{ backgroundColor: 'var(--success)' }}
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
      </AnimatePresence>

      {/* ── Mark as read modal (second step) ──────────────────────────── */}
      <AnimatePresence>
        {showMarkAsReadModal && (
          <>
            <motion.div
              key="read-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMarkAsReadModal(false)}
              className="fixed inset-0 z-40"
              style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            />
            <motion.div
              key="read-sheet"
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
                      value={readMonth}
                      onChange={e => setReadMonth(Number(e.target.value))}
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
                      value={readYear}
                      onChange={e => setReadYear(Number(e.target.value))}
                      className="w-full px-4 h-[52px] bg-transparent focus:outline-none text-[17px] appearance-none cursor-pointer"
                      style={{ color: 'var(--label)' }}
                    >
                      {Array.from({ length: 30 }, (_, i) => currentDate.getFullYear() - i).map(y => (
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
                <StarRating rating={readRating} onRate={setReadRating} size={36} />
                {readRating > 0 && (
                  <p className="text-[14px] mt-2" style={{ color: 'var(--label-secondary)' }}>
                    {(['', ...t.ratingLabels] as string[])[readRating]}
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
                    value={readNotes}
                    onChange={e => setReadNotes(e.target.value)}
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
                  onClick={() => setShowMarkAsReadModal(false)}
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
    </>
  )
}
