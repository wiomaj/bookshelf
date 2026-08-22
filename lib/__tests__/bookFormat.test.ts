import { describe, it, expect } from 'vitest'
import { bookFormatFromFlags, bookFormatToFlags, countBookFormats } from '../bookFormat'

describe('bookFormatFromFlags', () => {
  it('defaults to print when no flag is set', () => {
    expect(bookFormatFromFlags({})).toBe('print')
    expect(bookFormatFromFlags({ is_audiobook: false, is_ebook: false })).toBe('print')
    expect(bookFormatFromFlags(null)).toBe('print')
    expect(bookFormatFromFlags(undefined)).toBe('print')
  })

  it('reads the ebook and audiobook flags', () => {
    expect(bookFormatFromFlags({ is_ebook: true })).toBe('ebook')
    expect(bookFormatFromFlags({ is_audiobook: true })).toBe('audiobook')
  })

  it('prefers audiobook when a legacy row has both flags set', () => {
    expect(bookFormatFromFlags({ is_audiobook: true, is_ebook: true })).toBe('audiobook')
  })
})

describe('bookFormatToFlags', () => {
  it('maps each format to exclusive flags', () => {
    expect(bookFormatToFlags('print')).toEqual({ is_audiobook: false, is_ebook: false })
    expect(bookFormatToFlags('ebook')).toEqual({ is_audiobook: false, is_ebook: true })
    expect(bookFormatToFlags('audiobook')).toEqual({ is_audiobook: true, is_ebook: false })
  })

  it('round-trips every format', () => {
    for (const format of ['print', 'ebook', 'audiobook'] as const) {
      expect(bookFormatFromFlags(bookFormatToFlags(format))).toBe(format)
    }
  })
})

describe('countBookFormats', () => {
  it('counts an empty shelf as all zeroes', () => {
    expect(countBookFormats([])).toEqual({ print: 0, ebook: 0, audiobook: 0 })
  })

  it('counts each book exactly once', () => {
    const books = [
      {},
      { is_ebook: false, is_audiobook: false },
      { is_ebook: true },
      { is_audiobook: true },
      { is_audiobook: true, is_ebook: true },   // legacy row — audiobook wins
    ]
    const counts = countBookFormats(books)
    expect(counts).toEqual({ print: 2, ebook: 1, audiobook: 2 })
    expect(counts.print + counts.ebook + counts.audiobook).toBe(books.length)
  })

  it('treats null flags as print', () => {
    expect(countBookFormats([{ is_ebook: null, is_audiobook: null }])).toEqual({
      print: 1, ebook: 0, audiobook: 0,
    })
  })
})
