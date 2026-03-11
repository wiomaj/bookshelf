'use client'

import { useApp } from '@/contexts/AppContext'
import CozyOverlay from './CozyOverlay'
import NewVersionBanner from './NewVersionBanner'

export default function CozyBody({ children }: { children: React.ReactNode }) {
  const { cozyMode, isDark } = useApp()

  // Cozy mode takes precedence; dark mode applies when cozy is off
  const bg        = cozyMode ? '#FDF0E4' : isDark ? '#000000' : '#F2F2F7'
  const bgElevated = cozyMode ? '#FFF8F0' : isDark ? '#1C1C1E' : '#FFFFFF'
  const label     = cozyMode ? '#2D1A0A' : isDark ? '#FFFFFF'  : '#000000'
  const labelSec  = cozyMode ? 'rgba(45,26,10,0.6)'  : isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)'
  const separator = cozyMode ? 'rgba(45,26,10,0.12)' : isDark ? 'rgba(84,84,88,0.65)'   : 'rgba(60,60,67,0.13)'
  const glassBg   = cozyMode ? 'rgba(253,240,228,0.80)' : isDark ? 'rgba(30,30,30,0.80)' : 'rgba(255,255,255,0.72)'
  const glassBorder = cozyMode ? 'rgba(255,220,180,0.55)' : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.55)'

  return (
    <div
      className="transition-colors duration-700 min-h-screen"
      style={{
        backgroundColor: bg,
        '--primary':       cozyMode ? '#FF6B35' : '#007AFF',
        '--primary-muted': cozyMode ? 'rgba(255,107,53,0.12)' : 'rgba(0,122,255,0.12)',
        '--btn-shadow':    cozyMode
          ? '0 4px 16px rgba(255,107,53,0.35), 0 1px 4px rgba(255,107,53,0.15)'
          : '0 4px 16px rgba(0,122,255,0.30), 0 1px 4px rgba(0,122,255,0.15)',
        '--glass-bg':     glassBg,
        '--glass-border': glassBorder,
        '--bg':           bg,
        '--bg-elevated':  bgElevated,
        '--label':        label,
        '--label-secondary': labelSec,
        '--separator':    separator,
      } as React.CSSProperties}
    >
      {cozyMode && <CozyOverlay />}
      <NewVersionBanner />
      <div
        id="scroll-container"
        className="antialiased h-screen overflow-y-auto relative max-w-[600px] mx-auto w-full"
        style={{ zIndex: 2, paddingBottom: cozyMode ? 280 : 0 }}
      >
        {children}
      </div>
    </div>
  )
}
