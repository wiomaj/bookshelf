'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Heart, Pencil } from 'lucide-react'
import { getBook, updateBook, deleteBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import { fetchBookData } from '@/lib/bookDescription'
import { fetchCoverByTitleAuthor } from '@/lib/bookMetadata'
import { useApp, useT } from '@/contexts/AppContext'
import ConfirmDialog from '@/components/ConfirmDialog'
import ToReadForm, { type ToReadFormData } from '@/components/ToReadForm'
import { LONG_MONTHS } from '@/lib/month'
import type { Book } from '@/types/book'

const currentDate = new Date()

const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function getAddedTags(createdAt: string): { dateTag: string; durationTag: string } {
  const added = new Date(createdAt)
  const now = new Date()
  const dateTag = `${MONTH_NAMES[added.getMonth()]} ${added.getFullYear()}`
  const months =
    (now.getFullYear() - added.getFullYear()) * 12 +
    (now.getMonth() - added.getMonth())
  const durationTag = months <= 0 ? 'THIS MONTH' : months === 1 ? '1 MONTH' : `${months} MONTHS`
  return { dateTag, durationTag }
}

export default function WishlistDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { user } = useApp()
  const t = useT()

  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [updateLoading, setUpdateLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [moveLoading, setMoveLoading] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveMonth, setMoveMonth] = useState<number>(currentDate.getMonth() + 1)
  const [moveYear, setMoveYear] = useState<number>(currentDate.getFullYear())

  const [description, setDescription] = useState<string | undefined>(undefined)
  const [apiGenre, setApiGenre] = useState<string | undefined>(undefined)
  const [publishedYear, setPublishedYear] = useState<string | undefined>(undefined)
  const [bookDataLoading, setBookDataLoading] = useState(false)

  useEffect(() => {
    if (!user || !id) return
    getBook(supabase, user.id, id)
      .then(b => {
        setBook(b)
        if (b) {
          setBookDataLoading(true)
          fetchBookData(b.title, b.author).then(data => {
            setDescription(data.description)
            setApiGenre(data.genre)
            setPublishedYear(data.publishedYear)
            setBookDataLoading(false)
          })
          // Retroactive cover search
          if (!b.cover_url && b.title) {
            fetchCoverByTitleAuthor(b.title, b.author ?? '').then((cover) => {
              if (!cover) return
              updateBook(supabase, user.id, b.id, { cover_url: cover }).catch(() => {})
              setBook((prev) => prev ? { ...prev, cover_url: cover } : prev)
            }).catch(() => {})
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, id])

  async function handleUpdate(data: ToReadFormData) {
    if (!book || !user) return
    setUpdateLoading(true)
    try {
      await updateBook(supabase, user.id, book.id, { ...data, status: 'wishlist' })
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
    setMoveLoading(true)
    setShowMoveModal(false)
    try {
      await updateBook(supabase, user.id, book.id, { status, month: moveMonth, year: moveYear })
      sessionStorage.setItem('bookshelf_returnTab', status === 'read' ? 'read' : 'to_read')
      router.replace('/')
    } finally {
      setMoveLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-7 h-7 border-2 border-black/10 rounded-full animate-spin"
             style={{ borderTopColor: 'var(--primary)' }} />
      </div>
    )
  }

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <p className="text-[16px]" style={{ color: 'var(--label-secondary)' }}>Book not found.</p>
      </div>
    )
  }

  const { dateTag, durationTag } = getAddedTags(book.created_at)
  const displayGenre = book.genre || apiGenre

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
        <div className="px-4 pt-14 pb-4">
          <h1 className="text-[28px] font-bold tracking-[-0.4px]" style={{ color: 'var(--label)' }}>
            {t.editBook}
          </h1>
        </div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <ToReadForm
            initialData={book}
            onSubmit={handleUpdate}
            submitLabel={t.saveChanges}
            loading={updateLoading}
            hideDateField
          />
        </motion.div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen pb-8" style={{ backgroundColor: 'var(--bg)' }}>

        {/* ── Hero: full-width cover + gradient overlay ─────────────────── */}
        <div className="relative w-full min-h-[260px]" style={{ backgroundColor: 'var(--fill)' }}>
          {book.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover_url}
              alt={book.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, var(--fill) 0%, var(--separator-opaque) 100%)' }}>
              <Heart size={48} style={{ color: 'var(--label-tertiary)' }} />
            </div>
          )}

          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.72) 100%)' }}
          />

          {/* Edit + Close buttons */}
          <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
            <button
              onClick={() => setIsEditing(true)}
              className="w-9 h-9 flex items-center justify-center text-white"
              aria-label="Edit"
            >
              <Pencil size={20} strokeWidth={2} />
            </button>
            <button
              onClick={() => { sessionStorage.setItem('bookshelf_returnTab', 'wishlist'); router.push('/') }}
              className="w-9 h-9 flex items-center justify-center text-white"
              aria-label="Close"
            >
              <X size={24} strokeWidth={2} />
            </button>
          </div>

          {/* Title + tags + author */}
          <div className="relative z-[1] pt-12 px-4 pb-5 flex flex-col gap-2">
            <div className="flex items-end gap-2 flex-wrap">
              <h1 className="text-[24px] font-bold text-white leading-8">{book.title}</h1>
              <div className="flex items-center gap-1 mb-[2px]">
                <span
                  className="px-2 py-1 rounded-[8px] text-[12px] font-bold uppercase leading-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' }}
                >
                  {dateTag}
                </span>
                <span
                  className="px-2 py-1 rounded-[8px] text-[12px] font-bold uppercase leading-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' }}
                >
                  {durationTag}
                </span>
              </div>
            </div>
            {book.author && (
              <p className="text-[13px] font-medium leading-4" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {book.author}
              </p>
            )}
          </div>
        </div>

        {/* ── CTA buttons ───────────────────────────────────────────────── */}
        <div className="flex gap-3 px-4 pt-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowDeleteConfirm(true)}
            className="flex-1 py-[13px] rounded-[14px] text-[16px] font-semibold text-center"
            style={{ backgroundColor: 'var(--fill)', color: 'var(--label)' }}
          >
            {t.deleteBook}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={moveLoading}
            onClick={() => setShowMoveModal(true)}
            className="flex-1 py-[13px] rounded-[14px] text-[16px] font-semibold text-white text-center disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
          >
            {moveLoading ? t.loading : t.moveToReadingList}
          </motion.button>
        </div>

        {/* ── Details section ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="px-4 pt-6 flex flex-col gap-6"
        >
          {/* My notes */}
          {book.notes && (
            <p className="text-[16px] font-normal leading-6 whitespace-pre-wrap" style={{ color: 'var(--label)' }}>
              {book.notes}
            </p>
          )}

          {/* About the book */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--label-tertiary)' }}>
              {t.aboutTheBook}
            </span>
            {bookDataLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-black/10 rounded-full animate-spin"
                     style={{ borderTopColor: 'var(--primary)' }} />
                <span className="text-[14px]" style={{ color: 'var(--label-tertiary)' }}>{t.loading}</span>
              </div>
            ) : description ? (
              <p className="text-[16px] font-normal leading-6" style={{ color: 'var(--label)' }}>{description}</p>
            ) : (
              <p className="text-[16px] leading-6 italic" style={{ color: 'var(--label-tertiary)' }}>
                {t.noDescriptionAvailable}
              </p>
            )}
          </div>

          {/* Released + Genre */}
          {(publishedYear || displayGenre) && (
            <div className="flex gap-4">
              {publishedYear && (
                <div className="flex flex-col gap-1.5 w-[140px] shrink-0">
                  <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--label-tertiary)' }}>
                    {t.released}
                  </span>
                  <span className="text-[16px] leading-6" style={{ color: 'var(--label)' }}>{publishedYear}</span>
                </div>
              )}
              {displayGenre && (
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--label-tertiary)' }}>
                    {t.genre}
                  </span>
                  <span className="text-[16px] leading-6" style={{ color: 'var(--label)' }}>{displayGenre}</span>
                </div>
              )}
            </div>
          )}

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
                  {t.moveToReadingList}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleConfirmMove('read')}
                  className="w-full py-[15px] rounded-[14px] text-[17px] font-semibold text-white"
                  style={{ backgroundColor: '#34C759' }}
                >
                  {t.markAsRead}
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
    </>
  )
}
