/**
 * Backfills the content-metadata columns added by the 20260816 migrations —
 * isbn13, subjects, page_count, published_date, publisher, description and
 * genre — for every book that predates them.
 *
 * Books opened on their detail page backfill themselves (the page already looks
 * this up to display it), but that only covers read books, and only ones the
 * user happens to visit. This walks the whole table in one pass.
 *
 * Nothing already stored is overwritten, and metadata is only attached when the
 * catalogue result still matches the book's title and author — the same rule
 * lib/bookEnrichment applies in the app. Safe to re-run: fully populated rows
 * are skipped before any request is made.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/backfill-book-metadata.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/backfill-book-metadata.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY ?? ''
const DRY_RUN = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── Matching + extraction (mirrors lib/bookEnrichment.ts) ───────────────────

const MAX_STORED_SUBJECTS = 8
const MIN_DESCRIPTION_LENGTH = 30

const GENERIC_SUBJECTS = new Set([
  'fiction', 'nonfiction', 'non-fiction', 'general', 'books', 'literature',
  'literary collections', 'miscellanea', 'text', 'adult',
  'juvenile fiction', 'juvenile nonfiction',
])

function normaliseKey(value) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

function sharesNameToken(a, b) {
  const tokens = new Set(a.split(' ').filter(w => w.length >= 3))
  return b.split(' ').some(w => w.length >= 3 && tokens.has(w))
}

function matches(candidateTitle, candidateAuthor, title, author) {
  const suggested = normaliseKey(candidateTitle)
  const typed = normaliseKey(title)
  if (!suggested || !typed) return false

  const titleMatches =
    suggested === typed ||
    (suggested.length >= 4 && typed.length >= 4 &&
      (suggested.startsWith(typed) || typed.startsWith(suggested)))
  if (!titleMatches) return false

  const suggestedAuthor = normaliseKey(candidateAuthor)
  const typedAuthor = normaliseKey(author)
  if (!suggestedAuthor || !typedAuthor) return true
  return sharesNameToken(suggestedAuthor, typedAuthor)
}

function genreFromSubjects(subjects) {
  const clean = (subjects ?? []).map(s => s.trim()).filter(Boolean)
  if (clean.length === 0) return undefined
  return clean.find(s => !GENERIC_SUBJECTS.has(s.toLowerCase())) ?? clean[0]
}

const HTML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"' }

/**
 * Google Books descriptions carry markup; the app stores them plain.
 *
 * Tags are stripped in a loop rather than a single pass — a lone pass can be
 * reconstructed by nested markup ("<scr<script>ipt>" strips to "<script>").
 * Entities are unescaped in one combined pass rather than four chained ones,
 * so literal text like "&amp;lt;" decodes to "&lt;" and not, incorrectly, "<".
 */
function stripHtml(html) {
  let stripped = html
  let previous
  do {
    previous = stripped
    stripped = stripped.replace(/<[^>]*>/g, '')
  } while (stripped !== previous)

  return stripped
    .replace(/&(amp|lt|gt|quot);/g, (_, name) => HTML_ENTITIES[name])
    .replace(/\s+/g, ' ')
    .trim()
}

function isbn13From(identifiers) {
  const found = (identifiers ?? []).find(id => id.type === 'ISBN_13')?.identifier
  const digits = (found ?? '').replace(/[^0-9X]/gi, '')
  return digits.length === 13 ? digits : undefined
}

/** Google Books by title (+ author), returning the first volume that matches. */
async function lookup(title, author) {
  const query = author
    ? `intitle:"${title}" inauthor:"${author}"`
    : `intitle:"${title}"`
  const params = new URLSearchParams({ q: query, maxResults: '5', printType: 'books' })
  if (GOOGLE_BOOKS_API_KEY) params.set('key', GOOGLE_BOOKS_API_KEY)

  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    for (const item of data.items ?? []) {
      const info = item?.volumeInfo
      if (!info?.title) continue
      if (!matches(info.title, (info.authors ?? []).join(' '), title, author)) continue
      return info
    }
  } catch {
    // network error — treated as "not found", the row is left for a later run
  }
  return null
}

/** Only the columns the book is still missing. */
function patchFor(book, info) {
  const patch = {}

  const isbn13 = isbn13From(info.industryIdentifiers)
  if (!book.isbn13 && isbn13) patch.isbn13 = isbn13
  if (!book.page_count && info.pageCount > 0) patch.page_count = info.pageCount
  if (!book.published_date && info.publishedDate) patch.published_date = info.publishedDate
  if (!book.publisher && info.publisher) patch.publisher = info.publisher

  const description = stripHtml(info.description ?? '')
  if (!book.description && description.length >= MIN_DESCRIPTION_LENGTH) {
    patch.description = description
  }

  const subjects = (info.categories ?? []).map(s => s.trim()).filter(Boolean).slice(0, MAX_STORED_SUBJECTS)
  if (!book.subjects?.length && subjects.length > 0) patch.subjects = subjects

  const genre = genreFromSubjects(subjects)
  if (!book.genre && genre) patch.genre = genre

  return patch
}

// ── Main ────────────────────────────────────────────────────────────────────

const { data: books, error } = await supabase
  .from('books')
  .select('id, title, author, genre, isbn13, page_count, published_date, publisher, subjects, description')
  .or('isbn13.is.null,description.is.null,subjects.is.null')

if (error) {
  console.error('Failed to fetch books:', error.message)
  process.exit(1)
}

const pending = books.filter(b => !b.isbn13 || !b.subjects?.length || !b.description)

console.log(
  `${pending.length} of ${books.length} book(s) still missing an ISBN, subjects or a description.` +
  `${DRY_RUN ? ' Dry run — nothing will be written.' : ''}\n`
)

let updated = 0
let notFound = 0
let failed = 0

for (const book of pending) {
  process.stdout.write(`  "${book.title}" by ${book.author || '(no author)'} ... `)

  const info = await lookup(book.title, book.author ?? '')
  if (!info) {
    console.log('— no match')
    notFound++
  } else {
    const patch = patchFor(book, info)
    const summary = Object.keys(patch).join(', ') || 'nothing new'

    if (Object.keys(patch).length === 0) {
      console.log('— nothing new')
      notFound++
    } else if (DRY_RUN) {
      console.log(`would set ${summary}`)
      updated++
    } else {
      const { error: upErr } = await supabase.from('books').update(patch).eq('id', book.id)
      if (upErr) {
        console.log(`❌ ${upErr.message}`)
        failed++
      } else {
        console.log(`✓ ${summary}`)
        updated++
      }
    }
  }

  // Google Books rate-limits aggressively on unkeyed requests.
  await new Promise(res => setTimeout(res, 300))
}

console.log(`\nDone. ${updated} updated, ${notFound} without a usable match, ${failed} failed.`)
