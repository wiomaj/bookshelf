import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

// In the browser, route through the local Next.js proxy (/_supabase/*) so
// sandboxed preview environments can reach Supabase without direct internet access.
// On the server, use the real URL directly.
const url =
  typeof window !== 'undefined'
    ? `${window.location.origin}/_supabase`
    : supabaseUrl

export const supabase = createClient(url, supabaseKey)
