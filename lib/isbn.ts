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

// ─── Check-digit validation ───────────────────────────────────────────────────

/** Validate an ISBN-10 check digit (mod 11, trailing "X" = 10). */
export function isValidIsbn10(raw: string): boolean {
  const s = raw.replace(/[^\dX]/gi, '').toUpperCase()
  if (!/^\d{9}[\dX]$/.test(s)) return false
  let sum = 0
  for (let i = 0; i < 10; i++) {
    const c = s[i]
    sum += (c === 'X' ? 10 : parseInt(c, 10)) * (10 - i)
  }
  return sum % 11 === 0
}

/** Validate an ISBN-13 / Bookland EAN-13 check digit (mod 10, weights 1-3). */
export function isValidIsbn13(raw: string): boolean {
  const s = raw.replace(/\D/g, '')
  if (!/^\d{13}$/.test(s)) return false
  let sum = 0
  for (let i = 0; i < 13; i++) {
    sum += parseInt(s[i], 10) * (i % 2 === 0 ? 1 : 3)
  }
  return sum % 10 === 0
}

// ─── Barcode → ISBN ───────────────────────────────────────────────────────────

/**
 * Turn raw barcode text from the camera into a verified ISBN-13, or null.
 *
 * Handles the shapes a real book barcode actually arrives in:
 *  - Bookland EAN-13 (978/979 prefix) — the barcode printed on every modern book
 *  - EAN-13 + a 2- or 5-digit add-on (the price/issue extension printed to the
 *    right of the main barcode; ZXing concatenates it, giving 15 or 18 chars)
 *  - A bare ISBN-10, which some older books carry as a plain number
 *
 * The check digit is verified before anything is returned, so a partial or
 * mirrored read can never trigger a lookup for the wrong book. Non-book retail
 * barcodes (UPC-A, EAN-8, other EAN-13 prefixes) return null.
 */
export function isbnFromScan(raw: string): string | null {
  const s = raw.replace(/[^\dX]/gi, '').toUpperCase()

  // EAN-13 with a 2- or 5-digit add-on: the ISBN is the leading 13 characters.
  const core =
    (s.length === 15 || s.length === 18) && /^97[89]/.test(s) ? s.slice(0, 13) : s

  if (core.length === 13) {
    // Only Bookland prefixes are books; 4006381333931 is a retail product.
    if (!/^97[89]/.test(core)) return null
    return isValidIsbn13(core) ? core : null
  }

  if (core.length === 10) {
    return isValidIsbn10(core) ? isbn10to13(core) : null
  }

  return null
}

/**
 * The ISBN forms worth querying an upstream catalogue with, most-likely first.
 *
 * Catalogues index books under the ISBN that was printed on them: pre-2007
 * titles are often only findable by their ISBN-10, while everything since is
 * indexed as ISBN-13. Trying both turns a "not found" into a hit.
 */
export function isbnCandidates(raw: string): string[] {
  const s = raw.replace(/[^\dX]/gi, '').toUpperCase()
  const out: string[] = []

  if (s.length === 10 && /^\d{9}[\dX]$/.test(s)) {
    out.push(s, isbn10to13(s))
  } else if (s.length === 13) {
    out.push(s)
    // 978-prefixed ISBN-13s have an ISBN-10 equivalent; 979 ones do not.
    if (s.startsWith('978')) out.push(isbn13to10(s))
  }

  return [...new Set(out.filter(Boolean))]
}

/** Convert a 978-prefixed ISBN-13 back to its ISBN-10 form. */
export function isbn13to10(isbn13: string): string {
  const digits = isbn13.replace(/\D/g, '')
  if (digits.length !== 13 || !digits.startsWith('978')) return ''
  const body = digits.slice(3, 12)
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(body[i], 10) * (10 - i)
  const check = (11 - (sum % 11)) % 11
  return body + (check === 10 ? 'X' : String(check))
}
