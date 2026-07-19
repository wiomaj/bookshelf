import { describe, it, expect } from 'vitest'
import { booksToCsv, formatPartialDate, CSV_HEADERS_EN } from '@/lib/csvExport'
import type { Book } from '@/types/book'

const SEASONS: [string, string, string, string] = ['Spring', 'Summer', 'Fall', 'Winter']

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: '1',
    user_id: 'u1',
    title: 'The Hobbit',
    author: 'J.R.R. Tolkien',
    year: 2024,
    month: 5,
    rating: 4,
    created_at: '2024-03-10T12:34:56.000Z',
    status: 'read',
    ...overrides,
  }
}

describe('formatPartialDate', () => {
  it('formats a full date with zero-padding', () => {
    expect(formatPartialDate(2024, 5, 3, SEASONS)).toBe('2024-05-03')
  })

  it('formats year + month without a day', () => {
    expect(formatPartialDate(2024, 11, null, SEASONS)).toBe('2024-11')
  })

  it('formats season codes with the given names', () => {
    expect(formatPartialDate(2024, 13, null, SEASONS)).toBe('Spring 2024')
    expect(formatPartialDate(2023, 16, null, SEASONS)).toBe('Winter 2023')
  })

  it('formats a bare year', () => {
    expect(formatPartialDate(2024, null, null, SEASONS)).toBe('2024')
  })

  it('returns empty string without a year', () => {
    expect(formatPartialDate(null, 5, 3, SEASONS)).toBe('')
    expect(formatPartialDate(undefined, null, null, SEASONS)).toBe('')
  })
})

describe('booksToCsv', () => {
  it('emits a header row plus one row per book, CRLF-terminated', () => {
    const csv = booksToCsv([makeBook()])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe(CSV_HEADERS_EN.join(','))
    expect(lines[1]).toBe('The Hobbit,J.R.R. Tolkien,2024-03-10,,2024-05,4,')
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('escapes commas, quotes, and newlines', () => {
    const csv = booksToCsv([makeBook({
      title: 'Hello, World',
      author: 'A "B" C',
      notes: 'line one\nline two',
    })])
    const row = csv.split('\r\n')[1]
    expect(row).toBe('"Hello, World","A ""B"" C",2024-03-10,,2024-05,4,"line one\nline two"')
  })

  it('prefers read_year/read_month over year/month for the read date', () => {
    const csv = booksToCsv([makeBook({ read_year: 2023, read_month: 12 })])
    expect(csv.split('\r\n')[1]).toContain(',2023-12,')
  })

  it('includes the started-reading date when present', () => {
    const csv = booksToCsv([makeBook({
      started_reading_year: 2024,
      started_reading_month: 4,
      started_reading_day: 20,
    })])
    expect(csv.split('\r\n')[1]).toBe('The Hobbit,J.R.R. Tolkien,2024-03-10,2024-04-20,2024-05,4,')
  })

  it('leaves read date and rating empty for unfinished books', () => {
    const csv = booksToCsv([makeBook({ status: 'to_read', rating: 0, acquired_year: 2024 })])
    expect(csv.split('\r\n')[1]).toBe('The Hobbit,J.R.R. Tolkien,2024-03-10,,,,')
  })

  it('exports the read date for abandoned books', () => {
    const csv = booksToCsv([makeBook({ status: 'abandoned', rating: 2 })])
    expect(csv.split('\r\n')[1]).toBe('The Hobbit,J.R.R. Tolkien,2024-03-10,,2024-05,2,')
  })

  it('uses localized season names in dates', () => {
    const csv = booksToCsv(
      [makeBook({ month: 14 })],
      CSV_HEADERS_EN,
      ['Frühling', 'Sommer', 'Herbst', 'Winter'],
    )
    expect(csv.split('\r\n')[1]).toContain('Sommer 2024')
  })

  it('handles an empty library', () => {
    expect(booksToCsv([])).toBe(CSV_HEADERS_EN.join(',') + '\r\n')
  })
})
