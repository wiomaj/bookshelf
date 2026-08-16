import type { SupabaseClient } from '@supabase/supabase-js'
import type { Book } from '@/types/book'
import { monthSortKey } from '@/lib/month'

const COLUMNS = 'id, user_id, title, author, genre, year, month, rating, notes, cover_url, created_at, status, acquired_month, acquired_year, read_month, read_year, finished_at, is_audiobook, is_ebook, started_reading_day, started_reading_month, started_reading_year, isbn13, page_count, published_date, publisher, subjects'

/**
 * COLUMNS plus the synopsis, for queries that return a single book.
 *
 * Descriptions run to several KB and only the detail view renders one, so the
 * list queries below — which load the entire library in one request — leave the
 * column out rather than pay for it on every home-screen load.
 */
const DETAIL_COLUMNS = `${COLUMNS}, description`

/**
 * Newest-first ordering for read books: year, then month (season codes sort by
 * their midpoint), then the moment the book was actually finished. finished_at
 * falls back to created_at for rows that predate the column.
 */
export function compareByFinishDate(a: Book, b: Book): number {
  if (b.year !== a.year) return b.year - a.year
  const diff = monthSortKey(b.month) - monthSortKey(a.month)
  if (diff !== 0) return diff
  return new Date(b.finished_at ?? b.created_at).getTime() - new Date(a.finished_at ?? a.created_at).getTime()
}

/**
 * Fetch every book for a user in a single query, then split by status client-side.
 * Use this on the home page instead of three separate getReadBooks / getToReadBooks /
 * getWishlistBooks calls to cut DB round-trips from 3 → 1.
 */
export async function getAllBooks(supabase: SupabaseClient, userId: string): Promise<{
  read: Book[]
  toRead: Book[]
  wishlist: Book[]
}> {
  const { data, error } = await supabase
    .from('books')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const all = data as Book[]

  const sorted = all.slice().sort(compareByFinishDate)

  return {
    read:     sorted.filter(b => b.status === 'read' || b.status === 'abandoned'),
    toRead:   all.filter(b => b.status === 'to_read' || b.status === 'currently_reading'),
    wishlist: all.filter(b => b.status === 'wishlist'),
  }
}

/** All books for a user, sorted newest year → oldest, then newest month. */
export async function getBooks(supabase: SupabaseClient, userId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  // Sort in JS so season codes (13–16) sort by their midpoint month rather than
  // their raw numeric value, which would incorrectly place them above real months.
  return (data as Book[]).sort(compareByFinishDate)
}

/** Books the user has finished reading (status = 'read'). */
export async function getReadBooks(supabase: SupabaseClient, userId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select(COLUMNS)
    .eq('user_id', userId)
    .in('status', ['read', 'abandoned'])
    .order('year', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data as Book[]).sort(compareByFinishDate)
}

/** Books the user wants to read (status = 'to_read'), newest first. */
export async function getToReadBooks(supabase: SupabaseClient, userId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select(COLUMNS)
    .eq('user_id', userId)
    .in('status', ['to_read', 'currently_reading'])
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as Book[]
}

/** Books on the user's wishlist (status = 'wishlist'), newest first. */
export async function getWishlistBooks(supabase: SupabaseClient, userId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'wishlist')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as Book[]
}

/** Single book by id. Returns null if not found. */
export async function getBook(supabase: SupabaseClient, userId: string, id: string): Promise<Book | null> {
  const { data, error } = await supabase
    .from('books')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error?.code === 'PGRST116') return null // not found
  if (error) throw new Error(error.message)
  return data as Book
}

/** Add a new book. */
export async function addBook(
  supabase: SupabaseClient,
  userId: string,
  book: Omit<Book, 'id' | 'user_id' | 'created_at'>
): Promise<Book> {
  // Books created directly in the read shelf are finished right now.
  const finishedAt = (book.status ?? 'read') === 'read' && !book.finished_at
    ? { finished_at: new Date().toISOString() }
    : {}
  const { data, error } = await supabase
    .from('books')
    .insert({ ...book, ...finishedAt, user_id: userId })
    .select(DETAIL_COLUMNS)
    .single()

  if (error) throw new Error(error.message)
  return data as Book
}

/** Update fields on an existing book. */
export async function updateBook(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  updates: Partial<Omit<Book, 'id' | 'user_id' | 'created_at'>>
): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select(DETAIL_COLUMNS)
    .single()

  if (error) throw new Error(error.message)
  return data as Book
}

/** Delete a book by id. */
export async function deleteBook(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('books')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}
