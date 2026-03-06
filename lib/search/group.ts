/**
 * lib/search/group.ts
 *
 * Work-level grouping, deduplication, and edition-penalty pass.
 *
 * After all results have been scored by score.ts, this module:
 *
 *  1. Groups results by canonicalGroupKey  (normalised title + primary author).
 *  2. Identifies the best representative per group (highest score).
 *  3. Applies duplicate / low-info edition penalties to non-best entries.
 *  4. Merges source IDs from duplicates into the winning record.
 *  5. Returns the de-duplicated list, re-sorted by score.
 *
 * Near-identical detection:
 *   Two results from different groups are "near-identical" when they share
 *   the same normalised title, same primary author AND the same year (when known).
 *   These receive an extra nearIdenticalPenalty.
 */

import { WEIGHTS } from './weights'
import { scoreToConfidence } from './weights'
import type { BookSearchResult } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True when a result has enough metadata to be a "good" edition. */
function isInfoRich(r: BookSearchResult): boolean {
  return !!(r.isbn13?.length || r.isbn10?.length || r.coverImageUrl || r.publishedYear)
}

/** Build a strict dedup key for near-identical detection. */
function nearIdentKey(r: BookSearchResult): string {
  const year = r.publishedYear ? String(r.publishedYear) : '_'
  return `${r.normalizedTitle}::${r.normalizedAuthors[0] ?? ''}::${year}`
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Deduplicate and apply edition penalties to a pre-scored result list.
 *
 * @param results  Pre-scored results (may contain duplicates / multiple editions).
 * @param maxResults  Maximum number of results to return.
 * @param debug    When true, updates scoreBreakdown.duplicatePenalty.
 * @returns  De-duplicated, re-ranked list (at most maxResults entries).
 */
export function groupAndDeduplicate(
  results: BookSearchResult[],
  maxResults: number,
  debug = false
): BookSearchResult[] {
  if (results.length === 0) return []

  // ── Step 1: Group by canonicalGroupKey ────────────────────────────────────
  const groups = new Map<string, BookSearchResult[]>()

  for (const r of results) {
    const key = r.canonicalGroupKey ?? r.normalizedTitle
    const group = groups.get(key)
    if (group) {
      group.push(r)
    } else {
      groups.set(key, [r])
    }
  }

  // ── Step 2: Within each group, pick the best and penalise the rest ────────
  const winners: BookSearchResult[] = []

  for (const [, group] of groups) {
    // Sort group by score descending
    group.sort((a, b) => b.score - a.score)
    const [best, ...rest] = group

    // Merge sourceIds from duplicates into the winner
    for (const dup of rest) {
      for (const [src, id] of Object.entries(dup.sourceIds)) {
        if (!best.sourceIds[src as keyof typeof best.sourceIds]) {
          ;(best.sourceIds as Record<string, string>)[src] = id as string
        }
      }

      // Apply edition penalty to duplicate
      const penalty = isInfoRich(dup) ? WEIGHTS.duplicateEditionPenalty : WEIGHTS.lowInfoEditionPenalty
      dup.score = Math.max(0, dup.score + penalty)
      dup.confidence = scoreToConfidence(dup.score)
      if (debug && dup.scoreBreakdown) {
        dup.scoreBreakdown.duplicatePenalty = penalty
        dup.scoreBreakdown.finalScore = dup.score
      }
    }

    // Only the best representative of this group goes forward.
    // Rest entries are discarded (their sourceIds are merged into best above).
    winners.push(best)
  }

  // ── Step 3: Near-identical detection across groups ────────────────────────
  const seenNearIdent = new Map<string, boolean>()

  for (const r of winners) {
    const key = nearIdentKey(r)
    if (seenNearIdent.has(key)) {
      // A near-identical entry already exists → heavy penalty
      const penalty = WEIGHTS.nearIdenticalPenalty
      r.score = Math.max(0, r.score + penalty)
      r.confidence = scoreToConfidence(r.score)
      if (debug && r.scoreBreakdown) {
        r.scoreBreakdown.duplicatePenalty += penalty
        r.scoreBreakdown.finalScore = r.score
      }
    } else {
      seenNearIdent.set(key, true)
    }
  }

  // ── Step 4: Re-sort and slice ─────────────────────────────────────────────
  return winners
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
}
