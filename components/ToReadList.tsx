'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import BookCard from '@/components/BookCard'
import BookCover from '@/components/BookCover'
import type { Book } from '@/types/book'
import type { ViewMode } from '@/contexts/AppContext'
import { useT } from '@/contexts/AppContext'

const SHORT_MONTHS_LIST = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface ToReadListProps {
  books: Book[]
  viewMode?: ViewMode
}

// ─── Date formatting ──────────────────────────────────────────────────────────

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type SeasonLabels = Record<number, string>
function getSeasonLabels(t: ReturnType<typeof useT>): SeasonLabels {
  return { 13: t.seasonSpring, 14: t.seasonSummer, 15: t.seasonAutumn, 16: t.seasonWinter }
}

const SEASON_MIDPOINT: Record<number, number> = {
  13: 4, 14: 7, 15: 10, 16: 12,
}

type RelativeStrings = { justNow: string; month: string; months: string; year: string; years: string }

function formatAcquiredDate(year: number, month: number | null, r: RelativeStrings, createdAt: string, seasonLabels: SeasonLabels): string | null {
  if (!year || year === 0) return null

  const now = new Date()
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth() + 1
  const minutesDiff = (now.getTime() - new Date(createdAt).getTime()) / 60000

  let prefix = ''
  let midpoint = 6
  if (month) {
    if (month >= 1 && month <= 12) {
      prefix = SHORT_MONTHS[month - 1] + ' '
      midpoint = month
    } else if (seasonLabels[month]) {
      prefix = seasonLabels[month] + ' '
      midpoint = SEASON_MIDPOINT[month]
    }
  }

  const monthsDiff = (nowYear * 12 + nowMonth) - (year * 12 + midpoint)

  let relative: string
  if (minutesDiff < 30) {
    relative = r.justNow
  } else if (monthsDiff < 12) {
    relative = `${monthsDiff} ${monthsDiff !== 1 ? r.months : r.month}`
  } else {
    const years = Math.floor(monthsDiff / 12)
    relative = `${years} ${years !== 1 ? r.years : r.year}`
  }

  return `${prefix}${year} (${relative})`
}

// ─── Year section (accordion) ─────────────────────────────────────────────────

interface YearSectionProps {
  year: number
  books: Book[]
  viewMode: ViewMode
}

function ToReadYearSection({ year, books, viewMode }: YearSectionProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const router = useRouter()
  const t = useT()

  function toggle() {
    if (isOpen) setExpanded(false)
    setIsOpen(!isOpen)
  }

  const sortedBooks = [...books].sort((a, b) => {
    const aM = a.month ? (SEASON_MIDPOINT[a.month] ?? a.month) : 6
    const bM = b.month ? (SEASON_MIDPOINT[b.month] ?? b.month) : 6
    return bM - aM
  })

  const seasonLabels = getSeasonLabels(t)
  const yearLabel = year === 0 ? t.unknownYear : String(year)
  const count = books.length

  return (
    <div>
      {/* Accordion header — iOS 26 style */}
      <button
        onClick={toggle}
        className="flex items-center justify-between w-full px-5 pt-5 pb-2 text-left"
      >
        <span className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--label-secondary)' }}>
          {yearLabel}
          <span className="font-medium ml-2" style={{ color: 'var(--label-tertiary)' }}>
            · {count} {count === 1 ? t.singularBook : t.pluralBooks}
          </span>
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.18 }}
          style={{ color: 'var(--label-tertiary)' }}
        >
          <ChevronDown size={16} />
        </motion.div>
      </button>

      {/* Book list — slides open/closed */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
            className={expanded ? 'overflow-visible' : 'overflow-hidden'}
            onAnimationComplete={() => { if (isOpen) setExpanded(true) }}
          >
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 min-[500px]:grid-cols-3 gap-x-[12px] gap-y-3 px-4 pb-4">
                {sortedBooks.map((book) => (
                  <BookCard key={book.id} book={book} href={`/to-read/${book.id}`} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col px-5 pb-2">
                {sortedBooks.map((book, i) => {
                  const dateLabel = formatAcquiredDate(book.year, book.month ?? null, { justNow: t.relativeJustNow, month: t.relativeMonth, months: t.relativeMonths, year: t.relativeYear, years: t.relativeYears }, book.created_at, seasonLabels)
                  return (
                    <div key={book.id}>
                      <motion.button
                        whileTap={{ scale: 0.99, opacity: 0.85 }}
                        onClick={() => router.push(`/to-read/${book.id}`)}
                        className="w-full flex items-center gap-3 py-3 pr-4 text-left"
                      >
                        {/* Cover */}
                        <div className="w-[56px] h-[84px] rounded-[10px] overflow-hidden flex-shrink-0 shadow-sm">
                          <BookCover src={book.cover_url} alt={book.title} />
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          {dateLabel && (
                            <p className="text-[12px] font-medium leading-4" style={{ color: 'var(--label-tertiary)' }}>
                              {dateLabel}
                            </p>
                          )}
                          <p className="font-semibold text-[16px] leading-5 line-clamp-2 flex items-center gap-1.5" style={{ color: book.status === 'abandoned' ? 'var(--label-tertiary)' : 'var(--label)' }}>
                            {book.is_audiobook && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50">
                                <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
                              </svg>
                            )}
                            {book.is_ebook && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50">
                                <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
                                <line x1="12" x2="12.01" y1="18" y2="18" />
                              </svg>
                            )}
                            {book.title}
                            {book.status === 'abandoned' && (
                              <span className="shrink-0 text-[11px] font-medium px-[6px] py-[1px] rounded-full" style={{ backgroundColor: 'var(--fill)', color: 'var(--label-secondary)' }}>
                                {t.chipAbandoned}
                              </span>
                            )}
                          </p>
                          {book.author && (
                            <p className="text-[13px]" style={{ color: 'var(--label-secondary)' }}>
                              {book.author}
                            </p>
                          )}
                        </div>

                        {/* Chevron */}
                        <div style={{ color: 'var(--label-quaternary)' }}>
                          <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
                            <path d="M1 1.5L6.5 6.5L1 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </motion.button>
                      {i < sortedBooks.length - 1 && (
                        <div className="h-px ml-[68px]" style={{ backgroundColor: 'var(--separator)' }} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Currently Reading rail ───────────────────────────────────────────────────

function CurrentlyReadingRail({ books }: { books: Book[] }) {
  const sorted = [...books].sort((a, b) => {
    const ay = a.started_reading_year ?? 0
    const by = b.started_reading_year ?? 0
    if (by !== ay) return by - ay
    const am = a.started_reading_month ?? 0
    const bm = b.started_reading_month ?? 0
    if (bm !== am) return bm - am
    const ad = a.started_reading_day ?? 0
    const bd = b.started_reading_day ?? 0
    if (bd !== ad) return bd - ad
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  books = sorted
  const t = useT()

  return (
    <div className="mb-2">
      {/* Section header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <span className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--label-secondary)' }}>
          {t.currentlyReadingSection}
        </span>
        {/* Live pulse dot */}
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: 'var(--primary)' }} />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'var(--primary)' }} />
        </span>
      </div>

      {/* Horizontal scroll strip */}
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ scrollSnapType: 'x mandatory', paddingLeft: 20, scrollPaddingLeft: 20 }}>
        {books.map((book) => (
          <CurrentlyReadingCard key={book.id} book={book} />
        ))}
      </div>

    </div>
  )
}

function CurrentlyReadingCard({ book }: { book: Book }) {
  const router = useRouter()
  const [coverFailed, setCoverFailed] = useState(false)

  const startLabel = book.started_reading_year
    ? [
        book.started_reading_day ? String(book.started_reading_day) : null,
        book.started_reading_month ? SHORT_MONTHS_LIST[book.started_reading_month - 1] : null,
        String(book.started_reading_year),
      ].filter(Boolean).join(' ')
    : null

  const showCover = !!book.cover_url && !coverFailed

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => router.push(`/to-read/${book.id}`)}
      className="shrink-0 rounded-[8px] overflow-hidden text-left"
      style={{
        width: 150,
        height: 230,
        scrollSnapAlign: 'start',
        flexShrink: 0,
        boxShadow: '0 16px 32px -4px rgba(12,12,13,0.10), 0 4px 4px -4px rgba(12,12,13,0.05)',
      }}
    >
      <div className="relative w-full h-full flex items-end pb-4 pt-2 px-2">
        {/* Cover / placeholder */}
        <div className="absolute inset-0">
          <BookCover
            src={book.cover_url}
            alt={book.title}
            iconSize={0}
            patternSize={32}
            patternOpacity={0.16}
            onFail={() => setCoverFailed(true)}
          />
        </div>

        {/* Gradient overlay */}
        {showCover ? (
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/70" />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--primary), transparent), var(--primary))' }}
          />
        )}

        {/* Text pinned to bottom */}
        <div className="relative z-10 flex flex-col gap-1 w-full">
          {startLabel && (
            <p className="text-[11px] leading-[13px] tracking-[0.06px]" style={{ color: 'rgba(255,255,255,0.80)' }}>
              {startLabel}
            </p>
          )}
          {!showCover && (
            <p className="text-white text-[17px] font-semibold leading-[22px] tracking-[-0.43px] line-clamp-2">
              {book.title}
            </p>
          )}
          {book.author && (
            <p className="font-semibold text-[11px] leading-[13px] tracking-[0.06px] line-clamp-1" style={{ color: 'rgba(255,255,255,0.80)' }}>
              {book.author}
            </p>
          )}
        </div>
      </div>
    </motion.button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ToReadList({ books, viewMode = 'list' }: ToReadListProps) {
  const currentlyReading = books.filter(b => b.status === 'currently_reading')
  const toRead = books.filter(b => b.status !== 'currently_reading')

  const byYear = toRead.reduce<Record<number, Book[]>>((acc, book) => {
    const y = book.acquired_year ?? book.year ?? 0
    acc[y] = [...(acc[y] ?? []), book]
    return acc
  }, {})

  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => {
      if (a === 0) return 1
      if (b === 0) return -1
      return b - a
    })

  return (
    <div className="pb-8">
      {currentlyReading.length > 0 && (
        <CurrentlyReadingRail books={currentlyReading} />
      )}
      {years.map((year) => (
        <ToReadYearSection
          key={year}
          year={year}
          books={byYear[year]}
          viewMode={viewMode}
        />
      ))}
    </div>
  )
}
