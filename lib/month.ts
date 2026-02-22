// Shared month/season label helpers used across BookCard, BookForm, and the detail page.

export const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// 13–16 are season codes stored when the user can't remember the exact month.
export const SEASONS: Record<number, string> = {
  13: 'Spring',
  14: 'Summer',
  15: 'Fall',
  16: 'Winter',
}

/**
 * Returns a short display label for a month value, or null when the month is unknown.
 * - 1–12  → "Jan" … "Dec"
 * - 13–16 → "Spring" / "Summer" / "Fall" / "Winter"
 * - null  → null (caller should hide the tag)
 */
export function formatMonthShort(month: number | null | undefined): string | null {
  if (!month) return null
  if (month >= 1 && month <= 12) return SHORT_MONTHS[month - 1]
  return SEASONS[month] ?? null
}

/**
 * Returns a long display label (used in the detail hero).
 * Same rules as formatMonthShort but uses full month names.
 */
export function formatMonthLong(month: number | null | undefined): string | null {
  if (!month) return null
  if (month >= 1 && month <= 12) return LONG_MONTHS[month - 1]
  return SEASONS[month] ?? null
}
