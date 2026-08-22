'use client'

import { useState, useEffect } from 'react'
import { useT } from '@/contexts/AppContext'
import StarRating from '@/components/StarRating'
import StatScope from '@/components/StatScope'
import type { Book } from '@/types/book'

interface Props {
  books: Book[]
}

export default function RatingDistributionChart({ books }: Props) {
  const t = useT()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const ratedBooks = books.filter((b) => b.rating >= 1 && b.rating <= 5)
  if (ratedBooks.length === 0) return null

  // counts[0] = 5★, counts[1] = 4★, ..., counts[4] = 1★
  const counts = [5, 4, 3, 2, 1].map(
    (r) => ratedBooks.filter((b) => b.rating === r).length
  )

  const maxCount = Math.max(...counts, 1)
  const average = ratedBooks.reduce((s, b) => s + b.rating, 0) / ratedBooks.length

  return (
    <div
      className="mx-4 mb-4 rounded-[16px] p-[16px]"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      {/* Card title + the period it covers — ratings are always all-time */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p
            className="text-[17px] font-semibold tracking-[-0.43px]"
            style={{ color: 'var(--label)' }}
          >
            {t.statsRatingDistribution}
          </p>
          <p
            className="text-[12px] mt-[2px]"
            style={{ color: 'var(--label-secondary)' }}
          >
            {t.statsAllTime}
          </p>
        </div>
        <StatScope label={t.allTime} />
      </div>

      {/* Average rating */}
      <div className="flex items-baseline gap-[8px] mt-[24px] mb-[24px]">
        <span
          className="text-[40px] font-bold leading-none tracking-[0.38px]"
          style={{ color: 'var(--label)' }}
        >
          {average.toFixed(1)}
        </span>
        <span
          className="text-[12px] font-medium"
          style={{ color: 'var(--label-secondary)' }}
        >
          {t.statsAverageRating}
        </span>
      </div>

      {/* Two-column layout: stars | bars */}
      <div className="flex gap-[16px] items-center">
        {/* Left: star rows (5★ down to 1★) */}
        <div className="flex flex-col gap-[4px] shrink-0">
          {[5, 4, 3, 2, 1].map((r) => (
            <div key={r} className="py-[4px]">
              <StarRating rating={r} readonly size={16} />
            </div>
          ))}
        </div>

        {/* Right: horizontal bars + counts */}
        <div className="flex flex-col gap-[4px] flex-1 min-w-0">
          {counts.map((count, i) => {
            // max bar fills the available space; scale proportionally
            const pct = count === 0 ? 0 : Math.max(0.04, count / maxCount)
            return (
              <div key={i} className="flex items-center gap-[8px] py-[4px]">
                <div className="flex-1 min-w-0">
                  <div
                    className="h-[16px] rounded-[4px]"
                    style={{
                      width: count === 0 ? '5px' : ready ? `${Math.round(pct * 100)}%` : '0%',
                      backgroundColor: count === 0 ? 'var(--fill)' : 'var(--primary-muted)',
                      transition: `width 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s`,
                    }}
                  />
                </div>
                {count > 0 && (
                  <span
                    className="text-[11px] font-semibold leading-[13px] tracking-[0.06px] shrink-0 w-4 text-right"
                    style={{ color: 'var(--label)' }}
                  >
                    {count}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
