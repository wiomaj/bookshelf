'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Book as BookIcon } from 'lucide-react'
import StarRating from './StarRating'
import { formatMonthShort } from '@/lib/month'
import { coverUrl } from '@/lib/coverUrl'
import type { Book } from '@/types/book'

// Same Book-icon SVG used for the tile pattern; at backgroundSize '22px 22px'
// the 32-wide viewBox scales the icon down to ~16 px with ~3 px margin each side.
const bookPatternUrl =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='-4 -4 32 32' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20'/%3E%3C/svg%3E")`

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
            className="relative w-full h-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {/* Tiled book icon pattern at 8 % opacity */}
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage: bookPatternUrl,
                backgroundSize: '22px 22px',
                backgroundRepeat: 'repeat',
              }}
            />
            {/* Single centered full-opacity book icon */}
            <BookIcon size={24} color="white" className="relative z-10" />
          </div>
        )}
      </div>

      {/* Content: month → title → author → stars */}
      <div className="flex-1 min-w-0 flex flex-col gap-[4px]">
        {formatMonthShort(book.month) && (
          <p
            className="text-[11px] leading-[13px] tracking-[0.06px]"
            style={{ color: 'var(--label-secondary)' }}
          >
            {formatMonthShort(book.month)}
          </p>
        )}
        <p
          className="text-[17px] font-semibold leading-[22px] tracking-[-0.43px] line-clamp-2"
          style={{ color: 'var(--label)' }}
        >
          {book.title}
        </p>
        {book.author && (
          <p className="font-medium text-[12px] leading-[16px]" style={{ color: 'var(--label-secondary)' }}>
            {book.author}
          </p>
        )}
        <StarRating rating={book.rating} readonly size={16} />
      </div>
    </motion.div>
  )
}
