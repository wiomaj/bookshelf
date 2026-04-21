/**
 * lib/dnbUtils.ts
 *
 * Shared helpers for parsing DNB (Deutsche Nationalbibliothek) SRU responses.
 * Used by app/api/isbn/route.ts and app/api/search/route.ts.
 */

/**
 * Strip ISBD/MARC formatting from a DNB dc:title value.
 * DNB titles often look like: "[Parallel title] ; Main title : Subtitle / Responsibility"
 * Returns the plain main title only.
 */
export function cleanDnbTitle(raw: string): string {
  return raw
    .trim()
    .replace(/^\[.*?\]\s*;\s*/, '') // drop leading parallel-title in brackets
    .replace(/\s*[:/].*$/, '')      // drop subtitle and responsibility statement
    .trim()
}

/** Remove role annotations like [Illustrator], [Verfasser], [Übers.] from creator. */
export function stripCreatorRole(raw: string): string {
  return raw.replace(/\s*\[.*?\]/g, '').trim()
}

/** Invert "Lastname, Firstname" → "Firstname Lastname". */
export function normaliseCreator(raw: string): string {
  if (!raw.includes(',')) return raw
  const [last, ...firstParts] = raw.split(',').map((p) => p.trim())
  return [...firstParts, last].join(' ')
}
