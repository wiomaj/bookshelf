/**
 * Upgrade an external cover URL to the highest available resolution.
 * – Google Books: switch to zoom=0 + request 1200px via fife
 * – Open Library: swap -S/-M suffix for -L
 */
export function heroImageUrl(url: string): string {
  if (url.includes('books.google.com')) {
    return url
      .replace('http:', 'https:')
      .replace(/zoom=\d+/, 'zoom=0')
      .replace(/&fife=[^&]*/g, '') + '&fife=w1200'
  }
  if (url.includes('covers.openlibrary.org')) {
    return url.replace(/-[SM]\.jpg$/, '-L.jpg')
  }
  return url
}

/**
 * Route a raw cover URL through the local /api/cover proxy so the browser
 * (and Vercel CDN) caches it for 7 days instead of relying on short-lived
 * external Cache-Control headers.
 */
export function coverUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  return `/api/cover?url=${encodeURIComponent(raw)}`
}

/**
 * Convenience: upgrade to the hero (high-res) version, then proxy for caching.
 * Use this wherever the full-bleed hero background or floating cover card is shown.
 */
export function heroCoverUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  return coverUrl(heroImageUrl(raw))
}
