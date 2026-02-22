'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { useApp } from '@/contexts/AppContext'

export default function SettingsPage() {
  const router = useRouter()
  const { cozyMode, setCozyMode } = useApp()

  return (
    <div className="min-h-screen">
      <div className="max-w-[393px] mx-auto flex flex-col">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end p-3 h-[60px]">
          <button
            onClick={() => router.back()}
            className="p-[6px] w-[36px] flex items-center justify-center text-[#171717]"
            aria-label="Close settings"
          >
            <X size={24} />
          </button>
        </div>

        {/* ── Title ─────────────────────────────────────────────────────────── */}
        <div className="px-4 pb-6">
          <h1 className="text-[32px] font-black text-[#171717] leading-8">Settings</h1>
        </div>

        {/* ── Settings rows ──────────────────────────────────────────────────── */}
        <div className="px-4 pb-10 flex flex-col gap-6">

          {/* Cozy mode */}
          <div className="flex items-start gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <p className="text-[18px] font-bold text-[#171717] leading-6 tracking-[-0.3px]">
                Cozy mode
              </p>
              <p className="text-[16px] text-[#171717] leading-6">
                Cozy mode makes your app feel like a warm living room!
              </p>
            </div>

            {/* iOS-style toggle */}
            <button
              onClick={() => setCozyMode(!cozyMode)}
              className="relative w-[51px] h-[31px] rounded-[100px] shrink-0 transition-colors duration-300"
              style={{ backgroundColor: cozyMode ? '#34C759' : 'rgba(120,120,128,0.16)' }}
              aria-pressed={cozyMode}
              aria-label="Toggle cozy mode"
            >
              <div
                className="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-[100px] transition-transform duration-300"
                style={{
                  transform: cozyMode ? 'translateX(22px)' : 'translateX(2px)',
                  boxShadow:
                    '0px 0px 0px 0px rgba(0,0,0,0.04), 0px 3px 8px 0px rgba(0,0,0,0.15), 0px 3px 1px 0px rgba(0,0,0,0.06)',
                }}
              />
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
