import type { SupabaseClient } from '@supabase/supabase-js'
import type { Book } from '@/types/book'

const COLUMNS = 'id, user_id, title, author, genre, year, month, rating, notes, cover_url, created_at'

/** All books for a user, sorted newest year → oldest, then newest month. */
export async function getBooks(supabase: SupabaseClient, userId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .order('month', { ascending: false, nullsFirst: false })
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
