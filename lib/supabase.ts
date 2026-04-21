import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Warn loudly during server-side initialisation so a missing env var is never
// silently swallowed. The placeholders keep the module from throwing at build
// time; actual requests will fail with a clear Supabase error at runtime.
if (!url || !key) {
  if (typeof window === 'undefined') {
    console.warn(
      '[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
      'Copy .env.local.example to .env.local and fill in your project credentials.'
    )
  }
}

export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  key ?? 'placeholder-anon-key'
)
