/**
 * lib/search/weights.ts
 * Configurable scoring weights for the book search pipeline.
 *
 * All weights are additive. Positive = boost, negative = penalty.
 * Tune these values to adjust ranking behaviour without touching logic.
 */

export const WEIGHTS = {
  // ── Title match ─────────────────────────────────────────────────────────────
  /** Candidate normalised title === full normalised query */
  titleExact: 120,
  /** Match only after German umlaut expansion (ä→ae etc.) */
  titleNormalized: 100,
  /** Query appears as a contiguous phrase inside candidate title */
  titlePhrase: 80,
  /** Candidate title starts with the query */
  titlePrefix: 60,
  /** Maximum score for proportional token overlap */
  titleTokenOverlapMax: 50,
  /** Per extra token in candidate title beyond query length (after grace of 2) */
  titleExtraTokenPenalty: 5,
  /** Subtitle tokens materially overlap query tokens */
  subtitleSupportMax: 20,

  // ── Author match ─────────────────────────────────────────────────────────────
  /** Candidate author === author portion of query (exact) */
  authorExact: 90,
  /** Match after umlaut expansion */
  authorNormalized: 75,
  /** Maximum score for proportional author token overlap */
  authorOverlapMax: 40,
  /** Minimum overlap ratio to grant any author score */
  authorOverlapMinRatio: 0.4,

  // ── Combined title+author ─────────────────────────────────────────────────────
  /** Both title and author signals are strong */
  titleAuthorCombo: 50,
  /** Probable title+author query with good overall match */
  titleAuthorProbable: 40,
  /**
   * Penalty when query type is title+author but only title matched.
   * Prevents a title-only hit from outranking a book that also matches author.
   */
  titleOnlyPenalty: -20,
  /**
   * Penalty when query type is title+author but only author matched.
   */
  authorOnlyPenalty: -25,

  // ── Metadata quality ─────────────────────────────────────────────────────────
  /** Metadata boosts are deliberately small so they refine rather than dominate. */
  isbn13: 12,
  isbn10: 8,
  cover: 8,
  description: 4,
  pageCount: 3,
  publisher: 2,
  publishedYear: 3,
  language: 4,
  /**
   * Penalty when a result has none of: ISBN, cover, or year.
   * Forces genuinely empty stubs to the back.
   */
  missingMetadataPenalty: -10,

  // ── Provider base weights ─────────────────────────────────────────────────────
  /** Added to every result from that source before any other signals. */
  openLibrary: 8,
  googleBooks: 7,
  dnb: 5,
  europeana: 3,

  // ── Locale-aware boosts ───────────────────────────────────────────────────────
  /** German query + DNB result in German: strong German-edition signal */
  germanQueryDnbBoost: 20,
  /** German query + any result whose language includes 'ger'/'de' */
  germanEditionBoost: 15,
  /** English query + result language is 'en' */
  englishEditionBoost: 10,
  /**
   * Penalty when detected query language and candidate language clearly mismatch.
   * Not applied when language is unknown.
   */
  localeMismatchPenalty: -10,

  // ── Duplication / edition penalties ──────────────────────────────────────────
  /** Second+ result in the same work group */
  duplicateEditionPenalty: -40,
  /** Near-identical metadata to another result (same title + author + year) */
  nearIdenticalPenalty: -60,
  /** Low-info edition (no ISBN, no cover, no year) when a better edition exists */
  lowInfoEditionPenalty: -20,
} as const

// ── Confidence thresholds ────────────────────────────────────────────────────

/**
 * Map a final numeric score to a confidence label.
 * Thresholds tuned for the weight table above.
 */
export function scoreToConfidence(score: number): import('./types').Confidence {
  if (score >= 220) return 'exact'
  if (score >= 160) return 'strong'
  if (score >= 100) return 'medium'
  return 'weak'
}
