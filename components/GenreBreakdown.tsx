'use client'

import { useState, useEffect } from 'react'
import { useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'

interface Props {
  books: Book[]  // all read books
}

const MAX_SLICES = 5

// One accent, decreasing weights — same "shades of the brand colour" system
// FormatBreakdown uses, so the wedges read as one family rather than a
// rainbow of unrelated hues.
const SLICE_OPACITIES = [100, 78, 58, 42, 30, 18]

export default function GenreBreakdown({ books }: Props) {
  const t = useT()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Count books per genre (only books that have a genre set)
  const countMap = new Map<string, number>()
  for (const b of books) {
    const genre = b.genre?.trim()
    if (!genre) continue
    countMap.set(genre, (countMap.get(genre) ?? 0) + 1)
  }

  // Hide if no genre data
  if (countMap.size === 0) return null

  const sorted = [...countMap.entries()].sort((a, b) => b[1] - a[1])
  const shown = sorted.reduce((s, [, c]) => s + c, 0)

  // Group anything past the top slices into one "Other" wedge, so the chart
  // stays legible instead of splintering into a dozen slivers.
  const top = sorted.slice(0, MAX_SLICES)
  const rest = sorted.slice(MAX_SLICES)
  const restTotal = rest.reduce((s, [, c]) => s + c, 0)
  const slices: [string, number][] = restTotal > 0 ? [...top, [t.statsOtherGenres, restTotal]] : top

  const colorFor = (i: number) =>
    `color-mix(in srgb, var(--primary) ${SLICE_OPACITIES[i] ?? 15}%, transparent)`

  // Conic-gradient stops for the donut
  let acc = 0
  const stops = slices.map(([, count], i) => {
    const from = (acc / shown) * 100
    acc += count
    return `${colorFor(i)} ${from}% ${(acc / shown) * 100}%`
  })

  return (
    <div
      className="mx-4 mb-4 rounded-[16px] p-[16px]"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      {/* Card title. The subtitle leads with the period the card covers —
          genres are always all-time, whatever year the pace card is showing. */}
      <p className="text-[17px] font-semibold tracking-[-0.43px]" style={{ color: 'var(--label)' }}>
        {t.statsGenreBreakdown}
      </p>
      <p className="text-[12px] mt-[2px] mb-[24px]" style={{ color: 'var(--label-secondary)' }}>
        {t.statsGenreBreakdownSub}
      </p>

      <div className="flex items-center gap-[20px]">
        {/* Donut */}
        <div
          className="relative shrink-0 rounded-full"
          style={{
            width: 120,
            height: 120,
            background: ready ? `conic-gradient(${stops.join(', ')})` : 'var(--fill)',
            transition: 'background 0.6s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <div
            className="absolute rounded-full flex items-center justify-center"
            style={{ inset: 18, backgroundColor: 'var(--bg-elevated)' }}
          >
            <span
              className="text-[24px] font-bold leading-none tracking-[0.2px]"
              style={{ color: 'var(--label)' }}
            >
              {shown}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-[10px] min-w-0 flex-1">
          {slices.map(([genre, count], i) => (
            <div key={genre} className="flex items-center gap-[8px]">
              <span
                className="w-[8px] h-[8px] rounded-full shrink-0"
                style={{ backgroundColor: colorFor(i) }}
              />
              <span
                className="text-[12px] font-medium leading-none truncate"
                style={{ color: 'var(--label)', minWidth: 0, flex: '1 1 0' }}
              >
                {genre}
              </span>
              <span
                className="text-[11px] font-semibold tabular-nums shrink-0"
                style={{ color: 'var(--label)' }}
              >
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Caption: the tally only ever covers books with a saved genre, so it
          explains why that count trails the full shelf. */}
      <p
        className="text-[11px] mt-[16px] pt-[12px]"
        style={{ color: 'var(--label-secondary)', borderTop: '1px solid var(--separator)' }}
      >
        {t.statsGenreBreakdownCaption
          .replace('{shown}', String(shown))
          .replace('{total}', String(books.length))}
      </p>
    </div>
  )
}
