/**
 * lib/isbn.ts
 *
 * Shared ISBN helpers used by the book API routes
 * (app/api/books/search, app/api/books/metadata).
 */

/** Convert a 10-digit ISBN to its 13-digit (978-prefixed) form. */
export function isbn10to13(isbn10: string): string {
  const base = '978' + isbn10.slice(0, 9)
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3)
  }
  const check = (10 - (sum % 10)) % 10
  return base + check
}

/**
 * Detect whether a free-text query is an ISBN.
 * Accepts an optional "isbn:" / "isbn " prefix, hyphens and spaces.
 * Returns the bare 10- or 13-character ISBN, or null for non-ISBN queries.
 */
export function detectISBN(q: string): string | null {
  const stripped = q.replace(/^isbn[:\s]*/i, '').trim()
  const digits = stripped.replace(/[\s\-]/g, '')
  if ((digits.length === 10 || digits.length === 13) && /^\d+X?$/i.test(digits)) {
    return digits
  }
  return null
}

/**
 * Normalize any detected ISBN to 13 digits (converts ISBN-10, strips noise).
 * Assumes the input already passed detectISBN — garbage in, garbage out.
 */
export function normalizeIsbn13(isbn: string): string {
  const digits = isbn.replace(/[^\dX]/gi, '')
  if (digits.length === 10) return isbn10to13(digits)
  return digits.slice(0, 13)
}

/**
 * Strict variant: normalize raw input to a 13-digit ISBN, or null when the
 * input is not a valid-looking ISBN-10/13 at all.
 */
export function normalizeIsbn(raw: string): string | null {
  const digits = raw.replace(/[^\dX]/gi, '')
  if (digits.length === 13) return digits
  if (digits.length === 10 && /^\d{9}[\dX]$/i.test(digits)) return isbn10to13(digits)
  return null
}
