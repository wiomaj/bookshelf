/**
 * lib/search/pipeline.ts
 *
 * Orchestrates the full book-search pipeline:
 *
 *  1. Analyse the raw query (type, tokens, language).
 *  2. Fan out to all enabled providers in parallel.
 *  3. Merge provider results into a flat candidate list.
 *  4. Score each candidate against the query.
 *  5. Group, deduplicate, and apply edition penalties.
 *  6. Return the top-N results with confidence labels.
 *
 * This module is intentionally provider-agnostic: providers are passed in
 * as async functions so they can be mocked in tests.
 */

import { analyzeQuery } from './queryAnalysis'
import { scoreAll } from './score'
import { groupAndDeduplicate } from './group'
import { fetchGoogleBooks } from './adapters/googleBooks'
import { fetchOpenLibrary } from './adapters/openLibrary'
import { fetchDNB } from './adapters/dnb'
import { fetchEuropeana } from './adapters/europeana'
import type { BookSearchResult, SearchOptions, QueryAnalysis } from './types'

// ── Default options ───────────────────────────────────────────────────────────

const DEFAULT_MAX_RESULTS = 8
const DEFAULT_TIMEOUT_MS = 5_000

// ── Provider type ─────────────────────────────────────────────────────────────

export type ProviderFn = (
  analysis: QueryAnalysis,
  signal?: AbortSignal
) => Promise<BookSearchResult[]>

// ── Default provider list ────────────────────────────────────────────────────

/** All providers the pipeline uses by default. */
export const DEFAULT_PROVIDERS: ProviderFn[] = [
  fetchOpenLibrary,
  fetchGoogleBooks,
  fetchDNB,       // no-op for non-German queries
  fetchEuropeana, // no-op for non-German queries
]

// ── Pipeline ──────────────────────────────────────────────────────────────────

/**
 * Run the full search pipeline for a raw user query.
 *
 * @param rawQuery   The user's search string (as typed).
 * @param options    Optional tuning: maxResults, debug, timeoutMs.
 * @param providers  Override the default provider list (useful for tests).
 */
export async function searchBooks(
  rawQuery: string,
  options: SearchOptions = {},
  providers: ProviderFn[] = DEFAULT_PROVIDERS
): Promise<BookSearchResult[]> {
  const { maxResults = DEFAULT_MAX_RESULTS, debug = false, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  // ── 1. Analyse query ───────────────────────────────────────────────────────
  const analysis = analyzeQuery(rawQuery)
  if (!analysis.raw) return []

  // ── 2. Fan out to providers ────────────────────────────────────────────────
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let allResults: BookSearchResult[]

  try {
    const settled = await Promise.allSettled(
      providers.map((fn) => fn(analysis, controller.signal))
    )

    allResults = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  } finally {
    clearTimeout(timeoutId)
  }

  if (allResults.length === 0) return []

  // ── 3. Score all candidates ────────────────────────────────────────────────
  scoreAll(allResults, analysis, debug)

  // ── 4. Group, deduplicate, apply edition penalties ─────────────────────────
  const finalResults = groupAndDeduplicate(allResults, maxResults, debug)

  // Remove internal raw payload unless debug mode is active
  if (!debug) {
    for (const r of finalResults) {
      delete r._raw
    }
  }

  return finalResults
}
