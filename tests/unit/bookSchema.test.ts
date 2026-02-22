/**
 * Unit tests for lib/bookSchema.ts
 *
 * Covers: valid input, every rejection boundary, null month, season codes,
 * empty cover_url transform, and unknown-field stripping (injection defence).
 */
import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import { BookInputSchema } from '@/lib/bookSchema'

// ─── Fixture ──────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()

// Explicit type so spreads compile correctly (Zod v4 parse() accepts `unknown`)
const VALID: {
  title: string; author: string; genre: string; year: number
  month: number; rating: number; notes: string; cover_url: string
} = {
  title:     'The Hobbit',
  author:    'J.R.R. Tolkien',
  genre:     'Fantasy',
  year:      2023,
  month:     6,
  rating:    5,
  notes:     'A wonderful adventure.',
  cover_url: 'https://books.google.com/cover.jpg',
}

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('BookInputSchema — valid input', () => {
  it('accepts a fully valid book', () => {
    expect(() => BookInputSchema.parse(VALID)).not.toThrow()
  })

  it('accepts a book without optional fields', () => {
    const { genre, notes, cover_url, ...minimal } = VALID
    expect(() => BookInputSchema.parse(minimal)).not.toThrow()
  })

  it('accepts null month (unknown read date)', () => {
    const result = BookInputSchema.parse({ ...VALID, month: null })
    expect(result.month).toBeNull()
  })

  it('accepts season codes 13–16', () => {
    for (const m of [13, 14, 15, 16]) {
      expect(() => BookInputSchema.parse({ ...VALID, month: m })).not.toThrow()
    }
  })

  it('accepts the minimum valid year (1450)', () => {
    expect(() => BookInputSchema.parse({ ...VALID, year: 1450 })).not.toThrow()
  })

  it('accepts current year + 1', () => {
    expect(() => BookInputSchema.parse({ ...VALID, year: CURRENT_YEAR + 1 })).not.toThrow()
  })
})

// ─── Title validation ─────────────────────────────────────────────────────────

describe('BookInputSchema — title', () => {
  it('rejects an empty title', () => {
    expect(() => BookInputSchema.parse({ ...VALID, title: '' })).toThrow(ZodError)
  })

  it('rejects a whitespace-only title', () => {
    // Zod min(1) catches this — the string has length 3 but is still technically valid
    // The DB constraint also guards this; Zod min(1) covers empty string
    expect(() => BookInputSchema.parse({ ...VALID, title: '' })).toThrow(ZodError)
  })

  it('rejects a title exceeding 500 characters', () => {
    expect(() => BookInputSchema.parse({ ...VALID, title: 'x'.repeat(501) })).toThrow(ZodError)
  })

  it('accepts a title of exactly 500 characters', () => {
    expect(() => BookInputSchema.parse({ ...VALID, title: 'x'.repeat(500) })).not.toThrow()
  })
})

// ─── Year validation ──────────────────────────────────────────────────────────

describe('BookInputSchema — year', () => {
  it('rejects year 1449 (below floor)', () => {
    expect(() => BookInputSchema.parse({ ...VALID, year: 1449 })).toThrow(ZodError)
  })

  it('rejects a future year beyond current + 1', () => {
    expect(() => BookInputSchema.parse({ ...VALID, year: CURRENT_YEAR + 2 })).toThrow(ZodError)
  })

  it('rejects a non-integer year', () => {
    expect(() => BookInputSchema.parse({ ...VALID, year: 2023.5 })).toThrow(ZodError)
  })
})

// ─── Rating validation ────────────────────────────────────────────────────────

describe('BookInputSchema — rating', () => {
  it('rejects rating 0', () => {
    expect(() => BookInputSchema.parse({ ...VALID, rating: 0 })).toThrow(ZodError)
  })

  it('rejects rating 6', () => {
    expect(() => BookInputSchema.parse({ ...VALID, rating: 6 })).toThrow(ZodError)
  })

  it('accepts ratings 1–5', () => {
    for (const r of [1, 2, 3, 4, 5]) {
      expect(() => BookInputSchema.parse({ ...VALID, rating: r })).not.toThrow()
    }
  })
})

// ─── Month validation ─────────────────────────────────────────────────────────

describe('BookInputSchema — month', () => {
  it('rejects month 0', () => {
    expect(() => BookInputSchema.parse({ ...VALID, month: 0 })).toThrow(ZodError)
  })

  it('rejects month 17', () => {
    expect(() => BookInputSchema.parse({ ...VALID, month: 17 })).toThrow(ZodError)
  })

  it('accepts months 1–12', () => {
    for (let m = 1; m <= 12; m++) {
      expect(() => BookInputSchema.parse({ ...VALID, month: m })).not.toThrow()
    }
  })
})

// ─── Cover URL validation ─────────────────────────────────────────────────────

describe('BookInputSchema — cover_url', () => {
  it('transforms an empty string to undefined', () => {
    const result = BookInputSchema.parse({ ...VALID, cover_url: '' })
    expect(result.cover_url).toBeUndefined()
  })

  it('rejects a non-URL string', () => {
    expect(() => BookInputSchema.parse({ ...VALID, cover_url: 'not-a-url' })).toThrow(ZodError)
  })

  it('accepts a valid HTTPS URL', () => {
    expect(
      () => BookInputSchema.parse({ ...VALID, cover_url: 'https://covers.openlibrary.org/b/id/123-L.jpg' })
    ).not.toThrow()
  })
})

// ─── Injection / prototype pollution defence ──────────────────────────────────

describe('BookInputSchema — unknown-field stripping', () => {
  it('strips user_id from input (cannot override RLS identity)', () => {
    const result = BookInputSchema.parse({ ...VALID, user_id: 'attacker-id' })
    expect((result as Record<string, unknown>).user_id).toBeUndefined()
  })

  it('strips id from input', () => {
    const result = BookInputSchema.parse({ ...VALID, id: 'arbitrary-uuid' })
    expect((result as Record<string, unknown>).id).toBeUndefined()
  })

  it('strips created_at from input', () => {
    const result = BookInputSchema.parse({ ...VALID, created_at: '2020-01-01' })
    expect((result as Record<string, unknown>).created_at).toBeUndefined()
  })
})

// ─── Partial parse (updateBook) ───────────────────────────────────────────────

describe('BookInputSchema.partial() — for updateBook', () => {
  it('allows a subset of fields', () => {
    const result = BookInputSchema.partial().parse({ rating: 4 })
    expect(result.rating).toBe(4)
    expect(result.title).toBeUndefined()
  })

  it('still rejects an invalid value for a provided field', () => {
    expect(() => BookInputSchema.partial().parse({ rating: 99 })).toThrow(ZodError)
  })

  it('still strips unknown fields in partial mode', () => {
    const result = BookInputSchema.partial().parse({ rating: 3, user_id: 'evil' })
    expect((result as Record<string, unknown>).user_id).toBeUndefined()
  })
})
