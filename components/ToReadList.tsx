'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Book as BookIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { coverUrl } from '@/lib/coverUrl'
import BookCard from '@/components/BookCard'
import type { Book } from '@/types/book'
import type { ViewMode } from '@/contexts/AppContext'

const bookPatternUrl =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='-4 -4 32 32' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20'/%3E%3C/svg%3E")`

interface ToReadListProps {
  books: Book[]
  viewMode?: ViewMode
}

// ─── Date formatting ──────────────────────────────────────────────────────────

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const SEASON_LABELS: Record<number, string> = {
  13: 'Spring', 14: 'Summer', 15: 'Autumn', 16: 'Winter',
}

const SEASON_MIDPOINT: Record<number, number> = {
  13: 4, 14: 7, 15: 10, 16: 12,
}

function formatAcquiredDate(year: number, month: number | null): string | null {
  if (!year || year === 0) return null

  const now = new Date()
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth() + 1

  let prefix = ''
  let midpoint = 6
  if (month) {
    if (month >= 1 && month <= 12) {
      prefix = SHORT_MONTHS[month - 1] + ' '
      midpoint = month
    } else if (SEASON_LABELS[month]) {
      prefix = SEASON_LABELS[month] + ' '
      midpoint = SEASON_MIDPOINT[month]
    }
  }

  const monthsDiff = (nowYear * 12 + nowMonth) - (year * 12 + midpoint)

  let relative: string
  if (monthsDiff < 1) {
    relative = 'just now'
  } else if (monthsDiff < 12) {
    relative = `${monthsDiff} month${monthsDiff !== 1 ? 's' : ''}`
  } else {
    const years = Math.floor(monthsDiff / 12)
    relative = `${years} year${years !== 1 ? 's' : ''}`
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

  function toggle() {
    if (isOpen) setExpanded(false)
    setIsOpen(!isOpen)
  }

  const yearLabel = year === 0 ? 'Unknown Year' : String(year)
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
            · {count} {count === 1 ? 'book' : 'books'}
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
                {books.map((book) => (
                  <BookCard key={book.id} book={book} href={`/to-read/${book.id}`} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col px-5 pb-2">
                {books.map((book, i) => {
                  const dateLabel = formatAcquiredDate(book.year, book.month ?? null)
                  return (
                    <div key={book.id}>
                      <motion.button
                        whileTap={{ scale: 0.99, opacity: 0.85 }}
                        onClick={() => router.push(`/to-read/${book.id}`)}
                        className="w-full flex items-center gap-3 py-3 pr-4 text-left"
                      >
                        {/* Cover */}
                        <div className="w-[56px] h-[76px] rounded-[10px] overflow-hidden flex-shrink-0 shadow-sm">
                          {book.cover_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={coverUrl(book.cover_url)}
                              alt={book.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="relative w-full h-full flex items-center justify-center"
                                 style={{ backgroundColor: 'var(--primary)' }}>
                              <div className="absolute inset-0 opacity-[0.08]"
                                   style={{ backgroundImage: bookPatternUrl, backgroundSize: '18px 18px', backgroundRepeat: 'repeat' }} />
                              <BookIcon size={16} color="white" className="relative z-10" />
                            </div>
                          )}
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          {dateLabel && (
                            <p className="text-[12px] font-medium leading-4" style={{ color: 'var(--label-tertiary)' }}>
                              {dateLabel}
                            </p>
                          )}
                          <p className="font-semibold text-[16px] leading-5 line-clamp-2" style={{ color: 'var(--label)' }}>
                            {book.title}
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
                      {i < books.length - 1 && (
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function ToReadList({ books, viewMode = 'list' }: ToReadListProps) {
  const byYear = books.reduce<Record<number, Book[]>>((acc, book) => {
    const y = book.year ?? 0
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
