// CSV export of the user's library, triggered from the Settings page.

import type { Book } from '@/types/book'

export type CsvHeaders = [string, string, string, string, string, string, string]

export const CSV_HEADERS_EN: CsvHeaders = [
  'Title', 'Author', 'Date added', 'Started reading', 'Date read', 'Rating', 'Comment',
]

/** Quote a field per RFC 4180 when it contains a comma, quote, or newline. */
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/**
 * Formats a partial date from the year/month/day columns.
 * - full date        → "2024-05-12"
 * - year + month     → "2024-05"
 * - year + season    → "Spring 2024" (season codes 13–16, localized names)
 * - year only        → "2024"
 * - no year          → "" (a month without a year is meaningless, so it's dropped)
 */
export function formatPartialDate(
  year: number | null | undefined,
  month: number | null | undefined,
  day: number | null | undefined,
  seasonNames: [string, string, string, string],
): string {
  if (!year) return ''
  if (!month) return String(year)
  if (month >= 13 && month <= 16) return `${seasonNames[month - 13]} ${year}`
  if (month < 1 || month > 12) return String(year)
  const mm = String(month).padStart(2, '0')
  if (!day) return `${year}-${mm}`
  return `${year}-${mm}-${String(day).padStart(2, '0')}`
}

/**
 * Serializes books to CSV: title, author, date added, started reading,
 * date read, rating, comment. One row per book, CRLF line endings.
 */
export function booksToCsv(
  books: Book[],
  headers: CsvHeaders = CSV_HEADERS_EN,
  seasonNames: [string, string, string, string] = ['Spring', 'Summer', 'Fall', 'Winter'],
): string {
  const rows = books.map((book) => {
    const finished = book.status === 'read' || book.status === 'abandoned' || book.status === undefined
    return [
      book.title,
      book.author,
      book.created_at ? book.created_at.slice(0, 10) : '',
      formatPartialDate(book.started_reading_year, book.started_reading_month, book.started_reading_day, seasonNames),
      finished
        ? formatPartialDate(book.read_year ?? book.year, book.read_month ?? book.month, null, seasonNames)
        : '',
      book.rating >= 1 ? String(book.rating) : '',
      book.notes ?? '',
    ].map(escapeCsvField).join(',')
  })

  return [headers.map(escapeCsvField).join(','), ...rows].join('\r\n') + '\r\n'
}

/** Triggers a browser download of the CSV. BOM prefix keeps Excel happy with UTF-8. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
