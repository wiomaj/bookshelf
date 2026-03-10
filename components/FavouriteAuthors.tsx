'use client'

import { useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'

interface Props {
  books: Book[]
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

  // Only show if we have at least 2 authors or the top author has > 1 book
  if (maxCount === 1 && sorted.length < 2) return null

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
        {t.statsFavouriteAuthors}
      </p>
      <p
        className="text-[12px] mt-[2px] mb-[24px]"
        style={{ color: 'var(--label-secondary)' }}
      >
        {t.statsByBooksRead}
      </p>

      {/* Author rows */}
      <div className="flex flex-col gap-[12px]">
        {sorted.map(([author, count]) => {
          const barW = Math.max(16, Math.round((count / maxCount) * 100))
          return (
            <div key={author} className="flex items-center gap-[20px]">
              {/* Author name — fixed width column */}
              <span
                className="text-[12px] font-medium leading-[16px] shrink-0 w-[110px] truncate"
                style={{ color: 'var(--label)' }}
              >
                {author}
              </span>
              {/* Bar + count */}
              <div className="flex items-center gap-[8px]">
                <div
                  className="h-[16px] rounded-[4px] shrink-0 transition-all duration-300"
                  style={{
                    width: `${barW}px`,
                    backgroundColor: 'var(--primary-muted)',
                  }}
                />
                <span
                  className="text-[11px] font-semibold leading-[13px] tracking-[0.06px] shrink-0"
                  style={{ color: 'var(--label)' }}
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
