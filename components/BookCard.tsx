'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import StarRating from './StarRating'
import { formatMonthShort } from '@/lib/month'
import { coverUrl } from '@/lib/coverUrl'
import { fetchCoverByTitleAuthor } from '@/lib/bookMetadata'
import { updateBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import { useApp, useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'

// Lucide Book icon (closed book) as a tiled SVG background pattern.
// viewBox='-4 -4 32 32' adds ~4 px padding around the 24×24 icon so tiles
// don't run edge-to-edge when rendered at backgroundSize '32px 32px'.
const bookPatternUrl =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='-4 -4 32 32' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20'/%3E%3C/svg%3E")`

export default function BookCard({ book, href }: { book: Book; href?: string }) {
  const router = useRouter()
  const { user } = useApp()
  const t = useT()
  const [coverFailed, setCoverFailed] = useState(false)
  const retryRef = useRef(false)

  function handleCoverError() {
    setCoverFailed(true)
    if (retryRef.current || !user || !book.title) return
    retryRef.current = true
    fetchCoverByTitleAuthor(book.title, book.author ?? '').then((newCover) => {
      if (!newCover || newCover === book.cover_url) return
      updateBook(supabase, user.id, book.id, { cover_url: newCover }).catch(() => {})
    }).catch(() => {})
  }

  // Open Library sometimes returns a tiny 1x1 placeholder instead of 404
  function handleCoverLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    if (img.naturalWidth <= 1 || img.naturalHeight <= 1) handleCoverError()
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
          {showCover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl(book.cover_url)}
              alt={book.title}
              className="w-full h-full object-cover"
              onError={handleCoverError}
              onLoad={handleCoverLoad}
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

        {/* Audiobook badge */}
        {book.is_audiobook && (
          <div className="absolute top-2 left-2 z-20 w-[26px] h-[26px] rounded-full backdrop-blur-sm flex items-center justify-center" style={{ backgroundColor: 'rgba(60, 60, 67, 0.60)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
            </svg>
          </div>
        )}

        {/* Abandoned badge */}
        {book.status === 'abandoned' && (
          <div className="absolute top-2 right-2 z-20 flex items-center gap-1 rounded-full px-2 py-[3px] backdrop-blur-sm" style={{ backgroundColor: 'rgba(60, 60, 67, 0.60)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
              <path d="m14.5 7-5 5" />
              <path d="m9.5 7 5 5" />
            </svg>
            <span className="text-white text-[11px] font-semibold leading-[13px]">{t.chipAbandoned}</span>
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

          {book.rating >= 1 && <StarRating rating={book.rating} readonly size={16} darkBg />}
        </div>
      </div>
    </motion.div>
  )
}
