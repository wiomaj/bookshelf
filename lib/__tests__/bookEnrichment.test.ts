import { describe, it, expect } from 'vitest'
import {
  normaliseKey,
  suggestionMatches,
  genreFromSubjects,
  enrichmentFromSuggestion,
  hasStoredMetadata,
  enrichmentPatch,
  MAX_STORED_SUBJECTS,
} from '../bookEnrichment'
import type { BookSuggestion } from '../bookSearch'
import type { Book } from '@/types/book'

const PIRANESI: BookSuggestion = {
  title: 'Piranesi',
  author: 'Susanna Clarke',
  isbn13: '9781635575637',
  pageCount: 245,
  publishedDate: '2020-09-15',
  publisher: 'Bloomsbury',
  subjects: ['Fiction', 'Fantasy', 'Magical realism'],
}

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: 'b1',
    user_id: 'u1',
    title: 'Piranesi',
    author: 'Susanna Clarke',
    year: 2024,
    month: 3,
    rating: 5,
    created_at: '2024-03-02T10:00:00.000Z',
    ...overrides,
  }
}

// ─── normaliseKey ────────────────────────────────────────────────────────────

describe('normaliseKey', () => {
  it('lowercases, strips punctuation and collapses whitespace', () => {
    expect(normaliseKey('  The Left Hand   of Darkness! ')).toBe('the left hand of darkness')
  })

  it('reduces a string with no alphanumerics to empty', () => {
    expect(normaliseKey('—:—')).toBe('')
  })
})

// ─── suggestionMatches ───────────────────────────────────────────────────────

describe('suggestionMatches', () => {
  it('matches an untouched selection', () => {
    expect(suggestionMatches(PIRANESI, 'Piranesi', 'Susanna Clarke')).toBe(true)
  })

  it('ignores case and punctuation differences', () => {
    expect(suggestionMatches(PIRANESI, 'piranesi.', 'susanna clarke')).toBe(true)
  })

  it('matches when the user trims a subtitle', () => {
    const s = { ...PIRANESI, title: 'Piranesi: A Novel' }
    expect(suggestionMatches(s, 'Piranesi', 'Susanna Clarke')).toBe(true)
  })

  it('rejects a title the user replaced entirely', () => {
    expect(suggestionMatches(PIRANESI, 'Jonathan Strange & Mr Norrell', 'Susanna Clarke')).toBe(false)
  })

  it('rejects a different author on the same title', () => {
    expect(suggestionMatches(PIRANESI, 'Piranesi', 'Giovanni Battista Piranesi')).toBe(false)
  })

  it('accepts an author differing only in initials and middle names', () => {
    const s = { ...PIRANESI, title: 'A Wizard of Earthsea', author: 'Ursula K. Le Guin' }
    expect(suggestionMatches(s, 'A Wizard of Earthsea', 'Ursula Le Guin')).toBe(true)
  })

  it('accepts on title alone when one side has no author', () => {
    const s = { ...PIRANESI, author: '' }
    expect(suggestionMatches(s, 'Piranesi', 'Susanna Clarke')).toBe(true)
    expect(suggestionMatches(PIRANESI, 'Piranesi', '')).toBe(true)
  })

  it('does not prefix-match very short titles', () => {
    const s: BookSuggestion = { title: 'It', author: 'Stephen King' }
    expect(suggestionMatches(s, 'It Ends With Us', 'Stephen King')).toBe(false)
  })

  it('rejects an empty title on either side', () => {
    expect(suggestionMatches({ title: '', author: '' }, 'Piranesi', 'Susanna Clarke')).toBe(false)
    expect(suggestionMatches(PIRANESI, '', '')).toBe(false)
  })
})

// ─── genreFromSubjects ───────────────────────────────────────────────────────

describe('genreFromSubjects', () => {
  it('skips generic subjects in favour of a specific one', () => {
    expect(genreFromSubjects(['Fiction', 'General', 'Fantasy'])).toBe('Fantasy')
  })

  it('falls back to the first subject when all are generic', () => {
    expect(genreFromSubjects(['Fiction', 'General'])).toBe('Fiction')
  })

  it('returns undefined for no usable subjects', () => {
    expect(genreFromSubjects([])).toBeUndefined()
    expect(genreFromSubjects(null)).toBeUndefined()
    expect(genreFromSubjects(['  ', ''])).toBeUndefined()
  })
})

// ─── enrichmentFromSuggestion ────────────────────────────────────────────────

describe('enrichmentFromSuggestion', () => {
  it('extracts every stored column from a matching suggestion', () => {
    expect(enrichmentFromSuggestion(PIRANESI, 'Piranesi', 'Susanna Clarke')).toEqual({
      isbn13: '9781635575637',
      page_count: 245,
      published_date: '2020-09-15',
      publisher: 'Bloomsbury',
      subjects: ['Fiction', 'Fantasy', 'Magical realism'],
      genre: 'Fantasy',
    })
  })

  it('returns an empty object for no suggestion', () => {
    expect(enrichmentFromSuggestion(null, 'Piranesi', 'Susanna Clarke')).toEqual({})
    expect(enrichmentFromSuggestion(undefined, 'Piranesi', 'Susanna Clarke')).toEqual({})
  })

  it('returns an empty object when the suggestion no longer matches', () => {
    expect(enrichmentFromSuggestion(PIRANESI, 'Some Other Book', 'Susanna Clarke')).toEqual({})
  })

  it('omits keys rather than setting them undefined, so spreads never clear columns', () => {
    const sparse: BookSuggestion = { title: 'Piranesi', author: 'Susanna Clarke' }
    const result = enrichmentFromSuggestion(sparse, 'Piranesi', 'Susanna Clarke')
    expect(result).toEqual({})
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('drops an ISBN that is not 13 digits', () => {
    const s = { ...PIRANESI, isbn13: '0451524934' }
    expect(enrichmentFromSuggestion(s, 'Piranesi', 'Susanna Clarke').isbn13).toBeUndefined()
  })

  it('strips separators from an ISBN', () => {
    const s = { ...PIRANESI, isbn13: '978-1-63557-563-7' }
    expect(enrichmentFromSuggestion(s, 'Piranesi', 'Susanna Clarke').isbn13).toBe('9781635575637')
  })

  it('ignores a zero or negative page count', () => {
    const s = { ...PIRANESI, pageCount: 0 }
    expect(enrichmentFromSuggestion(s, 'Piranesi', 'Susanna Clarke').page_count).toBeUndefined()
  })

  it(`caps subjects at ${MAX_STORED_SUBJECTS} and trims them`, () => {
    const s = { ...PIRANESI, subjects: [' Fantasy ', ...Array.from({ length: 12 }, (_, i) => `S${i}`)] }
    const result = enrichmentFromSuggestion(s, 'Piranesi', 'Susanna Clarke')
    expect(result.subjects).toHaveLength(MAX_STORED_SUBJECTS)
    expect(result.subjects?.[0]).toBe('Fantasy')
  })
})

// ─── hasStoredMetadata ───────────────────────────────────────────────────────

describe('hasStoredMetadata', () => {
  it('is true once an ISBN or subjects are stored', () => {
    expect(hasStoredMetadata(book({ isbn13: '9781635575637' }))).toBe(true)
    expect(hasStoredMetadata(book({ subjects: ['Fantasy'] }))).toBe(true)
  })

  it('is false for a book with neither', () => {
    expect(hasStoredMetadata(book())).toBe(false)
    expect(hasStoredMetadata(book({ isbn13: null, subjects: [] }))).toBe(false)
  })
})

// ─── enrichmentPatch ─────────────────────────────────────────────────────────

describe('enrichmentPatch', () => {
  const full = enrichmentFromSuggestion(PIRANESI, 'Piranesi', 'Susanna Clarke')

  it('fills every missing column', () => {
    expect(enrichmentPatch(book(), full)).toEqual(full)
  })

  it('never overwrites a value already on the book', () => {
    const existing = book({ genre: 'Slipstream', page_count: 300 })
    const patch = enrichmentPatch(existing, full)
    expect(patch.genre).toBeUndefined()
    expect(patch.page_count).toBeUndefined()
    expect(patch.isbn13).toBe('9781635575637')
  })

  it('is empty when the book is fully populated, so callers can skip the write', () => {
    const existing = book({
      isbn13: '9781635575637',
      page_count: 245,
      published_date: '2020-09-15',
      publisher: 'Bloomsbury',
      subjects: ['Fantasy'],
      genre: 'Fantasy',
    })
    expect(enrichmentPatch(existing, full)).toEqual({})
  })

  it('treats an empty subjects array as missing', () => {
    expect(enrichmentPatch(book({ subjects: [] }), full).subjects).toEqual(full.subjects)
  })

  it('is empty when there is nothing to apply', () => {
    expect(enrichmentPatch(book(), {})).toEqual({})
  })
})
