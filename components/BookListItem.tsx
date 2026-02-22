'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import StarRating from './StarRating'
import { formatMonthShort } from '@/lib/month'
import type { Book } from '@/types/book'

export default function BookListItem({ book }: { book: Book }) {
  const router = useRouter()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => router.push(`/book/${book.id}`)}
      className="flex gap-4 items-center cursor-pointer"
    >
      {/* Cover */}
      <div className="w-[80px] h-[100px] rounded-[12px] overflow-hidden shrink-0">
        {book.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
            <BookOpen className="text-gray-400" size={24} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Month tag + stars */}
        <div className="flex items-center gap-2">
          {formatMonthShort(book.month) && (
            <span className="text-[12px] font-extrabold uppercase leading-4 text-[#7c7c7c]
                             bg-[#ededed] rounded-[8px] px-2 py-1 shrink-0">
              {formatMonthShort(book.month)}
            </span>
          )}
          <StarRating rating={book.rating} readonly size={16} />
        </div>

        {/* Title */}
        <p className="text-[16px] font-bold text-[#171717] leading-6 line-clamp-2">
          {book.title}
        </p>
      </div>
    </motion.div>
  )
}
