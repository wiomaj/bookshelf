'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  value: number
  options: number[]
  onSelect: (year: number) => void
}

/**
 * The year dropdown in the reading-pace card's header. It lives inside that
 * card rather than in the page header so it's clear it scopes only that card —
 * ratings, authors and genres stay all-time and say so in their subtitles.
 */
export default function YearPicker({ value, options, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-[5px] rounded-full px-[10px] py-[4px]"
        style={{ backgroundColor: 'var(--fill)' }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-[12px] font-semibold" style={{ color: 'var(--label)' }}>
          {value}
        </span>
        <ChevronDown size={12} style={{ color: 'var(--label-secondary)' }} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-[6px] rounded-[12px] overflow-hidden z-[60] max-h-[240px] overflow-y-auto"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
            minWidth: '110px',
          }}
        >
          {options.map(year => (
            <button
              key={year}
              role="option"
              aria-selected={year === value}
              onClick={() => { onSelect(year); setOpen(false) }}
              className="w-full px-[16px] py-[10px] text-left text-[15px]"
              style={{
                color: year === value ? 'var(--primary)' : 'var(--label)',
                fontWeight: year === value ? 600 : 400,
              }}
            >
              {year}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
