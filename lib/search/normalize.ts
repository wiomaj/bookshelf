/**
 * lib/search/normalize.ts
 * Text normalisation utilities for book search ranking.
 *
 * Two normalisation layers:
 *   normalizeText()   — universal base (lowercase + accent fold + strip punctuation)
 *   normalizeGerman() — base + umlaut expansion (ä→ae, ö→oe, ü→ue, ß→ss)
 *
 * Keep original display strings for the UI; use normalised strings only for
 * scoring comparisons.
 */

// ── Accent / diacritic folding ────────────────────────────────────────────────

/**
 * Unicode-normalize to NFD then strip all combining diacritic marks.
 * "résumé" → "resume", "Ångström" → "Angstrom"
 * NOTE: does NOT expand German umlauts — see expandUmlauts() for that.
 */
export function foldAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ── German umlaut expansion ───────────────────────────────────────────────────

/**
 * Expand German umlauts to their ASCII digraph equivalents.
 * Both cases are folded to lowercase digraphs so normalisation remains
 * case-insensitive.
 *
 *   ä/Ä → ae  |  ö/Ö → oe  |  ü/Ü → ue  |  ß → ss
 *
 * Used symmetrically on both the query AND the candidate title so that
 * "Über den Wolken" matches a candidate stored as "Ueber den Wolken".
 */
export function expandUmlauts(s: string): string {
  return s
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
}

/** Returns true when the string contains any German-specific character. */
export function hasUmlauts(s: string): boolean {
  return /[äöüÄÖÜß]/.test(s)
}

// ── Core normalisation ────────────────────────────────────────────────────────

/**
 * Universal base normalisation — suitable for any language.
 *
 * Pipeline:
 *   lowercase → trim → collapse whitespace → remove punctuation → fold accents
 *
 * Preserves letters, digits, and spaces.
 * Does NOT expand German umlauts (use normalizeGerman() for that).
 */
export function normalizeText(s: string): string {
  return foldAccents(
    s
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, '') // strip punctuation, keep letters/digits/spaces
  )
}

/**
 * German-aware normalisation — base + umlaut expansion.
 * Apply to BOTH sides of any German-query comparison.
 */
export function normalizeGerman(s: string): string {
  return normalizeText(expandUmlauts(s))
}

// ── Author normalisation ──────────────────────────────────────────────────────

/**
 * Normalise an author name for comparison.
 *
 * Handles "Lastname, Firstname" → "firstname lastname" inversion so that
 * "Herbert, Frank" compares equal to "Frank Herbert".
 */
export function normalizeAuthor(name: string): string {
  if (name.includes(',')) {
    const [last, ...firstParts] = name.split(',').map((p) => p.trim())
    return normalizeText([...firstParts, last].join(' '))
  }
  return normalizeText(name)
}

// ── Tokenisation ──────────────────────────────────────────────────────────────

/**
 * Common stop-words filtered out during tokenisation.
 * Kept small — only the highest-frequency noise words across EN/DE/FR/ES/PL.
 */
const STOP_WORDS = new Set([
  // English
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or',
  'by', 'with', 'from', 'as', 'into', 'through', 'about', 'is', 'are',
  // German
  'der', 'die', 'das', 'des', 'dem', 'den', 'ein', 'eine', 'eines', 'einem', 'einer',
  'und', 'mit', 'im', 'am', 'vom', 'zum', 'zur', 'bei', 'ist', 'von', 'uber',
  // French
  'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'au', 'aux',
  // Spanish / Polish
  'el', 'los', 'las', 'del', 'de', 'i', 'w', 'z',
])

/**
 * Split a normalised string into meaningful tokens, filtering stop-words
 * and very short fragments.
 *
 * Input should already be normalised via normalizeText().
 */
export function tokenize(normalized: string): string[] {
  return normalized
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w))
}

// ── Overlap metric ────────────────────────────────────────────────────────────

/**
 * Compute the fraction of queryTokens present in candidateTokens (0–1).
 * Returns 0 when queryTokens is empty.
 */
export function tokenOverlapRatio(
  queryTokens: string[],
  candidateTokens: string[]
): number {
  if (queryTokens.length === 0) return 0
  const cSet = new Set(candidateTokens)
  const matched = queryTokens.filter((t) => cSet.has(t)).length
  return matched / queryTokens.length
}

// ── Language detection ────────────────────────────────────────────────────────

/**
 * Common German article / preposition words that strongly suggest a German query
 * even without umlauts.
 */
const GERMAN_SIGNAL_WORDS = new Set([
  'der', 'die', 'das', 'des', 'dem', 'den', 'ein', 'eine', 'eines', 'einem',
  'und', 'ist', 'von', 'mit', 'im', 'am', 'vom', 'zum', 'zur', 'uber', 'nach',
  'wie', 'wer', 'was', 'wenn', 'also', 'noch', 'schon', 'nur', 'aber',
])

/**
 * Heuristic: is the raw query likely German?
 * Positive signals: umlauts present, or ≥1 German structural word found.
 */
export function looksGerman(query: string): boolean {
  if (hasUmlauts(query)) return true
  const words = query.toLowerCase().split(/\s+/)
  return words.some((w) => GERMAN_SIGNAL_WORDS.has(w))
}
