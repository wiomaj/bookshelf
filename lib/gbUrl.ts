/**
 * Google Books API URL builder.
 * Appends the API key when NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY is set.
 * Works in both server-side (API routes) and client-side code.
 */
export function gbUrl(params: Record<string, string>): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY
  const p = new URLSearchParams(params)
  if (key) p.set('key', key)
  return `https://www.googleapis.com/books/v1/volumes?${p}`
}
