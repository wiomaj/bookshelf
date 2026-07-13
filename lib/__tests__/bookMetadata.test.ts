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
// Server-backed: call 1 hits /api/books/search?q=isbn:… (Supabase cache +
// Open Library + Google Books merged server-side); call 2 falls back to
// /api/isbn (Google Books → DNB) for German/Austrian/Swiss books.

/** Helper: mock /api/books/search response ({ results: BookMetadata[] }) */
function searchResponse(results: Array<Record<string, unknown>>) {
  return { ok: true, json: async () => ({ results, hasMore: false }) }
}

/** Helper: mock /api/isbn response ({ result: IsbnResult | null }) */
function isbnResponse(result: Record<string, unknown> | null) {
  return { ok: true, json: async () => ({ result }) }
}

describe('fetchBookByISBN', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns title, author and cover from the server search route', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(searchResponse([{
      title: 'Nineteen Eighty-Four',
      authors: ['George Orwell'],
      coverUrl: 'https://books.google.com/c.jpg?zoom=1',
      isbn13: MOCK_ISBN,
    }]))
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Nineteen Eighty-Four')
    expect(result!.author).toBe('George Orwell')
    expect(result!.cover_url).toBe('https://books.google.com/c.jpg?zoom=1')
  })

  it('queries the search route with an isbn: prefixed query', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(searchResponse([{
      title: 'Nineteen Eighty-Four',
      authors: ['George Orwell'],
    }]))
    vi.stubGlobal('fetch', mockFetch)

    await fetchBookByISBN(MOCK_ISBN)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(String(mockFetch.mock.calls[0][0])).toContain(`/api/books/search?q=isbn:${MOCK_ISBN}`)
  })

  it('does NOT call the DNB fallback when the search route finds the book', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(searchResponse([{
      title: 'Nineteen Eighty-Four',
      authors: ['George Orwell'],
      coverUrl: 'https://covers.openlibrary.org/b/id/8575741-L.jpg',
    }]))
    vi.stubGlobal('fetch', mockFetch)

    await fetchBookByISBN(MOCK_ISBN)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('handles a result without a cover (cover_url stays undefined)', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(searchResponse([{
      title: 'Some Book',
      authors: ['Author'],
      coverUrl: null,
    }]))
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result).not.toBeNull()
    expect(result!.cover_url).toBeUndefined()
  })

  it('falls back to /api/isbn (DNB) when the search route returns no results', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(searchResponse([]))
    mockFetch.mockResolvedValueOnce(isbnResponse({
      title: 'Fühl dich wohl in deinem Zuhause',
      author: 'Frida Ramstedt',
      cover_url: 'https://books.google.com/c.jpg?zoom=1',
    }))
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN('9783442484027')
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Fühl dich wohl in deinem Zuhause')
    expect(result!.author).toBe('Frida Ramstedt')
    expect(result!.cover_url).toContain('books.google.com')
    expect(String(mockFetch.mock.calls[1][0])).toContain('/api/isbn?isbn=')
  })

  it('falls back to /api/isbn when the search route throws a network error', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    mockFetch.mockResolvedValueOnce(isbnResponse({
      title: 'Nineteen Eighty-Four',
      author: 'George Orwell',
    }))
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Nineteen Eighty-Four')
  })

  it('returns null when both routes return nothing', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(searchResponse([]))
    mockFetch.mockResolvedValueOnce(isbnResponse(null))
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result).toBeNull()
  })

  it('returns null when both routes are unreachable', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result).toBeNull()
  })
})
