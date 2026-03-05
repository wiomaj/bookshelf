'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { motion } from 'framer-motion'
import { useApp } from '@/contexts/AppContext'

interface StarRatingProps {
  rating: number
  onRate?: (rating: number) => void // Omit for read-only display
  readonly?: boolean
  size?: number
  darkBg?: boolean // kept for API compatibility; faded gold is used on all backgrounds
}

export default function StarRating({
  rating,
  onRate,
  readonly = false,
  size = 20,
  darkBg = false,
}: StarRatingProps) {
  const { cozyMode } = useApp()
  const [hovered, setHovered] = useState(0)

  return (
    <div className="flex gap-[3px]">
      {[1, 2, 3, 4, 5].map((star) => {
        const isActive = star <= (hovered || rating)

        return (
          <motion.button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onRate?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            whileHover={readonly ? {} : { scale: 1.25 }}
            whileTap={readonly ? {} : { scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className={readonly ? 'cursor-default' : 'cursor-pointer'}
          >
            <Star
              size={size}
              strokeWidth={0}
              className={
                isActive
                  ? 'fill-[#FFD60A] text-[#FFD60A] transition-colors'
                  : cozyMode && !darkBg
                  ? 'text-[#171717] transition-colors'
                  : darkBg
                  ? 'fill-[#FFD60A]/30 text-[#FFD60A]/30 transition-colors'
                  : 'fill-[hsla(240,6%,25%,0.3)] text-[hsla(240,6%,25%,0.3)] transition-colors'
              }
            />
          </motion.button>
        )
      })}
    </div>
  )
}
