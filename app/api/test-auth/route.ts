/**
 * Test-only authentication endpoint.
 *
 * SECURITY CONTRACT:
 *  - Returns HTTP 404 unless the env var TEST_AUTH=true is explicitly set.
 *  - TEST_AUTH is NEVER set to "true" in production deployments.
 *  - This endpoint must NEVER be reachable in production.
 *
 * Purpose: allows Playwright e2e tests to obtain a real Supabase session via
 * email+password without depending on the Google OAuth browser flow that
 * cannot run reliably in CI.
 *
 * Required env vars (set in CI secrets only):
 *   TEST_AUTH=true
 *   TEST_USER_A_EMAIL / TEST_USER_A_PASSWORD  — primary test user
 *   TEST_USER_B_EMAIL / TEST_USER_B_PASSWORD  — secondary test user (IDOR tests)
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // ── Hard gate ────────────────────────────────────────────────────────────
  if (process.env.TEST_AUTH !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Which test user? Default to "a"; pass ?user=b for the second user.
  const { searchParams } = new URL(request.url)
  const userSlot = searchParams.get('user') === 'b' ? 'B' : 'A'

  const email    = process.env[`TEST_USER_${userSlot}_EMAIL`]
  const password = process.env[`TEST_USER_${userSlot}_PASSWORD`]

  if (!email || !password) {
    return NextResponse.json(
      { error: `Missing TEST_USER_${userSlot}_EMAIL or TEST_USER_${userSlot}_PASSWORD` },
      { status: 500 }
    )
  }

  // ── Sign in via Supabase email+password ──────────────────────────────────
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(list) {
          list.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options) } catch { /* Server Component ctx */ }
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    return NextResponse.json({ error: 'Sign-in failed' }, { status: 401 })
  }

  return NextResponse.json({ ok: true, userId: data.user.id })
}
