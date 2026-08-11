import { describe, it, expect } from 'vitest'
import { readingDurationDays } from '@/lib/readingDuration'
import type { Book } from '@/types/book'

function makeBook(overrides: Partial<Book>): Book {
  return {
    id: 'id',
    user_id: 'user',
    title: 'Title',
    author: 'Author',
    year: 2026,
    month: 8,
    rating: 3,
    created_at: '2026-01-01T00:00:00Z',
    status: 'read',
    ...overrides,
  }
}

// finished_at is stored as UTC but compared against the local date the user
// picked as the start, so tests build it from a local date.
function localIso(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour).toISOString()
}

describe('readingDurationDays', () => {
  it('counts the days between the start date and the finish stamp', () => {
    const book = makeBook({
      started_reading_day: 1,
      started_reading_month: 8,
      started_reading_year: 2026,
      finished_at: localIso(2026, 8, 13),
    })
    expect(readingDurationDays(book)).toBe(12)
  })

  it('spans month and year boundaries', () => {
    const book = makeBook({
      started_reading_day: 20,
      started_reading_month: 12,
      started_reading_year: 2025,
      finished_at: localIso(2026, 1, 4),
    })
    expect(readingDurationDays(book)).toBe(15)
  })

  it('counts a same-day read as one day', () => {
    const book = makeBook({
      started_reading_day: 9,
      started_reading_month: 8,
      started_reading_year: 2026,
      finished_at: localIso(2026, 8, 9, 23),
    })
    expect(readingDurationDays(book)).toBe(1)
  })

  it('ignores the time of day on both ends', () => {
    const book = makeBook({
      started_reading_day: 9,
      started_reading_month: 8,
      started_reading_year: 2026,
      finished_at: localIso(2026, 8, 10, 1),
    })
    expect(readingDurationDays(book)).toBe(1)
  })

  it('counts from the 1st when the start day is unknown', () => {
    const book = makeBook({
      started_reading_day: null,
      started_reading_month: 8,
      started_reading_year: 2026,
      finished_at: localIso(2026, 8, 21),
    })
    expect(readingDurationDays(book)).toBe(20)
  })

  it('returns null without a start date', () => {
    expect(readingDurationDays(makeBook({ finished_at: localIso(2026, 8, 13) }))).toBeNull()
    expect(readingDurationDays(makeBook({
      started_reading_month: 8,
      finished_at: localIso(2026, 8, 13),
    }))).toBeNull()
  })

  it('falls back to the read month when finished_at is missing (legacy rows)', () => {
    const book = makeBook({
      started_reading_month: 4,
      started_reading_year: 2026,
      read_month: 8,
      read_year: 2026,
    })
    // 1 Apr 2026 → 1 Aug 2026
    expect(readingDurationDays(book)).toBe(122)
  })

  it('falls back to month/year when read_month/read_year are missing', () => {
    const book = makeBook({
      started_reading_month: 7,
      started_reading_year: 2026,
      month: 8,
      year: 2026,
    })
    expect(readingDurationDays(book)).toBe(31)
  })

  it('returns null for a legacy row finished in the start month (no day known)', () => {
    const book = makeBook({
      started_reading_day: 5,
      started_reading_month: 8,
      started_reading_year: 2026,
      read_month: 8,
      read_year: 2026,
    })
    expect(readingDurationDays(book)).toBeNull()
  })

  it('returns null when the read date is unknown and there is no finish stamp', () => {
    const book = makeBook({
      started_reading_month: 8,
      started_reading_year: 2026,
      month: null,
      year: 0,
    })
    expect(readingDurationDays(book)).toBeNull()
  })

  it('returns null when the finish is before the start', () => {
    const book = makeBook({
      started_reading_day: 20,
      started_reading_month: 8,
      started_reading_year: 2026,
      finished_at: localIso(2026, 8, 10),
    })
    expect(readingDurationDays(book)).toBeNull()
  })

  it('returns null for an unparseable finish stamp', () => {
    const book = makeBook({
      started_reading_month: 8,
      started_reading_year: 2026,
      finished_at: 'not-a-date',
    })
    expect(readingDurationDays(book)).toBeNull()
  })
})
