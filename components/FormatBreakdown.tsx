'use client'

import { useState, useEffect } from 'react'
import { useT } from '@/contexts/AppContext'
import { BOOK_FORMATS, countBookFormats, type BookFormat } from '@/lib/bookFormat'
import type { Book } from '@/types/book'

interface Props {
  books: Book[]  // all read books
}

// One accent, three weights — the app has a single brand colour, so the split
// reads as shades of it rather than three unrelated hues.
const FORMAT_COLORS: Record<BookFormat, string> = {
  print:     'var(--primary)',
  ebook:     'color-mix(in srgb, var(--primary) 55%, transparent)',
  audiobook: 'color-mix(in srgb, var(--primary) 28%, transparent)',
}

export default function FormatBreakdown({ books }: Props) {
  const t = useT()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  if (books.length === 0) return null

  const labels: Record<BookFormat, string> = {
    print: t.printBook,
    ebook: t.ebook,
    audiobook: t.audiobook,
  }

  const counts = countBookFormats(books)
  const total = books.length

  // Every book has a format, so the three counts always add up to the shelf —
  // percentages are of the whole, and the bar always fills its track.
  const shares = BOOK_FORMATS.map(format => ({
    format,
    count: counts[format],
    share: (counts[format] / total) * 100,
  }))
  const present = shares.filter(s => s.count > 0)
  const leading = present.reduce((a, b) => (b.count > a.count ? b : a))

  return (
    <div
      className="mx-4 mb-4 rounded-[16px] p-[16px]"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      {/* Card title. The subtitle leads with the period the card covers —
          formats are always all-time, whatever year the pace card is showing. */}
      <p
        className="text-[17px] font-semibold tracking-[-0.43px]"
        style={{ color: 'var(--label)' }}
      >
        {t.statsFormatSplit}
      </p>
      <p
        className="text-[12px] mt-[2px] mb-[24px]"
        style={{ color: 'var(--label-secondary)' }}
      >
        {t.statsFormatSplitSub}
      </p>

      {/* Headline: the format that takes the biggest share of the shelf */}
      <div className="flex items-baseline gap-[8px] mb-[16px]">
        <span
          className="text-[40px] font-bold leading-none tracking-[0.38px]"
          style={{ color: 'var(--label)' }}
        >
          {Math.round(leading.share)}%
        </span>
        <span
          className="text-[12px] font-medium"
          style={{ color: 'var(--label-secondary)' }}
        >
          {labels[leading.format]}
        </span>
      </div>

      {/* Stacked bar — one segment per format that's actually on the shelf */}
      <div
        className="flex w-full h-[10px] rounded-full overflow-hidden mb-[16px]"
        style={{ backgroundColor: 'var(--fill)' }}
      >
        {present.map(({ format, share }, i) => (
          <div
            key={format}
            style={{
              width: ready ? `${share}%` : 0,
              backgroundColor: FORMAT_COLORS[format],
              transition: `width 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s`,
            }}
          />
        ))}
      </div>

      {/* Legend — count and share per format */}
      <div className="flex flex-col gap-[10px]">
        {present.map(({ format, count, share }) => (
          <div key={format} className="flex items-center gap-2">
            <span
              className="w-[8px] h-[8px] rounded-full shrink-0"
              style={{ backgroundColor: FORMAT_COLORS[format] }}
            />
            <span
              className="text-[12px] font-medium leading-none truncate"
              style={{ color: 'var(--label)', minWidth: 0, flex: '1 1 0' }}
            >
              {labels[format]}
            </span>
            <span
              className="text-[11px] font-semibold tabular-nums shrink-0"
              style={{ color: 'var(--label)' }}
            >
              {count}
            </span>
            <span
              className="text-[11px] tabular-nums w-[34px] text-right shrink-0"
              style={{ color: 'var(--label-secondary)' }}
            >
              {Math.round(share)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
