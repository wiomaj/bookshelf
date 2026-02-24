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
// Season definitions: Dec–Feb = Winter, Mar–May = Spring, Jun–Aug = Summer, Sep–Nov = Fall.
export const SEASONS: Record<number, string> = {
  13: 'Spring',
  14: 'Summer',
  15: 'Fall',
  16: 'Winter',
}

/**
 * Returns a numeric sort key so books can be ordered by time within a year.
 * Season codes are mapped to their midpoint month so they interleave correctly
 * with specific months when sorting descending (newest first).
 *   Spring (Mar–May)  → 4   Summer (Jun–Aug) → 7
 *   Fall   (Sep–Nov)  → 10  Winter (Dec–Feb) → 1
 * null/unknown → 0 (sorts last).
 */
export function monthSortKey(month: number | null | undefined): number {
  if (!month) return 0
  const midpoints: Record<number, number> = { 13: 4, 14: 7, 15: 10, 16: 1 }
  return midpoints[month] ?? month
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
