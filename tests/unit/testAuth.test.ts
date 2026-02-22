/**
 * Unit tests for app/api/test-auth/route.ts
 *
 * Critical security invariant: this endpoint MUST return 404 whenever
 * TEST_AUTH is not explicitly "true".  This test locks that gate so a
 * misconfigured production deploy cannot accidentally expose the endpoint.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock next/headers and next/server ──────────────────────────────────────
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => [],
    set:    vi.fn(),
  }),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      _body:  body,
      async json() { return body },
    }),
  },
}))

// Mock @supabase/ssr so we don't need a real Supabase instance
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data:  { session: { access_token: 'tok' }, user: { id: 'u1' } },
        error: null,
      }),
    },
  }),
}))

// Lazy import AFTER all mocks are registered
const { POST } = await import('@/app/api/test-auth/route')

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(user = 'a') {
  return new Request(`http://localhost/api/test-auth?user=${user}`, { method: 'POST' })
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('test-auth endpoint — production safety gate', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Reset relevant env vars before each test
    delete process.env.TEST_AUTH
    delete process.env.TEST_USER_A_EMAIL
    delete process.env.TEST_USER_A_PASSWORD
    delete process.env.TEST_USER_B_EMAIL
    delete process.env.TEST_USER_B_PASSWORD
  })

  afterEach(() => {
    // Restore original env
    Object.assign(process.env, originalEnv)
  })

  it('returns 404 when TEST_AUTH is not set (default production state)', async () => {
    const res = await POST(makeRequest())
    expect(res.status).toBe(404)
  })

  it('returns 404 when TEST_AUTH=false', async () => {
    process.env.TEST_AUTH = 'false'
    const res = await POST(makeRequest())
    expect(res.status).toBe(404)
  })

  it('returns 404 when TEST_AUTH=1 (wrong value)', async () => {
    process.env.TEST_AUTH = '1'
    const res = await POST(makeRequest())
    expect(res.status).toBe(404)
  })

  it('returns 404 when TEST_AUTH=TRUE (wrong case)', async () => {
    process.env.TEST_AUTH = 'TRUE'
    const res = await POST(makeRequest())
    expect(res.status).toBe(404)
  })

  it('returns 500 when TEST_AUTH=true but credentials are missing', async () => {
    process.env.TEST_AUTH = 'true'
    // Credentials not set → should fail gracefully
    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
  })

  it('returns 200 when TEST_AUTH=true and credentials are set', async () => {
    process.env.TEST_AUTH         = 'true'
    process.env.TEST_USER_A_EMAIL = 'test@example.com'
    process.env.TEST_USER_A_PASSWORD = 'password'
    const res = await POST(makeRequest('a'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('selects user B credentials when ?user=b is passed', async () => {
    process.env.TEST_AUTH         = 'true'
    process.env.TEST_USER_B_EMAIL = 'testb@example.com'
    process.env.TEST_USER_B_PASSWORD = 'passwordB'
    const res = await POST(makeRequest('b'))
    expect(res.status).toBe(200)
  })
})
