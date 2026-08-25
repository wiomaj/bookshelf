/**
 * Fills in books.genre for every row that has none.
 *
 * The app fetched a genre for display but never stored it, so the column is
 * empty on shelves built before that was fixed — and the dashboard's genre
 * breakdown hides itself when no book has one. This walks the existing rows
 * once; new books get their genre at add time.
 *
 * Uses the same sources and the same first-category rule as /api/book-data.
 *
 * Both env vars are required. This is a plain Node script, so it does not pick
 * up .env.local the way `next dev` does — pass them inline, or on Node 20.6+
 * use `node --env-file=.env.local` once the key is in that file.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   node scripts/backfill-genres.mjs --dry-run
 *
 * Drop --dry-run to write. The key bypasses row-level security — keep it out of
 * anything that gets committed or shared.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const OL_UA = 'BookshelfApp/1.0 (bookshelf-app@outlook.com)'
// Same two env vars lib/gbUrl.ts accepts, so the script works with either.
const GOOGLE_KEY = process.env.GOOGLE_BOOKS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY

// ── Genre lookup (same rule as app/api/book-data/route.ts) ──────────────────

async function googleGenre(title, author) {
  try {
    const q = author ? `intitle:"${title}" inauthor:"${author}"` : `intitle:"${title}"`
    const params = new URLSearchParams({ q, maxResults: '5' })
    if (GOOGLE_KEY) params.set('key', GOOGLE_KEY)
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`)
    if (!res.ok) return undefined
    const data = await res.json()
    for (const item of data.items ?? []) {
      const cats = item?.volumeInfo?.categories
      // "Fiction / Fantasy / Epic" → "Fiction", matching the API route.
      if (cats?.length) return cats[0].split(' / ')[0].trim()
    }
  } catch { /* fall through to Open Library */ }
  return undefined
}

async function openLibraryGenre(title, author) {
  try {
    const params = new URLSearchParams({
      title,
      ...(author ? { author } : {}),
      fields: 'subject',
      limit: '1',
    })
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
      headers: { 'User-Agent': OL_UA },
    })
    if (!res.ok) return undefined
    const data = await res.json()
    return data.docs?.[0]?.subject?.[0]
  } catch { /* ignore */ }
  return undefined
}

async function fetchGenre(title, author) {
  return (await googleGenre(title, author)) ?? (await openLibraryGenre(title, author))
}

// ── Main ────────────────────────────────────────────────────────────────────

const { data: books, error } = await supabase
  .from('books')
  .select('id, title, author, genre')
  .is('genre', null)

if (error) { console.error('Failed to fetch books:', error.message); process.exit(1) }

console.log(`Found ${books.length} book(s) with no genre.${DRY_RUN ? ' (dry run)' : ''}\n`)

let filled = 0
let notFound = 0
let failed = 0

for (const book of books) {
  process.stdout.write(`  "${book.title}" by ${book.author ?? '(no author)'} ... `)
  const genre = await fetchGenre(book.title, book.author ?? '')

  if (!genre) {
    console.log('— no genre found')
    notFound++
  } else if (DRY_RUN) {
    console.log(`would set "${genre}"`)
    filled++
  } else {
    const { error: upErr } = await supabase
      .from('books')
      .update({ genre })
      .eq('id', book.id)
    if (upErr) {
      console.log(`❌ DB error: ${upErr.message}`)
      failed++
    } else {
      console.log(`✓ ${genre}`)
      filled++
    }
  }

  // Small delay to avoid hammering the APIs
  await new Promise(res => setTimeout(res, 300))
}

console.log(
  `\nDone. ${filled} genre(s) ${DRY_RUN ? 'would be set' : 'set'}, ` +
  `${notFound} not found${failed ? `, ${failed} failed` : ''}.`
)
