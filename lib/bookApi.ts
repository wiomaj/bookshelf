// Books are stored in localStorage — no server, no auth, works immediately.
// All functions return Promises so the rest of the app code stays unchanged.

import type { Book } from '@/types/book'

const STORAGE_KEY = 'bookshelf_books'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadBooks(): Book[] {
  if (typeof window === 'undefined') return [] // SSR guard
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Book[]) : []
  } catch {
    return []
  }
}

function saveBooks(books: Book[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books))
}

// ─── Public API (same signatures as before) ───────────────────────────────────

/** All books, sorted newest year → oldest, then newest month. */
export async function getBooks(): Promise<Book[]> {
  const books = loadBooks()
  return books.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year
    if (b.month !== a.month) return b.month - a.month
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

/** Single book by id. Returns null if not found. */
export async function getBook(id: string): Promise<Book | null> {
  return loadBooks().find((b) => b.id === id) ?? null
}

/** Add a new book. Uses crypto.randomUUID() for a stable unique id. */
export async function addBook(
  book: Omit<Book, 'id' | 'user_id' | 'created_at'>
): Promise<Book> {
  const books = loadBooks()
  const newBook: Book = {
    ...book,
    id: crypto.randomUUID(),
    user_id: 'local', // no auth — kept so the Book type stays unchanged
    created_at: new Date().toISOString(),
  }
  saveBooks([...books, newBook])
  return newBook
}

/** Update fields on an existing book. */
export async function updateBook(
  id: string,
  updates: Partial<Omit<Book, 'id' | 'user_id' | 'created_at'>>
): Promise<Book> {
  const books = loadBooks()
  const idx = books.findIndex((b) => b.id === id)
  if (idx === -1) throw new Error('Book not found')
  books[idx] = { ...books[idx], ...updates }
  saveBooks(books)
  return books[idx]
}

/** Delete a book by id. */
export async function deleteBook(id: string): Promise<void> {
  saveBooks(loadBooks().filter((b) => b.id !== id))
}
