/**
 * lib/serverFetch.ts
 *
 * Resilient fetch for server-side API routes talking to external book APIs
 * (Google Books, Open Library, DNB).
 *
 * - Per-attempt timeout (default 6 s) so a hung upstream never stalls a route.
 * - One retry with short backoff on network errors, 429 and 5xx responses —
 *   these are almost always transient on the free book APIs.
 * - A caller-provided AbortSignal takes precedence over the built-in timeout
 *   and is never retried once aborted.
 */

const DEFAULT_TIMEOUT_MS = 6_000
const DEFAULT_RETRIES = 1

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface RetryOptions {
  /** Extra attempts after the first (default 1). */
  retries?: number
  /** Per-attempt timeout, ignored when init.signal is provided (default 6000). */
  timeoutMs?: number
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit & { next?: { revalidate?: number } } = {},
  { retries = DEFAULT_RETRIES, timeoutMs = DEFAULT_TIMEOUT_MS }: RetryOptions = {},
): Promise<Response> {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const signal = init.signal ?? AbortSignal.timeout(timeoutMs)
      const res = await fetch(url, { ...init, signal })

      const retryable = res.status === 429 || res.status >= 500
      if (retryable && attempt < retries) {
        await sleep(300 * (attempt + 1))
        continue
      }
      return res
    } catch (err) {
      lastError = err
      // Caller aborted — don't retry, surface immediately.
      if (init.signal?.aborted) throw err
      if (attempt < retries) {
        await sleep(300 * (attempt + 1))
        continue
      }
    }
  }

  throw lastError
}
