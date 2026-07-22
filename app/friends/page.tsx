'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpenCheck, User, Settings, Users, Plus, X, Loader2, ChevronRight, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useApp, useT } from '@/contexts/AppContext'
import {
  getFriends, addFriendByEmail, getUnreadNotifications, markNotificationRead,
  avatarColor, initialFor,
} from '@/lib/friendsApi'
import type { AppNotification, FriendProfile } from '@/types/book'

function Avatar({ seed, name, email, size = 44 }: { seed: string; name: string | null; email: string; size?: number }) {
  const color = avatarColor(seed)
  const initial = initialFor(name, email)
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold shrink-0"
      style={{ width: size, height: size, backgroundColor: color, color: '#fff', fontSize: size * 0.42 }}
    >
      {initial}
    </div>
  )
}

// ── Bottom nav (Friends active) ───────────────────────────────────────────────
function BottomNav({ t, displayName }: { t: ReturnType<typeof useT>; displayName: string }) {
  const router = useRouter()
  return (
    <nav className="fixed bottom-5 left-4 right-4 z-50 max-w-[568px] mx-auto">
      <div className="glass flex items-center rounded-[28px] px-2 py-2"
           style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}>
        <button
          onClick={() => router.push('/')}
          className="flex-1 flex flex-col items-center gap-[3px] py-2 rounded-[22px]"
          style={{ color: 'var(--label-secondary)' }}
        >
          <BookOpenCheck size={22} strokeWidth={1.5} />
          <span className="text-[10px] font-medium tracking-[-0.1px]">{t.tabBooks}</span>
        </button>

        <button
          onClick={() => { sessionStorage.setItem('bookshelf_returnMainTab', 'dashboard'); router.push('/') }}
          className="flex-1 flex flex-col items-center gap-[3px] py-2 rounded-[22px]"
          style={{ color: 'var(--label-secondary)' }}
        >
          <User size={22} strokeWidth={1.5} />
          <span className="text-[10px] font-medium tracking-[-0.1px] max-w-[64px] truncate">{displayName || t.tabDashboard}</span>
        </button>

        <button className="flex-1 flex flex-col items-center gap-[3px] py-2 rounded-[22px] relative">
          <div className="absolute inset-0 rounded-[22px]" style={{ backgroundColor: 'var(--primary-muted)' }} />
          <Users size={22} strokeWidth={2} className="relative" style={{ color: 'var(--primary)' }} />
          <span className="text-[10px] font-medium tracking-[-0.1px] relative" style={{ color: 'var(--primary)' }}>
            {t.tabFriends}
          </span>
        </button>

        <Link
          href="/settings"
          className="flex-1 flex flex-col items-center gap-[3px] py-2 rounded-[22px]"
          style={{ color: 'var(--label-secondary)' }}
        >
          <Settings size={22} strokeWidth={1.5} />
          <span className="text-[10px] font-medium tracking-[-0.1px]">{t.settings}</span>
        </Link>
      </div>
    </nav>
  )
}

export default function FriendsPage() {
  const router = useRouter()
  const { user, displayName } = useApp()
  const t = useT()

  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [email, setEmail] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState(false)

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      const [friendList, unread] = await Promise.all([
        getFriends(supabase, user.id),
        getUnreadNotifications(supabase, user.id),
      ])
      setFriends(friendList)
      setNotifications(unread)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function dismissNotification(n: AppNotification) {
    setNotifications((prev) => prev.filter((x) => x.id !== n.id))
    await markNotificationRead(supabase, n.id).catch(() => {})
  }

  async function handleAddFriend(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)
    setAddLoading(true)
    const { error } = await addFriendByEmail(supabase, email.trim())
    setAddLoading(false)
    if (error) {
      if (error.includes('No user found')) setAddError(t.addFriendNotFound)
      else if (error.includes('already added')) setAddError(t.addFriendAlreadyAdded)
      else if (error.includes('cannot add yourself')) setAddError(t.addFriendCannotSelf)
      else setAddError(t.addFriendGenericError)
      return
    }
    setAddSuccess(true)
    setEmail('')
    await load()
    setTimeout(() => { setShowAdd(false); setAddSuccess(false) }, 900)
  }

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-[600px] mx-auto px-5 pt-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[28px] font-bold tracking-[-0.5px]" style={{ color: 'var(--label)' }}>
            {t.friendsTitle}
          </h1>
          <button
            onClick={() => setShowAdd(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--primary)' }}
            aria-label={t.addFriend}
          >
            <Plus size={20} color="#fff" strokeWidth={2.2} />
          </button>
        </div>

        {/* ── One-time "X added you" notifications ────────────────────── */}
        <AnimatePresence initial={false}>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden"
            >
              <div className="glass rounded-[16px] px-4 py-3 flex items-center gap-3">
                <UserPlus size={18} style={{ color: 'var(--primary)' }} className="shrink-0" />
                <p className="text-[14px] flex-1" style={{ color: 'var(--label)' }}>
                  <strong>{n.payload?.addedByName ?? '—'}</strong> {t.friendAddedNotification}
                </p>
                <button onClick={() => dismissNotification(n)} aria-label="Dismiss">
                  <X size={16} style={{ color: 'var(--label-secondary)' }} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* ── Friend list ──────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--label-secondary)' }} />
          </div>
        ) : friends.length === 0 ? (
          <div className="flex flex-col items-center text-center py-20 gap-2">
            <Users size={40} style={{ color: 'var(--label-tertiary)' }} />
            <h2 className="text-[17px] font-semibold" style={{ color: 'var(--label)' }}>{t.friendsEmptyTitle}</h2>
            <p className="text-[14px] max-w-[280px]" style={{ color: 'var(--label-secondary)' }}>{t.friendsEmptyCopy}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {friends.map((f) => (
              <button
                key={f.id}
                onClick={() => router.push(`/friends/${f.id}`)}
                className="flex items-center gap-3 rounded-[16px] px-4 py-3 text-left"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
              >
                <Avatar seed={f.id} name={f.display_name} email={f.email} />
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium truncate" style={{ color: 'var(--label)' }}>
                    {f.display_name || f.email}
                  </div>
                  <div className="text-[12px] truncate" style={{ color: 'var(--label-secondary)' }}>{f.email}</div>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--label-tertiary)' }} />
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomNav t={t} displayName={displayName} />

      {/* ── Add friend sheet ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAdd(false)}
              className="fixed inset-0 z-40"
              style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            />
            <motion.div
              initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-w-[600px] mx-auto rounded-t-[24px] px-6 pt-6 pb-10"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[18px] font-semibold" style={{ color: 'var(--label)' }}>{t.addFriend}</h2>
                <button onClick={() => setShowAdd(false)} aria-label="Close">
                  <X size={20} style={{ color: 'var(--label-secondary)' }} />
                </button>
              </div>

              {addSuccess ? (
                <p className="text-[15px] font-medium py-6 text-center" style={{ color: 'var(--primary)' }}>{t.addFriendSuccess}</p>
              ) : (
                <form onSubmit={handleAddFriend} className="flex flex-col gap-3">
                  <label className="text-[13px] font-medium" style={{ color: 'var(--label-secondary)' }}>
                    {t.addFriendEmailLabel}
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.addFriendEmailPlaceholder}
                    className="rounded-[12px] px-4 py-3 text-[15px] outline-none"
                    style={{ backgroundColor: 'var(--bg)', color: 'var(--label)' }}
                  />
                  {addError && <p className="text-[13px]" style={{ color: '#FF3B30' }}>{addError}</p>}
                  <button
                    type="submit"
                    disabled={addLoading || !email.trim()}
                    className="mt-2 rounded-[12px] py-3 text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                  >
                    {addLoading && <Loader2 size={16} className="animate-spin" />}
                    {t.addFriendSubmit}
                  </button>
                </form>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
