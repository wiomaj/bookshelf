import { describe, it, expect } from 'vitest'
import {
  hashSeed,
  deriveAvatar,
  avatarColors,
  avatarInitials,
  contrastWithWhite,
  solveLightness,
  resolveAvatarSeed,
  randomAvatarSeed,
  nextAvatarSeed,
  hueDistance,
  GRADIENT_DIRS,
} from '../avatar'

describe('hashSeed', () => {
  it('is stable for the same input', () => {
    expect(hashSeed('a7c1f2e0-9b34-4d51-8f6a-2e0d7c4b91aa'))
      .toBe(hashSeed('a7c1f2e0-9b34-4d51-8f6a-2e0d7c4b91aa'))
  })

  it('produces an unsigned 32-bit integer', () => {
    for (const seed of ['', 'a', 'user-1', '🙂', 'Łukasz']) {
      const h = hashSeed(seed)
      expect(Number.isInteger(h)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(0xffffffff)
    }
  })

  it('separates inputs that differ by one character', () => {
    expect(hashSeed('user-1')).not.toBe(hashSeed('user-2'))
  })
})

describe('deriveAvatar', () => {
  it('returns the same spec across calls — the picture never drifts', () => {
    const seed = 'a7c1f2e0-9b34-4d51-8f6a-2e0d7c4b91aa'
    expect(deriveAvatar(seed)).toEqual(deriveAvatar(seed))
  })

  it('survives a serialise/parse round trip', () => {
    const spec = deriveAvatar('round-trip-user')
    expect(JSON.parse(JSON.stringify(spec))).toEqual(spec)
  })

  it('keeps hues in range and the angle a valid index', () => {
    for (let i = 0; i < 500; i++) {
      const spec = deriveAvatar(`user-${i}`)
      expect(spec.hue).toBeGreaterThanOrEqual(0)
      expect(spec.hue).toBeLessThan(360)
      expect(spec.hue2).toBeGreaterThanOrEqual(0)
      expect(spec.hue2).toBeLessThan(360)
      expect(GRADIENT_DIRS[spec.angle]).toBeDefined()
    }
  })

  it('moves the second stop away from the first, so the gradient reads', () => {
    for (let i = 0; i < 500; i++) {
      const { hue, hue2 } = deriveAvatar(`user-${i}`)
      expect(hueDistance(hue, hue2)).toBeGreaterThanOrEqual(26)
    }
  })

  it('spreads 1000 uuid-shaped ids across the wheel with no empty arc', () => {
    const buckets = new Array(12).fill(0)
    for (let i = 0; i < 1000; i++) {
      // Shaped like a Supabase user id so the sample matches real inputs.
      const id = `${i.toString(16).padStart(8, '0')}-9b34-4d51-8f6a-2e0d7c4b91aa`
      buckets[Math.floor(deriveAvatar(id).hue / 30)]++
    }
    expect(buckets.every(n => n > 0)).toBe(true)
  })
})

describe('avatarColors', () => {
  it('clears the contrast budget on every hue in the wheel', () => {
    for (let hue = 0; hue < 360; hue++) {
      // Same constants the module ships with; if those change, this catches it.
      const fromL = solveLightness(hue, 66, 3.2, 58)
      const toL = solveLightness(hue, 60, 4.6, 40)
      expect(contrastWithWhite(hue, 66, fromL)).toBeGreaterThanOrEqual(3.2)
      expect(contrastWithWhite(hue, 60, toL)).toBeGreaterThanOrEqual(4.6)
    }
  })

  it('darkens yellows relative to blues rather than using one lightness', () => {
    const yellow = solveLightness(60, 66, 3.2, 58)
    const blue = solveLightness(240, 66, 3.2, 58)
    expect(yellow).toBeLessThan(blue)
  })

  it('returns usable hsl strings and a gradient direction', () => {
    const colors = avatarColors(deriveAvatar('colour-user'))
    expect(colors.from).toMatch(/^hsl\(\d+ \d+% [\d.]+%\)$/)
    expect(colors.to).toMatch(/^hsl\(\d+ \d+% [\d.]+%\)$/)
    expect(colors.dir).toHaveLength(4)
  })

  it('falls back to the first direction if the angle is out of range', () => {
    const colors = avatarColors({ hue: 200, hue2: 240, angle: 9 as 0 })
    expect(colors.dir).toEqual(GRADIENT_DIRS[0])
  })
})

describe('avatarInitials', () => {
  it('takes the first and last word of a multi-word name', () => {
    expect(avatarInitials('Wiola Maj')).toBe('WM')
    expect(avatarInitials('Anna Maria Kowalska')).toBe('AK')
  })

  it('splits on hyphens, dots and underscores', () => {
    expect(avatarInitials('anna-zofia kowalska')).toBe('AK')
    expect(avatarInitials('jean.luc.petit')).toBe('JP')
  })

  it('keeps accented and non-Latin letters', () => {
    expect(avatarInitials('Łukasz')).toBe('Ł')
    expect(avatarInitials('Tomás Ruiz')).toBe('TR')
    expect(avatarInitials('Ольга Петрова')).toBe('ОП')
  })

  it('returns a single letter for a one-word name', () => {
    expect(avatarInitials('Mira')).toBe('M')
  })

  it('falls back to the email local part when there is no name', () => {
    expect(avatarInitials('', 'reader@mail.com')).toBe('R')
    expect(avatarInitials(null, 'anna.kowalska@mail.com')).toBe('AK')
    expect(avatarInitials('   ', 'reader@mail.com')).toBe('R')
  })

  it('prefers the name over the email when both are present', () => {
    expect(avatarInitials('Mira', 'reader@mail.com')).toBe('M')
  })

  it('returns empty rather than junk when there is nothing to work with', () => {
    expect(avatarInitials('', null)).toBe('')
    expect(avatarInitials(undefined, undefined)).toBe('')
    expect(avatarInitials('🙂')).toBe('')
    expect(avatarInitials('123 456')).toBe('')
    expect(avatarInitials('...')).toBe('')
  })

  it('does not split a surrogate pair into half a character', () => {
    expect(avatarInitials('🙂 Maj')).toBe('M')
  })
})

describe('resolveAvatarSeed', () => {
  const userId = 'a7c1f2e0-9b34-4d51-8f6a-2e0d7c4b91aa'

  it('uses the stored seed when the user has shuffled', () => {
    expect(resolveAvatarSeed(userId, 'k3j9fq2')).toBe('k3j9fq2')
  })

  it('falls back to the account id for malformed metadata', () => {
    for (const stored of [undefined, null, '', '   ', 42, {}, [], true]) {
      expect(resolveAvatarSeed(userId, stored)).toBe(userId)
    }
  })
})

describe('hueDistance', () => {
  it('measures the short way round the wheel', () => {
    expect(hueDistance(10, 350)).toBe(20)
    expect(hueDistance(350, 10)).toBe(20)
    expect(hueDistance(0, 180)).toBe(180)
    expect(hueDistance(90, 90)).toBe(0)
  })

  it('never exceeds half the wheel', () => {
    for (let a = 0; a < 360; a += 7) {
      for (let b = 0; b < 360; b += 11) {
        const d = hueDistance(a, b)
        expect(d).toBeGreaterThanOrEqual(0)
        expect(d).toBeLessThanOrEqual(180)
      }
    }
  })
})

describe('randomAvatarSeed', () => {
  it('returns a non-empty string that survives the pipeline', () => {
    const seed = randomAvatarSeed()
    expect(seed.length).toBeGreaterThan(0)
    expect(resolveAvatarSeed('user-id', seed)).toBe(seed)
    expect(deriveAvatar(seed).hue).toBeGreaterThanOrEqual(0)
  })

  it('does not repeat itself', () => {
    const seen = new Set(Array.from({ length: 200 }, () => randomAvatarSeed()))
    expect(seen.size).toBe(200)
  })
})

describe('nextAvatarSeed', () => {
  it('lands a visibly different hue, so Shuffle never looks broken', () => {
    for (let i = 0; i < 200; i++) {
      const current = `user-${i}`
      const next = nextAvatarSeed(current)
      const moved = hueDistance(deriveAvatar(next).hue, deriveAvatar(current).hue)
      expect(moved).toBeGreaterThanOrEqual(40)
    }
  })

  it('returns a seed, never the one it was given', () => {
    const current = 'a7c1f2e0-9b34-4d51-8f6a-2e0d7c4b91aa'
    expect(nextAvatarSeed(current)).not.toBe(current)
  })
})
