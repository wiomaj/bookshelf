import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normaliseGoogleCover,
  googleCoverFromResponse,
  fetchBookByISBN,
} from '../bookMetadata'

const MOCK_ISBN = '9780451524935' // "Nineteen Eighty-Four" ISBN-13

// ─── normaliseGoogleCover ────────────────────────────────────────────────────

describe('normaliseGoogleCover', () => {
  it('upgrades http: to https:', () => {
    expect(normaliseGoogleCover('http://books.google.com/c.jpg')).toMatch(/^https:/)
  })

  it('replaces zoom=N with zoom=0', () => {
    const result = normaliseGoogleCover('https://books.google.com/c.jpg?zoom=5')
    expect(result).toContain('zoom=0')
    expect(result).not.toMatch(/zoom=[1-9]/)
  })

  it('removes an existing &fife= param before appending &fife=w600', () => {
    const result = normaliseGoogleCover('https://books.google.com/c.jpg?zoom=1&fife=w128')
    expect(result).not.toContain('fife=w128')
    expect(result).toContain('&fife=w600')
    // Exactly one fife param
    expect((result.match(/fife=/g) ?? []).length).toBe(1)
  })

  it('applies all transforms together', () => {
    const raw = 'http://books.google.com/c.jpg?zoom=5&edge=curl&fife=w200'
    const result = normaliseGoogleCover(raw)
    expect(result).toMatch(/^https:/)
    expect(result).toContain('zoom=0')
    expect(result).not.toContain('fife=w200')
    expect(result).toContain('&fife=w600')
  })

  it('handles a URL that already has no zoom or fife', () => {
    const result = normaliseGoogleCover('https://books.google.com/c.jpg')
    expect(result).toBe('https://books.google.com/c.jpg&fife=w600')
  })
})

// ─── googleCoverFromResponse ─────────────────────────────────────────────────

describe('googleCoverFromResponse', () => {
  it('returns undefined for null input', () => {
    expect(googleCoverFromResponse(null)).toBeUndefined()
  })

  it('returns undefined when items is an empty array', () => {
    expect(googleCoverFromResponse({ items: [] })).toBeUndefined()
  })

  it('returns undefined when volumeInfo has no imageLinks', () => {
    expect(googleCoverFromResponse({ items: [{ volumeInfo: {} }] })).toBeUndefined()
  })

  it('prefers extraLarge over lower-res variants', () => {
    const data = {
      items: [{
        volumeInfo: {
          imageLinks: {
            thumbnail:  'http://example.com/thumb.jpg?zoom=1',
            extraLarge: 'http://example.com/xl.jpg?zoom=1',
          },
        },
      }],
    }
    expect(googleCoverFromResponse(data)).toContain('xl.jpg')
  })

  it('falls back to medium when extraLarge and large are absent', () => {
    const data = {
      items: [{
        volumeInfo: {
          imageLinks: {
            thumbnail: 'http://example.com/thumb.jpg?zoom=1',
            medium:    'http://example.com/med.jpg?zoom=1',
          },
        },
      }],
    }
    expect(googleCoverFromResponse(data)).toContain('med.jpg')
  })

  it('normalises the chosen URL (https, zoom=0, fife=w600)', () => {
    const data = {
      items: [{
        volumeInfo: {
          imageLinks: { thumbnail: 'http://example.com/thumb.jpg?zoom=1' },
        },
      }],
    }
    const result = googleCoverFromResponse(data)
    expect(result).toMatch(/^https:/)
    expect(result).toContain('zoom=0')
    expect(result).toContain('&fife=w600')
  })
})

// ─── fetchBookByISBN ─────────────────────────────────────────────────────────

describe('fetchBookByISBN', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns title, author and normalised cover from Google Books when all fields present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{
          volumeInfo: {
            title:       'Nineteen Eighty-Four',
            authors:     ['George Orwell'],
            imageLinks:  { thumbnail: 'http://books.google.com/c.jpg?zoom=1' },
          },
        }],
      }),
    }))

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Nineteen Eighty-Four')
    expect(result!.author).toBe('George Orwell')
    // Cover must be normalised — https, zoom=0, fife=w600
    expect(result!.cover_url).toMatch(/^https:/)
    expect(result!.cover_url).toContain('zoom=0')
    expect(result!.cover_url).toContain('&fife=w600')
  })

  it('falls back to OpenLibrary cover when Google Books has no imageLinks', async () => {
    const mockFetch = vi.fn()
    // Call 1 — Google Books: item found, but no imageLinks
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{
          volumeInfo: { title: 'Nineteen Eighty-Four', authors: ['George Orwell'] },
        }],
      }),
    })
    // Call 2 — OpenLibrary Books API: has cover
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        [`ISBN:${MOCK_ISBN}`]: {
          title:   'Nineteen Eighty-Four',
          authors: [{ name: 'George Orwell' }],
          cover:   { large: 'https://covers.openlibrary.org/b/id/8575741-L.jpg' },
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result).not.toBeNull()
    expect(result!.cover_url).toContain('openlibrary.org')
    expect(result!.title).toBe('Nineteen Eighty-Four')
  })

  it('uses OpenLibrary for title + author + cover when Google Books has no items', async () => {
    const mockFetch = vi.fn()
    // Call 1 — Google Books: empty
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: undefined }) })
    // Call 2 — OpenLibrary: full data
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        [`ISBN:${MOCK_ISBN}`]: {
          title:   'Nineteen Eighty-Four',
          authors: [{ name: 'George Orwell' }],
          cover:   { large: 'https://covers.openlibrary.org/b/id/8575741-L.jpg' },
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Nineteen Eighty-Four')
    expect(result!.cover_url).toContain('openlibrary.org')
  })

  it('returns null when both sources return nothing', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: undefined }) })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result).toBeNull()
  })

  it('still returns OpenLibrary data when Google Books fetch throws a network error', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        [`ISBN:${MOCK_ISBN}`]: {
          title:   'Nineteen Eighty-Four',
          authors: [{ name: 'George Orwell' }],
          cover:   { medium: 'https://covers.openlibrary.org/b/id/8575741-M.jpg' },
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Nineteen Eighty-Four')
    expect(result!.cover_url).toContain('openlibrary.org')
  })

  it('uses medium cover from OpenLibrary when large is absent', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        [`ISBN:${MOCK_ISBN}`]: {
          title:   'Some Book',
          authors: [{ name: 'Some Author' }],
          // Only medium — no large
          cover:   { medium: 'https://covers.openlibrary.org/b/id/999-M.jpg' },
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result!.cover_url).toContain('-M.jpg')
  })

  // ── Regression test ─────────────────────────────────────────────────────────
  it('REGRESSION: ISBN scan cover is present in the returned suggestion when Google Books has no imageLinks', async () => {
    // This is the exact failure mode that triggered this fix:
    // Google Books returns the book but omits imageLinks → ISBNScanner used to
    // return cover_url: undefined → no cover shown after scanning.
    const mockFetch = vi.fn()
    // Google Books: item present, imageLinks absent
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{
          volumeInfo: {
            title:   'An Old Classic',
            authors: ['Classic Author'],
            // imageLinks deliberately absent — this is the bug trigger
          },
        }],
      }),
    })
    // OpenLibrary: provides the cover
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        [`ISBN:${MOCK_ISBN}`]: {
          title:   'An Old Classic',
          authors: [{ name: 'Classic Author' }],
          cover:   { large: 'https://covers.openlibrary.org/b/id/11111-L.jpg' },
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const suggestion = await fetchBookByISBN(MOCK_ISBN)

    // The core regression assertion: cover_url MUST be defined
    expect(suggestion?.cover_url).toBeDefined()
    expect(suggestion?.cover_url).toContain('openlibrary.org')
  })
})
