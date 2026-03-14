'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import StarRating from './StarRating'
import { formatMonthShort } from '@/lib/month'
import { coverUrl } from '@/lib/coverUrl'
import type { Book } from '@/types/book'

// Lucide Book icon (closed book) as a tiled SVG background pattern.
// viewBox='-4 -4 32 32' adds ~4 px padding around the 24×24 icon so tiles
// don't run edge-to-edge when rendered at backgroundSize '32px 32px'.
const bookPatternUrl =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='-4 -4 32 32' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20'/%3E%3C/svg%3E")`

export default function BookCard({ book, href }: { book: Book; href?: string }) {
  const router = useRouter()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2 }}
      onClick={() => router.push(href ?? `/book/${book.id}`)}
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
            <div className="relative w-full h-full" style={{ backgroundColor: 'var(--primary)' }}>
              {/* Tiled book icon pattern at 16 % opacity */}
              <div
                className="absolute inset-0 opacity-[0.16]"
                style={{
                  backgroundImage: bookPatternUrl,
                  backgroundSize: '32px 32px',
                  backgroundRepeat: 'repeat',
                }}
              />
            </div>
          )}
        </div>

        {/* Gradient overlay — dark for photo covers, primary-to-transparent for pattern */}
        {book.cover_url ? (
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/70" />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--primary), transparent), var(--primary))' }}
          />
        )}

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

          {book.author && (
            <p className="font-semibold text-[11px] leading-[13px] tracking-[0.06px] line-clamp-1" style={{ color: 'rgba(255,255,255,0.80)' }}>
              {book.author}
            </p>
          )}

          {book.rating >= 1 && <StarRating rating={book.rating} readonly size={16} darkBg />}
        </div>
      </div>
    </motion.div>
  )
}
