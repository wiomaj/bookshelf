'use client'

import { useApp, useT } from '@/contexts/AppContext'
import { avatarColors, avatarInitials, deriveAvatar, hashSeed } from '@/lib/avatar'

/** Below this, a second letter stops being readable and turns into texture. */
const SINGLE_INITIAL_BELOW_PX = 28

interface UserAvatarProps {
  /** Rendered width and height in px. */
  size: number
  /** Overrides the signed-in user — for previews and other people's shelves. */
  seed?: string
  name?: string
  email?: string | null
  shape?: 'circle' | 'squircle'
  /** Set when the name sits right next to it, so screen readers don't say it twice. */
  decorative?: boolean
  className?: string
}

/**
 * A user's generated picture: a two-stop gradient with their initials.
 *
 * Drawn from the account id (or the seed they shuffled to), so it needs no
 * network request, no loading state, and works offline. See lib/avatar.ts.
 */
export default function UserAvatar({
  size,
  seed,
  name,
  email,
  shape = 'squircle',
  decorative = false,
  className,
}: UserAvatarProps) {
  const { user, displayName, avatarSeed } = useApp()
  const t = useT()

  const resolvedSeed = seed ?? avatarSeed
  const resolvedName = name ?? displayName
  const resolvedEmail = email !== undefined ? email : user?.email

  const spec = deriveAvatar(resolvedSeed)
  const { from, to, dir } = avatarColors(spec)

  const full = avatarInitials(resolvedName, resolvedEmail)
  const initials = size < SINGLE_INITIAL_BELOW_PX ? full.slice(0, 1) : full

  // Deterministic id: two avatars sharing it also share an identical gradient,
  // so a collision within a page is harmless.
  const gradientId = `avatar-${hashSeed(resolvedSeed).toString(36)}-${spec.angle}`
  const radius = shape === 'circle' ? 50 : 28

  const label = resolvedName ? `${t.profileImage} — ${resolvedName}` : t.profileImage

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      style={{
        display: 'block',
        flexShrink: 0,
        borderRadius: shape === 'circle' ? '50%' : size * 0.28,
      }}
    >
      <defs>
        <linearGradient id={gradientId} x1={dir[0]} y1={dir[1]} x2={dir[2]} y2={dir[3]}>
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>

      <rect width="100" height="100" rx={radius} fill={`url(#${gradientId})`} />

      {initials && (
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#FFFFFF"
          fontSize={initials.length > 1 ? 34 : 42}
          fontWeight={500}
          letterSpacing="1"
          style={{ fontFamily: 'var(--font-unbounded), Inter, sans-serif' }}
        >
          {initials}
        </text>
      )}
    </svg>
  )
}
