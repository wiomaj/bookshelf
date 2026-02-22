/**
 * Unit tests for lib/safeRedirect.ts
 *
 * The open-redirect guard is a critical security control:
 *   - must reject external URLs
 *   - must reject protocol-relative URLs ("//evil.com")
 *   - must always produce a usable redirect path
 */
import { describe, it, expect } from 'vitest'
import { safeRedirectPath } from '@/lib/safeRedirect'

describe('safeRedirectPath — safe relative paths (must pass through)', () => {
  it('returns "/" for null (no next param)', () => {
    expect(safeRedirectPath(null)).toBe('/')
  })

  it('returns "/" for undefined', () => {
    expect(safeRedirectPath(undefined)).toBe('/')
  })

  it('returns "/" for empty string', () => {
    expect(safeRedirectPath('')).toBe('/')
  })

  it('passes through "/"', () => {
    expect(safeRedirectPath('/')).toBe('/')
  })

  it('passes through a valid sub-path', () => {
    expect(safeRedirectPath('/settings')).toBe('/settings')
  })

  it('passes through a nested path', () => {
    expect(safeRedirectPath('/book/some-uuid')).toBe('/book/some-uuid')
  })

  it('passes through a path with query params', () => {
    expect(safeRedirectPath('/add?from=home')).toBe('/add?from=home')
  })
})

describe('safeRedirectPath — dangerous values (must be blocked → "/")', () => {
  it('blocks an absolute external URL', () => {
    expect(safeRedirectPath('https://evil.com/steal')).toBe('/')
  })

  it('blocks an HTTP URL', () => {
    expect(safeRedirectPath('http://evil.com')).toBe('/')
  })

  it('blocks a protocol-relative URL ("//evil.com")', () => {
    expect(safeRedirectPath('//evil.com/phishing')).toBe('/')
  })

  it('blocks a URL with a space prefix trick', () => {
    // " //evil.com" — starts with space, not "/"
    expect(safeRedirectPath(' //evil.com')).toBe('/')
  })

  it('blocks "javascript:" pseudo-protocol', () => {
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/')
  })

  it('blocks a data URI', () => {
    expect(safeRedirectPath('data:text/html,<script>alert(1)</script>')).toBe('/')
  })

  it('blocks an encoded external URL', () => {
    // Encoded but still doesn't start with '/'
    expect(safeRedirectPath('%2F%2Fevil.com')).toBe('/')
  })
})
