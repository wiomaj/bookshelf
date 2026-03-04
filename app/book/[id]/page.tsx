'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { BookOpen, Pencil, X } from 'lucide-react'
import { getBook, updateBook, deleteBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import { fetchBookData } from '@/lib/bookDescription'
import { fetchCoverByTitleAuthor } from '@/lib/bookMetadata'
import StarRating from '@/components/StarRating'
import BookForm from '@/components/BookForm'
import ConfirmDialog from '@/components/ConfirmDialog'
import { formatMonthShort } from '@/lib/month'
import { useApp, useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'

/** Upgrade a cover URL to the highest resolution available for the full-width hero. */
function heroImageUrl(url: string): string {
  if (url.includes('books.google.com')) {
    return url
      .replace('http:', 'https:')
      .replace(/zoom=\d+/, 'zoom=0')
      .replace(/&fife=[^&]*/g, '') + '&fife=w1200'
  }
  if (url.includes('covers.openlibrary.org')) {
    return url.replace(/-[SM]\.jpg$/, '-L.jpg')
  }
  return url
}

export default function BookDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { user } = useApp()
  const t = useT()

  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [updateLoading, setUpdateLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [description, setDescription] = useState<string | undefined>(undefined)
  const [apiGenre, setApiGenre] = useState<string | undefined>(undefined)
  const [bookDataLoading, setBookDataLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    getBook(supabase, user.id, id).then((b) => {
      if (!b) setNotFound(true)
      else {
        setBook(b)
        setBookDataLoading(true)
        fetchBookData(b.title, b.author).then((data) => {
          setDescription(data.description)
          setApiGenre(data.genre)
          setBookDataLoading(false)
        })
        // If no cover, search for one in the background and update silently
        if (!b.cover_url && b.title) {
          fetchCoverByTitleAuthor(b.title, b.author ?? '').then((cover) => {
            if (!cover) return
            updateBook(supabase, b.id, { cover_url: cover }).catch(() => {})
            setBook((prev) => prev ? { ...prev, cover_url: cover } : prev)
          }).catch(() => {})
        }
      }
      setLoading(false)
    })
  }, [id, user])

  async function handleUpdate(data: Omit<Book, 'id' | 'user_id' | 'created_at'>) {
    if (!book || !user) return
    setUpdateLoading(true)
    try {
      await updateBook(supabase, user.id, book.id, { ...data, status: 'read' })
      sessionStorage.setItem('bookshelf_flash', 'changesSaved')
      router.replace('/')
    } finally {
      setUpdateLoading(false)
    }
  }

  async function handleDelete() {
    if (!book || !user) return
    setDeleteLoading(true)
    try {
      await deleteBook(supabase, user.id, book.id)
      router.replace('/')
    } finally {
      setDeleteLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-7 h-7 border-2 border-black/10 rounded-full animate-spin"
             style={{ borderTopColor: 'var(--primary)' }} />
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (notFound || !book) {
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
        {/* Close button — top right */}
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
          <BookForm
            initialData={book}
            onSubmit={handleUpdate}
            submitLabel={t.saveChanges}
            loading={updateLoading}
          />
        </motion.div>
      </div>
    )
  }

  // ── View mode ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>

        {/* ── Hero cover (230px) ──────────────────────────────────────── */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26, mass: 0.85 }}
          className="relative h-[260px] w-full overflow-hidden"
          style={{ backgroundColor: 'var(--fill)' }}
        >
          <div className="absolute inset-0">
            {book.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImageUrl(book.cover_url)}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, var(--fill) 0%, var(--separator-opaque) 100%)' }}>
                <BookOpen size={60} style={{ color: 'var(--label-tertiary)' }} />
              </div>
            )}
          </div>

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-[rgba(0,0,0,0)] to-[rgba(0,0,0,0.72)]" />

          {/* Edit + Close buttons — top right */}
          <div className="absolute top-4 right-4 flex items-center gap-1">
            <button
              onClick={() => setIsEditing(true)}
              className="w-9 h-9 flex items-center justify-center text-white"
              aria-label="Edit"
            >
              <Pencil size={20} strokeWidth={2} />
            </button>
            <button
              onClick={() => router.back()}
              className="w-9 h-9 flex items-center justify-center text-white"
              aria-label="Close"
            >
              <X size={24} />
            </button>
          </div>

          {/* Info block at the bottom of the hero */}
          <div className="absolute bottom-0 left-0 w-full px-4 pb-5 flex flex-col gap-2">
            <StarRating rating={book.rating} readonly size={20} darkBg />
            <div className="flex items-end gap-2 flex-wrap">
              <h1 className="text-white text-[24px] font-bold leading-8">
                {book.title}
              </h1>
              <span
                className="px-2 py-1 mb-[2px] rounded-[8px] text-[12px] font-bold uppercase leading-4"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' }}
              >
                {formatMonthShort(book.month)
                  ? `${formatMonthShort(book.month)} ${book.year}`
                  : book.year}
              </span>
            </div>
            {book.author && (
              <p className="text-[13px] font-medium leading-4" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {book.author}
              </p>
            )}
          </div>
        </motion.div>

        {/* ── Details ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="px-4 pt-6 flex flex-col gap-6"
        >
          {/* My notes */}
          {book.notes ? (
            <p className="text-[16px] font-normal leading-6 whitespace-pre-wrap" style={{ color: 'var(--label)' }}>
              {book.notes}
            </p>
          ) : (
            <p className="text-[16px] leading-6 italic" style={{ color: 'var(--label-tertiary)' }}>
              {t.noNotesAdded}
            </p>
          )}

          {/* Released + Genre */}
          <div className="flex gap-4">
            <div className="flex flex-col gap-1.5 w-[140px] shrink-0">
              <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--label-tertiary)' }}>
                {t.released}
              </span>
              <span className="text-[16px] leading-6" style={{ color: 'var(--label)' }}>
                {formatMonthShort(book.month)
                  ? `${formatMonthShort(book.month)} ${book.year}`
                  : book.year}
              </span>
            </div>
            {(book.genre || apiGenre) && (
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--label-tertiary)' }}>
                  {t.genre}
                </span>
                <span className="text-[16px] leading-6" style={{ color: 'var(--label)' }}>
                  {book.genre || apiGenre}
                </span>
              </div>
            )}
          </div>

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
              <p className="text-[16px] font-normal leading-6" style={{ color: 'var(--label)' }}>
                {description}
              </p>
            ) : (
              <p className="text-[16px] leading-6 italic" style={{ color: 'var(--label-tertiary)' }}>
                {t.noDescriptionAvailable}
              </p>
            )}
          </div>
        </motion.div>

        {/* ── Delete CTA ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="px-4 pt-4 pb-10"
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowDeleteConfirm(true)}
            className="px-6 py-[11px] rounded-[14px] text-[16px] font-semibold"
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
    </>
  )
}
