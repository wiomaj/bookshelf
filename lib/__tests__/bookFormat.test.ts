import { describe, it, expect } from 'vitest'
import { bookFormatFromFlags, bookFormatToFlags } from '../bookFormat'

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
