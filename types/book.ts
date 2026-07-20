/**
 * Rich metadata for a book fetched from Open Library / Google Books.
 * Stored in book_metadata_cache; returned by /api/books/search and /api/books/metadata.
 */
export type BookMetadata = {
  isbn13: string | null
  title: string
  authors: string[]
  description: string | null
  pageCount: number | null
  publishedDate: string | null   // "2003-06-26" | "2003" — varies by source
  publisher: string | null
  subjects: string[]             // genres/subject tags, max 8
  coverUrl: string | null
  source: 'openlibrary' | 'googlebooks' | 'cache'
}

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
  status?: 'read' | 'to_read' | 'wishlist' | 'abandoned' | 'currently_reading'
  acquired_month?: number | null      // month when user got the book (to_read date)
  acquired_year?: number | null
  read_month?: number | null          // month when user finished reading
  read_year?: number | null
  finished_at?: string | null         // ISO timestamp when the book was marked finished — breaks sort ties within a month
  started_reading_day?: number | null     // day the user started (optional, 1–31)
  started_reading_month?: number | null  // month the user started the current read
  started_reading_year?: number | null
  is_audiobook?: boolean
  is_ebook?: boolean
}
