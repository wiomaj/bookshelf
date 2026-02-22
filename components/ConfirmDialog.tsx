'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />

          {/* Dialog */}
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-sm
                       bg-white rounded-[16px] shadow-[0_8px_32px_rgba(23,23,23,0.16)] p-6"
          >
            {/* Icon + title */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="text-red-500" size={18} />
              </div>
              <h3 className="font-bold text-[#171717] text-[18px]">{title}</h3>
            </div>

            <p className="text-[rgba(23,23,23,0.72)] text-[16px] ml-[52px] mb-6 leading-6">
              {description}
            </p>

            {/* Buttons */}
            <div className="flex flex-col gap-3">
              <motion.button
                onClick={onConfirm}
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-4 bg-[#160a9d] rounded-full text-white text-[16px]
                           font-bold text-center disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-[0_8px_24px_rgba(22,10,157,0.45),0_2px_6px_rgba(22,10,157,0.22)]"
              >
                {loading ? 'Deleting…' : confirmLabel}
              </motion.button>
              <motion.button
                onClick={onCancel}
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-4 bg-[#171717]/[0.08] rounded-full text-[#171717]
                           text-[16px] font-bold text-center disabled:opacity-50"
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
