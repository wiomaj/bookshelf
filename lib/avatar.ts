/**
 * Generated user images.
 *
 * A user's picture is a pure function of a seed string — a two-stop gradient
 * plus their initials. No stored file, no network request, no migration: the
 * seed is the account id until the user shuffles it, so every existing account
 * already has an image.
 *
 * Everything in here is deterministic. Changing a constant changes every
 * user's picture, so treat the block below as versioned: bump AVATAR_VERSION
 * and make the change opt-in rather than silently reassigning identities.
 */

export const AVATAR_VERSION = 1

/** Index into GRADIENT_DIRS. */
export type GradientAngle = 0 | 1 | 2 | 3

export interface AvatarSpec {
  /** Gradient start hue, 0–359. */
  hue: number
  /** Gradient end hue, 0–359. */
  hue2: number
  /** Which way the gradient runs. */
  angle: GradientAngle
}

export interface AvatarColors {
  /** Light stop — the one the white initials have to survive. */
  from: string
  /** Dark stop. */
  to: string
  /** SVG linearGradient coordinates: [x1, y1, x2, y2]. */
  dir: readonly [number, number, number, number]
}

/** The four ways a gradient can run across the tile: ↘ ↗ ↓ → */
export const GRADIENT_DIRS: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 1, 1],
  [0, 1, 1, 0],
  [0, 0, 0, 1],
  [0, 0, 1, 0],
]

// ── Versioned constants ──────────────────────────────────────────────────────
const FROM_SAT = 66
const TO_SAT = 60
// White initials sit on the light stop, so it carries the stricter budget.
// 3:1 is the WCAG bar for large text; 3.2 leaves a little headroom.
const FROM_MIN_CONTRAST = 3.2
const TO_MIN_CONTRAST = 4.6
// Where contrast isn't the binding constraint (blues, purples) the solver would
// push lightness to the ceiling and wash the colour out. Cap it instead.
const FROM_LIGHTNESS_CAP = 58
const TO_LIGHTNESS_CAP = 40

/**
 * FNV-1a, 32-bit. Chosen for being tiny, dependency-free, and identical across
 * JS engines — the picture has to match on every device the user owns.
 */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Shortest distance between two hues on the wheel, 0–180. */
export function hueDistance(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360
  return Math.min(d, 360 - d)
}

/** One hash, three decisions: where on the wheel, how far it travels, which way it runs. */
export function deriveAvatar(seed: string): AvatarSpec {
  const h = hashSeed(seed)
  const hue = h % 360
  const shift = 26 + ((h >>> 8) % 46)
  return {
    hue,
    hue2: (hue + shift) % 360,
    angle: ((h >>> 16) % 4) as GradientAngle,
  }
}

// ── Colour ───────────────────────────────────────────────────────────────────

/** HSL (h 0–360, s/l 0–100) to RGB, each channel 0–1. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100
  const light = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}

/** WCAG relative luminance. */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** Contrast ratio of white text on the given colour. */
export function contrastWithWhite(hue: number, sat: number, light: number): number {
  return 1.05 / (relativeLuminance(hslToRgb(hue, sat, light)) + 0.05)
}

/**
 * The lightest value at this hue that still clears `target` against white,
 * capped so colours stay saturated.
 *
 * A fixed lightness looks fine on blues and turns white initials to mush on
 * yellows, which carry far more perceived brightness at the same HSL value —
 * so lightness is solved per hue rather than chosen once.
 */
export function solveLightness(hue: number, sat: number, target: number, cap: number): number {
  let lo = 8
  let hi = 72
  // Contrast falls as lightness rises, so this converges on the boundary.
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (contrastWithWhite(hue, sat, mid) >= target) lo = mid
    else hi = mid
  }
  return Math.min(lo, cap)
}

export function avatarColors(spec: AvatarSpec): AvatarColors {
  const fromL = solveLightness(spec.hue, FROM_SAT, FROM_MIN_CONTRAST, FROM_LIGHTNESS_CAP)
  const toL = solveLightness(spec.hue2, TO_SAT, TO_MIN_CONTRAST, TO_LIGHTNESS_CAP)
  return {
    from: `hsl(${spec.hue} ${FROM_SAT}% ${fromL.toFixed(1)}%)`,
    to: `hsl(${spec.hue2} ${TO_SAT}% ${toL.toFixed(1)}%)`,
    dir: GRADIENT_DIRS[spec.angle] ?? GRADIENT_DIRS[0],
  }
}

// ── Initials ─────────────────────────────────────────────────────────────────

/**
 * First and last initial of the display name, falling back to the email local
 * part, falling back to '' (the caller then renders the bare gradient).
 *
 * Array.from splits by code point, so accented and non-Latin names survive
 * rather than losing half a surrogate pair.
 */
export function avatarInitials(displayName?: string | null, email?: string | null): string {
  let source = (displayName ?? '').trim()
  if (!source && email) source = email.split('@')[0]

  const letters = source
    .split(/[\s._\-]+/)
    .filter(Boolean)
    .map(word => Array.from(word)[0])
    .filter((c): c is string => !!c && /\p{L}/u.test(c))

  if (letters.length === 0) return ''
  if (letters.length === 1) return letters[0].toLocaleUpperCase()
  return (letters[0] + letters[letters.length - 1]).toLocaleUpperCase()
}

// ── Seed ─────────────────────────────────────────────────────────────────────

/**
 * The seed a user's picture is drawn from: whatever they shuffled to, else
 * their account id. `stored` comes from user_metadata, so it can be anything —
 * a bad value falls back rather than throwing.
 */
export function resolveAvatarSeed(userId: string, stored?: unknown): string {
  if (typeof stored === 'string') {
    const trimmed = stored.trim()
    if (trimmed) return trimmed
  }
  return userId
}

/** A fresh random seed. Only ever called from a tap, so entropy quality is moot. */
export function randomAvatarSeed(): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Shuffling should look like it did something, so keep the hue this far away. */
const MIN_SHUFFLE_TRAVEL = 40
const MAX_SHUFFLE_TRIES = 12

/**
 * A seed whose hue is visibly different from the current one.
 *
 * A purely random seed lands near the current hue often enough that Shuffle
 * would sometimes look broken. Rerolling a bounded number of times fixes that
 * without ever blocking — if every try lands close, the last one still ships.
 */
export function nextAvatarSeed(currentSeed: string): string {
  const current = deriveAvatar(currentSeed).hue
  let candidate = randomAvatarSeed()
  for (let i = 0; i < MAX_SHUFFLE_TRIES; i++) {
    if (hueDistance(deriveAvatar(candidate).hue, current) >= MIN_SHUFFLE_TRAVEL) return candidate
    candidate = randomAvatarSeed()
  }
  return candidate
}
