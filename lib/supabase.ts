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

// In the browser, route through the local Next.js proxy (/_supabase/*) so
// sandboxed preview environments can reach Supabase without direct internet access.
// On the server, use the real URL directly.
const clientUrl =
  typeof window !== 'undefined'
    ? `${window.location.origin}/_supabase`
    : (url ?? 'https://placeholder.supabase.co')

export const supabase = createClient(
  clientUrl,
  key ?? 'placeholder-anon-key',
  {
    auth: {
      // Implicit flow so password-reset links work across devices/browsers.
      // PKCE requires the code verifier to be in the same browser that
      // initiated the request — which breaks when the email is opened on a
      // different device.
      flowType: 'implicit',
    },
  }
)
