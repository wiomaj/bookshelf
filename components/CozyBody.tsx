'use client'

import { useApp } from '@/contexts/AppContext'
import CozyOverlay from './CozyOverlay'

export default function CozyBody({ children }: { children: React.ReactNode }) {
  const { cozyMode } = useApp()

  return (
    <div
      className="transition-colors duration-700 min-h-screen"
      style={{
        backgroundColor: cozyMode ? '#FDF0E4' : '#F2F2F7',
        '--primary':       cozyMode ? '#FF6B35' : '#007AFF',
        '--primary-muted': cozyMode ? 'rgba(255,107,53,0.12)' : 'rgba(0,122,255,0.12)',
        '--btn-shadow':    cozyMode
          ? '0 4px 16px rgba(255,107,53,0.35), 0 1px 4px rgba(255,107,53,0.15)'
          : '0 4px 16px rgba(0,122,255,0.30), 0 1px 4px rgba(0,122,255,0.15)',
        '--glass-bg':     cozyMode
          ? 'rgba(253, 240, 228, 0.80)'
          : 'rgba(255, 255, 255, 0.72)',
        '--glass-border': cozyMode
          ? 'rgba(255, 220, 180, 0.55)'
          : 'rgba(255, 255, 255, 0.55)',
        '--bg':           cozyMode ? '#FDF0E4' : '#F2F2F7',
        '--bg-elevated':  cozyMode ? '#FFF8F0' : '#FFFFFF',
        '--label':        cozyMode ? '#2D1A0A' : '#000000',
        '--label-secondary': cozyMode ? 'rgba(45,26,10,0.6)' : 'rgba(60,60,67,0.6)',
        '--separator':    cozyMode ? 'rgba(45,26,10,0.12)' : 'rgba(60,60,67,0.13)',
      } as React.CSSProperties}
    >
      {cozyMode && <CozyOverlay />}
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
