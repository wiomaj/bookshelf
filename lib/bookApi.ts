import { createClient } from '@/utils/supabase/client'
import { BookInputSchema } from '@/lib/bookSchema'
import type { Book } from '@/types/book'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Columns we actually need — avoids leaking unexpected future columns. */
const BOOK_COLUMNS = 'id, user_id, title, author, genre, year, month, rating, notes, cover_url, created_at'

/** Never surface raw Supabase / Postgres error strings to the client. */
function dbError(context: string): Error {
  return new Error(`${context} failed. Please try again.`)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** All books for the current user, sorted newest year → oldest, then newest month. */
export async function getBooks(): Promise<Book[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('books')
    .select(BOOK_COLUMNS)
    .order('year', { ascending: false })
    .order('month', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw dbError('Fetching books')
  return (data ?? []) as Book[]
}

/** Single book by id. Returns null if not found. */
export async function getBook(id: string): Promise<Book | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('books')
    .select(BOOK_COLUMNS)
    .eq('id', id)
    .single()

  if (error) return null
  return data as Book
}

/** Add a new book for the current user. */
export async function addBook(
  book: Omit<Book, 'id' | 'user_id' | 'created_at'>
): Promise<Book> {
  // Validate + strip unknown fields before touching the DB
  const validated = BookInputSchema.parse(book)

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('books')
    .insert({ ...validated, user_id: user.id })
    .select(BOOK_COLUMNS)
    .single()

  if (error) throw dbError('Saving book')
  return data as Book
}

/** Update fields on an existing book. */
export async function updateBook(
  id: string,
  updates: Partial<Omit<Book, 'id' | 'user_id' | 'created_at'>>
): Promise<Book> {
  // Validate only the supplied fields (partial parse)
  const validated = BookInputSchema.partial().parse(updates)

  const supabase = createClient()
  const { data, error } = await supabase
    .from('books')
    .update(validated)
    .eq('id', id)
    .select(BOOK_COLUMNS)
    .single()

  if (error) throw dbError('Updating book')
  return data as Book
}

/** Delete a book by id. */
export async function deleteBook(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('books')
    .delete()
    .eq('id', id)

  if (error) throw dbError('Deleting book')
}
