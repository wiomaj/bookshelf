import { createClient } from '@/utils/supabase/client'
import type { Book } from '@/types/book'

// ─── Public API ───────────────────────────────────────────────────────────────

/** All books for the current user, sorted newest year → oldest, then newest month. */
export async function getBooks(): Promise<Book[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Book[]
}

/** Single book by id. Returns null if not found. */
export async function getBook(id: string): Promise<Book | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Book
}

/** Add a new book for the current user. */
export async function addBook(
  book: Omit<Book, 'id' | 'user_id' | 'created_at'>
): Promise<Book> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('books')
    .insert({ ...book, user_id: user.id })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Book
}

/** Update fields on an existing book. */
export async function updateBook(
  id: string,
  updates: Partial<Omit<Book, 'id' | 'user_id' | 'created_at'>>
): Promise<Book> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('books')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Book
}

/** Delete a book by id. */
export async function deleteBook(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('books')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}
