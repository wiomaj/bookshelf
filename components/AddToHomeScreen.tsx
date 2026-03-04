'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useT } from '@/contexts/AppContext'

const STORAGE_KEY = 'bookshelf_aths_dismissed'

// Minimal iOS share icon inline — matches the actual iOS share button
function IOSShareIcon() {
  return (
    <svg width="13" height="15" viewBox="0 0 13 15" fill="none" className="inline mb-[2px] mx-[1px]">
      <path d="M6.5 1v9M3.5 3.5L6.5 1l3 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 7v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function AddToHomeScreen() {
  const t = useT()
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  // Track prompt availability in state (not just a ref) so the Install button re-renders
  const [canInstall, setCanInstall] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Already running as installed PWA — never show
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator &&
        (window.navigator as { standalone?: boolean }).standalone === true)
    if (isStandalone) return

    // User already dismissed — never show again
    if (localStorage.getItem(STORAGE_KEY)) return

    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua)
    setIsIOS(ios)

    // Android/Chrome: capture the native install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setCanInstall(true)  // triggers re-render so Install button appears
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Show the banner after a short delay
    const timer = setTimeout(() => setShow(true), 3000)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
  }

  async function handleInstall() {
    if (deferredPrompt.current) {
      await deferredPrompt.current.prompt()
      const { outcome } = await deferredPrompt.current.userChoice
      deferredPrompt.current = null
      setCanInstall(false)
      if (outcome === 'accepted') {
        localStorage.setItem(STORAGE_KEY, '1')
        setShow(false)
      }
    } else {
      dismiss()
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="fixed bottom-[110px] left-4 right-4 z-40 max-w-[568px] mx-auto"
        >
          <div
            className="rounded-[18px] px-3.5 py-3 flex items-center gap-3"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
              border: '1px solid var(--separator)',
            }}
          >
            {/* App icon */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.png"
              alt=""
              className="w-11 h-11 rounded-[12px] shrink-0 shadow-sm"
            />

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--label)' }}>
                {t.athsTitle}
              </p>
              {isIOS ? (
                <p className="text-[12px] mt-0.5 leading-[1.4]" style={{ color: 'var(--label-secondary)' }}>
                  {t.athsIosTap} <IOSShareIcon /> {t.athsIosThen}{' '}
                  <span style={{ color: 'var(--label)' }}>&ldquo;{t.athsTitle}&rdquo;</span>
                </p>
              ) : (
                <p className="text-[12px] mt-0.5 leading-[1.4]" style={{ color: 'var(--label-secondary)' }}>
                  {t.athsAndroid}
                </p>
              )}
            </div>

            {/* Action: Install button (Android) or just dismiss (iOS — instructions are inline) */}
            {!isIOS && canInstall && (
              <button
                onClick={handleInstall}
                className="shrink-0 px-3 py-1.5 rounded-[10px] text-[13px] font-semibold text-white"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {t.athsInstall}
              </button>
            )}

            {/* Dismiss */}
            <button
              onClick={dismiss}
              className="w-6 h-6 flex items-center justify-center rounded-full shrink-0"
              style={{ backgroundColor: 'var(--fill)', color: 'var(--label-tertiary)' }}
              aria-label="Dismiss"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
