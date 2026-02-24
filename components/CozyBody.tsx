'use client'

import { useApp } from '@/contexts/AppContext'
import CozyOverlay from './CozyOverlay'

export default function CozyBody({ children }: { children: React.ReactNode }) {
  const { cozyMode } = useApp()

  return (
    <div
      className="transition-colors duration-700"
      style={{
        backgroundColor: cozyMode ? '#FDF8F0' : '#ffffff',
        // Primary color + button shadow switch when cozy mode is on
        '--primary':    cozyMode ? '#E8650A' : '#160a9d',
        '--btn-shadow': cozyMode
          ? '0 8px 24px rgba(232,101,10,0.45), 0 2px 6px rgba(232,101,10,0.22)'
          : '0 8px 24px rgba(22,10,157,0.45), 0 2px 6px rgba(22,10,157,0.22)',
      } as React.CSSProperties}
    >
      {cozyMode && <CozyOverlay />}
      {/* z-index: 2 keeps all page content above the fire overlay (z-index: 1) */}
      {/* Extra bottom padding in cozy mode lets users scroll to see the full fire */}
      <div
        id="scroll-container"
        className="antialiased h-screen overflow-y-auto relative max-w-[600px] mx-auto w-full"
        style={{ zIndex: 2, paddingBottom: cozyMode ? 120 : 0 }}
      >
        {children}
      </div>
    </div>
  )
}
