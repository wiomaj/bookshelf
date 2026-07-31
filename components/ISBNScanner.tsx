'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Flashlight } from 'lucide-react'
// Type-only — the library itself is loaded lazily inside the effect so it
// never lands in the main bundle.
import type { DecodeHintType } from '@zxing/library'
import { fetchBookByISBN } from '@/lib/bookMetadata'
import type { BookSuggestion } from '@/lib/bookSearch'
import { isbnFromScan } from '@/lib/isbn'
import { useT } from '@/contexts/AppContext'

interface ISBNScannerProps {
  onScanned: (suggestion: BookSuggestion) => void
  onClose: () => void
}

type ScanState = 'scanning' | 'looking-up' | 'not-found' | 'error'

/** How long a "not found" / error message stays up before scanning resumes. */
const RETRY_DELAY_MS = 2000

export default function ISBNScanner({ onScanned, onClose }: ISBNScannerProps) {
  const t = useT()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanState, setScanState] = useState<ScanState>('scanning')
  const [errorMsg, setErrorMsg] = useState('')
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)

  // Latest callbacks, read through refs so the camera effect can run exactly
  // once. Both call sites pass inline arrow functions, so depending on them
  // directly tore the camera down and rebuilt it on every parent re-render.
  const onScannedRef = useRef(onScanned)
  onScannedRef.current = onScanned

  const busyRef = useRef(false)
  const torchRef = useRef<((on: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    let cancelled = false
    let controls: { stop: () => void; switchTorch?: (on: boolean) => Promise<void> } | null = null

    async function start() {
      try {
        const [zxingBrowser, zxing] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        const { BrowserMultiFormatReader } = zxingBrowser
        const { BarcodeFormat } = zxing
        const hintType = zxing.DecodeHintType

        // Only look for the 1D formats a book barcode is ever printed in.
        // The default multi-format reader also hunts for QR, Aztec, Data Matrix
        // and PDF417 on every frame, which slows each attempt down enough to
        // matter and adds nothing here. TRY_HARDER lets the decoder do a second,
        // more thorough pass — worth it for a barcode on a curved paperback.
        const hints = new Map<DecodeHintType, unknown>([
          [hintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
          ]],
          [hintType.TRY_HARDER, true],
        ])

        const reader = new BrowserMultiFormatReader(hints, {
          // The library default is 500 ms — two decode attempts a second, which
          // is what made scanning feel like it "just doesn't find" anything.
          delayBetweenScanAttempts: 100,
        })

        const scannerControls = await reader.decodeFromConstraints(
          {
            video: {
              // Prefer the back camera — the default device on some phones is
              // the front camera, which makes barcode scanning near impossible.
              facingMode: { ideal: 'environment' },
              // A 640×480 default frame does not carry enough pixels across the
              // narrow bars of an EAN-13 at arm's length. Ask for HD and let the
              // browser fall back on its own if the camera cannot deliver it.
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          },
          videoRef.current!,
          async (result) => {
            if (cancelled || busyRef.current || !result) return

            // Verify the check digit and unwrap any price add-on before
            // looking anything up, so a partial read can never resolve to
            // some other book. Non-book barcodes are ignored outright.
            const isbn = isbnFromScan(result.getText())
            if (!isbn) return

            busyRef.current = true
            if (navigator.vibrate) navigator.vibrate(60)
            setScanState('looking-up')

            const resume = (state: ScanState) => {
              if (cancelled) return
              setScanState(state)
              setTimeout(() => {
                if (cancelled) return
                busyRef.current = false
                setScanState('scanning')
              }, RETRY_DELAY_MS)
            }

            try {
              const book = await fetchBookByISBN(isbn)
              if (cancelled) return

              if (!book) {
                resume('not-found')
                return
              }

              onScannedRef.current(book)
            } catch {
              setErrorMsg('')
              resume('error')
            }
          }
        )

        // The camera can finish opening after the overlay is already gone —
        // shut the stream down immediately rather than leaving it running.
        if (cancelled) {
          scannerControls.stop()
          return
        }

        controls = scannerControls

        if (typeof scannerControls.switchTorch === 'function') {
          torchRef.current = scannerControls.switchTorch
          setTorchAvailable(true)
        }

        // Continuous autofocus, where supported, is the difference between a
        // sharp barcode and a blurred one at close range. Best-effort only —
        // cameras without it reject the constraint, which changes nothing.
        void Promise.resolve(
          scannerControls.streamVideoConstraintsApply?.({
            advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
          })
        ).catch(() => {})
      } catch (e: unknown) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : ''
        setScanState('error')
        setErrorMsg(msg)
      }
    }

    start()

    return () => {
      cancelled = true
      torchRef.current = null
      // stop() is async when the torch is on (it turns it back off first).
      try {
        void Promise.resolve(controls?.stop()).catch(() => {})
      } catch {
        // already torn down
      }
    }
  }, [])

  async function toggleTorch() {
    const next = !torchOn
    try {
      await torchRef.current?.(next)
      setTorchOn(next)
    } catch {
      setTorchAvailable(false)
    }
  }

  const statusLabel = {
    scanning: t.scanPrompt,
    'looking-up': t.scanLookingUp,
    'not-found': t.scanNotFound,
    error: errorMsg || t.scanError,
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

      {/* Torch — only rendered when the camera actually supports it */}
      {torchAvailable && (
        <button
          onClick={toggleTorch}
          aria-label={t.scanTorch}
          aria-pressed={torchOn}
          className={`absolute top-4 left-4 z-10 w-10 h-10 flex items-center justify-center
                      rounded-full ${torchOn ? 'bg-white text-black' : 'bg-black/50 text-white'}`}
        >
          <Flashlight size={20} />
        </button>
      )}

      {/* Camera feed */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
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
