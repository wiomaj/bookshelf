'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import StarRating from './StarRating'
import BookCover from './BookCover'
import { formatMonthShort } from '@/lib/month'
import { useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'

export default function BookListItem({ book }: { book: Book }) {
  const router = useRouter()
  const t = useT()

  return (
    <motion.div
      whileTap={{ scale: 0.99, opacity: 0.85 }}
      onClick={() => router.push(`/book/${book.id}`)}
      className="flex gap-4 items-center cursor-pointer py-3"
    >
      {/* Cover thumbnail */}
      <div
        className="w-[56px] h-[84px] rounded-[10px] overflow-hidden shrink-0 shadow-sm"
      >
        <BookCover src={book.cover_url} alt={book.title} />
      </div>

      {/* Content: month → title → author → stars */}
      <div className="flex-1 min-w-0 flex flex-col gap-[4px]">
        {(formatMonthShort(book.month) || book.status === 'abandoned') && (
          <p
            className="text-[11px] leading-[13px] tracking-[0.06px] flex items-center gap-1"
            style={{ color: 'var(--label-secondary)' }}
          >
            {formatMonthShort(book.month)}
            {book.status === 'abandoned' && (
              <>
                {formatMonthShort(book.month) && <span>·</span>}
                <span style={{ color: 'var(--danger)' }}>{t.chipAbandoned}</span>
              </>
            )}
          </p>
        )}
        <p
          className="text-[17px] font-semibold leading-[22px] tracking-[-0.43px] line-clamp-2 flex items-center gap-1.5"
          style={{ color: book.status === 'abandoned' ? 'var(--label-tertiary)' : 'var(--label)' }}
        >
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
          <p className="font-medium text-[12px] leading-[16px]" style={{ color: 'var(--label-secondary)' }}>
            {book.author}
          </p>
        )}
        {book.rating >= 1 && <StarRating rating={book.rating} readonly size={16} />}
      </div>
    </motion.div>
  )
}
