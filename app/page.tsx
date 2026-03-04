'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, LayoutGrid, List, BookOpen, BookMarked, Settings, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { getReadBooks, getToReadBooks } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import YearSection from '@/components/YearSection'
import ToReadList from '@/components/ToReadList'
import AddToHomeScreen from '@/components/AddToHomeScreen'
import { useApp, useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'

type Tab = 'read' | 'to_read'

/** Raw touch travel (px) needed to trigger a refresh */
const PULL_THRESHOLD = 72
/** Max visual height (px) of the pull indicator */
const PULL_MAX = 64

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

  // Pull-to-refresh visual state
  const [pullY, setPullY] = useState(0)          // 0 → PULL_MAX visual height
  const [refreshing, setRefreshing] = useState(false)
  const [isTracking, setIsTracking] = useState(false) // true while finger is down

  // Mutable refs so touch handlers don't form stale closures
  const pullStartYRef  = useRef(0)
  const rawDyRef       = useRef(0)
  const isPullingRef   = useRef(false)
  const refreshingRef  = useRef(false)

  // ── loadBooks (stable reference for PTR handler) ────────────────────────
  const loadBooks = useCallback(async () => {
    if (!user) return
    const [read, toRead] = await Promise.all([
      getReadBooks(supabase, user.id),
      getToReadBooks(supabase, user.id),
    ])
    setBooks(read)
    setToReadBooks(toRead)
  }, [user])

  // ── Scroll shadow trigger ───────────────────────────────────────────────
  useEffect(() => {
    const el = document.getElementById('scroll-container')
    if (!el) return
    const container: HTMLElement = el
    function onScroll() { setScrolled(container.scrollTop > 60) }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // ── Initial data load ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    loadBooks().catch(console.error).finally(() => setLoading(false))
  }, [user, loadBooks])

  // ── Session-storage flash / tab restore ─────────────────────────────────
  useEffect(() => {
    const returnTab = sessionStorage.getItem('bookshelf_returnTab')
    if (returnTab === 'to_read') {
      sessionStorage.removeItem('bookshelf_returnTab')
      setActiveTab('to_read')
    }
    const flash = sessionStorage.getItem('bookshelf_flash')
    if (flash) {
      sessionStorage.removeItem('bookshelf_flash')
      const message =
        flash === 'changesSaved'   ? t.changesSaved :
        flash === 'bookAddedToRead' ? t.bookAddedToRead :
        null
      if (message) {
        setFlashMessage(message)
        setTimeout(() => setFlashMessage(null), 3000)
      }
    }
  }, [])

  // ── Pull-to-refresh touch handlers ──────────────────────────────────────
  useEffect(() => {
    const el = document.getElementById('scroll-container')
    if (!el) return

    function onTouchStart(e: TouchEvent) {
      if (el!.scrollTop > 0 || refreshingRef.current) return
      pullStartYRef.current = e.touches[0].clientY
      rawDyRef.current = 0
      isPullingRef.current = true
      setIsTracking(true)
    }

    function onTouchMove(e: TouchEvent) {
      if (!isPullingRef.current || refreshingRef.current) return
      const dy = e.touches[0].clientY - pullStartYRef.current
      if (dy <= 0) {
        rawDyRef.current = 0
        setPullY(0)
        return
      }
      // Prevent the browser's native overscroll/bounce while we're pulling
      e.preventDefault()
      rawDyRef.current = dy
      // Rubber-band: fast near 0, asymptotically approaches PULL_MAX
      const visual = PULL_MAX * (1 - Math.exp(-dy / 110))
      setPullY(visual)
    }

    function onTouchEnd() {
      if (!isPullingRef.current) return
      isPullingRef.current = false
      setIsTracking(false)
      const dy = rawDyRef.current
      rawDyRef.current = 0

      if (dy >= PULL_THRESHOLD && !refreshingRef.current) {
        // Threshold met → trigger refresh and lock indicator in place
        refreshingRef.current = true
        setRefreshing(true)
        setPullY(PULL_MAX * 0.75)          // settle to a stable spinner height
        loadBooks()
          .catch(console.error)
          .finally(() => {
            refreshingRef.current = false
            setRefreshing(false)
            setPullY(0)
          })
      } else {
        // Below threshold → snap back
        setPullY(0)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })
    el.addEventListener('touchcancel',onTouchEnd,   { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
      el.removeEventListener('touchcancel',onTouchEnd)
    }
  }, [loadBooks])

  const booksByYear = books.reduce<Record<number, Book[]>>((acc, book) => {
    acc[book.year] = [...(acc[book.year] ?? []), book]
    return acc
  }, {})
  const years = Object.keys(booksByYear).map(Number).sort((a, b) => b - a)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-black/10 rounded-full animate-spin"
               style={{ borderTopColor: 'var(--primary)' }} />
          <p className="text-[15px]" style={{ color: 'var(--label-secondary)' }}>{t.loadingBookshelf}</p>
        </div>
      </div>
    )
  }

  const fabRoute = activeTab === 'read' ? '/add' : '/to-read/add'
  const isEmptyState =
    (activeTab === 'read' && books.length === 0) ||
    (activeTab === 'to_read' && toReadBooks.length === 0)

  const title = activeTab === 'read' ? t.readBooksTitle : t.toReadBooksTitle

  // Progress ratio 0→1 for opacity / rotation of the pull icon
  const pullProgress = Math.min(pullY / PULL_MAX, 1)

  return (
    <div className="relative min-h-screen pb-[100px]" style={{ backgroundColor: 'var(--bg)' }}>

      {/* ── Pull-to-refresh indicator ──────────────────────────────── */}
      <div
        style={{
          height: pullY,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingBottom: pullY > 6 ? 10 : 0,
          // Instant tracking while finger is down; spring back on release
          transition: isTracking ? 'none' : 'height 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
          willChange: 'height',
        }}
      >
        {pullY > 4 && (
          <Loader2
            size={22}
            className={refreshing ? 'animate-spin' : ''}
            style={{
              color: 'var(--primary)',
              opacity: pullProgress,
              // Rotate toward 270° as the user pulls; stop rotating when refreshing
              transform: refreshing ? 'none' : `rotate(${pullProgress * 270}deg)`,
              transition: isTracking ? 'opacity 0.05s' : 'opacity 0.3s, transform 0.3s',
            }}
          />
        )}
      </div>

      {/* ── Glass top navigation bar (scroll-triggered) ──────────────── */}
      <AnimatePresence>
        {scrolled && !isEmptyState && (
          <motion.div
            key="topbar"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="fixed top-0 left-0 right-0 z-50 max-w-[600px] mx-auto glass"
            style={{ borderBottom: '1px solid var(--separator)', borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
          >
            <div className="flex items-center h-12 px-5 gap-3">
              <span className="flex-1 text-[17px] font-semibold tracking-[-0.3px]"
                    style={{ color: 'var(--label)' }}>
                {title}
              </span>

              <motion.button
                whileTap={{ scale: 0.90 }}
                onClick={() => router.push(fabRoute)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <Plus size={18} className="text-white" strokeWidth={2.5} />
              </motion.button>

              {activeTab === 'read' && books.length > 0 && (
                <div className="flex items-center gap-0.5 rounded-[8px] p-0.5"
                     style={{ backgroundColor: 'var(--fill)' }}>
                  <button
                    onClick={() => setViewMode('grid')}
                    className="p-1.5 rounded-[6px] transition-colors"
                    style={{
                      backgroundColor: viewMode === 'grid' ? 'var(--bg-elevated)' : 'transparent',
                      color: viewMode === 'grid' ? 'var(--label)' : 'var(--label-tertiary)',
                    }}
                    aria-label="Grid view"
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className="p-1.5 rounded-[6px] transition-colors"
                    style={{
                      backgroundColor: viewMode === 'list' ? 'var(--bg-elevated)' : 'transparent',
                      color: viewMode === 'list' ? 'var(--label)' : 'var(--label-tertiary)',
                    }}
                    aria-label="List view"
                  >
                    <List size={16} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Flash message ────────────────────────────────────────────── */}
      <AnimatePresence>
        {flashMessage && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            className="mx-4 mt-4 px-4 py-3 rounded-2xl text-white text-[14px] font-semibold text-center"
            style={{ backgroundColor: 'var(--label)' }}
          >
            {flashMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Large title + controls ────────────────────────────────────── */}
      {!isEmptyState && (
        <div className="flex items-end justify-between px-5 pt-4 pb-4">
          <h1 className="text-[34px] font-bold tracking-[-0.5px]"
              style={{ color: 'var(--label)' }}>
            {title}
          </h1>

          <div className="flex items-center gap-2 pb-1">
            <motion.button
              whileTap={{ scale: 0.90 }}
              onClick={() => router.push(fabRoute)}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
            >
              <Plus size={20} className="text-white" strokeWidth={2.5} />
            </motion.button>

            {activeTab === 'read' && books.length > 0 && (
              <div className="flex items-center gap-0.5 rounded-[10px] p-0.5"
                   style={{ backgroundColor: 'var(--fill)' }}>
                <button
                  onClick={() => setViewMode('grid')}
                  className="p-2 rounded-[8px] transition-colors"
                  style={{
                    backgroundColor: viewMode === 'grid' ? 'var(--bg-elevated)' : 'transparent',
                    color: viewMode === 'grid' ? 'var(--label)' : 'var(--label-tertiary)',
                  }}
                  aria-label="Grid view"
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className="p-2 rounded-[8px] transition-colors"
                  style={{
                    backgroundColor: viewMode === 'list' ? 'var(--bg-elevated)' : 'transparent',
                    color: viewMode === 'list' ? 'var(--label)' : 'var(--label-tertiary)',
                  }}
                  aria-label="List view"
                >
                  <List size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Read tab content ──────────────────────────────────────────── */}
      {activeTab === 'read' && (
        books.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center pt-10"
          >
            <div className="w-[280px] h-[280px] relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="w-full h-full object-contain"
                   src="https://www.figma.com/api/mcp/asset/f5d561e7-b783-4dd8-82bc-7ea2ff94c6b2" />
            </div>
            <div className="mt-6 w-full px-6 flex flex-col gap-5 text-center">
              <div className="flex flex-col gap-2">
                <h2 className="text-[24px] font-bold tracking-[-0.3px]" style={{ color: 'var(--label)' }}>
                  {t.noBooks}
                </h2>
                <div className="text-[16px] leading-6 flex flex-col gap-1" style={{ color: 'var(--label-secondary)' }}>
                  <p>{t.addFirstBook}</p>
                  <p>{t.addFirstBookBullet1}</p>
                  <p>{t.addFirstBookBullet2}</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => router.push('/add')}
                className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold"
                style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
              >
                {t.addFirstBookCta}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <div className="pb-4">
            {years.map((year) => (
              <YearSection key={year} year={year} books={booksByYear[year]} viewMode={viewMode} />
            ))}
          </div>
        )
      )}

      {/* ── To Read tab content ───────────────────────────────────────── */}
      {activeTab === 'to_read' && (
        toReadBooks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center pt-6"
          >
            <div className="w-full h-[280px] overflow-hidden relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt=""
                   className="absolute h-full left-1/2 -translate-x-1/2 max-w-none"
                   style={{ width: 400 }}
                   src="https://www.figma.com/api/mcp/asset/31efe637-7ca3-4ec0-9e1e-191cbaab36c6" />
            </div>
            <div className="mt-4 w-full px-6 flex flex-col gap-5 text-center">
              <div className="flex flex-col gap-2">
                <h2 className="text-[24px] font-bold tracking-[-0.3px]" style={{ color: 'var(--label)' }}>
                  {t.toReadEmptyTitle}
                </h2>
                <p className="text-[16px] leading-6" style={{ color: 'var(--label-secondary)' }}>
                  {t.toReadEmptyCopy}
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => router.push('/to-read/add')}
                className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold"
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

      {/* ── Add to Home Screen prompt ────────────────────────────────── */}
      <AddToHomeScreen />

      {/* ── Floating glass tab bar (iOS 26 Liquid Glass) ─────────────── */}
      <nav className="fixed bottom-5 left-4 right-4 z-50 max-w-[568px] mx-auto">
        <div className="glass flex items-center rounded-[28px] px-2 py-2"
             style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}>

          {/* Read tab */}
          <button
            onClick={() => setActiveTab('read')}
            className="flex-1 flex flex-col items-center gap-[3px] py-2 rounded-[22px] transition-colors relative"
          >
            {activeTab === 'read' && (
              <motion.div
                layoutId="tab-pill"
                className="absolute inset-0 rounded-[22px]"
                style={{ backgroundColor: 'var(--primary-muted)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <BookOpen
              size={24}
              strokeWidth={activeTab === 'read' ? 2 : 1.5}
              className="relative"
              style={{ color: activeTab === 'read' ? 'var(--primary)' : 'var(--label-secondary)' }}
            />
            <span className="text-[11px] font-medium relative tracking-[-0.1px]"
                  style={{ color: activeTab === 'read' ? 'var(--primary)' : 'var(--label-secondary)' }}>
              {t.tabRead}
            </span>
          </button>

          {/* To-Read tab */}
          <button
            onClick={() => setActiveTab('to_read')}
            className="flex-1 flex flex-col items-center gap-[3px] py-2 rounded-[22px] transition-colors relative"
          >
            {activeTab === 'to_read' && (
              <motion.div
                layoutId="tab-pill"
                className="absolute inset-0 rounded-[22px]"
                style={{ backgroundColor: 'var(--primary-muted)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <BookMarked
              size={24}
              strokeWidth={activeTab === 'to_read' ? 2 : 1.5}
              className="relative"
              style={{ color: activeTab === 'to_read' ? 'var(--primary)' : 'var(--label-secondary)' }}
            />
            <span className="text-[11px] font-medium relative tracking-[-0.1px]"
                  style={{ color: activeTab === 'to_read' ? 'var(--primary)' : 'var(--label-secondary)' }}>
              {toReadBooks.length > 0 ? `${t.tabToRead} (${toReadBooks.length})` : t.tabToRead}
            </span>
          </button>

          {/* Settings tab */}
          <Link
            href="/settings"
            className="flex-1 flex flex-col items-center gap-[3px] py-2 rounded-[22px] transition-colors"
            style={{ color: 'var(--label-secondary)' }}
          >
            <Settings size={24} strokeWidth={1.5} />
            <span className="text-[11px] font-medium tracking-[-0.1px]">{t.settings}</span>
          </Link>

        </div>
      </nav>

    </div>
  )
}
