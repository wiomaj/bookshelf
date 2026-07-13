'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  loadingLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  loadingLabel = 'Deleting…',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
            onClick={onCancel}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          />

          {/* Bottom sheet */}
          <motion.div
            key="sheet"
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
                {title}
              </h3>
              <p className="text-[15px] leading-5" style={{ color: 'var(--label-secondary)' }}>
                {description}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onConfirm}
                disabled={loading}
                className="w-full py-[15px] rounded-[14px] text-white text-[17px] font-semibold disabled:opacity-50"
                style={{ backgroundColor: 'var(--danger)' }}
              >
                {loading ? loadingLabel : confirmLabel}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onCancel}
                disabled={loading}
                className="w-full py-[15px] rounded-[14px] text-[17px] font-semibold disabled:opacity-50"
                style={{ backgroundColor: 'var(--fill)', color: 'var(--label)' }}
              >
                {cancelLabel}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
