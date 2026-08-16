/**
 * lib/bookEnrichment.ts
 *
 * Turns a search result (BookSuggestion) into the content-metadata columns
 * stored on `books`: isbn13, subjects, page_count, published_date, publisher —
 * plus the `genre` label derived from the subjects.
 *
 * The add flow shows all of this in the suggestion dropdown and then dropped it
 * on submit, so every book row carried only title/author/cover. Storing it makes
 * the data stable (the catalogues resolve the same query to different editions
 * over time) and gives `isbn13` as the join key into book_metadata_cache.
 *
 * Everything here is pure so the matching rules are unit-testable — the metadata
 * must only be attached when the suggestion still describes the book being
 * saved. Users routinely pick a suggestion and then correct the title or author
 * by hand, and silently keeping a mismatched ISBN would be worse than storing
 * nothing at all.
 */

import type { Book } from '@/types/book'
import type { BookSuggestion } from '@/lib/bookSearch'

/** Matches MAX_SUBJECTS in app/api/books/search — the API never returns more. */
export const MAX_STORED_SUBJECTS = 8

/**
 * Shortest synopsis worth storing, matching the threshold /api/book-data
 * already applies. Below this the catalogues return stubs like "A novel." that
 * are worse than showing nothing.
 */
export const MIN_DESCRIPTION_LENGTH = 30

/**
 * Subjects too broad to be useful as a displayed genre. Google Books tags a
 * large share of its catalogue "Fiction" / "General", which would collapse the
 * dashboard's genre breakdown into a single bar. They stay in `subjects` — a
 * ranker can still use them — they're just skipped when picking the label.
 */
const GENERIC_SUBJECTS = new Set([
  'fiction',
  'nonfiction',
  'non-fiction',
  'general',
  'books',
  'literature',
  'literary collections',
  'miscellanea',
  'text',
  'adult',
  'juvenile fiction',
  'juvenile nonfiction',
])

/** The subset of Book columns this module writes. */
export type BookEnrichment = Pick<
  Book,
  'isbn13' | 'page_count' | 'published_date' | 'publisher' | 'subjects' | 'genre' | 'description'
>

// ─── Matching ─────────────────────────────────────────────────────────────────

/** Lowercase, strip punctuation, collapse whitespace — same shape as the search route's dedup key. */
export function normaliseKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** True when two names share a word of 3+ characters ("J.R.R. Tolkien" ↔ "John Tolkien"). */
function sharesNameToken(a: string, b: string): boolean {
  const tokens = new Set(a.split(' ').filter((w) => w.length >= 3))
  return b.split(' ').some((w) => w.length >= 3 && tokens.has(w))
}

/**
 * Whether `suggestion` still describes the title/author about to be saved.
 *
 * Titles match exactly, or by prefix once both are 4+ characters — the common
 * case is a user trimming a subtitle ("Piranesi: A Novel" → "Piranesi").
 * Authors only have to share one name token, because catalogues disagree on
 * initials and middle names; an author known on just one side isn't evidence of
 * a mismatch, so a title match carries it.
 */
export function suggestionMatches(
  suggestion: BookSuggestion,
  title: string,
  author: string,
): boolean {
  const suggested = normaliseKey(suggestion.title ?? '')
  const typed = normaliseKey(title)
  if (!suggested || !typed) return false

  const titleMatches =
    suggested === typed ||
    (suggested.length >= 4 && typed.length >= 4 &&
      (suggested.startsWith(typed) || typed.startsWith(suggested)))
  if (!titleMatches) return false

  const suggestedAuthor = normaliseKey(suggestion.author ?? '')
  const typedAuthor = normaliseKey(author)
  if (!suggestedAuthor || !typedAuthor) return true

  return sharesNameToken(suggestedAuthor, typedAuthor)
}

// ─── Extraction ───────────────────────────────────────────────────────────────

/** First subject specific enough to show as a genre, else the first one. */
export function genreFromSubjects(subjects: string[] | null | undefined): string | undefined {
  const clean = (subjects ?? []).map((s) => s.trim()).filter(Boolean)
  if (clean.length === 0) return undefined
  return clean.find((s) => !GENERIC_SUBJECTS.has(s.toLowerCase())) ?? clean[0]
}

/**
 * The columns to persist for a book being saved from `suggestion`.
 *
 * Returns an empty object when there is no suggestion or it no longer matches
 * what the user typed. Keys are omitted rather than set to undefined so the
 * result can be spread straight into an insert or update without clearing
 * columns that already hold data.
 */
export function enrichmentFromSuggestion(
  suggestion: BookSuggestion | null | undefined,
  title: string,
  author: string,
): BookEnrichment {
  if (!suggestion || !suggestionMatches(suggestion, title, author)) return {}

  const enrichment: BookEnrichment = {}

  const isbn13 = suggestion.isbn13?.replace(/[^0-9X]/gi, '')
  if (isbn13 && isbn13.length === 13) enrichment.isbn13 = isbn13

  if (typeof suggestion.pageCount === 'number' && suggestion.pageCount > 0) {
    enrichment.page_count = suggestion.pageCount
  }
  if (suggestion.publishedDate) enrichment.published_date = suggestion.publishedDate
  if (suggestion.publisher) enrichment.publisher = suggestion.publisher

  const description = suggestion.description?.trim()
  if (description && description.length >= MIN_DESCRIPTION_LENGTH) {
    enrichment.description = description
  }

  const subjects = (suggestion.subjects ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_STORED_SUBJECTS)
  if (subjects.length > 0) {
    enrichment.subjects = subjects
    const genre = genreFromSubjects(subjects)
    if (genre) enrichment.genre = genre
  }

  return enrichment
}

// ─── Backfill ─────────────────────────────────────────────────────────────────

/**
 * Whether the read-book detail view still has to hit the catalogue.
 *
 * Only the description and subjects count. Publisher and page count are
 * genuinely absent for plenty of editions, so demanding them would leave the
 * lookup running forever on exactly the books that can never satisfy it — and
 * the chips showing them are conditional anyway.
 *
 * This page is also where books backfill themselves, so the bar includes
 * subjects even though nothing on screen renders them directly.
 */
export function needsMetadataLookup(
  book: Pick<Book, 'description' | 'subjects'>,
): boolean {
  return !book.description || (book.subjects?.length ?? 0) === 0
}

/**
 * The same question for the to-read and wishlist detail views, which render
 * only the synopsis, genre and release year. They look books up through
 * /api/book-data, which returns just those three, so their bar can't include
 * anything the route never provides.
 */
export function needsSynopsisLookup(
  book: Pick<Book, 'description' | 'genre' | 'published_date'>,
): boolean {
  return !book.description || !book.genre || !book.published_date
}

/**
 * Fields from `enrichment` that the book is still missing.
 *
 * Backfill never overwrites: a genre or page count already on the row may have
 * been corrected by the user, and a later catalogue lookup is not better
 * evidence than what is already stored. Returns an empty object when there is
 * nothing to write, so callers can skip the round-trip.
 */
export function enrichmentPatch(book: Book, enrichment: BookEnrichment): BookEnrichment {
  const patch: BookEnrichment = {}
  if (!book.isbn13 && enrichment.isbn13) patch.isbn13 = enrichment.isbn13
  if (!book.page_count && enrichment.page_count) patch.page_count = enrichment.page_count
  if (!book.published_date && enrichment.published_date) patch.published_date = enrichment.published_date
  if (!book.publisher && enrichment.publisher) patch.publisher = enrichment.publisher
  if (!book.subjects?.length && enrichment.subjects?.length) patch.subjects = enrichment.subjects
  if (!book.genre && enrichment.genre) patch.genre = enrichment.genre
  if (!book.description && enrichment.description) patch.description = enrichment.description
  return patch
}
