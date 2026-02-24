'use client'

import { motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Book } from '@/types/book'

interface ToReadListProps {
  books: Book[]
}

export default function ToReadList({ books }: ToReadListProps) {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-3 px-4 pb-8">
      {books.map((book, i) => (
        <motion.button
          key={book.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          onClick={() => router.push(`/to-read/${book.id}`)}
          className="w-full flex items-center gap-4 p-3 rounded-[16px]
                     bg-[rgba(23,23,23,0.04)] text-left"
        >
          {/* Cover thumbnail */}
          <div className="w-12 h-[68px] rounded-[8px] overflow-hidden flex-shrink-0 bg-gray-200">
            {book.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen size={20} className="text-gray-400" />
              </div>
            )}
          </div>

          {/* Title + Author */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[16px] text-[#171717] leading-5 truncate">{book.title}</p>
            {book.author && (
              <p className="text-[14px] text-[rgba(23,23,23,0.55)] leading-5 mt-0.5 truncate">{book.author}</p>
            )}
          </div>

          {/* Chevron */}
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="flex-shrink-0 text-[rgba(23,23,23,0.3)]">
            <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </motion.button>
      ))}
    </div>
  )
}
