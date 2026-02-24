'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, LayoutGrid, List } from 'lucide-react'
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
  const showFab = activeTab === 'read' ? books.length > 0 : toReadBooks.length > 0

  return (
    <div className="min-h-screen">

        {/* ── Flash message ────────────────────────────────────────────────── */}
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

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 pt-6 pb-2">
          <div className="flex flex-col gap-2">
            <h1 className="text-[#171717] text-[32px] font-black leading-8">
              {t.myBookshelf}
            </h1>
            {books.length === 0 && toReadBooks.length === 0 && (
              <Link
                href="/settings"
                className="font-bold text-[16px] leading-6"
                style={{ color: 'var(--primary)' }}
              >
                {t.settings}
              </Link>
            )}
          </div>

          {/* FAB — shown when current tab has books */}
          {showFab && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push(fabRoute)}
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
            >
              <Plus size={24} className="text-white" strokeWidth={2.5} />
            </motion.button>
          )}
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          {(['read', 'to_read'] as Tab[]).map((tab) => {
            const label = tab === 'read'
              ? t.tabRead
              : (toReadBooks.length > 0 ? `${t.tabToRead} (${toReadBooks.length})` : t.tabToRead)
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-[14px] font-bold transition-colors ${
                  activeTab === tab
                    ? 'text-white'
                    : 'text-[rgba(23,23,23,0.55)] bg-[rgba(23,23,23,0.06)]'
                }`}
                style={activeTab === tab ? { backgroundColor: 'var(--primary)' } : {}}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* ── Toolbar: Read tab (grid/list + Settings) ─────────────────────── */}
        {activeTab === 'read' && books.length > 0 && (
          <div className="flex items-center gap-1 px-4 pt-3 pb-1">
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
            <span className="text-[#171717] font-bold mx-2 select-none">|</span>
            <Link
              href="/settings"
              className="font-bold text-[16px] leading-6"
              style={{ color: 'var(--primary)' }}
            >
              {t.settings}
            </Link>
          </div>
        )}

        {/* ── Toolbar: To Read tab (Settings only) ─────────────────────────── */}
        {activeTab === 'to_read' && toReadBooks.length > 0 && (
          <div className="px-4 pt-3 pb-1">
            <Link
              href="/settings"
              className="font-bold text-[16px] leading-6"
              style={{ color: 'var(--primary)' }}
            >
              {t.settings}
            </Link>
          </div>
        )}

        {/* ── Read tab ────────────────────────────────────────────────────── */}
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

        {/* ── To Read tab ─────────────────────────────────────────────────── */}
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
    </div>
  )
}
