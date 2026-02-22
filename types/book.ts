// The core data shape for a book in the database.
// Every field maps 1:1 to a column in the Supabase `books` table.
export type Book = {
  id: string
  user_id: string    // Supabase auth user ID — RLS uses this to gate access
  title: string
  author: string
  genre?: string
  year: number       // Year the user read the book
  month: number | null  // 1–12 = month, 13=Spring 14=Summer 15=Fall 16=Winter, null = unknown
  rating: number     // 1–5
  notes?: string
  cover_url?: string
  created_at: string // ISO timestamp, set by Supabase automatically
}
