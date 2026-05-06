/**
 * One-off admin script: clears auto-fetched covers from Google Books and
 * OpenLibrary for ALL users so they are re-fetched correctly on next open.
 *
 * User-uploaded covers (*.supabase.co URLs) are NOT touched.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<your-key> node scripts/clear-autofetched-covers.mjs
 *
 * Get the service role key from:
 *   Supabase Dashboard → Project Settings → API → service_role (secret)
 *
 * Alternatively, run this SQL directly in the Supabase SQL editor:
 *
 *   UPDATE books
 *   SET cover_url = NULL
 *   WHERE cover_url LIKE '%books.google.com%'
 *      OR cover_url LIKE '%openlibrary.org%';
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(`
Error: Missing environment variables.

Run with:
  SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/clear-autofetched-covers.mjs

Or copy NEXT_PUBLIC_SUPABASE_URL from .env.local and get the service_role key
from: Supabase Dashboard → Project Settings → API → service_role (secret)

Alternatively, run this SQL in the Supabase SQL editor:

  UPDATE books
  SET cover_url = NULL
  WHERE cover_url LIKE '%books.google.com%'
     OR cover_url LIKE '%openlibrary.org%';
`)
  process.exit(1)
}

// Service role key bypasses RLS so we can update all users' books
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// First: count how many books will be affected
const { count, error: countError } = await supabase
  .from('books')
  .select('*', { count: 'exact', head: true })
  .or('cover_url.like.%books.google.com%,cover_url.like.%openlibrary.org%')

if (countError) {
  console.error('Count query failed:', countError.message)
  process.exit(1)
}

console.log(`Found ${count} book(s) with auto-fetched covers to clear.`)
if (count === 0) {
  console.log('Nothing to do.')
  process.exit(0)
}

// Clear the covers
const { error: updateError } = await supabase
  .from('books')
  .update({ cover_url: null })
  .or('cover_url.like.%books.google.com%,cover_url.like.%openlibrary.org%')

if (updateError) {
  console.error('Update failed:', updateError.message)
  process.exit(1)
}

console.log(`✓ Cleared auto-fetched covers for ${count} book(s).`)
console.log('  Covers will be re-fetched (author-precise) next time each book is opened.')
