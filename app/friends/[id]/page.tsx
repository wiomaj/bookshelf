'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useT } from '@/contexts/AppContext'
import { getFriendProfile, getFriendBooks, avatarColor, initialFor } from '@/lib/friendsApi'
import BookCover from '@/components/BookCover'
import StarRating from '@/components/StarRating'
import type { FriendBook, FriendProfile } from '@/types/book'

type Section = 'read' | 'to_read' | 'wishlist'

export default function FriendProfilePage() {
  const params = useParams()
  const router = useRouter()
  const friendId = params.id as string
  const t = useT()

  const [profile, setProfile] = useState<FriendProfile | null>(null)
  const [books, setBooks] = useState<{ read: FriendBook[]; toRead: FriendBook[]; wishlist: FriendBook[] }>({ read: [], toRead: [], wishlist: [] })
  const [section, setSection] = useState<Section>('read')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const p = await getFriendProfile(supabase, friendId)
        if (!p) { if (!cancelled) setNotFound(true); return }
        const b = await getFriendBooks(supabase, friendId)
        if (!cancelled) { setProfile(p); setBooks(b) }
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [friendId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--label-secondary)' }} />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ backgroundColor: 'var(--bg)' }}>
        <p style={{ color: 'var(--label-secondary)' }}>Not found.</p>
        <button onClick={() => router.push('/friends')} className="text-[14px]" style={{ color: 'var(--primary)' }}>
          {t.tabFriends}
        </button>
      </div>
    )
  }

  const currentBooks = section === 'read' ? books.read : section === 'to_read' ? books.toRead : books.wishlist
  const sections: { key: Section; label: string }[] = [
    { key: 'read', label: t.friendProfileRead },
    { key: 'to_read', label: t.friendProfileToRead },
    { key: 'wishlist', label: t.friendProfileWishlist },
  ]

  const name = profile.display_name || profile.email

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-[600px] mx-auto px-5 pt-8">
        <button onClick={() => router.push('/friends')} className="mb-4 flex items-center gap-1" style={{ color: 'var(--label-secondary)' }}>
          <ChevronLeft size={20} />
        </button>

        {/* ── Header: generated avatar + name ─────────────────────────── */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div
            className="flex items-center justify-center rounded-full font-semibold"
            style={{ width: 88, height: 88, backgroundColor: avatarColor(profile.id), color: '#fff', fontSize: 36 }}
          >
            {initialFor(profile.display_name, profile.email)}
          </div>
          <h1 className="text-[20px] font-bold" style={{ color: 'var(--label)' }}>{name}</h1>
        </div>

        {/* ── Section switch: gelesen / leseliste / Wunschliste ───────── */}
        <div className="flex rounded-[14px] p-1 mb-5" style={{ backgroundColor: 'var(--fill)' }}>
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className="flex-1 py-2 rounded-[10px] text-[13px] font-medium relative"
              style={{ color: section === s.key ? 'var(--label)' : 'var(--label-secondary)' }}
            >
              {section === s.key && (
                <motion.div
                  layoutId="friend-section-pill"
                  className="absolute inset-0 rounded-[10px]"
                  style={{ backgroundColor: 'var(--bg-elevated)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative">{s.label}</span>
            </button>
          ))}
        </div>

        {/* ── Books grid ───────────────────────────────────────────────── */}
        {currentBooks.length === 0 ? (
          <p className="text-center py-16 text-[14px]" style={{ color: 'var(--label-secondary)' }}>
            {t.friendProfileEmptySection}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {currentBooks.map((book) => (
              <button
                key={book.id}
                onClick={() => router.push(`/friends/${friendId}/book/${book.id}`)}
                className="rounded-[8px] h-[200px] overflow-hidden relative text-left"
              >
                <BookCover src={book.cover_url} alt={book.title} iconSize={0} patternSize={28} patternOpacity={0.16} />
                {book.rating > 0 && (
                  <div className="absolute bottom-2 left-2 right-2 flex justify-center">
                    <div className="rounded-full px-2 py-1 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
                      <StarRating rating={book.rating} readonly size={12} darkBg />
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
