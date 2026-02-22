'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, BookOpen } from 'lucide-react'
import { getBooks } from '@/lib/bookApi'
import YearSection from '@/components/YearSection'
import type { Book } from '@/types/book'

export default function HomePage() {
  const router = useRouter()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBooks()
      .then(setBooks)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const booksByYear = books.reduce<Record<number, Book[]>>((acc, book) => {
    acc[book.year] = [...(acc[book.year] ?? []), book]
    return acc
  }, {})

  const years = Object.keys(booksByYear).map(Number).sort((a, b) => b - a)

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-gray-200 border-t-[#171717] rounded-full animate-spin" />
          <p className="text-[rgba(23,23,23,0.72)] text-sm">Loading your bookshelf…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[393px] mx-auto">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 pt-6 pb-2">
          <h1 className="text-[#171717] text-[32px] font-black leading-8">
            My bookshelf
          </h1>

          {/* Blue circular FAB */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/add')}
            className="w-12 h-12 bg-[#160a9d] rounded-full flex items-center justify-center
                       shadow-[0_8px_24px_rgba(22,10,157,0.45),0_2px_6px_rgba(22,10,157,0.22)]"
          >
            <Plus size={24} className="text-white" strokeWidth={2.5} />
          </motion.button>
        </div>

        {/* ── Book list ──────────────────────────────────────────────────── */}
        {books.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 px-8 text-center"
          >
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mb-5">
              <BookOpen size={30} className="text-gray-300" />
            </div>
            <h2 className="text-[18px] font-bold text-[#171717] mb-1">No books yet</h2>
            <p className="text-[rgba(23,23,23,0.72)] text-[16px] mb-6">
              Add the first book to your shelf
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/add')}
              className="inline-flex items-center gap-2 bg-[#171717] text-white
                         px-6 py-4 rounded-full text-[16px] font-bold"
            >
              <Plus size={16} strokeWidth={2.5} />
              Add your first book
            </motion.button>
          </motion.div>
        ) : (
          <div className="pb-8">
            {years.map((year) => (
              <YearSection
                key={year}
                year={year}
                books={booksByYear[year]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
