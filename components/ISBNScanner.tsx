'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { fetchBookByISBN } from '@/lib/bookMetadata'

type BookSuggestion = {
  title: string
  author: string
  cover_url?: string
}

interface ISBNScannerProps {
  onScanned: (suggestion: BookSuggestion) => void
  onClose: () => void
}

type ScanState = 'scanning' | 'looking-up' | 'not-found' | 'error'

export default function ISBNScanner({ onScanned, onClose }: ISBNScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanState, setScanState] = useState<ScanState>('scanning')
  const [errorMsg, setErrorMsg] = useState('')
  const doneRef = useRef(false)

  useEffect(() => {
    let controls: { stop: () => void } | null = null

    async function start() {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')

      const reader = new BrowserMultiFormatReader()

      try {
        controls = await reader.decodeFromVideoDevice(
          undefined, // use default (back) camera
          videoRef.current!,
          async (result, _err) => {
            // Skip frames without a result or already done
            if (doneRef.current) return
            if (!result) return

            const isbn = result.getText()
            // Only handle EAN-13 / EAN-8 / UPC-A (book barcodes)
            if (!/^\d{8,13}$/.test(isbn)) return

            doneRef.current = true
            if (navigator.vibrate) navigator.vibrate(60)

            setScanState('looking-up')

            try {
              const book = await fetchBookByISBN(isbn)

              if (!book) {
                setScanState('not-found')
                // Allow retry after 2s
                setTimeout(() => {
                  doneRef.current = false
                  setScanState('scanning')
                }, 2000)
                return
              }

              onScanned(book)
            } catch {
              setScanState('error')
              setErrorMsg('Could not look up book. Try again.')
              setTimeout(() => {
                doneRef.current = false
                setScanState('scanning')
              }, 2000)
            }
          }
        )
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Camera unavailable'
        setScanState('error')
        setErrorMsg(msg)
      }
    }

    start()

    return () => {
      doneRef.current = true
      controls?.stop()
    }
  }, [onScanned])

  const statusLabel = {
    scanning: 'Point at an ISBN barcode',
    'looking-up': 'Found! Looking up book…',
    'not-found': 'Book not found. Try again…',
    error: errorMsg || 'Something went wrong.',
  }[scanState]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center
                   rounded-full bg-black/50 text-white"
      >
        <X size={22} />
      </button>

      {/* Camera feed */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted
        playsInline
      />

      {/* Scan-rect overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {/* Dark surround — four quadrant divs create the "hole" effect */}
        <div className="absolute inset-0 bg-black/55" />

        {/* Bright cutout rect */}
        <div
          className="relative z-10 w-[280px] h-[120px] rounded-[12px]"
          style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
        >
          {/* Corner marks */}
          {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
            <span
              key={i}
              className={`absolute w-5 h-5 border-white ${pos} ${
                i < 2 ? 'border-t-[3px]' : 'border-b-[3px]'
              } ${i % 2 === 0 ? 'border-l-[3px]' : 'border-r-[3px]'} ${
                i === 0 ? 'rounded-tl-[6px]' : i === 1 ? 'rounded-tr-[6px]' : i === 2 ? 'rounded-bl-[6px]' : 'rounded-br-[6px]'
              }`}
            />
          ))}

          {/* Scan line animation */}
          {scanState === 'scanning' && (
            <div className="absolute inset-x-2 top-0 h-[2px] bg-white/80 rounded-full animate-scan-line" />
          )}
        </div>
      </div>

      {/* Status label */}
      <div className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none">
        <div className="px-5 py-2.5 rounded-full bg-black/60 backdrop-blur-sm">
          <p className="text-white text-[15px] font-semibold text-center">
            {statusLabel}
          </p>
        </div>
      </div>
    </div>
  )
}
