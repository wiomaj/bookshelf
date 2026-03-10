'use client'

import { useState, useEffect } from 'react'
import { useT } from '@/contexts/AppContext'
import { SHORT_MONTHS } from '@/lib/month'
import type { Book } from '@/types/book'

interface Props {
  books: Book[]
  year: number
}

export default function ReadingPaceChart({ books, year }: Props) {
  const t = useT()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const counts = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return books.filter((b) => b.year === year && b.month === m).length
  })

  const maxCount = Math.max(...counts, 1)
  const totalThisYear = books.filter((b) => b.year === year).length
  const uncategorised = totalThisYear - counts.reduce((s, c) => s + c, 0)

  return (
    <div
      className="mx-4 mb-4 rounded-[16px] p-[16px]"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      {/* Card title */}
      <p
        className="text-[17px] font-semibold tracking-[-0.43px]"
        style={{ color: 'var(--label)' }}
      >
        {t.statsReadingPace}
      </p>
      <p
        className="text-[12px] mt-[2px] mb-[24px]"
        style={{ color: 'var(--label-secondary)' }}
      >
        {t.statsBooksPerMonth}
      </p>

      {/* Large stat */}
      <div className="flex items-baseline gap-[8px] mb-[24px]">
        <span
          className="text-[40px] font-bold leading-none tracking-[0.38px]"
          style={{ color: 'var(--label)' }}
        >
          {totalThisYear}
        </span>
        <span
          className="text-[12px] font-medium"
          style={{ color: 'var(--label-secondary)' }}
        >
          {t.statsBooks}
        </span>
      </div>

      {totalThisYear === 0 ? (
        <p className="text-[13px] text-center py-4" style={{ color: 'var(--label-tertiary)' }}>
          {t.statsNoBooks}
        </p>
      ) : (
        <div className="flex flex-col gap-[8px]">
          {/* Bar chart */}
          <div className="flex items-end gap-[4px]">
            {counts.map((count, i) => {
              const barH = count === 0 ? 3 : Math.max(16, Math.round((count / maxCount) * 72))
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-[4px]">
                  {/* Count above bar — invisible placeholder keeps alignment */}
                  <span
                    className="text-[11px] font-semibold leading-[13px] tracking-[0.06px] text-center w-full"
                    style={{ color: count > 0 ? 'var(--label)' : 'transparent' }}
                  >
                    {count}
                  </span>
                  {/* Bar */}
                  <div
                    className="w-full rounded-[4px]"
                    style={{
                      height: ready ? barH : 0,
                      backgroundColor: count > 0 ? 'var(--primary-muted)' : 'var(--fill)',
                      transition: `height 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.04}s`,
                    }}
                  />
                  {/* Month label */}
                  <span
                    className="text-[11px] leading-[13px] tracking-[0.06px] text-center w-full"
                    style={{ color: 'var(--label-secondary)' }}
                  >
                    {SHORT_MONTHS[i][0]}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Uncategorised note */}
          {uncategorised > 0 && (
            <p
              className="text-[11px] leading-[13px] tracking-[0.06px] text-right"
              style={{ color: 'var(--label-secondary)' }}
            >
              + {uncategorised} without a specific month
            </p>
          )}
        </div>
      )}
    </div>
  )
}
