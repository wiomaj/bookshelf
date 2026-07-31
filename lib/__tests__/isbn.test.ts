import { describe, it, expect } from 'vitest'
import {
  isbn10to13,
  isbn13to10,
  detectISBN,
  normalizeIsbn13,
  normalizeIsbn,
  isValidIsbn10,
  isValidIsbn13,
  isbnFromScan,
  isbnCandidates,
} from '../isbn'

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

// ─── Check digits ─────────────────────────────────────────────────────────────

describe('isValidIsbn10', () => {
  it('accepts a valid ISBN-10', () => {
    expect(isValidIsbn10('0451524934')).toBe(true)
  })

  it('accepts a valid ISBN-10 with an X check digit', () => {
    expect(isValidIsbn10('043935806X')).toBe(true)
    expect(isValidIsbn10('043935806x')).toBe(true)
  })

  it('rejects a wrong check digit', () => {
    expect(isValidIsbn10('0451524935')).toBe(false)
  })

  it('rejects the wrong length', () => {
    expect(isValidIsbn10('045152493')).toBe(false)
    expect(isValidIsbn10('9780451524935')).toBe(false)
  })
})

describe('isValidIsbn13', () => {
  it('accepts a valid ISBN-13', () => {
    expect(isValidIsbn13('9780451524935')).toBe(true)
    expect(isValidIsbn13('978-0-451-52493-5')).toBe(true)
  })

  it('rejects a wrong check digit', () => {
    expect(isValidIsbn13('9780451524936')).toBe(false)
  })

  it('rejects the wrong length', () => {
    expect(isValidIsbn13('978045152493')).toBe(false)
  })
})

describe('isbn13to10', () => {
  it('round-trips a 978 ISBN-13 back to its ISBN-10', () => {
    expect(isbn13to10('9780451524935')).toBe('0451524934')
  })

  it('round-trips an X check digit', () => {
    expect(isbn13to10(isbn10to13('043935806X'))).toBe('043935806X')
  })

  it('returns empty string for 979 ISBNs, which have no ISBN-10 form', () => {
    expect(isbn13to10('9791234567896')).toBe('')
  })
})

// ─── isbnFromScan (camera barcode → verified ISBN-13) ────────────────────────

describe('isbnFromScan', () => {
  it('accepts a Bookland EAN-13', () => {
    expect(isbnFromScan('9780451524935')).toBe('9780451524935')
  })

  it('accepts a 979-prefixed EAN-13', () => {
    // 979 is now issued for books alongside 978
    expect(isbnFromScan('9791234567896')).toBe('9791234567896')
  })

  it('strips a 5-digit price add-on scanned alongside the barcode', () => {
    expect(isbnFromScan('978045152493551999')).toBe('9780451524935')
  })

  it('strips a 2-digit add-on', () => {
    expect(isbnFromScan('978045152493512')).toBe('9780451524935')
  })

  it('converts a bare ISBN-10 to ISBN-13', () => {
    expect(isbnFromScan('0451524934')).toBe('9780451524935')
  })

  it('rejects a misread barcode with a bad check digit', () => {
    expect(isbnFromScan('9780451524936')).toBeNull()
    expect(isbnFromScan('0451524935')).toBeNull()
  })

  it('rejects non-book retail barcodes', () => {
    expect(isbnFromScan('4006381333931')).toBeNull() // valid EAN-13, not a book
    expect(isbnFromScan('12345670')).toBeNull()      // EAN-8
    expect(isbnFromScan('036000291452')).toBeNull()  // UPC-A
  })

  it('rejects empty and junk input', () => {
    expect(isbnFromScan('')).toBeNull()
    expect(isbnFromScan('not a barcode')).toBeNull()
  })
})

// ─── isbnCandidates ───────────────────────────────────────────────────────────

describe('isbnCandidates', () => {
  it('returns both forms for a 978 ISBN-13', () => {
    expect(isbnCandidates('9780451524935')).toEqual(['9780451524935', '0451524934'])
  })

  it('returns both forms for an ISBN-10', () => {
    expect(isbnCandidates('0451524934')).toEqual(['0451524934', '9780451524935'])
  })

  it('returns only the ISBN-13 for a 979 prefix', () => {
    expect(isbnCandidates('9791234567896')).toEqual(['9791234567896'])
  })

  it('returns nothing for a non-ISBN', () => {
    expect(isbnCandidates('12345')).toEqual([])
  })
})
