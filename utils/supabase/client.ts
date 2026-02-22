'use client'

import { createBrowserClient } from '@supabase/ssr'

// 'use client' ensures Next.js places this module in the client webpack
// layer where NEXT_PUBLIC_* vars are inlined as string literals at build
// time, rather than accessed via a runtime process.env shim (which is
// empty in the browser and breaks createBrowserClient).
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.'
    )
  }

  return createBrowserClient(url, key)
}
