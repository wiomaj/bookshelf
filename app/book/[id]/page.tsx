'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { BookOpen, BookOpenCheck, Pencil, X, Rocket, LibraryBig, type LucideIcon } from 'lucide-react'
import { getBook, updateBook, deleteBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import { fetchBookData } from '@/lib/bookDescription'
import { fetchCoverByTitleAuthor } from '@/lib/bookMetadata'
import StarRating from '@/components/StarRating'
import BookForm from '@/components/BookForm'
import ConfirmDialog from '@/components/ConfirmDialog'
import { formatMonthShort } from '@/lib/month'
import { useApp, useT } from '@/contexts/AppContext'
import { heroCoverUrl } from '@/lib/coverUrl'
import type { Book } from '@/types/book'

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
            updateBook(supabase, user.id, b.id, { cover_url: cover }).catch(() => {})
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

  const readDate = formatMonthShort(book.month)
    ? `${formatMonthShort(book.month)} ${book.year}`
    : book.year?.toString()

  // ── View mode ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="relative" style={{ minHeight: '100vh' }}>

        {/* ── Blurred background ──────────────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 h-[360px] overflow-hidden z-0">
          {book.cover_url ? (
            <img
              src={heroCoverUrl(book.cover_url)}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-[1.4] blur-[40px] opacity-90"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(135deg, var(--fill) 0%, var(--separator-opaque) 100%)' }}
            />
          )}
          {/* Gentle fade at bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/60" />
        </div>

        {/* ── Toolbar (edit + close) ───────────────────────────────────────── */}
        <div className="relative z-30 flex justify-end gap-2 pt-4 pr-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsEditing(true)}
            className="glass w-11 h-11 rounded-full flex items-center justify-center"
            aria-label="Edit"
            style={{ color: 'var(--label)' }}
          >
            <Pencil size={16} strokeWidth={2} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => router.back()}
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
            className="w-[148px] h-[220px] rounded-[10px] overflow-hidden"
            style={{ boxShadow: '0 20px 48px rgba(0,0,0,0.30), 0 4px 8px rgba(0,0,0,0.12)' }}
          >
            {book.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroCoverUrl(book.cover_url)}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--fill) 0%, var(--separator-opaque) 100%)' }}
              >
                <BookOpen size={48} style={{ color: 'var(--label-tertiary)' }} />
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Details sheet ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
          className="relative z-10 -mt-5 px-4 pt-[40px] pb-12 flex flex-col gap-5"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            boxShadow: '0 -4px 32px rgba(0,0,0,0.10), 0 -1px 0 rgba(0,0,0,0.04)',
            minHeight: 'calc(100vh - 295px)',
          }}
        >
          {/* Title + Author + Stars */}
          <div className="flex flex-col gap-[6px]">
            <h1
              className="text-[28px] font-bold leading-[34px] tracking-[0.38px]"
              style={{ color: 'var(--label)' }}
            >
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
            <StarRating rating={book.rating} readonly size={16} />
          </div>

          {/* Info chips — horizontal scroll */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            <InfoChip
              icon={BookOpenCheck}
              label={t.tabRead}
              value={readDate}
            />
            <InfoChip
              icon={Rocket}
              label={t.released}
              value={book.year?.toString()}
            />
            {(book.genre || apiGenre) && (
              <InfoChip
                icon={LibraryBig}
                label={t.genre}
                value={book.genre || apiGenre}
              />
            )}
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
                <div className="w-4 h-4 border-2 border-black/10 rounded-full animate-spin"
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
    </>
  )
}
