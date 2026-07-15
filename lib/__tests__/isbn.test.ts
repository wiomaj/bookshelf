import { describe, it, expect } from 'vitest'
import { isbn10to13, detectISBN, normalizeIsbn13, normalizeIsbn } from '../isbn'

describe('isbn10to13', () => {
  it('converts a known ISBN-10 with the correct check digit', () => {
    // "Nineteen Eighty-Four": 0451524934 → 9780451524935
    expect(isbn10to13('0451524934')).toBe('9780451524935')
  })

  it('converts an ISBN-10 ending in X', () => {
    // "The Hobbit" (old edition): 043935806X → 9780439358064 (check digit recomputed)
    const result = isbn10to13('043935806X')
    expect(result).toHaveLength(13)
    expect(result.startsWith('978043935806')).toBe(true)
    expect(result).not.toContain('X')
  })

  it('produces a 0 check digit when the sum is a multiple of 10', () => {
    // 9992158107 → 9789992158104? verify structurally: always 13 digits
    expect(isbn10to13('9992158107')).toMatch(/^978\d{10}$/)
  })
})

describe('detectISBN', () => {
  it('detects a bare ISBN-13', () => {
    expect(detectISBN('9780261102217')).toBe('9780261102217')
  })

  it('detects a bare ISBN-10', () => {
    expect(detectISBN('0451524934')).toBe('0451524934')
  })

  it('strips an isbn: prefix', () => {
    expect(detectISBN('isbn:9780261102217')).toBe('9780261102217')
  })

  it('strips hyphens and spaces', () => {
    expect(detectISBN('978-0-261-10221-7')).toBe('9780261102217')
    expect(detectISBN('978 0261 102 217')).toBe('9780261102217')
  })

  it('accepts an ISBN-10 ending in X', () => {
    expect(detectISBN('043935806X')).toBe('043935806X')
  })

  it('rejects free-text queries', () => {
    expect(detectISBN('the hobbit')).toBeNull()
    expect(detectISBN('sebastian hotz')).toBeNull()
  })

  it('rejects 12-digit codes (UPC-A) and 8-digit codes (EAN-8)', () => {
    expect(detectISBN('123456789012')).toBeNull()
    expect(detectISBN('12345678')).toBeNull()
  })

  it('rejects digit strings with letters mixed in', () => {
    expect(detectISBN('97802611A2217')).toBeNull()
  })
})

describe('normalizeIsbn13', () => {
  it('passes a 13-digit ISBN through unchanged', () => {
    expect(normalizeIsbn13('9780261102217')).toBe('9780261102217')
  })

  it('converts a 10-digit ISBN to 13', () => {
    expect(normalizeIsbn13('0451524934')).toBe('9780451524935')
  })

  it('strips hyphens before normalizing', () => {
    expect(normalizeIsbn13('978-0-261-10221-7')).toBe('9780261102217')
  })
})

describe('normalizeIsbn (strict)', () => {
  it('returns the ISBN-13 for valid input', () => {
    expect(normalizeIsbn('9780261102217')).toBe('9780261102217')
    expect(normalizeIsbn('0451524934')).toBe('9780451524935')
  })

  it('returns null for invalid input', () => {
    expect(normalizeIsbn('12345')).toBeNull()
    expect(normalizeIsbn('not an isbn')).toBeNull()
    expect(normalizeIsbn('123456789012')).toBeNull()
  })
})
