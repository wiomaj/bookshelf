'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, BookOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Book } from '@/types/book'

interface ToReadListProps {
  books: Book[]
}

// ─── Date formatting ──────────────────────────────────────────────────────────

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const SEASON_LABELS: Record<number, string> = {
  13: 'Spring', 14: 'Summer', 15: 'Autumn', 16: 'Winter',
}

// Season → approximate midpoint month for relative-time calculation
const SEASON_MIDPOINT: Record<number, number> = {
  13: 4, 14: 7, 15: 10, 16: 12,
}

/**
 * Returns a human-readable label like "Jan 2026 (1 month)" or "2022 (3 years)".
 * Returns null when no acquisition year is recorded (year === 0).
 */
function formatAcquiredDate(year: number, month: number | null): string | null {
  if (!year || year === 0) return null

  const now = new Date()
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth() + 1   // 1-indexed

  // Human-readable month / season prefix and midpoint month for diff calculation
  let prefix = ''
  let midpoint = 6   // default: middle of year when only year is known
  if (month) {
    if (month >= 1 && month <= 12) {
      prefix = SHORT_MONTHS[month - 1] + ' '
      midpoint = month
    } else if (SEASON_LABELS[month]) {
      prefix = SEASON_LABELS[month] + ' '
      midpoint = SEASON_MIDPOINT[month]
    }
  }

  // Difference in whole months since acquisition
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
}

function ToReadYearSection({ year, books }: YearSectionProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const router = useRouter()

  function toggle() {
    if (isOpen) setExpanded(false)
    setIsOpen(!isOpen)
  }

  const yearLabel = year === 0 ? 'Unknown' : String(year)
  const count = books.length

  return (
    <div>
      {/* Accordion header */}
      <button
        onClick={toggle}
        className="flex items-center justify-between w-full p-4 text-left"
      >
        <span className="text-[#171717] text-[16px] font-bold leading-6">
          {yearLabel}
          <span className="font-medium text-[12px] text-[#7c7c7c]">
            {'  '}{count} {count === 1 ? 'book' : 'books'}
          </span>
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2 }}
          className="text-[#171717]"
        >
          <ChevronDown size={24} />
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
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className={expanded ? 'overflow-visible' : 'overflow-hidden'}
            onAnimationComplete={() => { if (isOpen) setExpanded(true) }}
          >
            <div className="flex flex-col gap-[13px] px-4 pb-4">
              {books.map((book, i) => {
                const dateLabel = formatAcquiredDate(book.year, book.month ?? null)
                return (
                  <motion.button
                    key={book.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => router.push(`/to-read/${book.id}`)}
                    className="w-full flex items-center gap-4 text-left"
                  >
                    {/* Cover — 80 × 100 px matching Figma spec */}
                    <div className="w-20 h-[100px] rounded-[12px] overflow-hidden flex-shrink-0 bg-[rgba(23,23,23,0.06)]">
                      {book.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen size={24} className="text-[rgba(23,23,23,0.2)]" />
                        </div>
                      )}
                    </div>

                    {/* Text: date (small, gray) + title (bold) */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      {dateLabel && (
                        <p className="text-[12px] font-medium text-[#7c7c7c] leading-4">
                          {dateLabel}
                        </p>
                      )}
                      <p className="font-bold text-[16px] text-[#171717] leading-6 truncate">
                        {book.title}
                      </p>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ToReadList({ books }: ToReadListProps) {
  // Group by acquisition year (the `year` field stores when the book was obtained)
  const byYear = books.reduce<Record<number, Book[]>>((acc, book) => {
    const y = book.year ?? 0
    acc[y] = [...(acc[y] ?? []), book]
    return acc
  }, {})

  // Sort descending; year=0 ("Unknown") always at the bottom
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
        />
      ))}
    </div>
  )
}
