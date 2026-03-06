'use client'

import { useState, useEffect, useRef } from 'react'
import { useT } from '@/contexts/AppContext'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes

export default function NewVersionBanner() {
  const [available, setAvailable] = useState(false)
  const t = useT()
  const buildId = useRef<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextData = (window as any).__NEXT_DATA__
    if (!nextData?.buildId) return
    buildId.current = nextData.buildId

    async function check() {
      if (!buildId.current) return
      try {
        const res = await fetch(
          `/_next/static/${buildId.current}/_buildManifest.js`,
          { cache: 'no-store' }
        )
        if (!res.ok) setAvailable(true)
      } catch {
        // network error — ignore, don't show banner
      }
    }

    const id = setInterval(check, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  if (!available) return null

  return (
    <div
      className="fixed top-4 left-4 right-4 z-[200] max-w-[568px] mx-auto cursor-pointer"
      onClick={() => window.location.reload()}
    >
      <div
        className="glass rounded-2xl px-4 py-3 flex items-center gap-3 active:opacity-80 transition-opacity"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)', borderColor: 'var(--glass-border)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/banner-cat.png" alt="" className="w-8 h-8 shrink-0 object-contain" />
        <p className="text-[14px] font-medium leading-snug" style={{ color: 'var(--label)' }}>
          {t.newVersionBanner}
        </p>
      </div>
    </div>
  )
}
