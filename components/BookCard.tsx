'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import StarRating from './StarRating'
import { formatMonthShort } from '@/lib/month'
import type { Book } from '@/types/book'

export default function BookCard({ book }: { book: Book }) {
  const router = useRouter()

  function handleClick() {
    router.push(`/book/${book.id}`)
  }

  return (
    // Outer wrapper: resting shadow, glass ring on hover — no overflow-hidden so effects render cleanly
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, boxShadow: '0 0 0 1.5px rgba(255,255,255,0.65), 0 0 36px rgba(255,255,255,0.10)' }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2 }}
      onClick={handleClick}
      className="cursor-pointer rounded-[12px] h-[230px] group
                 shadow-[0_4px_16px_rgba(23,23,23,0.10)]"
    >
      {/* Inner wrapper clips the cover image to the card's border-radius */}
      <div className="relative w-full h-full rounded-[12px] overflow-hidden
                      bg-white flex items-end pt-2 pb-4 px-2">

        {/* Full-bleed cover image */}
        <div className="absolute inset-0">
          {book.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover_url}
              alt={book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
              <BookOpen className="text-gray-400" size={40} />
            </div>
          )}
        </div>

        {/* Gradient: transparent top → dark bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />

        {/* Glass surface overlay — fades in on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200
                        bg-white/[0.07] pointer-events-none" />

        {/* Content pinned to bottom */}
        <div className="relative z-10 flex flex-col gap-1 w-full">
          {/* Month / season pill tag — hidden when month is unknown */}
          {formatMonthShort(book.month) && (
            <div className="self-start rounded-[8px] px-2 py-1 flex items-center justify-center
                            bg-white/[0.18] backdrop-blur-xl
                            border border-white/[0.32]
                            shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_6px_rgba(0,0,0,0.10)]">
              <span className="text-white text-[12px] font-extrabold uppercase leading-4 tracking-wide text-center">
                {formatMonthShort(book.month)}
              </span>
            </div>
          )}

          {/* Title */}
          <p className="text-white text-[16px] font-bold leading-6 line-clamp-2">
            {book.title}
          </p>

          {/* Stars */}
          <StarRating rating={book.rating} readonly size={16} />
        </div>
      </div>
    </motion.div>
  )
}
