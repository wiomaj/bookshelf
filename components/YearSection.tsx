'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import BookCard from './BookCard'
import BookListItem from './BookListItem'
import type { Book } from '@/types/book'
import type { ViewMode } from '@/contexts/AppContext'

interface YearSectionProps {
  year: number
  books: Book[]
  defaultOpen?: boolean
  viewMode?: ViewMode
}

export default function YearSection({
  year,
  books,
  defaultOpen = true,
  viewMode = 'grid',
}: YearSectionProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return defaultOpen
    try {
      const raw = localStorage.getItem('bookshelf_closed_years')
      if (raw) {
        const closed = JSON.parse(raw) as number[]
        return !closed.includes(year)
      }
    } catch { /* ignore */ }
    return defaultOpen
  })

  // Once fully open we switch to overflow-visible so hover shadows/lift aren't clipped.
  // We revert to overflow-hidden just before the close animation so it clips correctly.
  const [expanded, setExpanded] = useState(isOpen)

  function toggle() {
    const next = !isOpen
    if (!next) setExpanded(false) // clip before close animation starts
    setIsOpen(next)
    try {
      const raw = localStorage.getItem('bookshelf_closed_years')
      const closed: number[] = raw ? JSON.parse(raw) : []
      if (!next) {
        if (!closed.includes(year)) closed.push(year)
      } else {
        const i = closed.indexOf(year)
        if (i > -1) closed.splice(i, 1)
      }
      localStorage.setItem('bookshelf_closed_years', JSON.stringify(closed))
    } catch { /* ignore */ }
  }

  return (
    <div>
      {/* Accordion header */}
      <button
        onClick={toggle}
        className="flex items-center justify-between w-full p-4 text-left"
      >
        <span className="text-[#171717] text-[16px] font-bold leading-6">
          {year}
          <span className="font-normal text-[rgba(23,23,23,0.40)]">
            {' '}|{' '}{books.length} {books.length === 1 ? 'book' : 'books'}
          </span>
        </span>

        <div className="flex items-center">
          {/* Chevron rotates when closed */}
          <motion.div
            animate={{ rotate: isOpen ? 0 : -90 }}
            transition={{ duration: 0.2 }}
            className="text-[#171717]"
          >
            <ChevronDown size={24} />
          </motion.div>
        </div>
      </button>

      {/* Book grid — slides open/closed */}
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
            {viewMode === 'list' ? (
              <div className="flex flex-col gap-[13px] px-4 pb-4">
                {books.map((book) => (
                  <BookListItem key={book.id} book={book} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-[13px] gap-y-3 px-4 pb-4">
                {books.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
