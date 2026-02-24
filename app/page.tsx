'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, LayoutGrid, List, BookOpen, BookMarked, Settings } from 'lucide-react'
import Link from 'next/link'
import { getReadBooks, getToReadBooks } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import YearSection from '@/components/YearSection'
import ToReadList from '@/components/ToReadList'
import { useApp, useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'

type Tab = 'read' | 'to_read'

export default function HomePage() {
  const router = useRouter()
  const { viewMode, setViewMode, user } = useApp()
  const t = useT()
  const [activeTab, setActiveTab] = useState<Tab>('read')
  const [books, setBooks] = useState<Book[]>([])
  const [toReadBooks, setToReadBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [flashMessage, setFlashMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    Promise.all([
      getReadBooks(supabase, user.id),
      getToReadBooks(supabase, user.id),
    ])
      .then(([read, toRead]) => {
        setBooks(read)
        setToReadBooks(toRead)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    const flash = sessionStorage.getItem('bookshelf_flash')
    if (flash) {
      sessionStorage.removeItem('bookshelf_flash')
      const message = flash === 'changesSaved' ? t.changesSaved : null
      if (message) {
        setFlashMessage(message)
        setTimeout(() => setFlashMessage(null), 3000)
      }
    }
  }, [])

  const booksByYear = books.reduce<Record<number, Book[]>>((acc, book) => {
    acc[book.year] = [...(acc[book.year] ?? []), book]
    return acc
  }, {})

  const years = Object.keys(booksByYear).map(Number).sort((a, b) => b - a)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-gray-200 border-t-[#171717] rounded-full animate-spin" />
          <p className="text-[rgba(23,23,23,0.72)] text-sm">{t.loadingBookshelf}</p>
        </div>
      </div>
    )
  }

  const fabRoute = activeTab === 'read' ? '/add' : '/to-read/add'

  return (
    <div className="min-h-screen pb-20">

      {/* ── Lavender header bubble ──────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden"
        style={{ backgroundColor: '#d0daf3', height: 100 }}
      >
        {/* Decorative circles — inlined from Figma asset */}
        <svg
          viewBox="0 0 1249 1586"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
          className="absolute pointer-events-none -translate-x-1/2"
          style={{ width: 1249, height: 1586, left: '50%', top: 28 }}
        >
          <ellipse cx="624.5" cy="624" rx="624.5" ry="624" fill="#c4caf0" />
          <path
            d="M917.079 1586H338.079V111H335C421.556 65.6543 520.069 40 624.579 40C729.089 40 827.602 65.6543 914.158 111H917.079V1586Z"
            fill="white"
          />
        </svg>

        {/* FAB — absolutely centred, top-48 matches Figma */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push(fabRoute)}
          className="absolute z-10 p-3 rounded-full -translate-x-1/2"
          style={{
            left: '50%',
            top: 58,
            backgroundColor: 'var(--primary)',
            boxShadow: 'var(--btn-shadow)',
          }}
        >
          <Plus size={24} className="text-white" strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* ── Flash message ───────────────────────────────────────────────── */}
      {flashMessage && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="mx-4 mt-4 px-4 py-3 rounded-2xl bg-[#171717] text-white text-[14px] font-semibold text-center"
        >
          {flashMessage}
        </motion.div>
      )}

      {/* ── Title row ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <h1 className="text-[#171717] text-[24px] font-black leading-8">
          {activeTab === 'read' ? t.readBooksTitle : t.toReadBooksTitle}
        </h1>

        {/* Grid / list toggle — Read tab only, when books exist */}
        {activeTab === 'read' && books.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-[6px] rounded-lg transition-colors ${
                viewMode === 'grid' ? 'text-[#171717]' : 'text-[rgba(23,23,23,0.35)]'
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid size={24} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-[6px] rounded-lg transition-colors ${
                viewMode === 'list' ? 'text-[#171717]' : 'text-[rgba(23,23,23,0.35)]'
              }`}
              aria-label="List view"
            >
              <List size={24} />
            </button>
          </div>
        )}
      </div>

      {/* ── Read tab content ────────────────────────────────────────────── */}
      {activeTab === 'read' && (
        books.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <div className="mt-[101px] w-[200px] h-[200px] overflow-hidden relative shrink-0">
              <img
                alt=""
                className="absolute inset-[5%_0] w-full h-full object-contain"
                src="https://www.figma.com/api/mcp/asset/33555f04-f9e5-4652-b095-20ae0c278236"
              />
            </div>

            <div className="mt-6 w-full px-8 flex flex-col gap-6 text-center">
              <div className="flex flex-col gap-[9px]">
                <h2 className="text-[24px] font-black text-[#171717] leading-8">
                  {t.noBooks}
                </h2>
                <p className="text-[16px] text-[#171717] leading-6">
                  {t.addFirstBook}
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push('/add')}
                className="w-full py-4 rounded-full text-white text-[16px] font-bold text-center"
                style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
              >
                {t.addFirstBookCta}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <div className="pb-8">
            {years.map((year) => (
              <YearSection
                key={year}
                year={year}
                books={booksByYear[year]}
                viewMode={viewMode}
              />
            ))}
          </div>
        )
      )}

      {/* ── To Read tab content ─────────────────────────────────────────── */}
      {activeTab === 'to_read' && (
        toReadBooks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <div className="mt-[101px] w-[200px] h-[200px] overflow-hidden relative shrink-0">
              <img
                alt=""
                className="absolute inset-[5%_0] w-full h-full object-contain"
                src="https://www.figma.com/api/mcp/asset/33555f04-f9e5-4652-b095-20ae0c278236"
              />
            </div>

            <div className="mt-6 w-full px-8 flex flex-col gap-6 text-center">
              <div className="flex flex-col gap-[9px]">
                <h2 className="text-[24px] font-black text-[#171717] leading-8">
                  {t.toReadEmptyTitle}
                </h2>
                <p className="text-[16px] text-[#171717] leading-6">
                  {t.toReadEmptyCopy}
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push('/to-read/add')}
                className="w-full py-4 rounded-full text-white text-[16px] font-bold text-center"
                style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
              >
                {t.addToReadingList}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <ToReadList books={toReadBooks} />
        )
      )}

      {/* ── Bottom navigation bar ───────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 h-16 bg-white flex items-center z-50"
        style={{ borderTop: '1px solid #b9b9b9' }}
      >
        <button
          onClick={() => setActiveTab('read')}
          className={`flex flex-col items-center justify-center gap-[3px] flex-1 h-full transition-colors ${
            activeTab === 'read' ? 'text-[#171717]' : 'text-[rgba(23,23,23,0.4)]'
          }`}
        >
          <BookOpen size={24} strokeWidth={activeTab === 'read' ? 2 : 1.5} />
          <span className="text-[11px] font-semibold">{t.tabRead}</span>
        </button>

        <button
          onClick={() => setActiveTab('to_read')}
          className={`flex flex-col items-center justify-center gap-[3px] flex-1 h-full transition-colors ${
            activeTab === 'to_read' ? 'text-[#171717]' : 'text-[rgba(23,23,23,0.4)]'
          }`}
        >
          <BookMarked size={24} strokeWidth={activeTab === 'to_read' ? 2 : 1.5} />
          <span className="text-[11px] font-semibold">
            {toReadBooks.length > 0 ? `${t.tabToRead} (${toReadBooks.length})` : t.tabToRead}
          </span>
        </button>

        <Link
          href="/settings"
          className="flex flex-col items-center justify-center gap-[3px] flex-1 h-full text-[rgba(23,23,23,0.4)]"
        >
          <Settings size={24} strokeWidth={1.5} />
          <span className="text-[11px] font-semibold">{t.settings}</span>
        </Link>
      </nav>
    </div>
  )
}
