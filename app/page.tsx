'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
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
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const el = document.getElementById('scroll-container')
    if (!el) return
    const scrollEl = el
    function onScroll() { setScrolled(scrollEl.scrollTop > 80) }
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    return () => scrollEl.removeEventListener('scroll', onScroll)
  }, [])

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
    const returnTab = sessionStorage.getItem('bookshelf_returnTab')
    if (returnTab === 'to_read') {
      sessionStorage.removeItem('bookshelf_returnTab')
      setActiveTab('to_read')
    }

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
  const isEmptyState =
    (activeTab === 'read' && books.length === 0) ||
    (activeTab === 'to_read' && toReadBooks.length === 0)

  return (
    <div className="relative min-h-screen page-bottom-safe">

      {/* ── Lavender header bubble — hidden on empty states ─────────────── */}
      {!isEmptyState && (
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
        </div>
      )}

      {/* FAB — hidden on empty states (CTA button serves that purpose) */}
      {!isEmptyState && (
        <div
          className="absolute z-50 left-1/2 -translate-x-1/2"
          style={{ top: 48 }}
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push(fabRoute)}
            className="p-3 rounded-full block"
            style={{
              backgroundColor: 'var(--primary)',
              boxShadow: 'var(--btn-shadow)',
            }}
          >
            <Plus size={24} className="text-white" strokeWidth={2.5} />
          </motion.button>
        </div>
      )}

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

      {/* ── Title row — hidden on empty states ──────────────────────────── */}
      {!isEmptyState && (
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
      )}

      {/* ── Read tab content ────────────────────────────────────────────── */}
      {activeTab === 'read' && (
        books.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            {/* Cozy cat illustration */}
            <div className="mt-4 w-[320px] h-[320px] relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="w-full h-full object-contain"
                src="https://www.figma.com/api/mcp/asset/f5d561e7-b783-4dd8-82bc-7ea2ff94c6b2"
              />
            </div>

            <div className="mt-6 w-full px-8 flex flex-col gap-6 text-center">
              <div className="flex flex-col gap-[9px]">
                <h2 className="text-[24px] font-black text-[#171717] leading-8">
                  {t.noBooks}
                </h2>
                <div className="text-[16px] text-[#171717] leading-6 flex flex-col gap-1">
                  <p>{t.addFirstBook}</p>
                  <p>{t.addFirstBookBullet1}</p>
                  <p>{t.addFirstBookBullet2}</p>
                </div>
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
            <div className="mt-[30px] w-full h-[320px] overflow-hidden relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="absolute h-full left-1/2 -translate-x-1/2 max-w-none"
                style={{ width: 441 }}
                src="https://www.figma.com/api/mcp/asset/31efe637-7ca3-4ec0-9e1e-191cbaab36c6"
              />
            </div>

            <div className="mt-4 w-full px-8 flex flex-col gap-6 text-center">
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

      {/* ── Scroll-triggered top action bar ────────────────────────────── */}
      <AnimatePresence>
        {scrolled && !isEmptyState && (
          <motion.div
            key="topbar"
            initial={{ y: -44, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -44, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="fixed top-0 left-0 right-0 h-[44px] bg-white z-50 flex items-center px-4"
            style={{ borderBottom: '1px solid #b9b9b9' }}
          >
            {/* Title */}
            <span className="flex-1 text-[#171717] text-[18px] font-bold leading-6 tracking-[-0.3px]">
              {activeTab === 'read' ? t.readBooksTitle : t.toReadBooksTitle}
            </span>

            {/* FAB — centered + 8 px from top so shadow isn't clipped */}
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 8 }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push(fabRoute)}
                className="p-3 rounded-full block"
                style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
              >
                <Plus size={24} className="text-white" strokeWidth={2.5} />
              </motion.button>
            </div>

            {/* Grid / list toggle — Read tab only */}
            {activeTab === 'read' && books.length > 0 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-[6px] rounded-lg transition-colors ${
                    viewMode === 'grid' ? 'text-[#171717]' : 'text-[rgba(23,23,23,0.35)]'
                  }`}
                  aria-label="Grid view"
                >
                  <LayoutGrid size={20} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-[6px] rounded-lg transition-colors ${
                    viewMode === 'list' ? 'text-[#171717]' : 'text-[rgba(23,23,23,0.35)]'
                  }`}
                  aria-label="List view"
                >
                  <List size={20} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom navigation bar ───────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white z-50 bottom-nav-safe"
        style={{ borderTop: '1px solid #e0e0e0' }}
      >
        <div className="h-20 flex">
          <button
            onClick={() => setActiveTab('read')}
            className={`flex flex-col items-center pt-[11px] gap-[2px] flex-1 transition-colors ${
              activeTab === 'read' ? 'text-[#171717]' : 'text-[#7c7c7c]'
            }`}
          >
            <BookOpen size={24} strokeWidth={activeTab === 'read' ? 2 : 1.5} />
            <span className="text-[12px] font-medium leading-[16px]">{t.tabRead}</span>
          </button>

          <button
            onClick={() => setActiveTab('to_read')}
            className={`flex flex-col items-center pt-[11px] gap-[2px] flex-1 transition-colors ${
              activeTab === 'to_read' ? 'text-[#171717]' : 'text-[#7c7c7c]'
            }`}
          >
            <BookMarked size={24} strokeWidth={activeTab === 'to_read' ? 2 : 1.5} />
            <span className="text-[12px] font-medium leading-[16px]">
              {toReadBooks.length > 0 ? `${t.tabToRead} (${toReadBooks.length})` : t.tabToRead}
            </span>
          </button>

          <Link
            href="/settings"
            className="flex flex-col items-center pt-[11px] gap-[2px] flex-1 text-[#7c7c7c]"
          >
            <Settings size={24} strokeWidth={1.5} />
            <span className="text-[12px] font-medium leading-[16px]">{t.settings}</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
