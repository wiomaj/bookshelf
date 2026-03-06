/**
 * lib/search/score.ts
 *
 * Scoring engine for the book search pipeline.
 *
 * Each BookSearchResult is scored against the QueryAnalysis independently;
 * penalty passes (duplicate/edition detection) happen in group.ts after
 * all results have been scored.
 *
 * Score dimensions (see weights.ts for numeric values):
 *
 *  Title match
 *    titleExact          — normalised title === normalised query
 *    titleNormalized     — match after umlaut expansion
 *    titlePhrase         — query appears as phrase inside title
 *    titlePrefix         — title starts with query
 *    titleTokenOverlap   — proportional token overlap
 *    titleExtraPenalty   — penalise very long titles
 *    subtitleSupport     — subtitle tokens boost for ambiguous queries
 *
 *  Author match
 *    authorExact         — normalised author === normalised author tokens
 *    authorNormalized    — match after umlaut expansion
 *    authorOverlap       — proportional token overlap
 *
 *  Combined
 *    titleAuthorCombo    — both signals are strong → extra boost
 *    titleOnlyPenalty    — title+author query but only title matched
 *    authorOnlyPenalty   — title+author query but only author matched
 *
 *  Metadata quality
 *    isbn13/10, cover, description, pageCount, publisher, year, language
 *    missingMetadataPenalty
 *
 *  Provider base weight
 *
 *  Locale boost/penalty
 */

import {
  normalizeText,
  normalizeGerman,
  normalizeAuthor,
  tokenize,
  tokenOverlapRatio,
} from './normalize'
import { WEIGHTS, scoreToConfidence } from './weights'
import type { QueryAnalysis, BookSearchResult, ScoreBreakdown } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

// ── Title scoring ─────────────────────────────────────────────────────────────

interface TitleScore {
  titleExact: number
  titleNormalized: number
  titlePhrase: number
  titlePrefix: number
  titleTokenOverlap: number
  subtitleSupport: number
}

function scoreTitleDimensions(
  result: BookSearchResult,
  analysis: QueryAnalysis
): TitleScore {
  const { normalized: qNorm, likelyGerman, titleTokens } = analysis
  const { normalizedTitle, normalizedSubtitle } = result

  // Also compute German-expanded versions of both sides
  const qGerman = likelyGerman ? normalizeGerman(analysis.raw) : qNorm
  const cGerman = likelyGerman ? normalizeGerman(result.title) : normalizedTitle

  const cTokens = tokenize(normalizedTitle)
  const qTokens = titleTokens.length > 0 ? titleTokens : tokenize(qNorm)

  // titleExact
  const titleExact =
    normalizedTitle === qNorm || (likelyGerman && cGerman === qGerman)
      ? WEIGHTS.titleExact
      : 0

  // titleNormalized — only meaningful if exact already scored
  const titleNormalized =
    titleExact === 0 && likelyGerman && cGerman === qGerman
      ? WEIGHTS.titleNormalized
      : 0

  // titlePhrase — query appears as a contiguous substring in the candidate
  const titlePhrase =
    titleExact === 0 && titleNormalized === 0 && normalizedTitle.includes(qNorm)
      ? WEIGHTS.titlePhrase
      : 0

  // titlePrefix — candidate title starts with the normalised query
  const titlePrefix =
    titleExact === 0 &&
    titleNormalized === 0 &&
    titlePhrase === 0 &&
    normalizedTitle.startsWith(qNorm)
      ? WEIGHTS.titlePrefix
      : 0

  // titleTokenOverlap — proportional overlap of content tokens
  let titleTokenOverlap = 0
  if (titleExact === 0 && titleNormalized === 0 && qTokens.length > 0) {
    const ratio = tokenOverlapRatio(qTokens, cTokens)
    titleTokenOverlap = Math.round(ratio * WEIGHTS.titleTokenOverlapMax)

    // Penalise very long titles (more than 2 extra tokens beyond query)
    const extraTokens = Math.max(0, cTokens.length - qTokens.length - 2)
    if (extraTokens > 0) {
      titleTokenOverlap = Math.max(
        0,
        titleTokenOverlap - extraTokens * WEIGHTS.titleExtraTokenPenalty
      )
    }
  }

  // subtitleSupport — useful when query partially matches a combined title+subtitle
  let subtitleSupport = 0
  if (normalizedSubtitle && qTokens.length > 0) {
    const subTokens = tokenize(normalizedSubtitle)
    const subRatio = tokenOverlapRatio(qTokens, [...cTokens, ...subTokens])
    if (subRatio > tokenOverlapRatio(qTokens, cTokens)) {
      subtitleSupport = Math.round(
        (subRatio - tokenOverlapRatio(qTokens, cTokens)) * WEIGHTS.subtitleSupportMax
      )
    }
  }

  return { titleExact, titleNormalized, titlePhrase, titlePrefix, titleTokenOverlap, subtitleSupport }
}

// ── Author scoring ────────────────────────────────────────────────────────────

interface AuthorScore {
  authorExact: number
  authorOverlap: number
}

function scoreAuthorDimensions(
  result: BookSearchResult,
  analysis: QueryAnalysis
): AuthorScore {
  const { authorTokens, likelyGerman } = analysis
  if (authorTokens.length === 0) return { authorExact: 0, authorOverlap: 0 }

  const qAuthorStr = authorTokens.join(' ')
  const { normalizedAuthors } = result

  // Check each candidate author for an exact/normalised/overlap match; take best
  let bestExact = 0
  let bestOverlap = 0

  for (const normAuthor of normalizedAuthors) {
    // Exact
    if (normAuthor === qAuthorStr) {
      bestExact = Math.max(bestExact, WEIGHTS.authorExact)
      continue
    }

    // German-expanded exact
    if (likelyGerman) {
      const authorGerman = normalizeGerman(result.authors[normalizedAuthors.indexOf(normAuthor)] ?? normAuthor)
      const qAuthorGerman = normalizeGerman(qAuthorStr)
      if (authorGerman === qAuthorGerman) {
        bestExact = Math.max(bestExact, WEIGHTS.authorNormalized)
        continue
      }
    }

    // Token overlap
    const cAuthorTokens = tokenize(normAuthor)
    const qAuthorTokens = tokenize(qAuthorStr)
    if (qAuthorTokens.length > 0) {
      const ratio = tokenOverlapRatio(qAuthorTokens, cAuthorTokens)
      if (ratio >= WEIGHTS.authorOverlapMinRatio) {
        bestOverlap = Math.max(bestOverlap, Math.round(ratio * WEIGHTS.authorOverlapMax))
      }
    }
  }

  return { authorExact: bestExact, authorOverlap: bestOverlap }
}

// ── Metadata quality scoring ──────────────────────────────────────────────────

function scoreMetadata(result: BookSearchResult): number {
  let s = 0
  if (result.isbn13?.length) s += WEIGHTS.isbn13
  if (result.isbn10?.length) s += WEIGHTS.isbn10
  if (result.coverImageUrl) s += WEIGHTS.cover
  if (result.description) s += WEIGHTS.description
  if (result.pageCount) s += WEIGHTS.pageCount
  if (result.publisher) s += WEIGHTS.publisher
  if (result.publishedYear) s += WEIGHTS.publishedYear
  if (result.language?.length) s += WEIGHTS.language

  // Penalise completely empty metadata
  if (!result.isbn13?.length && !result.isbn10?.length && !result.coverImageUrl && !result.publishedYear) {
    s += WEIGHTS.missingMetadataPenalty
  }

  return s
}

// ── Provider base weight ──────────────────────────────────────────────────────

/** Map SourceId → WEIGHTS key (casing differs between the two). */
const PROVIDER_WEIGHT_KEY: Record<string, keyof typeof WEIGHTS> = {
  openlibrary: 'openLibrary',
  googlebooks: 'googleBooks',
  dnb: 'dnb',
  europeana: 'europeana',
}

function scoreProvider(result: BookSearchResult): number {
  const key = PROVIDER_WEIGHT_KEY[result.source]
  return key ? (WEIGHTS[key] as number) : 0
}

// ── Locale boost / penalty ────────────────────────────────────────────────────

function scoreLocale(result: BookSearchResult, analysis: QueryAnalysis): number {
  const { likelyGerman } = analysis
  const { language, source } = result

  const isGermanEdition = language?.some((l) =>
    l === 'de' || l === 'ger' || l === 'deu'
  )
  const isEnglishEdition = language?.some((l) => l === 'en' || l === 'eng')

  let s = 0

  if (likelyGerman) {
    if (source === 'dnb') s += WEIGHTS.germanQueryDnbBoost
    if (isGermanEdition) s += WEIGHTS.germanEditionBoost
    if (isEnglishEdition && !isGermanEdition) s += WEIGHTS.localeMismatchPenalty
  } else {
    // For non-German queries, lightly prefer English editions
    if (isEnglishEdition) s += WEIGHTS.englishEditionBoost
  }

  return s
}

// ── Combined title+author bonus / penalties ───────────────────────────────────

function scoreCombined(
  titleScore: number,
  authorScore: number,
  analysis: QueryAnalysis
): number {
  if (analysis.type !== 'title+author') return 0

  const hasTitleSignal = titleScore >= 40
  const hasAuthorSignal = authorScore >= 30

  if (hasTitleSignal && hasAuthorSignal) {
    // Both strong — extra reward
    return titleScore >= 100 && authorScore >= 60
      ? WEIGHTS.titleAuthorCombo
      : WEIGHTS.titleAuthorProbable
  }

  if (hasTitleSignal && !hasAuthorSignal) return WEIGHTS.titleOnlyPenalty
  if (!hasTitleSignal && hasAuthorSignal) return WEIGHTS.authorOnlyPenalty

  return 0
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Score a single BookSearchResult against the query analysis.
 * Mutates result.score and result.confidence in place.
 * When debug=true also attaches a ScoreBreakdown.
 */
export function scoreResult(
  result: BookSearchResult,
  analysis: QueryAnalysis,
  debug = false
): BookSearchResult {
  const titleDims = scoreTitleDimensions(result, analysis)
  const authorDims = scoreAuthorDimensions(result, analysis)

  const titleScore =
    titleDims.titleExact ||
    titleDims.titleNormalized ||
    titleDims.titlePhrase ||
    titleDims.titlePrefix ||
    titleDims.titleTokenOverlap

  const authorScore = authorDims.authorExact || authorDims.authorOverlap

  const combinedBonus = scoreCombined(titleScore, authorScore, analysis)
  const metadataScore = scoreMetadata(result)
  const providerScore = scoreProvider(result)
  const localeScore = scoreLocale(result, analysis)

  const subtitleSupport = titleDims.subtitleSupport

  const finalScore =
    titleScore +
    authorScore +
    combinedBonus +
    subtitleSupport +
    metadataScore +
    providerScore +
    localeScore

  result.score = clamp(finalScore, 0, 9999)
  result.confidence = scoreToConfidence(result.score)

  if (debug) {
    result.scoreBreakdown = {
      titleExact: titleDims.titleExact,
      titleNormalized: titleDims.titleNormalized,
      titleTokenOverlap: titleDims.titleTokenOverlap,
      subtitleSupport,
      authorExact: authorDims.authorExact,
      authorOverlap: authorDims.authorOverlap,
      titleAuthorCombo: combinedBonus,
      metadataQuality: metadataScore,
      providerWeight: providerScore,
      localeBoost: localeScore,
      duplicatePenalty: 0, // filled in by group.ts
      finalScore: result.score,
    }
  }

  return result
}

/**
 * Score all results in a flat array.
 * Returns the same array (mutated), sorted by score descending.
 */
export function scoreAll(
  results: BookSearchResult[],
  analysis: QueryAnalysis,
  debug = false
): BookSearchResult[] {
  for (const r of results) scoreResult(r, analysis, debug)
  return results.sort((a, b) => b.score - a.score)
}

/**
 * Normalise an author name from a search result for author-query matching.
 * Re-exported here as a convenience so callers don't need to import normalize.ts.
 */
export { normalizeAuthor }
