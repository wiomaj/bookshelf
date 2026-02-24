'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { BookOpen, Pencil, X } from 'lucide-react'
import { getBook, updateBook, deleteBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import { fetchBookData } from '@/lib/bookDescription'
import StarRating from '@/components/StarRating'
import BookForm from '@/components/BookForm'
import ConfirmDialog from '@/components/ConfirmDialog'
import { formatMonthShort } from '@/lib/month'
import { useApp, useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'

/** Upgrade a cover URL to the highest resolution available for the full-width hero. */
function heroImageUrl(url: string): string {
  // Google Books: maximise zoom + request 1200 px wide for crisp retina display
  if (url.includes('books.google.com')) {
    return url
      .replace('http:', 'https:')
      .replace(/zoom=\d+/, 'zoom=0')
      .replace(/&fife=[^&]*/g, '') + '&fife=w1200'
  }
  // Open Library: ensure we're on the largest documented size
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-gray-200 border-t-[#171717] rounded-full animate-spin" />
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (notFound || !book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
          <BookOpen size={26} className="text-gray-300" />
        </div>
        <h2 className="text-[18px] font-bold text-[#171717]">{t.bookNotFound}</h2>
        <button
          onClick={() => router.replace('/')}
          className="flex items-center gap-1.5 text-[rgba(23,23,23,0.72)] text-[16px]"
        >
          {t.backToBookshelf}
        </button>
      </div>
    )
  }

  // ── Edit mode ────────────────────────────────────────────────────────────────
  if (isEditing) {
    return (
      <div className="min-h-screen relative">
          {/* Close button — top right */}
          <button
            onClick={() => setIsEditing(false)}
            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center text-[#171717] z-10"
          >
            <X size={24} />
          </button>

          <div className="px-4 pt-12 pb-6">
            <h1 className="text-[#171717] text-[32px] font-black leading-8">{t.editBook}</h1>
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
      <div className="min-h-screen">

          {/* ── Hero cover (230px) ──────────────────────────────────────── */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26, mass: 0.85 }}
            className="relative h-[230px] w-full overflow-hidden bg-gray-200"
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
                <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                  <BookOpen size={60} className="text-gray-400" />
                </div>
              )}
            </div>

            {/* Gradient overlay: covers full image top → bottom */}
            <div className="absolute inset-0 bg-gradient-to-b from-[rgba(0,0,0,0)] to-[rgba(0,0,0,0.7)]" />

            {/* Edit + Close buttons — top right */}
            <div className="absolute top-3 right-3 flex items-center gap-1">
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
            <div className="absolute bottom-0 left-0 w-full px-4 pb-6 flex flex-col gap-2">
              {/* Stars */}
              <StarRating rating={book.rating} readonly size={20} darkBg />

              {/* Title + month/year tag on the same row */}
              <div className="flex items-end gap-2 flex-wrap">
                <h1 className="text-white text-[24px] font-black leading-8">
                  {book.title}
                </h1>
                <span
                  className="px-2 py-1 mb-[2px] rounded-[8px] text-[12px] font-extrabold text-[#171717] uppercase leading-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.72)' }}
                >
                  {formatMonthShort(book.month)
                    ? `${formatMonthShort(book.month)} ${book.year}`
                    : book.year}
                </span>
              </div>

              {/* Author */}
              {book.author && (
                <p className="text-white text-[12px] font-medium leading-4">
                  {book.author}
                </p>
              )}
            </div>
          </motion.div>

          {/* ── Details: notes · about · released/genre ─────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="px-4 pt-6 flex flex-col gap-6 text-[#171717]"
          >
            {/* My notes — body text, no heading */}
            {book.notes ? (
              <p className="text-[16px] font-normal leading-6 whitespace-pre-wrap">
                {book.notes}
              </p>
            ) : (
              <p className="text-[rgba(23,23,23,0.72)] text-[16px] leading-6 italic">
                {t.noNotesAdded}
              </p>
            )}

            {/* Released + Genre */}
            <div className="flex gap-2">
              <div className="flex flex-col gap-2 w-[150px] shrink-0">
                <span className="text-[12px] font-extrabold uppercase leading-4">
                  {t.released}
                </span>
                <span className="text-[16px] font-normal leading-6">
                  {formatMonthShort(book.month)
                    ? `${formatMonthShort(book.month)} ${book.year}`
                    : book.year}
                </span>
              </div>
              {(book.genre || apiGenre) && (
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <span className="text-[12px] font-extrabold uppercase leading-4">
                    {t.genre}
                  </span>
                  <span className="text-[16px] font-normal leading-6">
                    {book.genre || apiGenre}
                  </span>
                </div>
              )}
            </div>

            {/* About the book */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-extrabold uppercase leading-4">
                {t.aboutTheBook}
              </span>
              {bookDataLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-200 border-t-[#171717] rounded-full animate-spin" />
                  <span className="text-[rgba(23,23,23,0.48)] text-[14px]">{t.loading}</span>
                </div>
              ) : description ? (
                <p className="text-[16px] font-normal leading-6">
                  {description}
                </p>
              ) : (
                <p className="text-[rgba(23,23,23,0.48)] text-[16px] leading-6 italic">
                  {t.noDescriptionAvailable}
                </p>
              )}
            </div>
          </motion.div>

          {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className="px-4 pt-3 pb-6"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDeleteConfirm(true)}
              className="px-6 py-2 bg-[#171717]/[0.08] rounded-full text-[#171717] text-[16px] font-bold"
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
