/**
 * lib/search/types.ts
 * Shared type definitions for the book search pipeline.
 */

// ── Source identifiers ────────────────────────────────────────────────────────

export type SourceId = 'openlibrary' | 'googlebooks' | 'dnb' | 'europeana'

// ── Query analysis ────────────────────────────────────────────────────────────

/**
 * Classified query type, used to tune scoring weights and provider queries.
 *
 *  title        — user is searching for a book title
 *  author       — user is searching for an author name
 *  title+author — both signals detected (e.g. "Dune Frank Herbert")
 *  ambiguous    — not enough signal to distinguish
 */
export type QueryType = 'title' | 'author' | 'title+author' | 'ambiguous'

export interface QueryAnalysis {
  /** Raw input as typed by the user */
  raw: string
  /** Lowercased, whitespace-collapsed, punctuation-stripped, accent-folded */
  normalized: string
  type: QueryType
  /** Tokens likely belonging to the title portion */
  titleTokens: string[]
  /** Tokens likely belonging to the author portion */
  authorTokens: string[]
  /** True when the query contains German umlauts or common German article words */
  likelyGerman: boolean
  hasUmlauts: boolean
}

// ── Canonical result model ────────────────────────────────────────────────────

export type Confidence = 'exact' | 'strong' | 'medium' | 'weak'

/**
 * Normalised representation of a single book candidate from any provider.
 * Original display strings are kept alongside normalised scoring strings.
 */
export interface BookSearchResult {
  /** Stable deduplication key: "source:providerKey" */
  id: string
  /** Primary provider that produced this record */
  source: SourceId
  /** Provider-specific IDs for merging/enrichment */
  sourceIds: Partial<Record<SourceId, string>>

  // ── Display fields (original values) ─────────────────────────────────────
  title: string
  subtitle?: string
  authors: string[]
  language?: string[]
  publishedYear?: number
  publisher?: string
  isbn10?: string[]
  isbn13?: string[]
  pageCount?: number
  description?: string
  coverImageUrl?: string
  categories?: string[]

  // ── Scoring fields (normalised) ───────────────────────────────────────────
  normalizedTitle: string
  normalizedSubtitle?: string
  normalizedAuthors: string[]

  // ── Grouping ──────────────────────────────────────────────────────────────
  /** Open Library work key if available, e.g. /works/OL45804W */
  workKey?: string
  /**
   * Canonical key used to group editions of the same work.
   * Format: "{normalizedTitle}::{normalizedPrimaryAuthor}"
   */
  canonicalGroupKey?: string

  // ── Ranking output ────────────────────────────────────────────────────────
  score: number
  confidence: Confidence
  /** Per-dimension score breakdown (populated when debug=true) */
  scoreBreakdown?: ScoreBreakdown

  _raw?: unknown
}

// ── Score breakdown ───────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  titleExact: number
  titleNormalized: number
  titleTokenOverlap: number
  subtitleSupport: number
  authorExact: number
  authorOverlap: number
  titleAuthorCombo: number
  metadataQuality: number
  providerWeight: number
  localeBoost: number
  duplicatePenalty: number
  finalScore: number
}

// ── Pipeline options ──────────────────────────────────────────────────────────

export interface SearchOptions {
  /** Maximum results to return (default: 8) */
  maxResults?: number
  /**
   * Attach ScoreBreakdown to each result.
   * Useful for tuning — add ?debug=1 to the API endpoint.
   */
  debug?: boolean
  /** Total pipeline timeout in ms (default: 5000) */
  timeoutMs?: number
}

// ── Public surface (what the UI sees) ────────────────────────────────────────

/** Minimal shape expected by BookForm and ToReadForm */
export interface BookSuggestion {
  title: string
  author: string
  cover_url?: string
}
