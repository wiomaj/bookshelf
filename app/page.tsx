'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, LayoutGrid, List, BookOpenCheck, BarChart2, Settings, Loader2, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { getReadBooks, getToReadBooks, getWishlistBooks } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import YearSection from '@/components/YearSection'
import ToReadList from '@/components/ToReadList'
import WishlistList from '@/components/WishlistList'
import AddToHomeScreen from '@/components/AddToHomeScreen'
import ReadingPaceChart from '@/components/ReadingPaceChart'
import RatingDistributionChart from '@/components/RatingDistributionChart'
import FavouriteAuthors from '@/components/FavouriteAuthors'
import GenreBreakdown from '@/components/GenreBreakdown'
import { useApp, useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'

type Tab = 'books' | 'dashboard'
type BookTab = 'read' | 'to_read' | 'wishlist'

// ── Dashboard entrance animation variants ────────────────────────────────────
const dashContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
}
const dashCard = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

/** Raw touch travel (px) needed to trigger a refresh */
const PULL_THRESHOLD = 72
/** Max visual height (px) of the pull indicator */
const PULL_MAX = 64

export default function HomePage() {
  const router = useRouter()
  const { viewMode, setViewMode, user, setToReadCount, setWishlistCount } = useApp()
  const t = useT()
  const [activeTab, setActiveTab] = useState<Tab>('books')
  const [activeBookTab, setActiveBookTab] = useState<BookTab>('read')
  const [books, setBooks] = useState<Book[]>([])
  const [toReadBooks, setToReadBooks] = useState<Book[]>([])
  const [wishlistBooks, setWishlistBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [flashMessage, setFlashMessage] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [dashboardYear, setDashboardYear] = useState<number | 'all' | null>(null)
  const [yearPickerSource, setYearPickerSource] = useState<'large' | 'top' | null>(null)

  // Pull-to-refresh visual state
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [isTracking, setIsTracking] = useState(false)

  const yearPickerRef    = useRef<HTMLDivElement>(null)
  const yearPickerTopRef = useRef<HTMLDivElement>(null)

  // Mutable refs so touch handlers don't form stale closures
  const pullStartYRef  = useRef(0)
  const rawDyRef       = useRef(0)
  const isPullingRef   = useRef(false)
  const refreshingRef  = useRef(false)

  // ── loadBooks (stable reference for PTR handler) ─────────────────────────
  const loadBooks = useCallback(async () => {
    if (!user) return
    const [read, toRead, wishlist] = await Promise.all([
      getReadBooks(supabase, user.id),
      getToReadBooks(supabase, user.id),
      getWishlistBooks(supabase, user.id),
    ])
    setBooks(read)
    setToReadBooks(toRead)
    setWishlistBooks(wishlist)
    setToReadCount(toRead.length)
    setWishlistCount(wishlist.length)
  }, [user, setToReadCount, setWishlistCount])

  // ── Scroll shadow trigger ─────────────────────────────────────────────────
  useEffect(() => {
    const el = document.getElementById('scroll-container')
    if (!el) return
    const container: HTMLElement = el
    function onScroll() { setScrolled(container.scrollTop > 60) }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // ── Year picker click-outside ─────────────────────────────────────────────
  useEffect(() => {
    if (!yearPickerSource) return
    function handler(e: MouseEvent) {
      const target = e.target as Node
      const insideLarge = yearPickerRef.current?.contains(target)
      const insideTop   = yearPickerTopRef.current?.contains(target)
      if (!insideLarge && !insideTop) setYearPickerSource(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [yearPickerSource])

  // ── Initial data load ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    loadBooks().catch(console.error).finally(() => setLoading(false))
  }, [user, loadBooks])

  // ── Session-storage flash / tab restore ───────────────────────────────────
  useEffect(() => {
    const returnTab = sessionStorage.getItem('bookshelf_returnTab')
    if (returnTab === 'read' || returnTab === 'to_read' || returnTab === 'wishlist') {
      sessionStorage.removeItem('bookshelf_returnTab')
      setActiveTab('books')
      setActiveBookTab(returnTab as BookTab)
    }
    const flash = sessionStorage.getItem('bookshelf_flash')
    if (flash) {
      sessionStorage.removeItem('bookshelf_flash')
      const message =
        flash === 'changesSaved'      ? t.changesSaved :
        flash === 'bookAddedToRead'   ? t.bookAddedToRead :
        flash === 'bookAddedToWishlist' ? t.bookAddedToWishlist :
        null
      if (message) {
        setFlashMessage(message)
        setTimeout(() => setFlashMessage(null), 3000)
      }
    }
  }, [])

  // ── Pull-to-refresh touch handlers ───────────────────────────────────────
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
      e.preventDefault()
      rawDyRef.current = dy
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
        refreshingRef.current = true
        setRefreshing(true)
        setPullY(PULL_MAX * 0.75)
        loadBooks()
          .catch(console.error)
          .finally(() => {
            refreshingRef.current = false
            setRefreshing(false)
            setPullY(0)
          })
      } else {
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
  // null = not yet picked → default to most recent year; 'all' = explicit all-time
  const effectiveYear: number | 'all' = dashboardYear ?? (years.length > 0 ? years[0] : 'all')

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

  const fabRoute =
    activeTab === 'books' && activeBookTab === 'read'     ? '/add?tab=read' :
    activeTab === 'books' && activeBookTab === 'to_read'  ? '/add?tab=to_read' :
    activeTab === 'books'                                 ? '/add?tab=wishlist' :
    null  // no FAB on Dashboard

  const isEmptyState =
    (activeTab === 'books' && activeBookTab === 'read'     && books.length === 0) ||
    (activeTab === 'books' && activeBookTab === 'to_read'  && toReadBooks.length === 0) ||
    (activeTab === 'books' && activeBookTab === 'wishlist' && wishlistBooks.length === 0)

  const title =
    activeTab === 'dashboard' ? t.dashboardTitle : t.myBookshelf

  const pullProgress = Math.min(pullY / PULL_MAX, 1)

  return (
    <div className="relative min-h-screen pb-[100px]" style={{ backgroundColor: 'var(--bg)' }}>

      {/* ── Pull-to-refresh indicator ─────────────────────────────────── */}
      <div
        style={{
          height: pullY,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingBottom: pullY > 6 ? 10 : 0,
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

              {/* Year picker — dashboard, scrolled top bar */}
              {activeTab === 'dashboard' && (
                <div className="relative" ref={yearPickerTopRef}>
                  <button
                    onClick={() => setYearPickerSource(s => s === 'top' ? null : 'top')}
                    className="flex items-center gap-[5px] rounded-full px-[12px] py-[6px]"
                    style={{ backgroundColor: 'var(--fill)' }}
                  >
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--label)' }}>
                      {effectiveYear === 'all' ? t.allTime : String(effectiveYear)}
                    </span>
                    <ChevronDown size={12} style={{ color: 'var(--label-secondary)' }} />
                  </button>

                  <AnimatePresence>
                    {yearPickerSource === 'top' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full mt-[6px] rounded-[12px] overflow-hidden z-[60]"
                        style={{
                          backgroundColor: 'var(--bg-elevated)',
                          boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
                          minWidth: '110px',
                        }}
                      >
                        {years.map(y => (
                          <button
                            key={y}
                            onClick={() => { setDashboardYear(y); setYearPickerSource(null) }}
                            className="w-full px-[16px] py-[10px] text-left text-[15px]"
                            style={{
                              color: effectiveYear === y ? 'var(--primary)' : 'var(--label)',
                              fontWeight: effectiveYear === y ? 600 : 400,
                            }}
                          >
                            {y}
                          </button>
                        ))}
                        {years.length > 0 && (
                          <div className="mx-[12px] h-px" style={{ backgroundColor: 'var(--separator)' }} />
                        )}
                        <button
                          onClick={() => { setDashboardYear('all'); setYearPickerSource(null) }}
                          className="w-full px-[16px] py-[10px] text-left text-[15px]"
                          style={{
                            color: effectiveYear === 'all' ? 'var(--primary)' : 'var(--label)',
                            fontWeight: effectiveYear === 'all' ? 600 : 400,
                          }}
                        >
                          {t.allTime}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {fabRoute && (
                <motion.button
                  whileTap={{ scale: 0.90 }}
                  onClick={() => router.push(fabRoute)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <Plus size={18} className="text-white" strokeWidth={2.5} />
                </motion.button>
              )}

              {activeTab === 'books' && (
                (activeBookTab === 'read' && books.length > 0) ||
                (activeBookTab === 'to_read' && toReadBooks.length > 0) ||
                (activeBookTab === 'wishlist' && wishlistBooks.length > 0)
              ) && (
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
            {/* Year picker dropdown — dashboard only */}
            {activeTab === 'dashboard' && (
              <div className="relative" ref={yearPickerRef}>
                <button
                  onClick={() => setYearPickerSource(s => s === 'large' ? null : 'large')}
                  className="flex items-center gap-[5px] rounded-full px-[12px] py-[7px]"
                  style={{ backgroundColor: 'var(--fill)' }}
                >
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--label)' }}>
                    {effectiveYear === 'all' ? t.allTime : String(effectiveYear)}
                  </span>
                  <ChevronDown size={12} style={{ color: 'var(--label-secondary)' }} />
                </button>

                <AnimatePresence>
                  {yearPickerSource === 'large' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full mt-[6px] rounded-[12px] overflow-hidden z-[60]"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
                        minWidth: '110px',
                      }}
                    >
                      {years.map(y => (
                        <button
                          key={y}
                          onClick={() => { setDashboardYear(y); setYearPickerSource(null) }}
                          className="w-full px-[16px] py-[10px] text-left text-[15px]"
                          style={{
                            color: effectiveYear === y ? 'var(--primary)' : 'var(--label)',
                            fontWeight: effectiveYear === y ? 600 : 400,
                          }}
                        >
                          {y}
                        </button>
                      ))}
                      {years.length > 0 && (
                        <div className="mx-[12px] h-px" style={{ backgroundColor: 'var(--separator)' }} />
                      )}
                      <button
                        onClick={() => { setDashboardYear('all'); setYearPickerSource(null) }}
                        className="w-full px-[16px] py-[10px] text-left text-[15px]"
                        style={{
                          color: effectiveYear === 'all' ? 'var(--primary)' : 'var(--label)',
                          fontWeight: effectiveYear === 'all' ? 600 : 400,
                        }}
                      >
                        {t.allTime}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {fabRoute && (
              <motion.button
                whileTap={{ scale: 0.90 }}
                onClick={() => router.push(fabRoute)}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
              >
                <Plus size={20} className="text-white" strokeWidth={2.5} />
              </motion.button>
            )}

            {activeTab === 'books' && (
              (activeBookTab === 'read' && books.length > 0) ||
              (activeBookTab === 'to_read' && toReadBooks.length > 0) ||
              (activeBookTab === 'wishlist' && wishlistBooks.length > 0)
            ) && (
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

      {/* ── Books tab: segmented control ─────────────────────────────── */}
      {activeTab === 'books' && !isEmptyState && (
        <div className="px-4 pb-3">
          <div className="flex p-[3px] rounded-full" style={{ backgroundColor: 'var(--fill)' }}>
            {([
              { key: 'read',     label: t.tabRead },
              { key: 'to_read',  label: toReadBooks.length > 0 ? `${t.tabToRead} (${toReadBooks.length})` : t.tabToRead },
              { key: 'wishlist', label: wishlistBooks.length > 0 ? `${t.tabWishlist} (${wishlistBooks.length})` : t.tabWishlist },
            ] as { key: BookTab; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveBookTab(key)}
                className="flex-1 py-[6px] rounded-full text-[13px] font-medium transition-all"
                style={activeBookTab === key
                  ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--label)', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }
                  : { color: 'var(--label-secondary)' }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Books tab → Read sub-tab ──────────────────────────────────── */}
      {activeTab === 'books' && activeBookTab === 'read' && (
        books.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center pt-10"
          >
            <div className="w-[280px] h-[280px] relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="w-full h-full object-contain"
                   src="/empty-read.png" />
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

      {/* ── Books tab → To Read sub-tab ───────────────────────────────── */}
      {activeTab === 'books' && activeBookTab === 'to_read' && (
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
                   src="/empty-toread.png" />
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
                onClick={() => router.push('/add?tab=to_read')}
                className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold"
                style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
              >
                {t.addToReadingList}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <ToReadList books={toReadBooks} viewMode={viewMode} />
        )
      )}

      {/* ── Books tab → Wishlist sub-tab ──────────────────────────────── */}
      {activeTab === 'books' && activeBookTab === 'wishlist' && (
        wishlistBooks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center pt-6"
          >
            <div className="w-[320px] h-[320px] relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="w-full h-full object-contain"
                   src="/empty-wishlist.png" />
            </div>
            <div className="mt-4 w-full px-6 flex flex-col gap-5 text-center">
              <div className="flex flex-col gap-2">
                <h2 className="text-[22px] font-bold tracking-[-0.3px]" style={{ color: 'var(--label)' }}>
                  {t.wishlistEmptyTitle}
                </h2>
                <p className="text-[17px] leading-[22px] tracking-[-0.4px]" style={{ color: 'var(--label-secondary)' }}>
                  {t.wishlistEmptyCopy}
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => router.push('/add?tab=wishlist')}
                className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold"
                style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
              >
                {t.addToWishlist}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <WishlistList books={wishlistBooks} viewMode={viewMode} />
        )
      )}

      {/* ── Dashboard tab ────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <motion.div
          key="dashboard"
          className="pb-4 pt-2"
          variants={dashContainer}
          initial="hidden"
          animate="show"
        >
          {effectiveYear !== 'all' && (
            <motion.div variants={dashCard}>
              <ReadingPaceChart books={books} year={effectiveYear} />
            </motion.div>
          )}
          <motion.div variants={dashCard}>
            <RatingDistributionChart books={books} />
          </motion.div>
          <motion.div variants={dashCard}>
            <FavouriteAuthors books={books} />
          </motion.div>
          <motion.div variants={dashCard}>
            <GenreBreakdown books={books} />
          </motion.div>
        </motion.div>
      )}

      {/* ── Add to Home Screen prompt ────────────────────────────────── */}
      <AddToHomeScreen />

      {/* ── Floating glass tab bar ────────────────────────────────────── */}
      <nav className="fixed bottom-5 left-4 right-4 z-50 max-w-[568px] mx-auto">
        <div className="glass flex items-center rounded-[28px] px-2 py-2"
             style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}>

          {/* Books tab */}
          <button
            onClick={() => setActiveTab('books')}
            className="flex-1 flex flex-col items-center gap-[3px] py-2 rounded-[22px] transition-colors relative"
          >
            {activeTab === 'books' && (
              <motion.div
                layoutId="tab-pill"
                className="absolute inset-0 rounded-[22px]"
                style={{ backgroundColor: 'var(--primary-muted)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <BookOpenCheck
              size={22}
              strokeWidth={activeTab === 'books' ? 2 : 1.5}
              className="relative"
              style={{ color: activeTab === 'books' ? 'var(--primary)' : 'var(--label-secondary)' }}
            />
            <span className="text-[10px] font-medium relative tracking-[-0.1px]"
                  style={{ color: activeTab === 'books' ? 'var(--primary)' : 'var(--label-secondary)' }}>
              {t.tabBooks}
            </span>
          </button>

          {/* Dashboard tab */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className="flex-1 flex flex-col items-center gap-[3px] py-2 rounded-[22px] transition-colors relative"
          >
            {activeTab === 'dashboard' && (
              <motion.div
                layoutId="tab-pill"
                className="absolute inset-0 rounded-[22px]"
                style={{ backgroundColor: 'var(--primary-muted)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <BarChart2
              size={22}
              strokeWidth={activeTab === 'dashboard' ? 2 : 1.5}
              className="relative"
              style={{ color: activeTab === 'dashboard' ? 'var(--primary)' : 'var(--label-secondary)' }}
            />
            <span className="text-[10px] font-medium relative tracking-[-0.1px]"
                  style={{ color: activeTab === 'dashboard' ? 'var(--primary)' : 'var(--label-secondary)' }}>
              {t.tabDashboard}
            </span>
          </button>

          {/* Settings tab */}
          <Link
            href="/settings"
            className="flex-1 flex flex-col items-center gap-[3px] py-2 rounded-[22px] transition-colors"
            style={{ color: 'var(--label-secondary)' }}
          >
            <Settings size={22} strokeWidth={1.5} />
            <span className="text-[10px] font-medium tracking-[-0.1px]">{t.settings}</span>
          </Link>

        </div>
      </nav>

    </div>
  )
}
