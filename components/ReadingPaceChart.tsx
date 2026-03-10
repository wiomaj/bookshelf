'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '@/contexts/AppContext'
import { SHORT_MONTHS } from '@/lib/month'
import type { Book } from '@/types/book'

interface Props {
  books: Book[]  // all read books
}

export default function ReadingPaceChart({ books }: Props) {
  const t = useT()

  // Available years sorted descending
  const years = [...new Set(books.map((b) => b.year))].sort((a, b) => b - a)
  const [yearIndex, setYearIndex] = useState(0)
  const selectedYear = years[yearIndex] ?? new Date().getFullYear()

  // Count books per calendar month (1–12) for the selected year
  const counts = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return books.filter((b) => b.year === selectedYear && b.month === m).length
  })

  const maxCount = Math.max(...counts, 1)
  // Use ALL books for the year (including seasonal/unknown months) for the total
  const totalThisYear = books.filter((b) => b.year === selectedYear).length
  // Books without a specific calendar month (seasonal or unknown)
  const uncategorised = totalThisYear - counts.reduce((s, c) => s + c, 0)

  if (years.length === 0) return null

  return (
    <div
      className="mx-4 mb-6 rounded-[20px] px-4 pt-4 pb-5"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-[13px] font-semibold tracking-[-0.1px]" style={{ color: 'var(--label)' }}>
            {t.statsReadingPace}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--label-secondary)' }}>
            {t.statsBooksPerMonth}
          </p>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setYearIndex((i) => Math.min(i + 1, years.length - 1))}
            disabled={yearIndex >= years.length - 1}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-opacity"
            style={{
              backgroundColor: 'var(--fill)',
              opacity: yearIndex >= years.length - 1 ? 0.3 : 1,
            }}
          >
            <ChevronLeft size={14} strokeWidth={2.5} style={{ color: 'var(--label)' }} />
          </button>
          <span className="text-[13px] font-semibold w-10 text-center" style={{ color: 'var(--label)' }}>
            {selectedYear}
          </span>
          <button
            onClick={() => setYearIndex((i) => Math.max(i - 1, 0))}
            disabled={yearIndex <= 0}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-opacity"
            style={{
              backgroundColor: 'var(--fill)',
              opacity: yearIndex <= 0 ? 0.3 : 1,
            }}
          >
            <ChevronRight size={14} strokeWidth={2.5} style={{ color: 'var(--label)' }} />
          </button>
        </div>
      </div>

      {/* Total badge */}
      {totalThisYear > 0 && (
        <p className="text-[28px] font-bold tracking-[-0.5px] mb-3" style={{ color: 'var(--label)' }}>
          {totalThisYear}
          <span className="text-[13px] font-normal ml-1" style={{ color: 'var(--label-secondary)' }}>
            {totalThisYear === 1 ? 'book' : 'books'}
          </span>
        </p>
      )}

      {totalThisYear === 0 ? (
        <p className="text-[13px] text-center py-6" style={{ color: 'var(--label-tertiary)' }}>
          {t.statsNoBooks}
        </p>
      ) : (
        /* Bar chart */
        <div className="flex items-end gap-[5px] h-[88px]">
          {counts.map((count, i) => {
            const barH = count === 0 ? 3 : Math.max(12, Math.round((count / maxCount) * 72))
            const isMax = count > 0 && count === maxCount
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-[4px]">
                {/* Count label */}
                <span
                  className="text-[10px] font-semibold leading-none"
                  style={{ color: count > 0 ? 'var(--label)' : 'transparent' }}
                >
                  {count}
                </span>
                {/* Bar */}
                <div
                  className="w-full rounded-t-[4px] rounded-b-[2px] transition-all duration-300"
                  style={{
                    height: barH,
                    backgroundColor: isMax
                      ? 'var(--primary)'
                      : count > 0
                        ? 'var(--primary-muted)'
                        : 'var(--fill)',
                    opacity: count === 0 ? 0.5 : 1,
                  }}
                />
                {/* Month label */}
                <span className="text-[9px] leading-none" style={{ color: 'var(--label-tertiary)' }}>
                  {SHORT_MONTHS[i]}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Note for seasonal/unknown-month books */}
      {uncategorised > 0 && totalThisYear > 0 && (
        <p className="text-[10px] mt-2 text-right" style={{ color: 'var(--label-tertiary)' }}>
          +{uncategorised} without specific month
        </p>
      )}
    </div>
  )
}
