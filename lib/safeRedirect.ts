/**
 * Validates a redirect path coming from URL params.
 *
 * Only accepts safe relative paths — rejects:
 *   - absolute URLs  ("https://evil.com")
 *   - protocol-relative ("//evil.com")
 *   - empty string    (falls back to "/")
 *
 * @param rawNext  raw value from searchParams.get('next')
 * @returns        a safe path, always starting with a single "/"
 */
export function safeRedirectPath(rawNext: string | null | undefined): string {
  const path = rawNext ?? '/'
  return path.startsWith('/') && !path.startsWith('//') ? path : '/'
}
