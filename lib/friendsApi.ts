import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppNotification, FriendBook, FriendProfile } from '@/types/book'
import { monthSortKey } from '@/lib/month'

/** Same ordering as bookApi's compareByFinishDate, adapted for FriendBook (no `notes`). */
function compareFriendBooksByFinishDate(a: FriendBook, b: FriendBook): number {
  if (b.year !== a.year) return b.year - a.year
  const diff = monthSortKey(b.month) - monthSortKey(a.month)
  if (diff !== 0) return diff
  return new Date(b.finished_at ?? b.created_at).getTime() - new Date(a.finished_at ?? a.created_at).getTime()
}

// Same as bookApi's COLUMNS, minus `notes` — friends never see private comments.
const FRIEND_BOOK_COLUMNS =
  'id, user_id, title, author, genre, year, month, rating, cover_url, created_at, status, acquired_month, acquired_year, read_month, read_year, finished_at, is_audiobook, is_ebook, started_reading_day, started_reading_month, started_reading_year'

/** Friends the current user has added, newest first. */
export async function getFriends(supabase: SupabaseClient, userId: string): Promise<FriendProfile[]> {
  const { data: rows, error } = await supabase
    .from('friendships')
    .select('friend_id, created_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  const ids = (rows ?? []).map((r) => r.friend_id as string)
  if (ids.length === 0) return []

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .in('id', ids)

  if (profileError) throw new Error(profileError.message)

  const byId = new Map((profiles as FriendProfile[]).map((p) => [p.id, p]))
  return ids.map((id) => byId.get(id)).filter((p): p is FriendProfile => !!p)
}

/** A single friend's profile — only resolvable once a friendship exists (RLS). */
export async function getFriendProfile(supabase: SupabaseClient, friendId: string): Promise<FriendProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .eq('id', friendId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as FriendProfile | null
}

/** A friend's books, split by status. `notes` is never fetched. */
export async function getFriendBooks(supabase: SupabaseClient, friendId: string): Promise<{
  read: FriendBook[]
  toRead: FriendBook[]
  wishlist: FriendBook[]
}> {
  const { data, error } = await supabase
    .from('books')
    .select(FRIEND_BOOK_COLUMNS)
    .eq('user_id', friendId)
    .order('year', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const all = data as FriendBook[]
  const sorted = all.slice().sort(compareFriendBooksByFinishDate)

  return {
    read: sorted.filter((b) => b.status === 'read' || b.status === 'abandoned'),
    toRead: all.filter((b) => b.status === 'to_read' || b.status === 'currently_reading'),
    wishlist: all.filter((b) => b.status === 'wishlist'),
  }
}

/** A single friend book by id (used for the read-only detail view). */
export async function getFriendBook(supabase: SupabaseClient, friendId: string, bookId: string): Promise<FriendBook | null> {
  const { data, error } = await supabase
    .from('books')
    .select(FRIEND_BOOK_COLUMNS)
    .eq('user_id', friendId)
    .eq('id', bookId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as FriendBook | null
}

/** Add a friend by email via the privileged server route. */
export async function addFriendByEmail(supabase: SupabaseClient, email: string): Promise<{ error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { error: 'Not authenticated.' }

  const res = await fetch('/api/friends/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { error: json.error ?? 'Failed to add friend.' }
  return { error: null }
}

/** Unread notifications for the current user, newest first. */
export async function getUnreadNotifications(supabase: SupabaseClient, userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, type, payload, read_at, created_at')
    .eq('user_id', userId)
    .is('read_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as AppNotification[]
}

export async function markNotificationRead(supabase: SupabaseClient, notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)

  if (error) throw new Error(error.message)
}

/** Deterministic accent color for a generated avatar, derived from the user id. */
export function avatarColor(seed: string): string {
  const palette = ['#FF6B6B', '#F59E0B', '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316']
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}

export function initialFor(name: string | null | undefined, email: string): string {
  const source = (name && name.trim()) || email
  return source.trim().charAt(0).toUpperCase() || '?'
}
