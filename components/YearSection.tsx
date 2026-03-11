'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import BookCard from './BookCard'
import BookListItem from './BookListItem'
import type { Book } from '@/types/book'
import type { ViewMode } from '@/contexts/AppContext'
import { useT } from '@/contexts/AppContext'

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

  const [expanded, setExpanded] = useState(isOpen)
  const t = useT()

  function toggle() {
    const next = !isOpen
    if (!next) setExpanded(false)
    setIsOpen(next)
    try {
      const raw = localStorage.getItem('bookshelf_closed_years')
      const closed: number[] = raw ? JSON.parse(raw) : []
      if (!next) { if (!closed.includes(year)) closed.push(year) }
      else { const i = closed.indexOf(year); if (i > -1) closed.splice(i, 1) }
      localStorage.setItem('bookshelf_closed_years', JSON.stringify(closed))
    } catch { /* ignore */ }
  }

  return (
    <div>
      {/* Section header — iOS 26 style: secondary label, small caps */}
      <button
        onClick={toggle}
        className="flex items-center justify-between w-full px-5 pt-5 pb-2 text-left"
      >
        <span className="text-[13px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--label-secondary)' }}>
          {year}
          <span className="font-medium ml-2" style={{ color: 'var(--label-tertiary)' }}>
            · {books.length} {books.length === 1 ? t.singularBook : t.pluralBooks}
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

      {/* Book grid */}
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
            {viewMode === 'list' ? (
              <div className="flex flex-col px-5 pb-2">
                {books.map((book, i) => (
                  <div key={book.id}>
                    <BookListItem book={book} />
                    {i < books.length - 1 && (
                      <div className="h-px ml-[96px]" style={{ backgroundColor: 'var(--separator)' }} />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 min-[500px]:grid-cols-3 gap-x-[12px] gap-y-3 px-4 pb-4">
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
