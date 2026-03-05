'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import StarRating from './StarRating'
import { formatMonthShort } from '@/lib/month'
import { coverUrl } from '@/lib/coverUrl'
import type { Book } from '@/types/book'

export default function BookCard({ book }: { book: Book }) {
  const router = useRouter()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2 }}
      onClick={() => router.push(`/book/${book.id}`)}
      className="cursor-pointer rounded-[8px] h-[230px] overflow-hidden
                 shadow-[0_16px_32px_-4px_rgba(12,12,13,0.10),0_4px_4px_-4px_rgba(12,12,13,0.05)]"
    >
      <div className="relative w-full h-full flex items-end pb-4 pt-2 px-2">

        {/* Cover image or no-cover placeholder */}
        <div className="absolute inset-0">
          {book.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl(book.cover_url)}
              alt={book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <BookOpen size={36} style={{ color: 'rgba(255,255,255,0.5)' }} />
            </div>
          )}
        </div>

        {/* Gradient overlay: transparent → dark at bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/70" />

        {/* Content pinned to bottom */}
        <div className="relative z-10 flex flex-col gap-1 w-full">
          {formatMonthShort(book.month) && (
            <p
              className="text-[11px] leading-[13px] tracking-[0.06px]"
              style={{ color: 'rgba(255,255,255,0.80)' }}
            >
              {formatMonthShort(book.month)}
            </p>
          )}

          {/* Title — only shown when there is no cover */}
          {!book.cover_url && (
            <p className="text-white text-[17px] font-semibold leading-[22px] tracking-[-0.43px] line-clamp-2">
              {book.title}
            </p>
          )}

          <StarRating rating={book.rating} readonly size={16} />
        </div>
      </div>
    </motion.div>
  )
}
