/**
 * Bulk re-fetches covers for all books that have no cover_url.
 * Uses the same author-precise search logic as the app.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/refetch-covers.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── Cover fetching (same logic as lib/bookMetadata.ts) ──────────────────────

function normaliseGoogleCover(raw) {
  return raw
    .replace('http:', 'https:')
    .replace(/zoom=\d+/, 'zoom=0')
    .replace(/&fife=[^&]*/g, '') + '&fife=w600'
}

function googleCoverFromResponse(data) {
  const items = data?.items
  if (!Array.isArray(items)) return undefined
  for (const item of items) {
    const links = item?.volumeInfo?.imageLinks
    if (!links) continue
    const raw = links.extraLarge ?? links.large ?? links.medium ?? links.thumbnail
    if (raw) return normaliseGoogleCover(raw)
  }
  return undefined
}

function olCoverFromDoc(doc) {
  if (!doc) return undefined
  if (doc.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
  if (doc.cover_edition_key) return `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`
  if (doc.isbn?.[0]) return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`
  return undefined
}

async function googleBooks(q) {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`)
    if (!res.ok) return undefined
    return googleCoverFromResponse(await res.json())
  } catch { return undefined }
}

async function openLibrary(params) {
  try {
    const qs = new URLSearchParams({ ...params, fields: 'cover_i,cover_edition_key,isbn', limit: '1' })
    const res = await fetch(`https://openlibrary.org/search.json?${qs}`)
    if (!res.ok) return undefined
    const data = await res.json()
    return olCoverFromDoc(data.docs?.[0])
  } catch { return undefined }
}

async function firstOf(promises) {
  try {
    return await Promise.any(promises.map(async p => {
      const r = await p
      if (!r) throw new Error('no cover')
      return r
    }))
  } catch { return undefined }
}

async function fetchCover(title, author) {
  // Phase 1: precise title + author
  if (author) {
    const precise = await Promise.race([
      firstOf([
        googleBooks(`intitle:"${title}" inauthor:"${author}"`),
        openLibrary({ title, author }),
      ]),
      new Promise(res => setTimeout(() => res(undefined), 5000)),
    ])
    if (precise) return precise
  }
  // Phase 2: title-only fallback
  return Promise.race([
    firstOf([
      googleBooks(`intitle:"${title}"`),
      openLibrary({ title }),
    ]),
    new Promise(res => setTimeout(() => res(undefined), 5000)),
  ])
}

// ── Main ────────────────────────────────────────────────────────────────────

const { data: books, error } = await supabase
  .from('books')
  .select('id, title, author, cover_url')
  .is('cover_url', null)

if (error) { console.error('Failed to fetch books:', error.message); process.exit(1) }

console.log(`Found ${books.length} book(s) missing covers. Re-fetching...\n`)

let found = 0
let notFound = 0

for (const book of books) {
  process.stdout.write(`  "${book.title}" by ${book.author ?? '(no author)'} ... `)
  const cover = await fetchCover(book.title, book.author ?? '')

  if (cover) {
    const { error: upErr } = await supabase
      .from('books')
      .update({ cover_url: cover })
      .eq('id', book.id)
    if (upErr) {
      console.log(`❌ DB error: ${upErr.message}`)
    } else {
      console.log(`✓`)
      found++
    }
  } else {
    console.log(`— no cover found`)
    notFound++
  }

  // Small delay to avoid hammering the APIs
  await new Promise(res => setTimeout(res, 300))
}

console.log(`\nDone. ${found} cover(s) restored, ${notFound} not found.`)
