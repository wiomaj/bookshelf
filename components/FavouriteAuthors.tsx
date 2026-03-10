'use client'

import { useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'

interface Props {
  books: Book[]  // all read books
}

const MAX_AUTHORS = 5

export default function FavouriteAuthors({ books }: Props) {
  const t = useT()

  if (books.length === 0) return null

  // Count books per author
  const countMap = new Map<string, number>()
  for (const b of books) {
    const author = b.author?.trim()
    if (!author) continue
    countMap.set(author, (countMap.get(author) ?? 0) + 1)
  }

  if (countMap.size === 0) return null

  // Sort by count descending, take top N
  const sorted = [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_AUTHORS)

  const maxCount = sorted[0][1]

  // Only show component if top author has read > 1 book, or there are at least 2 authors
  if (maxCount === 1 && sorted.length < 2) return null

  return (
    <div
      className="mx-4 mb-6 rounded-[20px] px-4 pt-4 pb-5"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      {/* Header */}
      <div className="mb-3">
        <p className="text-[13px] font-semibold tracking-[-0.1px]" style={{ color: 'var(--label)' }}>
          {t.statsFavouriteAuthors}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--label-secondary)' }}>
          {t.statsByBooksRead}
        </p>
      </div>

      {/* Horizontal bar list */}
      <div className="flex flex-col gap-[10px]">
        {sorted.map(([author, count]) => {
          const isMax = count === maxCount
          const barW = Math.max(8, Math.round((count / maxCount) * 100))
          return (
            <div key={author} className="flex items-center gap-2">
              {/* Author name */}
              <span
                className="text-[12px] font-medium leading-none truncate"
                style={{ color: 'var(--label)', minWidth: 0, flex: '1 1 0' }}
              >
                {author}
              </span>
              {/* Bar + count */}
              <div className="flex items-center gap-[6px] shrink-0">
                <div
                  className="h-[8px] rounded-full transition-all duration-300"
                  style={{
                    width: `${barW}px`,
                    maxWidth: '100px',
                    backgroundColor: isMax ? 'var(--primary)' : 'var(--primary-muted)',
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
