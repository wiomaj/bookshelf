'use client'

import { useT } from '@/contexts/AppContext'

export type BookStatus = 'read' | 'to_read' | 'wishlist'

export default function StatusPicker({
  value,
  onChange,
}: {
  value: BookStatus
  onChange: (status: BookStatus) => void
}) {
  const t = useT()

  const tabs: { key: BookStatus; label: string }[] = [
    { key: 'read', label: t.tabRead },
    { key: 'to_read', label: t.tabToRead },
    { key: 'wishlist', label: t.tabWishlist },
  ]

  return (
    <div className="flex p-[3px] rounded-full" style={{ backgroundColor: 'var(--fill)' }}>
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className="flex-1 py-[6px] rounded-full text-[13px] font-medium transition-all"
          style={
            value === key
              ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--label)', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }
              : { color: 'var(--label-secondary)' }
          }
        >
          {label}
        </button>
      ))}
    </div>
  )
}
