/**
 * lib/rateLimit.ts
 *
 * Lightweight in-process sliding-window rate limiter.
 *
 * Suitable for single-instance deployments (local dev, single Vercel region).
 * For multi-region / multi-instance production, swap the Map for a shared
 * store such as Vercel KV or Upstash Redis using the same interface.
 *
 * Usage:
 *   const { ok, retryAfter } = checkRateLimit(`isbn:${ip}`, 30, 60_000)
 *   if (!ok) return rateLimitResponse(retryAfter)
 */

interface Entry {
  count: number
  reset: number // epoch ms
}

const store = new Map<string, Entry>()

// Prune stale entries every 5 minutes to prevent unbounded memory growth.
const PRUNE_INTERVAL_MS = 5 * 60 * 1000
let lastPrune = Date.now()

function maybePrune() {
  const now = Date.now()
  if (now - lastPrune < PRUNE_INTERVAL_MS) return
  lastPrune = now
  for (const [key, entry] of store) {
    if (now > entry.reset) store.delete(key)
  }
}

/**
 * Check whether `key` is within `limit` requests per `windowMs` milliseconds.
 * Mutates internal state on every call — always call once per request.
 *
 * @returns `ok` — true if the request should proceed.
 *          `retryAfter` — seconds until the window resets (only meaningful when !ok).
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  maybePrune()

  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.reset - now) / 1000) }
  }

  entry.count++
  return { ok: true, retryAfter: 0 }
}

/**
 * Extract the best available client IP from a Next.js request.
 * Falls back to 'unknown' when running behind a proxy that strips headers.
 */
export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}
