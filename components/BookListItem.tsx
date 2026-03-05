'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import StarRating from './StarRating'
import { formatMonthShort } from '@/lib/month'
import { coverUrl } from '@/lib/coverUrl'
import type { Book } from '@/types/book'

export default function BookListItem({ book }: { book: Book }) {
  const router = useRouter()

  return (
    <motion.div
      whileTap={{ scale: 0.99, opacity: 0.85 }}
      onClick={() => router.push(`/book/${book.id}`)}
      className="flex gap-3 items-center cursor-pointer py-3 pr-4"
    >
      {/* Cover */}
      <div className="w-[56px] h-[76px] rounded-[10px] overflow-hidden shrink-0 shadow-sm">
        {book.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl(book.cover_url)} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, var(--fill) 0%, var(--separator) 100%)' }}>
            <BookOpen size={20} style={{ color: 'var(--label-tertiary)' }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-[16px] font-semibold leading-5 line-clamp-2" style={{ color: 'var(--label)' }}>
          {book.title}
        </p>
        <div className="flex items-center gap-2">
          <StarRating rating={book.rating} readonly size={14} />
          {formatMonthShort(book.month) && (
            <span className="text-[12px] font-medium" style={{ color: 'var(--label-secondary)' }}>
              {formatMonthShort(book.month)}
            </span>
          )}
        </div>
      </div>

      {/* Chevron */}
      <div style={{ color: 'var(--label-quaternary)' }}>
        <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
          <path d="M1 1.5L6.5 6.5L1 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </motion.div>
  )
}
