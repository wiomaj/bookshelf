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

interface WishlistListProps {
  books: Book[]
  viewMode?: ViewMode
}

// ─── Year section (accordion) ─────────────────────────────────────────────────

interface YearSectionProps {
  year: number
  books: Book[]
  viewMode: ViewMode
}

function WishlistYearSection({ year, books, viewMode }: YearSectionProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const router = useRouter()
  const t = useT()

  function toggle() {
    if (isOpen) setExpanded(false)
    setIsOpen(!isOpen)
  }

  const yearLabel = String(year)
  const count = books.length

  return (
    <div>
      {/* Accordion header */}
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

      {/* Book list */}
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
                  <BookCard key={book.id} book={book} href={`/wishlist/${book.id}`} hideRating />
                ))}
              </div>
            ) : (
              <div className="flex flex-col px-5 pb-2">
                {books.map((book, i) => {
                  return (
                    <div key={book.id}>
                      <motion.button
                        whileTap={{ scale: 0.99, opacity: 0.85 }}
                        onClick={() => router.push(`/wishlist/${book.id}`)}
                        className="w-full flex items-center gap-3 py-3 pr-4 text-left"
                      >
                        {/* Cover */}
                        <div className="w-[56px] h-[84px] rounded-[10px] overflow-hidden flex-shrink-0 shadow-sm">
                          <BookCover src={book.cover_url} alt={book.title} />
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <p className="font-semibold text-[16px] leading-5 line-clamp-2 flex items-center gap-1.5" style={{ color: 'var(--label)' }}>
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

export default function WishlistList({ books, viewMode = 'list' }: WishlistListProps) {
  const byYear = books.reduce<Record<number, Book[]>>((acc, book) => {
    const y = new Date(book.created_at).getFullYear()
    acc[y] = [...(acc[y] ?? []), book]
    return acc
  }, {})

  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a)

  return (
    <div className="pb-8">
      {years.map((year) => (
        <WishlistYearSection
          key={year}
          year={year}
          books={byYear[year]}
          viewMode={viewMode}
        />
      ))}
    </div>
  )
}
