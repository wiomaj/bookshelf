/**
 * lib/search/queryAnalysis.ts
 *
 * Classifies a raw user query into a QueryType and extracts title/author tokens.
 * The classification is heuristic — it does not need to be perfect, because the
 * scorer handles ambiguous queries gracefully.
 *
 * Classification order (first match wins):
 *   1. Explicit separator (" - ", " by ", " von ") → title+author
 *   2. Two proper-name words with no title stop-words → author
 *   3. 3+ words where the last 1–2 words look like a proper name → title+author
 *   4. Query contains known title/article words → title
 *   5. Fallback → ambiguous
 */

import {
  normalizeText,
  expandUmlauts,
  hasUmlauts,
  tokenize,
  looksGerman,
} from './normalize'
import type { QueryAnalysis, QueryType } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True if a word starts with an uppercase letter (proper noun heuristic). */
function isProperName(word: string): boolean {
  return word.length >= 2 && /^[A-ZÄÖÜ]/.test(word)
}

/** Words that strongly indicate a title rather than an author. */
const TITLE_SIGNAL_WORDS = new Set([
  // English articles / prepositions
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or',
  'with', 'from', 'into', 'through', 'about', 'is', 'are', 'not', 'no',
  // German articles / prepositions
  'der', 'die', 'das', 'des', 'dem', 'den', 'ein', 'eine', 'eines',
  'und', 'im', 'am', 'vom', 'zum', 'zur', 'bei', 'ist', 'uber', 'nach',
  'wie', 'wer', 'was', 'wenn',
  // French
  'le', 'la', 'les', 'du', 'des', 'un', 'une', 'et', 'en', 'au',
  // Spanish
  'el', 'los', 'las', 'del',
])

/** Explicit separator tokens that split "title SEPARATOR author". */
const SEPARATORS = [' - ', ' by ', ' von ']

// ── Separator splitting ────────────────────────────────────────────────────────

function splitAtSeparator(query: string): [string, string] | null {
  for (const sep of SEPARATORS) {
    const idx = query.toLowerCase().indexOf(sep)
    if (idx > 2) {
      return [query.slice(0, idx).trim(), query.slice(idx + sep.length).trim()]
    }
  }
  return null
}

// ── Main analysis ─────────────────────────────────────────────────────────────

/**
 * Analyse a raw user query string and return structured metadata used by the
 * scoring and provider-query-construction stages.
 */
export function analyzeQuery(rawQuery: string): QueryAnalysis {
  const raw = rawQuery.trim()
  if (!raw) {
    return {
      raw: '',
      normalized: '',
      type: 'ambiguous',
      titleTokens: [],
      authorTokens: [],
      likelyGerman: false,
      hasUmlauts: false,
    }
  }

  const likelyGerman = looksGerman(raw)
  const umlautPresent = hasUmlauts(raw)

  // Normalize: expand umlauts for German queries so "Über" → "ueber" is
  // consistent with how candidate titles are later compared.
  const forNorm = likelyGerman ? expandUmlauts(raw) : raw
  const normalized = normalizeText(forNorm)

  const words = raw.trim().split(/\s+/)

  // ── 1. Explicit separator ──────────────────────────────────────────────────
  const separated = splitAtSeparator(raw)
  if (separated) {
    const [titlePart, authorPart] = separated
    return {
      raw,
      normalized,
      type: 'title+author',
      titleTokens: tokenize(normalizeText(likelyGerman ? expandUmlauts(titlePart) : titlePart)),
      authorTokens: tokenize(normalizeText(authorPart)),
      likelyGerman,
      hasUmlauts: umlautPresent,
    }
  }

  // ── 2. Pure author (2 proper-noun words, no title signals) ────────────────
  if (
    words.length === 2 &&
    words.every(isProperName) &&
    !words.some((w) => TITLE_SIGNAL_WORDS.has(w.toLowerCase()))
  ) {
    return {
      raw,
      normalized,
      type: 'author',
      titleTokens: [],
      authorTokens: tokenize(normalized),
      likelyGerman,
      hasUmlauts: umlautPresent,
    }
  }

  // ── 3. Title + author (last 2 words look like a proper name) ─────────────
  if (words.length >= 3) {
    // Try last 2 words as "Firstname Lastname"
    const last2 = words.slice(-2)
    const first = words.slice(0, -2)
    if (
      last2.every(isProperName) &&
      first.length > 0 &&
      !last2.some((w) => TITLE_SIGNAL_WORDS.has(w.toLowerCase()))
    ) {
      const authorRaw = last2.join(' ')
      const titleRaw = first.join(' ')
      return {
        raw,
        normalized,
        type: 'title+author',
        titleTokens: tokenize(normalizeText(likelyGerman ? expandUmlauts(titleRaw) : titleRaw)),
        authorTokens: tokenize(normalizeText(authorRaw)),
        likelyGerman,
        hasUmlauts: umlautPresent,
      }
    }

    // Try last word only as "Lastname"
    const lastWord = words[words.length - 1]
    const restWords = words.slice(0, -1)
    if (
      isProperName(lastWord) &&
      restWords.length > 0 &&
      !TITLE_SIGNAL_WORDS.has(lastWord.toLowerCase())
    ) {
      const titleRaw = restWords.join(' ')
      return {
        raw,
        normalized,
        type: 'title+author',
        titleTokens: tokenize(normalizeText(likelyGerman ? expandUmlauts(titleRaw) : titleRaw)),
        authorTokens: tokenize(normalizeText(lastWord)),
        likelyGerman,
        hasUmlauts: umlautPresent,
      }
    }
  }

  // ── 4. Title (contains article / structural word, or short phrase) ────────
  const hasArticleWord = words.some((w) => TITLE_SIGNAL_WORDS.has(w.toLowerCase()))
  if (hasArticleWord || words.length <= 4) {
    return {
      raw,
      normalized,
      type: 'title',
      titleTokens: tokenize(normalized),
      authorTokens: [],
      likelyGerman,
      hasUmlauts: umlautPresent,
    }
  }

  // ── 5. Ambiguous fallback ──────────────────────────────────────────────────
  // Score as both title and author — the scorer handles this gracefully.
  return {
    raw,
    normalized,
    type: 'ambiguous',
    titleTokens: tokenize(normalized),
    authorTokens: tokenize(normalized),
    likelyGerman,
    hasUmlauts: umlautPresent,
  }
}

// ── Provider query construction ───────────────────────────────────────────────

/**
 * Build the primary query string to send to Open Library / Google Books.
 * For title+author queries, uses provider field qualifiers for precision.
 */
export function buildProviderQuery(
  analysis: QueryAnalysis,
  provider: 'openlibrary' | 'googlebooks'
): string {
  const { raw, type, titleTokens, authorTokens } = analysis

  if (type === 'author') {
    return provider === 'googlebooks' ? `inauthor:"${raw}"` : raw
  }

  if (type === 'title+author' && titleTokens.length > 0 && authorTokens.length > 0) {
    const titlePart = titleTokens.join(' ')
    const authorPart = authorTokens.join(' ')
    if (provider === 'googlebooks') {
      return `intitle:"${titlePart}" inauthor:"${authorPart}"`
    }
    // Open Library supports title= and author= params (handled in the adapter)
    return raw
  }

  if (type === 'title') {
    return provider === 'googlebooks' ? `intitle:"${raw}"` : raw
  }

  // ambiguous: plain query works best
  return raw
}

/**
 * For Open Library, returns the preferred field params for a structured query.
 * Returns null when a plain `q=` query is better.
 */
export function buildOpenLibraryParams(
  analysis: QueryAnalysis
): { title?: string; author?: string; q?: string } {
  if (analysis.type === 'author') {
    return { q: analysis.raw }
  }
  if (analysis.type === 'title+author' && analysis.titleTokens.length > 0 && analysis.authorTokens.length > 0) {
    return {
      title: analysis.titleTokens.join(' '),
      author: analysis.authorTokens.join(' '),
    }
  }
  return { q: analysis.raw }
}
