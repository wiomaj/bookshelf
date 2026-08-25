'use client'

import { useState, useEffect, useRef } from 'react'
import { useT } from '@/contexts/AppContext'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes

async function fetchBuildId(): Promise<string | null> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { buildId: string | null }
    return data.buildId
  } catch {
    return null
  }
}

export default function NewVersionBanner() {
  const [available, setAvailable] = useState(false)
  const t = useT()
  const baseline = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      const current = await fetchBuildId()
      if (cancelled || !current) return
      if (baseline.current === null) {
        baseline.current = current
        return
      }
      if (current !== baseline.current) setAvailable(true)
    }

    // Check immediately, not just after the first interval — on iOS the app
    // is often backgrounded (and its timers suspended) well within
    // POLL_INTERVAL, so waiting for the interval alone can mean it never
    // fires during a typical session.
    check()

    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }

    const id = setInterval(check, POLL_INTERVAL)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
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
