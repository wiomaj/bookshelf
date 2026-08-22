'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, LayoutGrid, List, BookOpenCheck, Settings, Loader2, ChevronDown, Search, X, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { getAllBooks, updateBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import YearSection from '@/components/YearSection'
import ToReadList from '@/components/ToReadList'
import WishlistList from '@/components/WishlistList'
import AddToHomeScreen from '@/components/AddToHomeScreen'
import ReadingPaceChart from '@/components/ReadingPaceChart'
import UserAvatar from '@/components/UserAvatar'
import RatingDistributionChart from '@/components/RatingDistributionChart'
import FavouriteAuthors from '@/components/FavouriteAuthors'
import GenreBreakdown from '@/components/GenreBreakdown'
import BookCover from '@/components/BookCover'
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

/** Large-title font size bounds — shrinks until the title fits its row */
const TITLE_MAX_PX = 34
const TITLE_MIN_PX = 20

export default function HomePage() {
  const router = useRouter()
  const { viewMode, setViewMode, user, setToReadCount, setWishlistCount, displayName, updateDisplayName, cozyMode } = useApp()
  const t = useT()
  const [activeTab, setActiveTab] = useState<Tab>('books')
  const [activeBookTab, setActiveBookTab] = useState<BookTab>('read')
  const [books, setBooks] = useState<Book[]>([])
  const [toReadBooks, setToReadBooks] = useState<Book[]>([])
  const [wishlistBooks, setWishlistBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [flashMessage, setFlashMessage] = useState<string | null>(null)
  const [flashUndo, setFlashUndo] = useState<{ bookId: string; month: number; year: number } | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [dashboardYear, setDashboardYear] = useState<number | 'all' | null>(null)
  const [yearPickerSource, setYearPickerSource] = useState<'large' | 'top' | null>(null)

  // Name prompt overlay
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [namePromptInput, setNamePromptInput] = useState('')
  const [namePromptSaving, setNamePromptSaving] = useState(false)

  // Pull-to-refresh visual state
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [isTracking, setIsTracking] = useState(false)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter
  const [showFilter, setShowFilter] = useState(false)
  const [filterFormat, setFilterFormat] = useState<'all' | 'audiobook' | 'ebook'>('all')
  const [filterMinRating, setFilterMinRating] = useState(0)      // 0 = off
  const [filterGenre, setFilterGenre] = useState<string | null>(null)
  const [filterHideAbandoned, setFilterHideAbandoned] = useState(false)

  const filtersActive =
    filterFormat !== 'all' || filterMinRating > 0 || filterGenre !== null || filterHideAbandoned

  function resetFilters() {
    setFilterFormat('all')
    setFilterMinRating(0)
    setFilterGenre(null)
    setFilterHideAbandoned(false)
  }

  const yearPickerRef    = useRef<HTMLDivElement>(null)
  const yearPickerTopRef = useRef<HTMLDivElement>(null)
  const titleRef         = useRef<HTMLHeadingElement>(null)

  // Mutable refs so touch handlers don't form stale closures
  const pullStartYRef  = useRef(0)
  const rawDyRef       = useRef(0)
  const isPullingRef   = useRef(false)
  const refreshingRef  = useRef(false)

  // ── loadBooks (stable reference for PTR handler) ─────────────────────────
  const loadBooks = useCallback(async () => {
    if (!user) return
    try {
      const { read, toRead, wishlist } = await getAllBooks(supabase, user.id)
      setBooks(read)
      setToReadBooks(toRead)
      setWishlistBooks(wishlist)
      setToReadCount(toRead.length)
      setWishlistCount(wishlist.length)
      setLoadError(false)
    } catch (err) {
      console.error('[loadBooks] Failed to load books:', err)
      // Don't clear existing state on a failed refresh — a transient error
      // shouldn't blank out books that are already showing on screen.
      setLoadError(true)
    }
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

  // ── Scroll-to-top on tab change ───────────────────────────────────────────
  useEffect(() => {
    document.getElementById('scroll-container')?.scrollTo({ top: 0 })
  }, [activeTab, activeBookTab])

  // ── Large-title auto-fit ──────────────────────────────────────────────────
  // The Unbounded display font is wide; shrink the font size until the title
  // fits the space left of the action buttons instead of running under them.
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return

    function fit() {
      if (!el) return
      let size = TITLE_MAX_PX
      el.style.fontSize = `${size}px`
      while (size > TITLE_MIN_PX && el.scrollWidth > el.clientWidth) {
        size -= 1
        el.style.fontSize = `${size}px`
      }
    }

    fit()
    // Re-measure once the webfont has actually loaded (metrics change).
    document.fonts?.ready.then(fit).catch(() => {})
    // Re-measure when the available width changes (rotation, tab switch).
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [activeTab, loading, displayName, t, books.length, toReadBooks.length, wishlistBooks.length])

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
    const returnMainTab = sessionStorage.getItem('bookshelf_returnMainTab')
    if (returnMainTab === 'dashboard') {
      sessionStorage.removeItem('bookshelf_returnMainTab')
      setActiveTab('dashboard')
    }
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
        flash === 'markedAsRead'      ? t.markedAsRead :
        null
      if (message) {
        setFlashMessage(message)
        if (flash === 'markedAsRead') {
          try {
            const raw = sessionStorage.getItem('bookshelf_flash_undo')
            sessionStorage.removeItem('bookshelf_flash_undo')
            if (raw) setFlashUndo(JSON.parse(raw))
          } catch { /* ignore */ }
        } else {
          setFlashUndo(null)
        }
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
        flashTimerRef.current = setTimeout(() => { setFlashMessage(null); setFlashUndo(null) }, 5000)
      }
    }
  }, [])

  async function handleUndo() {
    if (!user || !flashUndo) return
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlashMessage(null)
    setFlashUndo(null)
    await updateBook(supabase, user.id, flashUndo.bookId, {
      status: 'to_read',
      month: flashUndo.month,
      year: flashUndo.year,
      finished_at: null,
    })
    setActiveBookTab('to_read')
    loadBooks()
  }

  // ── Name prompt on first login ────────────────────────────────────────────
  useEffect(() => {
    if (!user || displayName) return
    try {
      if (!localStorage.getItem('bookshelf_name_prompted')) setShowNamePrompt(true)
    } catch { /* ignore */ }
  }, [user, displayName])

  async function handleNamePromptSave() {
    const trimmed = namePromptInput.trim()
    try { localStorage.setItem('bookshelf_name_prompted', 'true') } catch { /* ignore */ }
    if (trimmed) {
      setNamePromptSaving(true)
      await updateDisplayName(trimmed)
      setNamePromptSaving(false)
    }
    setShowNamePrompt(false)
  }

  function handleNamePromptSkip() {
    try { localStorage.setItem('bookshelf_name_prompted', 'true') } catch { /* ignore */ }
    setShowNamePrompt(false)
  }

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

  // ── List filters ──────────────────────────────────────────────────────────
  // Format applies to every tab; rating / genre / hide-abandoned only make
  // sense for the Read list (the other tabs have no ratings or genres).
  const byFormat = (b: Book) =>
    filterFormat === 'all' ||
    (filterFormat === 'audiobook' && !!b.is_audiobook) ||
    (filterFormat === 'ebook' && !!b.is_ebook)

  const filteredReadBooks = books.filter(b =>
    byFormat(b) &&
    (filterMinRating === 0 || (b.rating ?? 0) >= filterMinRating) &&
    (filterGenre === null || (b.genre?.trim() ?? '') === filterGenre) &&
    (!filterHideAbandoned || b.status !== 'abandoned')
  )
  const filteredToRead = toReadBooks.filter(byFormat)
  const filteredWishlist = wishlistBooks.filter(byFormat)

  // Distinct genres of read books, most frequent first (for the filter sheet)
  const genreCounts = new Map<string, number>()
  for (const b of books) {
    const g = b.genre?.trim()
    if (g) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1)
  }
  const filterGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g).slice(0, 12)
  const hasAbandoned = books.some(b => b.status === 'abandoned')

  const booksByYear = filteredReadBooks.reduce<Record<number, Book[]>>((acc, book) => {
    acc[book.year] = [...(acc[book.year] ?? []), book]
    return acc
  }, {})
  const years = Object.keys(booksByYear).map(Number).sort((a, b) => b - a)

  // ── Dashboard data — abandoned books don't count as read ─────────────────
  const dashboardBooks = books.filter(b => b.status !== 'abandoned')
  const dashYears = [...new Set(dashboardBooks.map(b => b.year))].sort((a, b) => b - a)
  // null = not yet picked → default to most recent year; 'all' = explicit all-time
  const effectiveYear: number | 'all' = dashboardYear ?? (dashYears.length > 0 ? dashYears[0] : 'all')


  // ── Search ───────────────────────────────────────────────────────────────
  function bookHref(book: Book): string {
    if (book.status === 'wishlist') return `/wishlist/${book.id}`
    if (book.status === 'to_read' || book.status === 'currently_reading') return `/to-read/${book.id}`
    return `/book/${book.id}`
  }

  const allBooks = [...books, ...toReadBooks, ...wishlistBooks]
  const q = searchQuery.trim().toLowerCase()
  const searchResults = q.length > 0
    ? allBooks.filter(b =>
        b.title.toLowerCase().includes(q) ||
        (b.author ?? '').toLowerCase().includes(q)
      )
    : []

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-[var(--fill)] rounded-full animate-spin"
               style={{ borderTopColor: 'var(--primary)' }} />
          <p className="text-[15px]" style={{ color: 'var(--label-secondary)' }}>{t.loadingBookshelf}</p>
        </div>
      </div>
    )
  }

  // A failed fetch must never be confused with "you have no books" — show a
  // dedicated retry screen instead of falling through to the empty states.
  if (loadError && books.length === 0 && toReadBooks.length === 0 && wishlistBooks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-4 text-center max-w-[320px]">
          <h2 className="text-[20px] font-bold" style={{ color: 'var(--label)' }}>{t.loadBooksErrorTitle}</h2>
          <p className="text-[15px] leading-5" style={{ color: 'var(--label-secondary)' }}>{t.loadBooksErrorBody}</p>
          <button
            onClick={() => { setLoading(true); loadBooks().finally(() => setLoading(false)) }}
            className="px-5 py-[12px] rounded-[12px] text-white text-[15px] font-semibold"
            style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
          >
            {t.loadBooksErrorRetry}
          </button>
        </div>
      </div>
    )
  }

  const fabRoute =
    activeTab === 'books' && activeBookTab === 'read'     ? '/add?tab=read' :
    activeTab === 'books' && activeBookTab === 'to_read'  ? '/add?tab=to_read' :
    activeTab === 'books'                                 ? '/add?tab=wishlist' :
    null  // no FAB on Dashboard

  const hasAnyBooks = books.length > 0 || toReadBooks.length > 0 || wishlistBooks.length > 0

  const isEmptyState =
    (activeTab === 'books' && !hasAnyBooks) ||
    (activeTab === 'dashboard' && dashboardBooks.length === 0)

  const title =
    activeTab === 'dashboard' ? (displayName || t.dashboardTitle) : t.myBookshelf

  const pullProgress = Math.min(pullY / PULL_MAX, 1)

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: cozyMode ? 16 : 100 }}>

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
              {activeTab === 'books' && hasAnyBooks ? (
                <div className="flex items-center flex-1 shrink-0">
                  {([
                    { key: 'read' as BookTab, label: t.tabRead },
                    { key: 'to_read' as BookTab, label: t.tabToRead },
                    { key: 'wishlist' as BookTab, label: t.tabWishlist },
                  ]).map(({ key, label }, i) => (
                    <div key={key} className="flex items-center shrink-0">
                      {i > 0 && (
                        <div className="w-px h-[18px] mx-[16px]" style={{ backgroundColor: 'var(--separator)' }} />
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveBookTab(key)}
                        className="text-[12px] leading-[16px] whitespace-nowrap"
                        style={{
                          fontWeight: activeBookTab === key ? 510 : 400,
                          color: activeBookTab === key ? 'var(--label)' : 'var(--label-secondary)',
                        }}
                      >
                        {label}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="flex-1 min-w-0 truncate text-[17px] font-semibold tracking-[-0.3px]"
                      style={{ color: 'var(--label)' }}>
                  {title}
                </span>
              )}

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
                        {dashYears.map(y => (
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
                        {dashYears.length > 0 && (
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

              {activeTab === 'books' && hasAnyBooks && (
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
            className="mx-4 mt-4 px-4 py-3 rounded-2xl text-[14px] font-semibold flex items-center justify-between"
            style={{
              // Inverted pill: --label background needs the opposite text
              // color, otherwise dark mode renders white on white.
              backgroundColor: 'var(--label)',
              color: 'var(--bg-elevated)',
            }}
          >
            <span className={flashUndo ? '' : 'w-full text-center'}>{flashMessage}</span>
            {flashUndo && (
              <button
                onClick={handleUndo}
                className="ml-3 shrink-0 px-3 py-1 rounded-lg text-[13px] font-bold"
                style={{ backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 22%, transparent)' }}
              >
                {t.undo}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Large title + controls ────────────────────────────────────── */}
      {!isEmptyState && (
        <div className="px-5 pt-4 pb-4">
          {/* Single row: left content + right buttons, always same height */}
          <div className="flex items-end gap-2">

            {/* Dashboard only — the title is the reader's name, so this is their
                picture next to it. Not rendered on the books tab, where the
                search bar overlays the title. */}
            {activeTab === 'dashboard' && (
              <UserAvatar size={40} decorative className="mb-[6px]" />
            )}

            {/* Left: title always in DOM (fixes height), search bar overlays it */}
            <div className="flex-1 min-w-0 relative">
              {/* Title — always rendered to hold the row height. Auto-shrinks
                  to fit the row (the Unbounded display font is wide and would
                  otherwise run under the buttons). */}
              <motion.h1
                ref={titleRef}
                className="font-bold tracking-[-0.5px] whitespace-nowrap overflow-hidden text-ellipsis w-full"
                style={{ color: 'var(--label)', fontSize: TITLE_MAX_PX, lineHeight: '51px' }}
                animate={{ opacity: activeTab === 'books' && showSearch ? 0 : 1 }}
                transition={{ duration: 0.15 }}
              >
                {title}
              </motion.h1>

              {/* Search bar — absolute over the title, aligns to bottom */}
              {activeTab === 'books' && (
                <motion.div
                  className="absolute inset-0 flex items-end pb-1"
                  animate={{
                    clipPath: showSearch
                      ? 'inset(0% 0% 0% 0% round 12px)'
                      : 'inset(0% 0% 0% 100% round 18px)',
                  }}
                  transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                >
                  <motion.div
                    className="w-full flex items-center gap-2 px-3 h-9"
                    style={{ backgroundColor: 'var(--fill)' }}
                    animate={{ borderRadius: showSearch ? '12px' : '18px' }}
                    transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                  >
                    {showSearch && (
                      <motion.div layoutId="search-icon" style={{ display: 'flex', flexShrink: 0, color: 'var(--label-tertiary)' }}>
                        <Search size={18} />
                      </motion.div>
                    )}
                    <input
                      ref={searchInputRef}
                      type="search"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={t.searchPlaceholder}
                      className="flex-1 bg-transparent text-[17px] focus:outline-none min-w-0"
                      style={{ color: 'var(--label)', caretColor: 'var(--primary)' }}
                    />
                    {searchQuery.length > 0 && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--label-tertiary)' }}
                      >
                        <X size={11} className="text-white" strokeWidth={2.5} />
                      </button>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </div>

            {/* Right: action buttons */}
            <div className="flex items-center gap-2 shrink-0 pb-1">
              {/* Year picker — dashboard only */}
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
                        style={{ backgroundColor: 'var(--bg-elevated)', boxShadow: '0 4px 24px rgba(0,0,0,0.14)', minWidth: '110px' }}
                      >
                        {dashYears.map(y => (
                          <button
                            key={y}
                            onClick={() => { setDashboardYear(y); setYearPickerSource(null) }}
                            className="w-full px-[16px] py-[10px] text-left text-[15px]"
                            style={{ color: effectiveYear === y ? 'var(--primary)' : 'var(--label)', fontWeight: effectiveYear === y ? 600 : 400 }}
                          >{y}</button>
                        ))}
                        {dashYears.length > 0 && <div className="mx-[12px] h-px" style={{ backgroundColor: 'var(--separator)' }} />}
                        <button
                          onClick={() => { setDashboardYear('all'); setYearPickerSource(null) }}
                          className="w-full px-[16px] py-[10px] text-left text-[15px]"
                          style={{ color: effectiveYear === 'all' ? 'var(--primary)' : 'var(--label)', fontWeight: effectiveYear === 'all' ? 600 : 400 }}
                        >{t.allTime}</button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Filter + Search buttons — collapse width when search is open */}
              {activeTab === 'books' && hasAnyBooks && (
                <motion.div
                  animate={{ width: showSearch ? 0 : 'auto', opacity: showSearch ? 0 : 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                  style={{ pointerEvents: showSearch ? 'none' : 'auto', overflow: 'hidden' }}
                  className="flex items-center gap-2"
                >
                  <button
                    onClick={() => setShowFilter(true)}
                    className="w-9 h-9 rounded-full flex items-center justify-center relative"
                    style={{ backgroundColor: 'var(--fill)', color: filtersActive ? 'var(--primary)' : 'var(--label-secondary)' }}
                    aria-label="Filter"
                  >
                    <SlidersHorizontal size={18} />
                    {filtersActive && (
                      <span className="absolute top-[2px] right-[2px] w-2 h-2 rounded-full"
                            style={{ backgroundColor: 'var(--primary)' }} />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowSearch(true)
                      setTimeout(() => searchInputRef.current?.focus(), 50)
                    }}
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--fill)', color: 'var(--label-secondary)' }}
                    aria-label="Search"
                  >
                    <motion.div layoutId="search-icon" style={{ display: 'flex' }}>
                      <Search size={18} />
                    </motion.div>
                  </button>
                </motion.div>
              )}

              {/* + button — always visible, spins 45° when search is open */}
              {fabRoute && (
                <motion.button
                  whileTap={{ scale: 0.90 }}
                  onClick={() => {
                    if (showSearch) { setShowSearch(false); setSearchQuery('') }
                    else router.push(fabRoute)
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  animate={{
                    backgroundColor: showSearch ? 'var(--fill)' : 'var(--primary)',
                    boxShadow: showSearch ? 'none' : 'var(--btn-shadow)',
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.span
                    animate={{ rotate: showSearch ? 45 : 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    style={{ display: 'flex', color: showSearch ? 'var(--label-secondary)' : 'white' }}
                  >
                    <Plus size={20} strokeWidth={2.5} />
                  </motion.span>
                </motion.button>
              )}
            </div>

          </div>
        </div>
      )}


      {/* ── Books tab: segmented control ─────────────────────────────── */}
      {activeTab === 'books' && !isEmptyState && !showSearch && (
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

      {/* ── Search results ───────────────────────────────────────────── */}
      {activeTab === 'books' && showSearch && searchQuery.trim().length > 0 && (
        <div className="px-4">
          {searchResults.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center pt-12 gap-2"
            >
              <p className="text-[17px] font-semibold" style={{ color: 'var(--label)' }}>
                {t.searchNoResults}
              </p>
              <p className="text-[15px]" style={{ color: 'var(--label-secondary)' }}>
                {t.searchNoResultsSub}
              </p>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-[1px] overflow-hidden rounded-[14px]"
                 style={{ backgroundColor: 'var(--separator)' }}>
              {searchResults.map((book, i) => {
                const statusLabel =
                  book.status === 'wishlist'          ? t.tabWishlist :
                  book.status === 'to_read'           ? t.tabToRead :
                  book.status === 'currently_reading' ? t.chipCurrentlyReading :
                  book.status === 'abandoned'         ? t.chipAbandoned :
                  t.tabRead
                return (
                  <motion.button
                    key={book.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => router.push(bookHref(book))}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    style={{ backgroundColor: 'var(--bg-elevated)' }}
                  >
                    {/* Cover thumbnail */}
                    <div className="w-[42px] h-[60px] rounded-[6px] overflow-hidden shrink-0"
                         style={{ backgroundColor: 'var(--primary)' }}>
                      <BookCover src={book.cover_url} alt={book.title} iconSize={12} patternSize={14} />
                    </div>

                    {/* Title + author */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold leading-[20px] truncate"
                         style={{ color: 'var(--label)' }}>
                        {book.title}
                      </p>
                      {book.author && (
                        <p className="text-[13px] leading-[18px] truncate"
                           style={{ color: 'var(--label-secondary)' }}>
                          {book.author}
                        </p>
                      )}
                    </div>

                    {/* Status badge */}
                    <span
                      className="text-[11px] font-medium px-2 py-[3px] rounded-full shrink-0"
                      style={{ backgroundColor: 'var(--fill)', color: 'var(--label-secondary)' }}
                    >
                      {statusLabel}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Books tab → Read sub-tab ──────────────────────────────────── */}
      {activeTab === 'books' && activeBookTab === 'read' && !(showSearch && searchQuery.trim().length > 0) && (
        books.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <div className="w-[280px] h-[280px] relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="w-full h-full object-contain"
                   src="/empty-read.png" />
            </div>
            <div className="w-full px-6 flex flex-col gap-5 text-center">
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
        ) : filtersActive && filteredReadBooks.length === 0 ? (
          <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center pt-12 gap-3 px-6"
            >
              <p className="text-[17px] font-semibold" style={{ color: 'var(--label)' }}>
                {t.searchNoResults}
              </p>
              <button
                onClick={resetFilters}
                className="text-[15px] font-medium"
                style={{ color: 'var(--primary)' }}
              >
                {t.filterReset}
              </button>
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
      {activeTab === 'books' && activeBookTab === 'to_read' && !(showSearch && searchQuery.trim().length > 0) && (
        toReadBooks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <div className="w-full h-[280px] overflow-hidden relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt=""
                   className="absolute h-full left-1/2 -translate-x-1/2 max-w-none"
                   style={{ width: 400 }}
                   src="/empty-toread.png" />
            </div>
            <div className="w-full px-6 flex flex-col gap-5 text-center">
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
        ) : filtersActive && filteredToRead.length === 0 ? (
          <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center pt-12 gap-3 px-6"
            >
              <p className="text-[17px] font-semibold" style={{ color: 'var(--label)' }}>
                {t.searchNoResults}
              </p>
              <button
                onClick={resetFilters}
                className="text-[15px] font-medium"
                style={{ color: 'var(--primary)' }}
              >
                {t.filterReset}
              </button>
            </motion.div>
        ) : (
          <ToReadList books={filteredToRead} viewMode={viewMode} />
        )
      )}

      {/* ── Books tab → Wishlist sub-tab ──────────────────────────────── */}
      {activeTab === 'books' && activeBookTab === 'wishlist' && !(showSearch && searchQuery.trim().length > 0) && (
        wishlistBooks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <div className="w-[320px] h-[320px] relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="w-full h-full object-contain"
                   src="/empty-wishlist.png" />
            </div>
            <div className="w-full px-6 flex flex-col gap-5 text-center">
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
        ) : filtersActive && filteredWishlist.length === 0 ? (
          <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center pt-12 gap-3 px-6"
            >
              <p className="text-[17px] font-semibold" style={{ color: 'var(--label)' }}>
                {t.searchNoResults}
              </p>
              <button
                onClick={resetFilters}
                className="text-[15px] font-medium"
                style={{ color: 'var(--primary)' }}
              >
                {t.filterReset}
              </button>
            </motion.div>
        ) : (
          <WishlistList books={filteredWishlist} viewMode={viewMode} />
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
          {dashboardBooks.length === 0 ? (
            /* ── Empty state ── */
            <motion.div
              variants={dashCard}
              className="flex flex-col items-center text-center px-8 pt-6 pb-8"
            >
              <div className="w-[260px] h-[260px] relative shrink-0 mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  className="w-full h-full object-contain"
                  src="/empty-dashboard.png"
                />
              </div>
              <h2
                className="text-[22px] font-bold tracking-[-0.3px] mb-2"
                style={{ color: 'var(--label)' }}
              >
                {t.dashboardEmptyTitle}
              </h2>
              <p
                className="text-[15px] leading-[22px] mb-8"
                style={{ color: 'var(--label-secondary)' }}
              >
                {t.dashboardEmptyCopy}
              </p>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => { setActiveTab('books'); router.push('/add') }}
                className="w-full max-w-[280px] py-[15px] rounded-[14px] text-white text-[17px] font-semibold"
                style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
              >
                {t.addFirstBookCta}
              </motion.button>
            </motion.div>
          ) : (
            <>
              {effectiveYear !== 'all' && (
                <motion.div variants={dashCard}>
                  <ReadingPaceChart books={dashboardBooks} year={effectiveYear} />
                </motion.div>
              )}
              <motion.div variants={dashCard}>
                <RatingDistributionChart books={dashboardBooks} />
              </motion.div>
              <motion.div variants={dashCard}>
                <FavouriteAuthors books={dashboardBooks} />
              </motion.div>
              <motion.div variants={dashCard}>
                <GenreBreakdown books={dashboardBooks} />
              </motion.div>
            </>
          )}
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
            {/* The tab label already reads the name, so the image is decorative here. */}
            <UserAvatar size={22} shape="circle" decorative className="relative" />
            <span className="text-[10px] font-medium relative tracking-[-0.1px] max-w-[64px] truncate"
                  style={{ color: activeTab === 'dashboard' ? 'var(--primary)' : 'var(--label-secondary)' }}>
              {displayName || t.tabDashboard}
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

      {/* ── Name prompt overlay ───────────────────────────────────────── */}
      <AnimatePresence>
        {showNamePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
          >
            <motion.div
              initial={{ y: 120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 120, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className="w-full max-w-[600px] rounded-t-[28px] px-6 pt-5 pb-10"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              {/* Drag handle */}
              <div className="w-10 h-1 rounded-full mx-auto mb-6"
                   style={{ backgroundColor: 'var(--separator-opaque)' }} />

              <div className="flex flex-col gap-1 mb-6">
                <h2 className="text-[24px] font-bold tracking-[-0.3px]" style={{ color: 'var(--label)' }}>
                  {t.namePromptTitle}
                </h2>
                <p className="text-[15px] leading-5" style={{ color: 'var(--label-secondary)' }}>
                  {t.namePromptSub}
                </p>
              </div>

              <div className="rounded-[14px] overflow-hidden mb-4" style={{ backgroundColor: 'var(--fill)' }}>
                <input
                  type="text"
                  autoFocus
                  autoComplete="given-name"
                  placeholder={t.yourNamePlaceholder}
                  value={namePromptInput}
                  onChange={e => setNamePromptInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleNamePromptSave() }}
                  className="w-full px-4 py-[14px] text-[17px] bg-transparent focus:outline-none"
                  style={{ color: 'var(--label)', caretColor: 'var(--primary)' }}
                />
              </div>

              <div className="flex flex-col gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleNamePromptSave}
                  disabled={namePromptSaving}
                  className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold disabled:opacity-50"
                  style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
                >
                  {namePromptSaving ? '…' : t.namePromptCta}
                </motion.button>
                <button
                  onClick={handleNamePromptSkip}
                  className="w-full py-[12px] text-[16px] font-medium"
                  style={{ color: 'var(--label-secondary)' }}
                >
                  {t.namePromptSkip}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filter / sort bottom sheet ────────────────────────────────── */}
      <AnimatePresence>
        {showFilter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowFilter(false)}
          >
            <motion.div
              initial={{ y: 120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 120, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className="w-full max-w-[600px] rounded-t-[28px] px-5 pt-5 pb-10"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="w-10 h-1 rounded-full mx-auto mb-5"
                   style={{ backgroundColor: 'var(--separator-opaque)' }} />

              {/* View section */}
              <p className="text-[13px] font-semibold uppercase tracking-[0.5px] mb-2"
                 style={{ color: 'var(--label-secondary)' }}>
                {t.filterView}
              </p>
              <div className="flex gap-2 mb-5">
                {([
                  { mode: 'grid' as const, label: t.viewGrid, icon: <LayoutGrid size={18} /> },
                  { mode: 'list' as const, label: t.viewList, icon: <List size={18} /> },
                ]).map(({ mode, label, icon }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-[12px] text-[15px] font-medium transition-colors"
                    style={{
                      backgroundColor: viewMode === mode ? 'var(--primary)' : 'var(--fill)',
                      color: viewMode === mode ? 'white' : 'var(--label)',
                    }}
                  >
                    {icon}{label}
                  </button>
                ))}
              </div>

              {/* Format section */}
              <p className="text-[13px] font-semibold uppercase tracking-[0.5px] mb-2"
                 style={{ color: 'var(--label-secondary)' }}>
                {t.filterFormat}
              </p>
              <div className="flex gap-2 mb-5">
                {([
                  { value: 'all' as const, label: t.filterAll },
                  { value: 'audiobook' as const, label: t.audiobook },
                  { value: 'ebook' as const, label: t.ebook },
                ]).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setFilterFormat(value)}
                    className="flex-1 py-[10px] px-2 rounded-[12px] text-[14px] font-medium transition-colors"
                    style={{
                      backgroundColor: filterFormat === value ? 'var(--primary)' : 'var(--fill)',
                      color: filterFormat === value ? 'white' : 'var(--label)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Minimum rating — applies to the Read list */}
              {activeBookTab === 'read' && (
                <>
                  <p className="text-[13px] font-semibold uppercase tracking-[0.5px] mb-2"
                     style={{ color: 'var(--label-secondary)' }}>
                    {t.filterMinRating}
                  </p>
                  <div className="flex gap-2 mb-5">
                    {[0, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        onClick={() => setFilterMinRating(r)}
                        className="flex-1 py-[10px] rounded-[12px] text-[14px] font-medium transition-colors"
                        style={{
                          backgroundColor: filterMinRating === r ? 'var(--primary)' : 'var(--fill)',
                          color: filterMinRating === r ? 'white' : 'var(--label)',
                        }}
                      >
                        {r === 0 ? t.filterAll : r === 5 ? '5★' : `${r}★+`}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Genre — applies to the Read list */}
              {activeBookTab === 'read' && filterGenres.length > 0 && (
                <>
                  <p className="text-[13px] font-semibold uppercase tracking-[0.5px] mb-2"
                     style={{ color: 'var(--label-secondary)' }}>
                    {t.genre}
                  </p>
                  <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-5 px-5">
                    {[null, ...filterGenres].map((g) => (
                      <button
                        key={g ?? '__all__'}
                        onClick={() => setFilterGenre(g)}
                        className="shrink-0 py-[8px] px-4 rounded-full text-[14px] font-medium transition-colors whitespace-nowrap"
                        style={{
                          backgroundColor: filterGenre === g ? 'var(--primary)' : 'var(--fill)',
                          color: filterGenre === g ? 'white' : 'var(--label)',
                        }}
                      >
                        {g ?? t.filterAll}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Hide abandoned — only offered when abandoned books exist */}
              {activeBookTab === 'read' && hasAbandoned && (
                <div className="flex items-center justify-between py-1 mb-5">
                  <span className="text-[15px]" style={{ color: 'var(--label)' }}>
                    {t.filterHideAbandoned}
                  </span>
                  <button
                    onClick={() => setFilterHideAbandoned(v => !v)}
                    className="relative w-[51px] h-[31px] rounded-full shrink-0 transition-colors duration-300"
                    style={{ backgroundColor: filterHideAbandoned ? 'var(--success)' : 'rgba(120,120,128,0.22)' }}
                    aria-pressed={filterHideAbandoned}
                  >
                    <div
                      className="absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white transition-transform duration-300"
                      style={{
                        transform: filterHideAbandoned ? 'translateX(22px)' : 'translateX(2px)',
                        boxShadow: '0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.16)',
                      }}
                    />
                  </button>
                </div>
              )}

              {/* Reset */}
              {filtersActive && (
                <button
                  onClick={() => { resetFilters(); setShowFilter(false) }}
                  className="w-full py-[13px] rounded-[14px] text-[16px] font-semibold"
                  style={{ backgroundColor: 'var(--fill)', color: 'var(--danger)' }}
                >
                  {t.filterReset}
                </button>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
