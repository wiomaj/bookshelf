'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import StarRating from './StarRating'
import BookCover from './BookCover'
import { formatMonthShort } from '@/lib/month'
import { fetchCoverByTitleAuthor } from '@/lib/bookMetadata'
import { updateBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import { useApp, useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'

export default function BookCard({ book, href, hideRating }: { book: Book; href?: string; hideRating?: boolean }) {
  const router = useRouter()
  const { user } = useApp()
  const t = useT()
  const [coverFailed, setCoverFailed] = useState(false)
  const retryRef = useRef(false)

  function handleCoverError() {
    setCoverFailed(true)
    if (retryRef.current || !user || !book.title) return
    retryRef.current = true
    // Self-heal: look up a fresh cover and persist it for the next load.
    fetchCoverByTitleAuthor(book.title, book.author ?? '').then((newCover) => {
      if (!newCover || newCover === book.cover_url) return
      updateBook(supabase, user.id, book.id, { cover_url: newCover }).catch(() => {})
    }).catch(() => {})
  }

  const showCover = book.cover_url && !coverFailed

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
          <BookCover
            src={book.cover_url}
            alt={book.title}
            iconSize={0}
            patternSize={32}
            patternOpacity={0.16}
            onFail={handleCoverError}
          />
        </div>

        {/* Audiobook badge */}
        {book.is_audiobook && (
          <div className="absolute top-2 left-2 z-20 w-[26px] h-[26px] rounded-full backdrop-blur-sm flex items-center justify-center" style={{ backgroundColor: 'rgba(60, 60, 67, 0.60)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
            </svg>
          </div>
        )}

        {/* Ebook badge */}
        {book.is_ebook && (
          <div className="absolute top-2 z-20 w-[26px] h-[26px] rounded-full backdrop-blur-sm flex items-center justify-center" style={{ backgroundColor: 'rgba(60, 60, 67, 0.60)', left: book.is_audiobook ? '40px' : '8px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
              <line x1="12" x2="12.01" y1="18" y2="18" />
            </svg>
          </div>
        )}

        {/* Abandoned badge */}
        {book.status === 'abandoned' && (
          <div className="absolute top-[11px] z-20 rounded-full px-2 py-1 backdrop-blur-sm flex items-center justify-center" style={{ backgroundColor: 'rgba(60, 60, 67, 0.60)', left: book.is_ebook && book.is_audiobook ? '72px' : (book.is_audiobook || book.is_ebook) ? '40px' : '8px' }}>
            <span className="text-white text-[11px] leading-[13px] tracking-[0.06px]">{t.chipAbandoned}</span>
          </div>
        )}

        {/* Gradient overlay — dark for photo covers, primary-to-transparent for pattern */}
        {showCover ? (
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
          {!showCover && (
            <p className="text-white text-[17px] font-semibold leading-[22px] tracking-[-0.43px] line-clamp-2">
              {book.title}
            </p>
          )}

          {book.author && (
            <p className="font-semibold text-[11px] leading-[13px] tracking-[0.06px] line-clamp-1" style={{ color: 'rgba(255,255,255,0.80)' }}>
              {book.author}
            </p>
          )}

          {!hideRating && book.rating >= 1 && <StarRating rating={book.rating} readonly size={16} darkBg />}
        </div>
      </div>
    </motion.div>
  )
}
