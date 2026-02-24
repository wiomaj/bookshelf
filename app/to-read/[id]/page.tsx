'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { X, BookOpen } from 'lucide-react'
import { getBook, deleteBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import { fetchBookData } from '@/lib/bookDescription'
import { useApp, useT } from '@/contexts/AppContext'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Book } from '@/types/book'

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

export default function ToReadDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { user } = useApp()
  const t = useT()

  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // API-fetched metadata
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
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, id])

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-gray-200 border-t-[#171717] rounded-full animate-spin" />
      </div>
    )
  }

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[rgba(23,23,23,0.55)]">Book not found.</p>
      </div>
    )
  }

  const { dateTag, durationTag } = getAddedTags(book.created_at)
  const displayGenre = book.genre || apiGenre

  return (
    <>
      <div className="min-h-screen pb-8">

        {/* ── Hero: full-width cover + gradient overlay ────────────────────── */}
        <div className="relative w-full h-[230px] overflow-hidden bg-gray-200">
          {book.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover_url}
              alt={book.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
              <BookOpen size={48} className="text-gray-400" />
            </div>
          )}

          {/* Gradient overlay: transparent top → dark bottom */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%)' }}
          />

          {/* X close button — top right */}
          <button
            onClick={() => { sessionStorage.setItem('bookshelf_returnTab', 'to_read'); router.push('/') }}
            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center"
            aria-label="Close"
          >
            <X size={24} className="text-white" strokeWidth={2} />
          </button>

          {/* Title + tags + author — bottom of hero */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 flex flex-col gap-2">
            <div className="flex items-end gap-2 flex-wrap">
              <h1 className="text-[24px] font-black text-white leading-8">{book.title}</h1>
              <div className="flex items-center gap-1 mb-[2px]">
                <span
                  className="px-2 py-1 rounded-[8px] text-[12px] font-extrabold text-[#171717] uppercase leading-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.72)' }}
                >
                  {dateTag}
                </span>
                <span
                  className="px-2 py-1 rounded-[8px] text-[12px] font-extrabold text-[#171717] uppercase leading-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.72)' }}
                >
                  {durationTag}
                </span>
              </div>
            </div>
            {book.author && (
              <p className="text-[12px] font-medium text-white leading-4">{book.author}</p>
            )}
          </div>
        </div>

        {/* ── CTA buttons — side by side ───────────────────────────────────── */}
        <div className="flex gap-3 px-4 pt-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowDeleteConfirm(true)}
            className="flex-1 py-3 rounded-full text-[16px] font-bold text-[#171717] text-center"
            style={{ backgroundColor: 'rgba(23,23,23,0.08)' }}
          >
            {t.deleteBook}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push(`/book/${book.id}`)}
            className="flex-1 py-3 rounded-full text-[16px] font-bold text-white text-center"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
          >
            {t.markAsRead}
          </motion.button>
        </div>

        {/* ── Details section ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="px-4 pt-6 flex flex-col gap-6 text-[#171717]"
        >
          {/* My notes */}
          {book.notes && (
            <p className="text-[16px] font-normal leading-6 whitespace-pre-wrap">{book.notes}</p>
          )}

          {/* Released + Genre */}
          {(publishedYear || displayGenre) && (
            <div className="flex gap-2">
              {publishedYear && (
                <div className="flex flex-col gap-2 w-[150px] shrink-0">
                  <span className="text-[12px] font-extrabold uppercase leading-4">{t.released}</span>
                  <span className="text-[16px] font-normal leading-6">{publishedYear}</span>
                </div>
              )}
              {displayGenre && (
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <span className="text-[12px] font-extrabold uppercase leading-4">{t.genre}</span>
                  <span className="text-[16px] font-normal leading-6">{displayGenre}</span>
                </div>
              )}
            </div>
          )}

          {/* About the book */}
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-extrabold uppercase leading-4">{t.aboutTheBook}</span>
            {bookDataLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-200 border-t-[#171717] rounded-full animate-spin" />
                <span className="text-[rgba(23,23,23,0.48)] text-[14px]">{t.loading}</span>
              </div>
            ) : description ? (
              <p className="text-[16px] font-normal leading-6">{description}</p>
            ) : (
              <p className="text-[rgba(23,23,23,0.48)] text-[16px] leading-6 italic">
                {t.noDescriptionAvailable}
              </p>
            )}
          </div>
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
