'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, BookOpen, X } from 'lucide-react'
import { getBook, updateBook, deleteBook } from '@/lib/bookApi'
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

  useEffect(() => {
    getBook(id).then((b) => {
      if (!b) setNotFound(true)
      else setBook(b)
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-gray-200 border-t-[#171717] rounded-full animate-spin" />
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (notFound || !book) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
          <BookOpen size={26} className="text-gray-300" />
        </div>
        <h2 className="text-[18px] font-bold text-[#171717]">Book not found</h2>
        <button
          onClick={() => router.replace('/')}
          className="flex items-center gap-1.5 text-[rgba(23,23,23,0.72)] text-[16px]"
        >
          <ArrowLeft size={16} />
          Back to bookshelf
        </button>
      </div>
    )
  }

  // ── Edit mode ────────────────────────────────────────────────────────────────
  if (isEditing) {
    return (
      <div className="min-h-screen bg-white">
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
      <div className="min-h-screen bg-white pb-[160px]">
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

            {/* Back button — top left over the image */}
            <button
              onClick={() => router.back()}
              className="absolute top-3 left-[10px] w-9 h-9 flex items-center justify-center text-white"
            >
              <ArrowLeft size={24} />
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

          {/* ── My Notes ──────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="px-4 pt-6"
          >
            <h2 className="text-[#171717] text-[18px] font-bold leading-6 mb-2">
              My Notes
            </h2>
            {book.notes ? (
              <p className="text-[#171717] text-[16px] font-normal leading-6 whitespace-pre-wrap">
                {book.notes}
              </p>
            ) : (
              <p className="text-[rgba(23,23,23,0.72)] text-[16px] leading-6 italic">
                No notes added.
              </p>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Fixed bottom CTAs ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        className="fixed bottom-0 left-0 right-0 bg-white px-4 pt-3 pb-6"
      >
        <div className="max-w-[393px] mx-auto flex flex-col gap-3">
          {/* Primary — Edit */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsEditing(true)}
            className="w-full py-4 bg-[#160a9d] rounded-full text-white text-[16px] font-bold text-center
                       shadow-[0_8px_24px_rgba(22,10,157,0.45),0_2px_6px_rgba(22,10,157,0.22)]"
          >
            Edit book
          </motion.button>

          {/* Secondary — Delete */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-4 bg-[#171717]/[0.08] rounded-full text-[#171717] text-[18px] font-bold text-center"
          >
            Delete book
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
