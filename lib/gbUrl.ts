/**
 * Google Books API URL builder.
 *
 * Prefers the secret server-side GOOGLE_BOOKS_API_KEY (available only in API
 * routes) and falls back to NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY for legacy
 * setups. All Google Books calls should go through server routes so the key
 * is never shipped to the browser.
 */
export function gbUrl(params: Record<string, string>): string {
  const key = process.env.GOOGLE_BOOKS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY
  const p = new URLSearchParams(params)
  if (key) p.set('key', key)
  return `https://www.googleapis.com/books/v1/volumes?${p}`
}
