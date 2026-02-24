'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, BookOpen, Trash2 } from 'lucide-react'
import { getBook, deleteBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import { useApp, useT } from '@/contexts/AppContext'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Book } from '@/types/book'

export default function ToReadDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { user } = useApp()
  const t = useT()

  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (!user || !id) return
    getBook(supabase, user.id, id)
      .then(setBook)
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

  return (
    <>
      <div className="min-h-screen">
        {/* ── Back button ─────────────────────────────────────────────────── */}
        <div className="px-4 pt-6 pb-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[rgba(23,23,23,0.06)]"
          >
            <ArrowLeft size={20} className="text-[#171717]" />
          </motion.button>
        </div>

        {/* ── Cover hero ──────────────────────────────────────────────────── */}
        <div className="flex justify-center px-4 py-6">
          <div className="w-[120px] h-[168px] rounded-[12px] overflow-hidden bg-gray-200 shadow-md flex-shrink-0">
            {book.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen size={32} className="text-gray-400" />
              </div>
            )}
          </div>
        </div>

        {/* ── Title + Author ──────────────────────────────────────────────── */}
        <div className="px-6 text-center">
          <h1 className="text-[24px] font-black text-[#171717] leading-8">{book.title}</h1>
          {book.author && (
            <p className="text-[16px] text-[rgba(23,23,23,0.55)] mt-1">{book.author}</p>
          )}
        </div>

        {/* ── Notes ───────────────────────────────────────────────────────── */}
        {book.notes && (
          <div className="mx-4 mt-6 p-4 rounded-[16px] bg-[rgba(23,23,23,0.04)]">
            <p className="text-[15px] text-[#171717] leading-6 whitespace-pre-wrap">{book.notes}</p>
          </div>
        )}

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 px-4 mt-8 pb-10">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push(`/book/${book.id}`)}
            className="w-full py-4 rounded-full text-white text-[16px] font-bold text-center"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
          >
            {t.markAsRead}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-4 rounded-full text-[16px] font-bold text-center flex items-center justify-center gap-2 bg-[rgba(23,23,23,0.06)] text-[rgba(23,23,23,0.72)]"
          >
            <Trash2 size={18} />
            {t.deleteBook}
          </motion.button>
        </div>
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
