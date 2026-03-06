/**
 * lib/__tests__/search.test.ts
 *
 * Unit tests for the book search pipeline.
 * Uses Vitest and mocks provider calls so no real HTTP requests are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── normalize.ts ──────────────────────────────────────────────────────────────

import {
  normalizeText,
  normalizeGerman,
  normalizeAuthor,
  expandUmlauts,
  hasUmlauts,
  foldAccents,
  tokenize,
  tokenOverlapRatio,
  looksGerman,
} from '../search/normalize'

describe('normalizeText', () => {
  it('lowercases input', () => {
    expect(normalizeText('Hello World')).toBe('hello world')
  })

  it('trims and collapses whitespace', () => {
    expect(normalizeText('  foo   bar  ')).toBe('foo bar')
  })

  it('removes punctuation', () => {
    expect(normalizeText("It's a test!")).toBe('its a test')
  })

  it('folds accents', () => {
    expect(normalizeText('résumé')).toBe('resume')
  })
})

describe('expandUmlauts', () => {
  it('expands ä → ae, ö → oe, ü → ue, ß → ss (digraphs are always lowercase)', () => {
    // Umlaut chars become lowercase digraphs; surrounding chars keep their case
    expect(expandUmlauts('Über')).toBe('ueber')   // Ü→ue + ber
    expect(expandUmlauts('Öl')).toBe('oel')        // Ö→oe + l
    expect(expandUmlauts('Müller')).toBe('Mueller') // M + ü→ue + ller
    expect(expandUmlauts('Straße')).toBe('Strasse')
  })
})

describe('hasUmlauts', () => {
  it('returns true for strings with German umlauts', () => {
    expect(hasUmlauts('Über den Wolken')).toBe(true)
    expect(hasUmlauts('Müller')).toBe(true)
    expect(hasUmlauts('normal')).toBe(false)
  })
})

describe('foldAccents', () => {
  it('removes combining diacritics without expanding umlauts', () => {
    expect(foldAccents('résumé')).toBe('resume')
    // German umlauts are precomposed — foldAccents does NOT expand them
    // (that's expandUmlauts' job)
    expect(foldAccents('Über')).toBe('Uber')
  })
})

describe('normalizeGerman', () => {
  it('expands umlauts AND lowercases', () => {
    expect(normalizeGerman('Über den Wolken')).toBe('ueber den wolken')
    expect(normalizeGerman('Müller')).toBe('mueller')
  })
})

describe('normalizeAuthor', () => {
  it('handles normal name', () => {
    expect(normalizeAuthor('Frank Herbert')).toBe('frank herbert')
  })

  it('inverts "Lastname, Firstname" format', () => {
    expect(normalizeAuthor('Herbert, Frank')).toBe('frank herbert')
  })

  it('handles compound last names', () => {
    expect(normalizeAuthor('García Márquez, Gabriel')).toBe('gabriel garcia marquez')
  })
})

describe('tokenize', () => {
  it('splits on spaces and filters stop words', () => {
    const tokens = tokenize('the lord of the rings')
    expect(tokens).not.toContain('the')
    expect(tokens).not.toContain('of')
    expect(tokens).toContain('lord')
    expect(tokens).toContain('rings')
  })

  it('filters very short tokens', () => {
    expect(tokenize('a b cd ef')).not.toContain('b')
    expect(tokenize('a b cd ef')).toContain('cd')
    expect(tokenize('a b cd ef')).toContain('ef')
  })
})

describe('tokenOverlapRatio', () => {
  it('returns 1 for identical token sets', () => {
    expect(tokenOverlapRatio(['dune', 'herbert'], ['dune', 'herbert'])).toBe(1)
  })

  it('returns partial overlap', () => {
    expect(tokenOverlapRatio(['dune', 'messiah'], ['dune'])).toBe(0.5)
  })

  it('returns 0 when queryTokens is empty', () => {
    expect(tokenOverlapRatio([], ['dune'])).toBe(0)
  })
})

describe('looksGerman', () => {
  it('detects umlauts', () => {
    expect(looksGerman('Über den Wolken')).toBe(true)
  })

  it('detects German signal words', () => {
    expect(looksGerman('der kleine Prinz')).toBe(true)
    expect(looksGerman('die Verwandlung')).toBe(true)
  })

  it('returns false for English', () => {
    expect(looksGerman('lord of the rings')).toBe(false)
  })
})

// ── queryAnalysis.ts ──────────────────────────────────────────────────────────

import { analyzeQuery, buildProviderQuery, buildOpenLibraryParams } from '../search/queryAnalysis'

describe('analyzeQuery', () => {
  it('returns ambiguous for empty string', () => {
    expect(analyzeQuery('')).toMatchObject({ type: 'ambiguous', titleTokens: [], authorTokens: [] })
  })

  it('classifies explicit separator "by" as title+author', () => {
    const result = analyzeQuery('Dune by Frank Herbert')
    expect(result.type).toBe('title+author')
    expect(result.titleTokens).toContain('dune')
    expect(result.authorTokens).toContain('frank')
    expect(result.authorTokens).toContain('herbert')
  })

  it('classifies explicit separator " - " as title+author', () => {
    const result = analyzeQuery('Der Prozess - Franz Kafka')
    expect(result.type).toBe('title+author')
  })

  it('classifies two proper-noun words as author', () => {
    const result = analyzeQuery('Frank Herbert')
    expect(result.type).toBe('author')
    expect(result.authorTokens).toContain('frank')
    expect(result.authorTokens).toContain('herbert')
  })

  it('classifies "the lord of the rings" as title (contains article)', () => {
    const result = analyzeQuery('the lord of the rings')
    expect(result.type).toBe('title')
  })

  it('classifies "Dune Frank Herbert" as title+author (proper name at end)', () => {
    const result = analyzeQuery('Dune Frank Herbert')
    expect(result.type).toBe('title+author')
    expect(result.titleTokens).toContain('dune')
  })

  it('detects German queries', () => {
    const result = analyzeQuery('der kleine Prinz')
    expect(result.likelyGerman).toBe(true)
  })

  it('detects umlauts', () => {
    const result = analyzeQuery('Über den Wolken')
    expect(result.hasUmlauts).toBe(true)
    expect(result.likelyGerman).toBe(true)
  })
})

describe('buildProviderQuery', () => {
  it('builds Google Books author query', () => {
    const analysis = analyzeQuery('Frank Herbert')
    const q = buildProviderQuery(analysis, 'googlebooks')
    expect(q).toContain('inauthor:')
  })

  it('builds Google Books title+author query', () => {
    const analysis = analyzeQuery('Dune by Frank Herbert')
    const q = buildProviderQuery(analysis, 'googlebooks')
    expect(q).toContain('intitle:')
    expect(q).toContain('inauthor:')
  })
})

describe('buildOpenLibraryParams', () => {
  it('returns title and author for title+author query', () => {
    const analysis = analyzeQuery('Dune by Frank Herbert')
    const params = buildOpenLibraryParams(analysis)
    expect(params.title).toBeTruthy()
    expect(params.author).toBeTruthy()
    expect(params.q).toBeUndefined()
  })

  it('returns q for author-only query', () => {
    const analysis = analyzeQuery('Frank Herbert')
    const params = buildOpenLibraryParams(analysis)
    expect(params.q).toBeTruthy()
  })
})

// ── score.ts ──────────────────────────────────────────────────────────────────

import { scoreResult } from '../search/score'
import type { BookSearchResult, QueryAnalysis } from '../search/types'

function makeResult(overrides: Partial<BookSearchResult> = {}): BookSearchResult {
  return {
    id: 'test:1',
    source: 'openlibrary',
    sourceIds: { openlibrary: '/works/OL1234W' },
    title: 'Dune',
    authors: ['Frank Herbert'],
    normalizedTitle: 'dune',
    normalizedAuthors: ['frank herbert'],
    canonicalGroupKey: 'dune::frank herbert',
    score: 0,
    confidence: 'weak',
    ...overrides,
  }
}

describe('scoreResult', () => {
  it('gives high score for exact title match', () => {
    const analysis = analyzeQuery('Dune')
    const result = makeResult()
    scoreResult(result, analysis)
    expect(result.score).toBeGreaterThan(100)
  })

  it('gives higher score for title+author match than title-only', () => {
    const analysis = analyzeQuery('Dune by Frank Herbert')
    const resultWithAuthor = makeResult()
    const resultNoAuthor = makeResult({ authors: ['Someone Else'], normalizedAuthors: ['someone else'] })

    scoreResult(resultWithAuthor, analysis)
    scoreResult(resultNoAuthor, analysis)

    expect(resultWithAuthor.score).toBeGreaterThan(resultNoAuthor.score)
  })

  it('adds metadata quality boosts', () => {
    const analysis = analyzeQuery('Dune')
    const rich = makeResult({ isbn13: ['9780441013593'], coverImageUrl: 'https://example.com/cover.jpg', publishedYear: 1965 })
    const bare = makeResult()

    scoreResult(rich, analysis)
    scoreResult(bare, analysis)

    expect(rich.score).toBeGreaterThan(bare.score)
  })

  it('assigns at least medium confidence for a matched title with metadata', () => {
    const analysis = analyzeQuery('Dune')
    const result = makeResult({
      isbn13: ['9780441013593'],
      coverImageUrl: 'https://example.com/cover.jpg',
      publishedYear: 1965,
      publisher: 'Chilton Books',
    })
    scoreResult(result, analysis)
    // titleExact(120) + isbn13(12) + cover(8) + year(3) + publisher(2) + OL(8) = 153 → 'medium'
    expect(['exact', 'strong', 'medium']).toContain(result.confidence)
    expect(result.score).toBeGreaterThan(100)
  })

  it('attaches score breakdown when debug=true', () => {
    const analysis = analyzeQuery('Dune')
    const result = makeResult()
    scoreResult(result, analysis, true)
    expect(result.scoreBreakdown).toBeDefined()
    expect(result.scoreBreakdown!.finalScore).toBe(result.score)
  })

  it('boosts German edition for German query', () => {
    const analysis = analyzeQuery('der kleine Prinz')
    const german = makeResult({ title: 'Der kleine Prinz', normalizedTitle: 'der kleine prinz', language: ['ger'], source: 'dnb', sourceIds: { dnb: '123' } })
    const english = makeResult({ title: 'Der kleine Prinz', normalizedTitle: 'der kleine prinz', language: ['eng'] })

    scoreResult(german, analysis)
    scoreResult(english, analysis)

    expect(german.score).toBeGreaterThan(english.score)
  })
})

// ── group.ts ──────────────────────────────────────────────────────────────────

import { groupAndDeduplicate } from '../search/group'

describe('groupAndDeduplicate', () => {
  it('returns empty array for empty input', () => {
    expect(groupAndDeduplicate([], 8)).toEqual([])
  })

  it('keeps the highest-scoring result per canonicalGroupKey', () => {
    const results: BookSearchResult[] = [
      makeResult({ id: 'a', score: 200, canonicalGroupKey: 'dune::frank herbert' }),
      makeResult({ id: 'b', score: 150, canonicalGroupKey: 'dune::frank herbert' }),
    ]
    const output = groupAndDeduplicate(results, 8)
    // The winner should be id 'a'
    const winner = output.find((r) => r.score >= 150)
    expect(winner?.id).toBe('a')
  })

  it('respects maxResults', () => {
    const results: BookSearchResult[] = Array.from({ length: 20 }, (_, i) =>
      makeResult({ id: `r${i}`, score: 100 - i, canonicalGroupKey: `group-${i}` })
    )
    expect(groupAndDeduplicate(results, 5)).toHaveLength(5)
  })

  it('merges sourceIds from duplicates into winner', () => {
    const winner = makeResult({ id: 'ol:1', source: 'openlibrary', sourceIds: { openlibrary: '/works/OL1W' }, score: 200, canonicalGroupKey: 'dune::frank herbert' })
    const dup = makeResult({ id: 'gb:1', source: 'googlebooks', sourceIds: { googlebooks: 'abc123' }, score: 150, canonicalGroupKey: 'dune::frank herbert' })
    groupAndDeduplicate([winner, dup], 8)
    expect(winner.sourceIds.googlebooks).toBe('abc123')
  })

  it('applies near-identical penalty when same title+author+year appears twice', () => {
    const r1 = makeResult({ id: 'a', score: 200, canonicalGroupKey: 'groupA', publishedYear: 1965 })
    const r2 = makeResult({ id: 'b', score: 180, canonicalGroupKey: 'groupB', publishedYear: 1965 })
    const output = groupAndDeduplicate([r1, r2], 8)
    // r2 should have a penalty applied because same normalized title + author + year
    const b = output.find((r) => r.id === 'b')
    expect(b!.score).toBeLessThan(180)
  })
})

// ── pipeline.ts ───────────────────────────────────────────────────────────────

import { searchBooks } from '../search/pipeline'
import type { ProviderFn } from '../search/pipeline'

describe('searchBooks pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array for empty query', async () => {
    const results = await searchBooks('', {}, [])
    expect(results).toEqual([])
  })

  it('returns results from a single mock provider', async () => {
    const mockProvider: ProviderFn = vi.fn().mockResolvedValue([
      makeResult({ id: 'p:1', score: 0, title: 'Dune', authors: ['Frank Herbert'], normalizedTitle: 'dune', normalizedAuthors: ['frank herbert'] }),
    ])

    const results = await searchBooks('Dune', { maxResults: 5 }, [mockProvider])
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].title).toBe('Dune')
  })

  it('handles provider errors gracefully (Promise.allSettled)', async () => {
    const failingProvider: ProviderFn = vi.fn().mockRejectedValue(new Error('network error'))
    const workingProvider: ProviderFn = vi.fn().mockResolvedValue([
      makeResult({ id: 'p:2', score: 0, title: 'Dune', authors: ['Frank Herbert'], normalizedTitle: 'dune', normalizedAuthors: ['frank herbert'] }),
    ])

    const results = await searchBooks('Dune', {}, [failingProvider, workingProvider])
    expect(results.length).toBeGreaterThan(0)
  })

  it('deduplicates results from multiple providers', async () => {
    const result = makeResult({ id: 'p:1', score: 0, canonicalGroupKey: 'dune::frank herbert' })
    const dup    = makeResult({ id: 'p:2', score: 0, canonicalGroupKey: 'dune::frank herbert' })

    const p1: ProviderFn = vi.fn().mockResolvedValue([result])
    const p2: ProviderFn = vi.fn().mockResolvedValue([dup])

    const results = await searchBooks('Dune', { maxResults: 8 }, [p1, p2])
    // Should be deduplicated — at most 1 entry for the canonical group
    const duneResults = results.filter((r) => r.canonicalGroupKey === 'dune::frank herbert')
    expect(duneResults.length).toBeLessThanOrEqual(1)
  })

  it('respects maxResults option', async () => {
    const providers: ProviderFn[] = [
      vi.fn().mockResolvedValue(
        Array.from({ length: 15 }, (_, i) =>
          makeResult({ id: `p:${i}`, score: 0, canonicalGroupKey: `group-${i}`, normalizedTitle: `title ${i}` })
        )
      ),
    ]
    const results = await searchBooks('test', { maxResults: 5 }, providers)
    expect(results.length).toBeLessThanOrEqual(5)
  })

  it('attaches scoreBreakdown in debug mode', async () => {
    const provider: ProviderFn = vi.fn().mockResolvedValue([
      makeResult({ id: 'p:1', score: 0, normalizedTitle: 'dune' }),
    ])
    const results = await searchBooks('Dune', { debug: true }, [provider])
    if (results.length > 0) {
      expect(results[0].scoreBreakdown).toBeDefined()
    }
  })

  it('strips _raw field unless debug=true', async () => {
    const provider: ProviderFn = vi.fn().mockResolvedValue([
      makeResult({ id: 'p:1', score: 0, _raw: { internal: 'data' } }),
    ])
    const results = await searchBooks('Dune', { debug: false }, [provider])
    if (results.length > 0) {
      expect(results[0]._raw).toBeUndefined()
    }
  })
})
