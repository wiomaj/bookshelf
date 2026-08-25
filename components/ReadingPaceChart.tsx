'use client'

import { useState, useEffect, useMemo } from 'react'
import { useT } from '@/contexts/AppContext'
import { SHORT_MONTHS } from '@/lib/month'
import YearPicker from '@/components/YearPicker'
import type { Book } from '@/types/book'

interface Props {
  /** Every book on the Read shelf — abandoned ones included, counted separately. */
  books: Book[]
}

// A book belongs to the year and month it was *finished*. read_year/read_month
// are the canonical finish date; year/month are the older columns they replaced,
// so they stay as the fallback for rows written before the split. Same rule as
// csvExport and readingDuration.
const finishYear  = (b: Book): number        => b.read_year ?? b.year
const finishMonth = (b: Book): number | null => b.read_month ?? b.month ?? null

// Season codes 13–16 (Spring/Summer/Fall/Winter) are a real answer to "when did
// you read it?", just a coarser one than a month. They can't sit in a month bar
// without inventing a month, so they get their own row under the chart.
const SEASON_CODES = [13, 14, 15, 16] as const

export default function ReadingPaceChart({ books }: Props) {
  const t = useT()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Years come from every book on the shelf, abandoned included — a year where
  // you only ever gave up on books is still a year worth showing.
  const years = useMemo(
    () => [...new Set(books.map(finishYear))].sort((a, b) => b - a),
    [books],
  )

  // null until the reader picks one, so the default follows the data as it loads.
  const [picked, setPicked] = useState<number | null>(null)
  const year = picked ?? years[0] ?? new Date().getFullYear()

  const stats = useMemo(() => {
    const ofYear = books.filter(b => finishYear(b) === year)
    const finished = ofYear.filter(b => b.status !== 'abandoned')

    // Year-over-year: only meaningful once the shelf actually reaches back into
    // the previous year. A year that holds nothing but abandoned books still
    // counts as reached — finishing 0 of them is a real comparison.
    const ofPrevYear = books.filter(b => finishYear(b) === year - 1)
    const prevTotal = ofPrevYear.length > 0
      ? ofPrevYear.filter(b => b.status !== 'abandoned').length
      : null

    const counts = Array.from({ length: 12 }, (_, i) =>
      finished.filter(b => finishMonth(b) === i + 1).length,
    )
    const seasons = SEASON_CODES.map(code =>
      finished.filter(b => finishMonth(b) === code).length,
    )
    const dated = counts.reduce((s, c) => s + c, 0) + seasons.reduce((s, c) => s + c, 0)

    return {
      counts,
      seasons,
      total: finished.length,
      undated: finished.length - dated,
      abandoned: ofYear.length - finished.length,
      prevTotal,
    }
  }, [books, year])

  const delta = stats.prevTotal === null ? null : stats.total - stats.prevTotal

  // Seasons render as chips, not bars, so they must not scale the month bars.
  const maxCount = Math.max(...stats.counts, 1)

  return (
    <div
      className="mx-4 mb-4 rounded-[16px] p-[16px]"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      {/* Card title + the year this card — and only this card — covers */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p
            className="text-[17px] font-semibold tracking-[-0.43px]"
            style={{ color: 'var(--label)' }}
          >
            {t.statsReadingPace}
          </p>
          <p
            className="text-[12px] mt-[2px]"
            style={{ color: 'var(--label-secondary)' }}
          >
            {t.statsBooksPerMonth}
          </p>
        </div>
        <YearPicker value={year} options={years} onSelect={setPicked} />
      </div>

      {/* Large stat */}
      <div className="flex items-baseline flex-wrap gap-x-[8px] gap-y-[6px] mt-[24px] mb-[24px]">
        <span
          className="text-[40px] font-bold leading-none tracking-[0.38px]"
          style={{ color: 'var(--label)' }}
        >
          {stats.total}
        </span>
        <span
          className="text-[12px] font-medium"
          style={{ color: 'var(--label-secondary)' }}
        >
          {t.statsBooks}
        </span>
        {/* Year-over-year delta against the year before the one being shown */}
        {delta !== null && (
          <span
            className="rounded-full px-[8px] py-[3px] text-[11px] font-semibold leading-[13px] tracking-[0.06px]"
            style={
              delta > 0
                ? {
                    backgroundColor: 'color-mix(in srgb, var(--success) 14%, transparent)',
                    color: 'var(--success)',
                  }
                : { backgroundColor: 'var(--fill)', color: 'var(--label-secondary)' }
            }
          >
            {delta === 0
              ? `${t.statsSameAsYear} ${year - 1}`
              /* U+2212 minus, not a hyphen — it lines up with the digits */
              : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${t.statsVsYear} ${year - 1}`}
          </span>
        )}
        {stats.abandoned > 0 && (
          <span
            className="text-[12px] font-medium"
            style={{ color: 'var(--label-tertiary)' }}
          >
            · {stats.abandoned} {t.statsNotFinished}
          </span>
        )}
      </div>

      {stats.total === 0 ? (
        <p className="text-[13px] text-center py-4" style={{ color: 'var(--label-tertiary)' }}>
          {t.statsNoBooks}
        </p>
      ) : (
        <div className="flex flex-col gap-[8px]">
          {/* Bar chart */}
          <div className="flex items-end gap-[4px]">
            {stats.counts.map((count, i) => {
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

          {/* Books logged to a season rather than a month */}
          {stats.seasons.some(c => c > 0) && (
            <div className="flex flex-wrap gap-[6px] pt-[4px]">
              {stats.seasons.map((count, i) =>
                count === 0 ? null : (
                  <span
                    key={SEASON_CODES[i]}
                    className="rounded-full px-[8px] py-[3px] text-[11px] leading-[13px] tracking-[0.06px]"
                    style={{ backgroundColor: 'var(--fill)', color: 'var(--label-secondary)' }}
                  >
                    {t.seasonNames[i]}
                    <span className="font-semibold ml-[4px]" style={{ color: 'var(--label)' }}>
                      {count}
                    </span>
                  </span>
                ),
              )}
            </div>
          )}

          {/* Books with no month or season at all */}
          {stats.undated > 0 && (
            <p
              className="text-[11px] leading-[13px] tracking-[0.06px] text-right"
              style={{ color: 'var(--label-secondary)' }}
            >
              + {stats.undated} {t.statsWithoutMonth}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
