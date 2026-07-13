'use client'

import { useState, useEffect } from 'react'
import { Book as BookIcon } from 'lucide-react'
import { coverUrl } from '@/lib/coverUrl'

// Lucide Book icon (closed book) as a tiled SVG background pattern.
// viewBox='-4 -4 32 32' adds ~4 px padding around the 24×24 icon so tiles
// don't run edge-to-edge.
export const bookPatternUrl =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='-4 -4 32 32' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20'/%3E%3C/svg%3E")`

interface BookCoverProps {
  /** Raw external cover URL (proxied through /api/cover automatically). */
  src?: string | null
  alt?: string
  /** Book icon size in the placeholder; 0 hides the icon. */
  iconSize?: number
  /** Tiled pattern cell size in the placeholder. */
  patternSize?: number
  /** Placeholder pattern opacity. */
  patternOpacity?: number
  /** Called once when the image fails to load (404, blank 1×1, network). */
  onFail?: () => void
}

/**
 * Book cover image that fills its parent and degrades gracefully:
 * missing URL, 404, network error, or a blank 1×1 tracking image all
 * render the tiled-book placeholder instead of an empty gap.
 *
 * The parent element defines size and rounding (e.g. `w-[56px] h-[84px]
 * rounded-[10px] overflow-hidden`).
 */
export default function BookCover({
  src,
  alt = '',
  iconSize = 16,
  patternSize = 18,
  patternOpacity = 0.08,
  onFail,
}: BookCoverProps) {
  const [failed, setFailed] = useState(false)

  // If the book's cover URL changes (e.g. self-healed after a retry), try again.
  useEffect(() => { setFailed(false) }, [src])

  function handleFail() {
    if (failed) return
    setFailed(true)
    onFail?.()
  }

  // Already-proxied or local URLs pass through; external URLs get proxied.
  const resolved = src ? (src.startsWith('/') ? src : coverUrl(src)) : undefined

  if (!resolved || failed) {
    return (
      <div
        className="relative w-full h-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        <div
          className="absolute inset-0"
          style={{
            opacity: patternOpacity,
            backgroundImage: bookPatternUrl,
            backgroundSize: `${patternSize}px ${patternSize}px`,
            backgroundRepeat: 'repeat',
          }}
        />
        {iconSize > 0 && <BookIcon size={iconSize} color="white" className="relative z-10" />}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="w-full h-full object-cover"
      onError={handleFail}
      // Some CDNs return a tiny blank image with HTTP 200 instead of a 404.
      onLoad={(e) => {
        const img = e.currentTarget
        if (img.naturalWidth <= 1 || img.naturalHeight <= 1) handleFail()
      }}
    />
  )
}
