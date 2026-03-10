'use client'

import { useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'

interface Props {
  books: Book[]  // all read books
}

const STAR_LABELS = ['★1', '★2', '★3', '★4', '★5']

export default function RatingDistributionChart({ books }: Props) {
  const t = useT()

  if (books.length === 0) return null

  // Count books per rating 1–5
  const counts = [1, 2, 3, 4, 5].map(
    (r) => books.filter((b) => b.rating === r).length
  )

  const maxCount = Math.max(...counts, 1)
  const total = counts.reduce((s, c) => s + c, 0)

  if (total === 0) return null

  return (
    <div
      className="mx-4 mb-6 rounded-[20px] px-4 pt-4 pb-5"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      {/* Header */}
      <div className="mb-1">
        <p className="text-[13px] font-semibold tracking-[-0.1px]" style={{ color: 'var(--label)' }}>
          {t.statsRatingDistribution}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--label-secondary)' }}>
          {t.statsAllTime}
        </p>
      </div>

      {/* Total badge */}
      <p className="text-[28px] font-bold tracking-[-0.5px] mb-3" style={{ color: 'var(--label)' }}>
        {total}
        <span className="text-[13px] font-normal ml-1" style={{ color: 'var(--label-secondary)' }}>
          {total === 1 ? 'rating' : 'ratings'}
        </span>
      </p>

      {/* Bar chart */}
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
              {/* Star label */}
              <span className="text-[9px] leading-none" style={{ color: 'var(--label-tertiary)' }}>
                {STAR_LABELS[i]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
