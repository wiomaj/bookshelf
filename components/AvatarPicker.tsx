'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shuffle } from 'lucide-react'
import { useApp, useT } from '@/contexts/AppContext'
import { nextAvatarSeed } from '@/lib/avatar'
import UserAvatar from '@/components/UserAvatar'

interface AvatarPickerProps {
  open: boolean
  onClose: () => void
}

/** Three seeds, each visibly apart from the last, so the choices read as
 *  distinct options rather than near-duplicates. */
function generateOptions(fromSeed: string): string[] {
  const seeds: string[] = []
  let last = fromSeed
  for (let i = 0; i < 3; i++) {
    last = nextAvatarSeed(last)
    seeds.push(last)
  }
  return seeds
}

/**
 * Bottom sheet for picking the generated profile image.
 *
 * Presents three generated options at once — tapping one only moves a local
 * preview, and the account is written once, on Save, so a run of taps
 * doesn't turn into a run of network calls.
 */
export default function AvatarPicker({ open, onClose }: AvatarPickerProps) {
  const { user, avatarSeed, updateAvatarSeed } = useApp()
  const t = useT()

  const [preview, setPreview] = useState(avatarSeed)
  const [options, setOptions] = useState<string[]>(() => generateOptions(avatarSeed))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Opening always starts from what's actually saved, so a discarded preview
  // never comes back on the next visit.
  useEffect(() => {
    if (open) {
      setPreview(avatarSeed)
      setOptions(generateOptions(avatarSeed))
      setError(null)
    }
  }, [open, avatarSeed])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, saving, onClose])

  const accountId = user?.id ?? ''
  const isDefault = preview === accountId
  const dirty = preview !== avatarSeed

  async function handleSave() {
    if (!dirty) { onClose(); return }
    setSaving(true)
    setError(null)
    // null clears the stored seed, which falls the image back to the account id.
    const { error: saveError } = await updateAvatarSeed(isDefault ? null : preview)
    setSaving(false)
    if (saveError) setError(saveError)
    else onClose()
  }

  function renderAvatarTile(seed: string) {
    const selected = seed === preview
    return (
      <motion.button
        key={seed}
        type="button"
        whileTap={{ scale: 0.94 }}
        animate={{ scale: selected ? 1.06 : 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        onClick={() => setPreview(seed)}
        disabled={saving}
        aria-pressed={selected}
        aria-label={t.profileImage}
        className="rounded-full disabled:opacity-50"
        style={{
          boxShadow: selected
            ? `0 0 0 3px var(--bg-elevated), 0 0 0 5px var(--primary)`
            : 'none',
        }}
      >
        <UserAvatar size={76} seed={seed} shape="circle" decorative />
      </motion.button>
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { if (!saving) onClose() }}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          />

          {/* Bottom sheet */}
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t.profileImage}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-w-[600px] mx-auto
                       rounded-t-[28px] p-6 pb-10"
            style={{ backgroundColor: 'var(--bg-elevated)' }}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-5"
                 style={{ backgroundColor: 'var(--separator-opaque)' }} />

            <div className="flex flex-col gap-1.5 mb-6">
              <h3 className="text-[22px] font-bold tracking-[-0.3px]" style={{ color: 'var(--label)' }}>
                {t.profileImage}
              </h3>
              <p className="text-[15px] leading-5" style={{ color: 'var(--label-secondary)' }}>
                {t.profileImageHint}
              </p>
            </div>

            {/* The current picture stays on the left, set apart from the
                three generated options so it doesn't read as a fourth
                sibling — the heading above already names what they're for. */}
            <div className="flex justify-center items-center gap-8 mb-6">
              {renderAvatarTile(avatarSeed)}
              <div className="flex gap-5">
                {options.map(renderAvatarTile)}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setOptions(generateOptions(preview))}
                disabled={saving}
                className="w-full py-[15px] rounded-[14px] text-[17px] font-semibold
                           flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--fill)', color: 'var(--label)' }}
              >
                <Shuffle size={18} strokeWidth={2.2} />
                {t.shuffleImage}
              </motion.button>

              {!isDefault && (
                <button
                  onClick={() => setPreview(accountId)}
                  disabled={saving}
                  className="text-[15px] py-1 disabled:opacity-50"
                  style={{ color: 'var(--primary)' }}
                >
                  {t.resetImage}
                </button>
              )}

              {error && (
                <p className="text-[14px] px-1 text-center" style={{ color: 'var(--danger)' }}>
                  {error}
                </p>
              )}

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={saving}
                className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold
                           disabled:opacity-50 mt-1"
                style={{ backgroundColor: 'var(--primary)', boxShadow: 'var(--btn-shadow)' }}
              >
                {saving ? '…' : t.saveChanges}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                disabled={saving}
                className="w-full py-[15px] rounded-[14px] text-[17px] font-semibold disabled:opacity-50"
                style={{ backgroundColor: 'var(--fill)', color: 'var(--label)' }}
              >
                {t.cancel}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
