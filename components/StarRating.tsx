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
  darkBg?: boolean // true when rendered on a dark hero — inactive stars show as faint amber
}

export default function StarRating({
  rating,
  onRate,
  readonly = false,
  size = 20,
  darkBg = false,
}: StarRatingProps) {
  const { cozyMode } = useApp()
  // `hovered` tracks which star the cursor is over, for the preview highlight
  const [hovered, setHovered] = useState(0)

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        // A star is "active" if it's within the hover preview or the saved rating
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
              className={
                isActive
                  ? 'fill-amber-400 text-amber-400 transition-colors'
                  : darkBg
                  ? 'fill-amber-400/25 text-amber-400/25 transition-colors'
                  : cozyMode ? 'text-[#171717] transition-colors' : 'text-gray-200 transition-colors'
              }
            />
          </motion.button>
        )
      })}
    </div>
  )
}
