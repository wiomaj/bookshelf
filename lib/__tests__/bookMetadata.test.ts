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
// OpenLibrary fallback uses the Search API (/search.json?q={isbn}) — same
// endpoint used by the manual title-search flow — NOT the Books API.
// OL Search API response shape: { docs: [{ title, author_name, cover_i, … }] }

/** Helper: build a mock OL Search API response for a single doc */
function olSearchResponse(doc: Record<string, unknown>) {
  return { ok: true, json: async () => ({ docs: [doc] }) }
}

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
            title:      'Nineteen Eighty-Four',
            authors:    ['George Orwell'],
            imageLinks: { thumbnail: 'http://books.google.com/c.jpg?zoom=1' },
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

  it('does NOT call OpenLibrary when Google Books already has a cover', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{
          volumeInfo: {
            title:      'Nineteen Eighty-Four',
            authors:    ['George Orwell'],
            imageLinks: { thumbnail: 'http://books.google.com/c.jpg?zoom=1' },
          },
        }],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await fetchBookByISBN(MOCK_ISBN)
    expect(mockFetch).toHaveBeenCalledTimes(1) // only Google Books
  })

  it('falls back to OpenLibrary Search API cover when Google Books has no imageLinks', async () => {
    const mockFetch = vi.fn()
    // Call 1 — Google Books: item found, but no imageLinks
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ volumeInfo: { title: 'Nineteen Eighty-Four', authors: ['George Orwell'] } }],
      }),
    })
    // Call 2 — OpenLibrary Search API: cover_i present
    mockFetch.mockResolvedValueOnce(
      olSearchResponse({ title: 'Nineteen Eighty-Four', author_name: ['George Orwell'], cover_i: 8575741 })
    )
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result).not.toBeNull()
    expect(result!.cover_url).toBe('https://covers.openlibrary.org/b/id/8575741-L.jpg')
    expect(result!.title).toBe('Nineteen Eighty-Four')
  })

  it('falls back to cover_edition_key when cover_i is absent', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
    mockFetch.mockResolvedValueOnce(
      olSearchResponse({ title: 'Some Book', author_name: ['Author'], cover_edition_key: 'OL12345M' })
    )
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result!.cover_url).toContain('/olid/OL12345M-L.jpg')
  })

  it('falls back to first ISBN cover URL when cover_i and cover_edition_key are absent', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
    mockFetch.mockResolvedValueOnce(
      olSearchResponse({ title: 'Some Book', author_name: ['Author'], isbn: ['9780451524935', '0451524934'] })
    )
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result!.cover_url).toContain('/isbn/9780451524935-L.jpg')
  })

  it('uses OpenLibrary for title + author + cover when Google Books has no items', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: undefined }) })
    mockFetch.mockResolvedValueOnce(
      olSearchResponse({ title: 'Nineteen Eighty-Four', author_name: ['George Orwell'], cover_i: 8575741 })
    )
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Nineteen Eighty-Four')
    expect(result!.cover_url).toContain('/id/8575741-L.jpg')
  })

  it('returns null when both sources return nothing', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: undefined }) })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ docs: [] }) })
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result).toBeNull()
  })

  it('still tries OpenLibrary when Google Books fetch throws a network error', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    mockFetch.mockResolvedValueOnce(
      olSearchResponse({ title: 'Nineteen Eighty-Four', author_name: ['George Orwell'], cover_i: 8575741 })
    )
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchBookByISBN(MOCK_ISBN)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Nineteen Eighty-Four')
    expect(result!.cover_url).toContain('openlibrary.org')
  })

  // ── Regression test ─────────────────────────────────────────────────────────
  it('REGRESSION: ISBN scan cover is present when Google Books omits imageLinks', async () => {
    // The original bug: Google Books returns book metadata but no imageLinks.
    // The old Books API fallback often returned empty {} for the same ISBN.
    // The new Search API fallback reliably returns cover_i for most books.
    const mockFetch = vi.fn()
    // Google Books: item present, imageLinks absent (the bug trigger)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{
          volumeInfo: {
            title: 'Fühl dich wohl in deinem Zuhause',
            authors: ['Frida Ramstedt'],
            // imageLinks deliberately absent
          },
        }],
      }),
    })
    // OpenLibrary Search API: has cover_i (what the Books API was missing)
    mockFetch.mockResolvedValueOnce(
      olSearchResponse({
        title: 'Fühl dich wohl in deinem Zuhause',
        author_name: ['Frida Ramstedt'],
        cover_i: 12345678,
      })
    )
    vi.stubGlobal('fetch', mockFetch)

    const suggestion = await fetchBookByISBN('9783442484027')

    // Core regression assertion: cover_url MUST be defined
    expect(suggestion?.cover_url).toBeDefined()
    expect(suggestion?.cover_url).toBe('https://covers.openlibrary.org/b/id/12345678-L.jpg')
  })
})
