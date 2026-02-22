/**
 * Unit tests for lib/month.ts — formatMonthShort and formatMonthLong.
 *
 * These helpers are used on every book card and in the detail page hero;
 * an off-by-one error would silently corrupt displayed dates.
 */
import { describe, it, expect } from 'vitest'
import { formatMonthShort, formatMonthLong } from '@/lib/month'

// ─── formatMonthShort ─────────────────────────────────────────────────────────

describe('formatMonthShort', () => {
  it('returns correct abbreviated names for months 1–12', () => {
    const expected = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]
    for (let i = 1; i <= 12; i++) {
      expect(formatMonthShort(i)).toBe(expected[i - 1])
    }
  })

  it('returns "Spring" for code 13', ()  => expect(formatMonthShort(13)).toBe('Spring'))
  it('returns "Summer" for code 14', ()  => expect(formatMonthShort(14)).toBe('Summer'))
  it('returns "Fall" for code 15',   ()  => expect(formatMonthShort(15)).toBe('Fall'))
  it('returns "Winter" for code 16', ()  => expect(formatMonthShort(16)).toBe('Winter'))

  it('returns null for null (unknown read date)', () => {
    expect(formatMonthShort(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(formatMonthShort(undefined)).toBeNull()
  })

  it('returns null for 0 (invalid sentinel)', () => {
    expect(formatMonthShort(0)).toBeNull()
  })

  it('returns null for an out-of-range code like 17', () => {
    // 17 is not a valid month or season — should fall through to null
    expect(formatMonthShort(17)).toBeNull()
  })
})

// ─── formatMonthLong ──────────────────────────────────────────────────────────

describe('formatMonthLong', () => {
  it('returns correct full names for months 1–12', () => {
    const expected = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]
    for (let i = 1; i <= 12; i++) {
      expect(formatMonthLong(i)).toBe(expected[i - 1])
    }
  })

  it('returns season labels for codes 13–16', () => {
    expect(formatMonthLong(13)).toBe('Spring')
    expect(formatMonthLong(14)).toBe('Summer')
    expect(formatMonthLong(15)).toBe('Fall')
    expect(formatMonthLong(16)).toBe('Winter')
  })

  it('returns null for null', () => {
    expect(formatMonthLong(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(formatMonthLong(undefined)).toBeNull()
  })
})

// ─── Consistency ──────────────────────────────────────────────────────────────

describe('formatMonthShort / formatMonthLong consistency', () => {
  it('both return non-null for the same valid month codes', () => {
    for (let i = 1; i <= 16; i++) {
      expect(formatMonthShort(i)).not.toBeNull()
      expect(formatMonthLong(i)).not.toBeNull()
    }
  })

  it('both return null for the same invalid codes', () => {
    for (const v of [null, undefined, 0, 17, -1]) {
      expect(formatMonthShort(v as never)).toBeNull()
      expect(formatMonthLong(v as never)).toBeNull()
    }
  })
})
