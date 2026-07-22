'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useT } from '@/contexts/AppContext'
import { getFriendBook } from '@/lib/friendsApi'
import { heroCoverUrl } from '@/lib/coverUrl'
import { formatMonthLong } from '@/lib/month'
import StarRating from '@/components/StarRating'
import type { FriendBook } from '@/types/book'

// Read-only view of a friend's book: cover, title, author, star rating only —
// the private `notes` field is never fetched for friend-facing queries.
export default function FriendBookDetailPage() {
  const params = useParams()
  const router = useRouter()
  const friendId = params.id as string
  const bookId = params.bookId as string
  const t = useT()

  const [book, setBook] = useState<FriendBook | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    getFriendBook(supabase, friendId, bookId)
      .then((b) => { if (!cancelled) { if (b) setBook(b); else setNotFound(true) } })
      .catch(() => { if (!cancelled) setNotFound(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [friendId, bookId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--label-secondary)' }} />
      </div>
    )
  }

  if (notFound || !book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ backgroundColor: 'var(--bg)' }}>
        <p style={{ color: 'var(--label-secondary)' }}>Not found.</p>
        <button onClick={() => router.push(`/friends/${friendId}`)} className="text-[14px]" style={{ color: 'var(--primary)' }}>
          {t.tabFriends}
        </button>
      </div>
    )
  }

  const monthLabel = formatMonthLong(book.month)

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-[600px] mx-auto px-5 pt-8">
        <button onClick={() => router.back()} className="mb-4" style={{ color: 'var(--label-secondary)' }}>
          <ChevronLeft size={20} />
        </button>

        <div className="flex flex-col items-center gap-4">
          <div className="w-[160px] h-[240px] rounded-[8px] overflow-hidden shadow-[0_16px_32px_-4px_rgba(12,12,13,0.15)]">
            {book.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroCoverUrl(book.cover_url)} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ backgroundColor: 'var(--fill)' }} />
            )}
          </div>

          <div className="text-center">
            <h1 className="text-[20px] font-bold" style={{ color: 'var(--label)' }}>{book.title}</h1>
            <p className="text-[15px] mt-1" style={{ color: 'var(--label-secondary)' }}>{book.author}</p>
          </div>

          {book.rating > 0 && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[12px] uppercase tracking-wide" style={{ color: 'var(--label-tertiary)' }}>
                {t.friendRatingLabel}
              </span>
              <StarRating rating={book.rating} readonly size={22} />
            </div>
          )}

          <div className="flex gap-2 flex-wrap justify-center">
            {book.genre && (
              <span className="rounded-full px-3 py-1 text-[12px]" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--label-secondary)' }}>
                {book.genre}
              </span>
            )}
            {monthLabel && (
              <span className="rounded-full px-3 py-1 text-[12px]" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--label-secondary)' }}>
                {monthLabel} {book.year}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
