'use client'

import { useState, useEffect } from 'react'
import { useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'

interface Props {
  books: Book[]  // all read books
}

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

  // Sort by count descending
  const sorted = [...countMap.entries()].sort((a, b) => b[1] - a[1])
  const maxCount = sorted[0][1]
  const total = sorted.reduce((s, [, c]) => s + c, 0)

  return (
    <div
      className="mx-4 mb-6 rounded-[20px] px-4 pt-4 pb-5"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      {/* Header */}
      <div className="mb-1">
        <p className="text-[13px] font-semibold tracking-[-0.1px]" style={{ color: 'var(--label)' }}>
          {t.statsGenreBreakdown}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--label-secondary)' }}>
          {t.statsByBooksRead}
        </p>
      </div>

      {/* Total badge */}
      <p className="text-[28px] font-bold tracking-[-0.5px] mb-3" style={{ color: 'var(--label)' }}>
        {total}
        <span className="text-[13px] font-normal ml-1" style={{ color: 'var(--label-secondary)' }}>
          {total === 1 ? t.singularBook : t.pluralBooks}
        </span>
      </p>

      {/* Horizontal bar list */}
      <div className="flex flex-col gap-[10px]">
        {sorted.map(([genre, count], i) => {
          const isMax = count === maxCount
          const barW = Math.max(8, Math.round((count / maxCount) * 100))
          return (
            <div key={genre} className="flex items-center gap-2">
              {/* Genre name */}
              <span
                className="text-[12px] font-medium leading-none truncate"
                style={{ color: 'var(--label)', minWidth: 0, flex: '1 1 0' }}
              >
                {genre}
              </span>
              {/* Bar + count */}
              <div className="flex items-center gap-[6px] shrink-0">
                <div
                  className="h-[8px] rounded-full"
                  style={{
                    width: ready ? `${barW}px` : 0,
                    maxWidth: '100px',
                    backgroundColor: isMax ? 'var(--primary)' : 'var(--primary-muted)',
                    transition: `width 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s`,
                  }}
                />
                <span
                  className="text-[11px] font-semibold tabular-nums w-4 text-right"
                  style={{ color: isMax ? 'var(--primary)' : 'var(--label-secondary)' }}
                >
                  {count}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
