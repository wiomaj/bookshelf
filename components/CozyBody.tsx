'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'
import CozyOverlay from './CozyOverlay'
import CozyCatScene from './CozyCatScene'
import NewVersionBanner from './NewVersionBanner'

export default function CozyBody({ children }: { children: React.ReactNode }) {
  const { cozyMode, isDark } = useApp()
  const pathname = usePathname()

  const cozyDark = cozyMode && isDark
  const showCozyCat = cozyMode && pathname === '/'

  // cozyDark = both on → dark warm room; cozy only → light warm; dark only → standard dark; neither → standard light
  const bg        = cozyDark ? '#1C0E06' : cozyMode ? '#FDF0E4' : isDark ? '#000000' : '#F2F2F7'
  const bgElevated = cozyDark ? '#2C1A0E' : cozyMode ? '#FFF8F0' : isDark ? '#1C1C1E' : '#FFFFFF'
  const label     = cozyDark ? '#F5E6D3' : cozyMode ? '#2D1A0A' : isDark ? '#FFFFFF'  : '#000000'
  const labelSec  = cozyDark ? 'rgba(245,230,211,0.6)' : cozyMode ? 'rgba(45,26,10,0.6)'  : isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)'
  const separator = cozyDark ? 'rgba(255,180,100,0.15)' : cozyMode ? 'rgba(45,26,10,0.12)' : isDark ? 'rgba(84,84,88,0.65)'   : 'rgba(60,60,67,0.13)'
  const glassBg   = cozyDark ? 'rgba(28,14,6,0.85)'   : cozyMode ? 'rgba(253,240,228,0.80)' : isDark ? 'rgba(30,30,30,0.80)' : 'rgba(255,255,255,0.72)'
  const glassBorder = cozyDark ? 'rgba(255,160,80,0.20)' : cozyMode ? 'rgba(255,220,180,0.55)' : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.55)'

  // Approximate solid color of the glass header over the background
  const glassColor = cozyDark ? '#1C0E06' : cozyMode ? '#FDF0E4' : isDark ? '#181818' : '#FBFBFD'

  // Update theme-color meta tag (controls iOS Safari status bar color)
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) return
    meta.setAttribute('content', bg)

    // Expose colors so pages can update theme-color on scroll
    const w = window as Window & { __themeColors?: { bg: string; glass: string } }
    w.__themeColors = { bg, glass: glassColor }
  }, [bg, glassColor])

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
        className="antialiased h-screen overflow-y-auto relative max-w-[600px] mx-auto w-full safe-area-pad"
        style={{ zIndex: 2 }}
      >
        {children}
        {showCozyCat && <CozyCatScene />}
      </div>
    </div>
  )
}
