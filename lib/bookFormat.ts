/**
 * A book's physical/digital kind. The database stores this as two independent
 * booleans (`is_audiobook`, `is_ebook`); the UI treats it as one exclusive
 * choice, so these helpers translate between the two shapes.
 */
export type BookFormat = 'print' | 'ebook' | 'audiobook'

type FormatFlags = { is_audiobook?: boolean | null; is_ebook?: boolean | null }

/**
 * Reads the format out of a book row. Legacy rows can have both flags set —
 * audiobook wins there, since that's the more specific of the two.
 */
export function bookFormatFromFlags(flags: FormatFlags | null | undefined): BookFormat {
  if (flags?.is_audiobook) return 'audiobook'
  if (flags?.is_ebook) return 'ebook'
  return 'print'
}

/** Turns the exclusive UI choice back into the two stored booleans. */
export function bookFormatToFlags(format: BookFormat): { is_audiobook: boolean; is_ebook: boolean } {
  return {
    is_audiobook: format === 'audiobook',
    is_ebook: format === 'ebook',
  }
}

/** Display order for the formats — print first, since it's the default. */
export const BOOK_FORMATS: readonly BookFormat[] = ['print', 'ebook', 'audiobook']

/**
 * How many books fall into each format. Every book counts exactly once: a row
 * with neither flag set is print, so the three counts always add up to
 * `books.length`.
 */
export function countBookFormats(books: readonly FormatFlags[]): Record<BookFormat, number> {
  const counts: Record<BookFormat, number> = { print: 0, ebook: 0, audiobook: 0 }
  for (const book of books) counts[bookFormatFromFlags(book)] += 1
  return counts
}
