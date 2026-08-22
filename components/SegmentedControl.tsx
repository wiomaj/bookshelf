'use client'

import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

export type SegmentedOption<T extends string> = {
  value: T
  label: string
  icon?: LucideIcon
}

/**
 * iOS-style segmented control: one exclusive choice, laid out as equal-width
 * segments with a sliding pill behind the selected one.
 */
export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  layoutId,
}: {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  ariaLabel?: string
  /** Unique per rendered control — shared ids would make the pills animate into each other. */
  layoutId?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex p-[3px] rounded-full"
      style={{ backgroundColor: 'var(--fill)' }}
    >
      {options.map(({ value: key, label, icon: Icon }) => {
        const selected = value === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(key)}
            className="relative flex-1 flex items-center justify-center gap-[6px] py-[8px] rounded-full text-[13px] font-medium transition-colors"
            style={{ color: selected ? 'var(--label)' : 'var(--label-secondary)', fontWeight: selected ? 600 : 500 }}
          >
            {selected && (
              <motion.span
                layoutId={layoutId ?? 'segmented-control-thumb'}
                transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: 'var(--bg-elevated)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}
              />
            )}
            <span className="relative flex items-center gap-[6px]">
              {Icon && <Icon size={15} strokeWidth={1.9} />}
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
