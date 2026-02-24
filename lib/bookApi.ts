import type { SupabaseClient } from '@supabase/supabase-js'
import type { Book } from '@/types/book'
import { monthSortKey } from '@/lib/month'

const COLUMNS = 'id, user_id, title, author, genre, year, month, rating, notes, cover_url, created_at, status'

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
  return (data as Book[]).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year
    const diff = monthSortKey(b.month) - monthSortKey(a.month)
    if (diff !== 0) return diff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

/** Books the user has finished reading (status = 'read'). */
export async function getReadBooks(supabase: SupabaseClient, userId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'read')
    .order('year', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data as Book[]).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year
    const diff = monthSortKey(b.month) - monthSortKey(a.month)
    if (diff !== 0) return diff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

/** Books the user wants to read (status = 'to_read'), newest first. */
export async function getToReadBooks(supabase: SupabaseClient, userId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'to_read')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as Book[]
}

/** Single book by id. Returns null if not found. */
export async function getBook(supabase: SupabaseClient, userId: string, id: string): Promise<Book | null> {
  const { data, error } = await supabase
    .from('books')
    .select(COLUMNS)
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
  const { data, error } = await supabase
    .from('books')
    .insert({ ...book, user_id: userId })
    .select(COLUMNS)
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
    .select(COLUMNS)
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
