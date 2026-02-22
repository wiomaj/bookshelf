'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { BookOpen, X } from 'lucide-react'
import { getBook, updateBook, deleteBook } from '@/lib/bookApi'
import { fetchBookData } from '@/lib/bookDescription'
import StarRating from '@/components/StarRating'
import BookForm from '@/components/BookForm'
import ConfirmDialog from '@/components/ConfirmDialog'
import { formatMonthShort } from '@/lib/month'
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
    getBook(id).then((b) => {
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
  }, [id])

  async function handleUpdate(data: Omit<Book, 'id' | 'user_id' | 'created_at'>) {
    if (!book) return
    setUpdateLoading(true)
    try {
      const updated = await updateBook(book.id, data)
      setBook(updated)
      setIsEditing(false)
    } finally {
      setUpdateLoading(false)
    }
  }

  async function handleDelete() {
    if (!book) return
    setDeleteLoading(true)
    try {
      await deleteBook(book.id)
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
        <h2 className="text-[18px] font-bold text-[#171717]">Book not found</h2>
        <button
          onClick={() => router.replace('/')}
          className="flex items-center gap-1.5 text-[rgba(23,23,23,0.72)] text-[16px]"
        >
          Back to bookshelf
        </button>
      </div>
    )
  }

  // ── Edit mode ────────────────────────────────────────────────────────────────
  if (isEditing) {
    return (
      <div className="min-h-screen">
        <div className="max-w-[393px] mx-auto">
          {/* Header — back + title */}
          <div className="flex items-center gap-2 h-[60px] px-3">
            <button
              onClick={() => setIsEditing(false)}
              className="w-9 h-9 flex items-center justify-center text-[#171717]"
            >
              <X size={24} />
            </button>
          </div>

          <div className="px-4 pb-6">
            <h1 className="text-[#171717] text-[32px] font-black leading-8">Edit book</h1>
          </div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <BookForm
              initialData={book}
              onSubmit={handleUpdate}
              submitLabel="Save Changes"
              loading={updateLoading}
            />
          </motion.div>
        </div>
      </div>
    )
  }

  // ── View mode ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="min-h-screen pb-[100px]">
        <div className="max-w-[393px] mx-auto">

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

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />

            {/* Close button — top right over the image */}
            <button
              onClick={() => router.back()}
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center text-white"
            >
              <X size={24} />
            </button>

            {/* Info block at the bottom of the hero */}
            <div className="absolute bottom-0 left-0 w-full px-4 pb-6 flex flex-col gap-2">
              {/* Stars + month/year tag on the same row */}
              <div className="flex items-center gap-3">
                <StarRating rating={book.rating} readonly size={20} />
                <div className="rounded-[8px] px-2 py-1
                               bg-white/[0.18] backdrop-blur-xl
                               border border-white/[0.32]
                               shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_6px_rgba(0,0,0,0.10)]">
                  <span className="text-white text-[12px] font-extrabold uppercase leading-4 tracking-wide">
                    {formatMonthShort(book.month)
                      ? `${formatMonthShort(book.month)} ${book.year}`
                      : book.year}
                  </span>
                </div>
              </div>

              {/* Title */}
              <h1 className="text-white text-[32px] font-black leading-8">
                {book.title}
              </h1>

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
                No notes added.
              </p>
            )}

            {/* Released + Genre */}
            <div className="flex gap-2">
              <div className="flex flex-col gap-2 w-[150px] shrink-0">
                <span className="text-[12px] font-extrabold uppercase leading-4">
                  Released
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
                    Genre
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
                About the book
              </span>
              {bookDataLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-200 border-t-[#171717] rounded-full animate-spin" />
                  <span className="text-[rgba(23,23,23,0.48)] text-[14px]">Loading…</span>
                </div>
              ) : description ? (
                <p className="text-[16px] font-normal leading-6">
                  {description}
                </p>
              ) : (
                <p className="text-[rgba(23,23,23,0.48)] text-[16px] leading-6 italic">
                  No description available.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Fixed bottom CTAs ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        className="fixed bottom-0 left-0 right-0 px-4 pt-3 pb-6"
      >
        <div className="max-w-[393px] mx-auto flex gap-3">
          {/* Secondary — Delete */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowDeleteConfirm(true)}
            className="flex-1 py-3 bg-[#171717]/[0.08] rounded-full text-[#171717] text-[16px] font-bold text-center"
          >
            Delete book
          </motion.button>

          {/* Primary — Edit */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsEditing(true)}
            className="flex-1 py-3 rounded-full text-white text-[16px] font-bold text-center"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
          >
            Edit book
          </motion.button>
        </div>
      </motion.div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete this book?"
        description={`"${book.title}" will be permanently removed from your bookshelf.`}
        confirmLabel="Delete"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}
