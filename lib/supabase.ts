import { createClient } from '@supabase/supabase-js'

// Fallback to placeholder values so the build doesn't throw at module init
// time when env vars aren't available. Real requests will fail gracefully
// at runtime if the vars are genuinely missing.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(url, key)
