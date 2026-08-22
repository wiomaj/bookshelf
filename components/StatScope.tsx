'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  /** The period this card's numbers cover — shown on the pill. */
  label: string
  /** When given, the pill becomes a year dropdown; omit for a static badge. */
  options?: number[]
  onSelect?: (year: number) => void
}

/**
 * The pill in a stat card's header that spells out which period the card
 * covers. Every dashboard card renders one in the same spot, so "All time" and
 * a picked year are never mistaken for each other — the year picker only
 * scopes the card it sits in.
 */
export default function StatScope({ label, options, onSelect }: Props) {
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

  // Static badge — the card is all-time and has nothing to pick.
  if (!options || options.length === 0) {
    return (
      <span
        className="shrink-0 rounded-full px-[10px] py-[4px] text-[12px] font-semibold"
        style={{ backgroundColor: 'var(--fill)', color: 'var(--label-secondary)' }}
      >
        {label}
      </span>
    )
  }

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
          {label}
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
          {options.map(year => {
            const selected = String(year) === label
            return (
              <button
                key={year}
                role="option"
                aria-selected={selected}
                onClick={() => { onSelect?.(year); setOpen(false) }}
                className="w-full px-[16px] py-[10px] text-left text-[15px]"
                style={{
                  color: selected ? 'var(--primary)' : 'var(--label)',
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {year}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
