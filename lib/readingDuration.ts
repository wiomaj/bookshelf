// How long a book took to read: from the day it was marked "currently reading"
// (started_reading_*) to the day it was marked finished (finished_at).

import type { Book } from '@/types/book'

export type ReadingDurationInput = Pick<
  Book,
  | 'started_reading_day'
  | 'started_reading_month'
  | 'started_reading_year'
  | 'finished_at'
  | 'read_month'
  | 'read_year'
  | 'month'
  | 'year'
>

const MS_PER_DAY = 86_400_000

// Day index of a calendar date, so differences are whole days and never off by
// one because of DST or the time of day the book was finished.
function calendarDay(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY)
}

/**
 * Number of days the user spent reading a book, or null when it can't be told.
 *
 * Start comes from the date picked in the "start reading" sheet; the day is
 * optional there, so a month-only start counts from the 1st. End is the
 * finished_at stamp, falling back to the read month for books finished before
 * finished_at existed — that fallback only knows the month, so a finish in the
 * start month carries no usable duration and returns null.
 *
 * A start and finish on the same day counts as 1 day, not 0. Data that can't be
 * true (a finish before the start) returns null instead of a negative number.
 */
export function readingDurationDays(book: ReadingDurationInput): number | null {
  const startYear = book.started_reading_year
  const startMonth = book.started_reading_month
  // Season codes (13–16) never occur here: both start-date pickers offer real months only.
  if (!startYear || !startMonth || startMonth < 1 || startMonth > 12) return null
  const start = calendarDay(startYear, startMonth, book.started_reading_day || 1)

  let end: number
  let exactFinish: boolean
  if (book.finished_at) {
    const finished = new Date(book.finished_at)
    if (Number.isNaN(finished.getTime())) return null
    // Local calendar date — started_reading_* is a local date the user picked.
    end = calendarDay(finished.getFullYear(), finished.getMonth() + 1, finished.getDate())
    exactFinish = true
  } else {
    const readYear = book.read_year ?? book.year
    const readMonth = book.read_month ?? book.month
    if (!readYear || !readMonth || readMonth < 1 || readMonth > 12) return null
    end = calendarDay(readYear, readMonth, 1)
    exactFinish = false
  }

  const days = end - start
  if (days < 0) return null
  if (days === 0) return exactFinish ? 1 : null
  return days
}
