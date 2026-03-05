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
      className="flex gap-4 items-center cursor-pointer py-3"
    >
      {/* Cover thumbnail */}
      <div
        className="w-[80px] h-[100px] rounded-[12px] overflow-hidden shrink-0
                   shadow-[0_16px_32px_-4px_rgba(12,12,13,0.10),0_4px_4px_-4px_rgba(12,12,13,0.05)]"
      >
        {book.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl(book.cover_url)} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <BookOpen size={24} style={{ color: 'rgba(255,255,255,0.6)' }} />
          </div>
        )}
      </div>

      {/* Content: month → stars → title */}
      <div className="flex-1 min-w-0 flex flex-col gap-[4px]">
        {formatMonthShort(book.month) && (
          <p
            className="text-[11px] leading-[13px] tracking-[0.06px]"
            style={{ color: 'var(--label-secondary)' }}
          >
            {formatMonthShort(book.month)}
          </p>
        )}
        <StarRating rating={book.rating} readonly size={16} />
        <p
          className="text-[17px] font-semibold leading-[22px] tracking-[-0.43px] line-clamp-2"
          style={{ color: 'var(--label)' }}
        >
          {book.title}
        </p>
      </div>
    </motion.div>
  )
}
