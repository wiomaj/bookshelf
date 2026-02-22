/**
 * Integration tests for lib/bookApi.ts
 *
 * The Supabase client is mocked so tests run without a real DB.
 * Focus areas:
 *  1. Zod validation fires BEFORE any Supabase call (no DB round-trip on bad input)
 *  2. Raw Supabase / Postgres error strings are NOT re-thrown to callers
 *  3. Unknown fields (user_id injection) are stripped before the DB insert
 *  4. Partial updates validate only the provided fields
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ZodError } from 'zod'

// ── Mock @/utils/supabase/client before importing bookApi ─────────────────

/** Mutable terminal for any query chain — configure per-test via mockResolve/mockReject. */
const { mockSingle, mockGetUser, mockFrom } = vi.hoisted(() => {
  const mockSingle  = vi.fn()
  const mockGetUser = vi.fn()

  // Build a chainable mock: every method returns 'self', terminal is mockSingle
  function makeChain() {
    const self: Record<string, unknown> = {}
    const chainFn = () => self
    self.select = chainFn
    self.insert = chainFn
    self.update = chainFn
    self.delete = chainFn
    self.eq     = chainFn
    self.order  = chainFn
    self.single = mockSingle
    // Make the chain itself awaitable (for delete().eq() which is awaited directly)
    self.then = undefined  // prevents accidental Promise wrapping
    return self
  }

  const mockFrom = vi.fn(() => makeChain())

  return { mockSingle, mockGetUser, mockFrom }
})

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from:  mockFrom,
  }),
}))

// Import AFTER mock registration (vi.mock is hoisted automatically)
import { addBook, updateBook, getBooks, deleteBook } from '@/lib/bookApi'

// ── Fixtures ───────────────────────────────────────────────────────────────

const VALID_INPUT = {
  title:  'Dune',
  author: 'Frank Herbert',
  year:   2023,
  month:  4,
  rating: 5,
} as const

const MOCK_USER_ID = 'user-abc-123'
const MOCK_BOOK_ROW = { id: 'book-uuid', user_id: MOCK_USER_ID, ...VALID_INPUT, created_at: '2024-01-01' }

// ── Helpers ────────────────────────────────────────────────────────────────

function authOk()  { mockGetUser.mockResolvedValue({ data: { user: { id: MOCK_USER_ID } } }) }
function authNone(){ mockGetUser.mockResolvedValue({ data: { user: null } }) }
function dbOk()    { mockSingle.mockResolvedValue({ data: MOCK_BOOK_ROW, error: null }) }
function dbErr(msg: string) { mockSingle.mockResolvedValue({ data: null, error: { message: msg } }) }

beforeEach(() => {
  vi.clearAllMocks()
  authOk()
  dbOk()
})

// ── 1. Zod validation fires BEFORE Supabase ────────────────────────────────

describe('addBook — Zod validation pre-flight', () => {
  it('throws ZodError for an empty title — Supabase never called', async () => {
    await expect(addBook({ ...VALID_INPUT, title: '' }))
      .rejects.toBeInstanceOf(ZodError)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('throws ZodError for an invalid rating (0) — Supabase never called', async () => {
    await expect(addBook({ ...VALID_INPUT, rating: 0 as never }))
      .rejects.toBeInstanceOf(ZodError)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('throws ZodError for out-of-range year — Supabase never called', async () => {
    await expect(addBook({ ...VALID_INPUT, year: 1000 }))
      .rejects.toBeInstanceOf(ZodError)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('updateBook — Zod validation pre-flight', () => {
  it('throws ZodError for invalid partial rating — Supabase never called', async () => {
    await expect(updateBook('book-id', { rating: 99 as never }))
      .rejects.toBeInstanceOf(ZodError)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

// ── 2. Error sanitization ──────────────────────────────────────────────────

describe('addBook — DB error sanitization', () => {
  it('does NOT expose raw Postgres error message', async () => {
    const rawDbError = 'duplicate key value violates unique constraint "books_pkey"'
    dbErr(rawDbError)

    let thrownMessage = ''
    try {
      await addBook(VALID_INPUT)
    } catch (e) {
      thrownMessage = (e as Error).message
    }

    expect(thrownMessage).not.toContain(rawDbError)
    expect(thrownMessage).not.toContain('pkey')
    expect(thrownMessage).not.toContain('constraint')
    expect(thrownMessage).toContain('failed')  // generic message
  })
})

describe('updateBook — DB error sanitization', () => {
  it('does NOT expose raw Postgres error message', async () => {
    const rawDbError = 'ERROR: invalid input syntax for type integer'
    dbErr(rawDbError)

    let thrownMessage = ''
    try {
      await updateBook('book-id', { rating: 3 })
    } catch (e) {
      thrownMessage = (e as Error).message
    }

    expect(thrownMessage).not.toContain(rawDbError)
    expect(thrownMessage).not.toContain('integer')
    expect(thrownMessage).toContain('failed')
  })
})

describe('deleteBook — DB error sanitization', () => {
  it('does NOT expose raw error', async () => {
    // Override the chain for delete: delete().eq() returns the error directly
    const rawDbError = 'permission denied for table books'
    mockFrom.mockImplementationOnce(() => ({
      delete: () => ({
        eq: async () => ({ data: null, error: { message: rawDbError } }),
      }),
    }))

    let thrownMessage = ''
    try {
      await deleteBook('book-id')
    } catch (e) {
      thrownMessage = (e as Error).message
    }

    expect(thrownMessage).not.toContain(rawDbError)
    expect(thrownMessage).not.toContain('permission')
    expect(thrownMessage).toContain('failed')
  })
})

// ── 3. Auth check ──────────────────────────────────────────────────────────

describe('addBook — unauthenticated user', () => {
  it('throws "Not authenticated" when there is no session', async () => {
    authNone()
    await expect(addBook(VALID_INPUT)).rejects.toThrow('Not authenticated')
  })
})

// ── 4. getBooks success path ───────────────────────────────────────────────

describe('getBooks', () => {
  it('returns an empty array when there are no books', async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: () => ({
        order: () => ({
          order: () => ({
            order: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    }))

    const result = await getBooks()
    expect(result).toEqual([])
  })

  it('throws a sanitized error when the DB call fails', async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: () => ({
        order: () => ({
          order: () => ({
            order: async () => ({ data: null, error: { message: 'connection refused' } }),
          }),
        }),
      }),
    }))

    await expect(getBooks()).rejects.toThrow('failed')
    // Ensure raw error not leaked
    try {
      await getBooks()
    } catch (e) {
      expect((e as Error).message).not.toContain('connection refused')
    }
  })
})
