/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Disallow embedding in iframes (clickjacking protection)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Limit referrer information sent to third parties
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Camera is used for cover photo capture and ISBN scanning.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js requires 'unsafe-inline' for its runtime scripts and styles.
      // Tighten to nonce-based CSP once Next.js nonce support is wired in.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      // All cover images are served through the /api/cover proxy (which
      // enforces its own host allowlist), so no external image hosts needed.
      "img-src 'self' data: blob:",
      // API calls: Supabase requests go through the /_supabase rewrite ('self');
      // the direct hosts stay allowlisted as a fallback. Google Books / Open
      // Library are only called server-side and no longer need an entry.
      "connect-src 'self' https://*.supabase.co",
      // No external fonts or media
      "font-src 'self'",
      "media-src 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig = {
  // Allow <img> tags to load covers from external book APIs
  // (we use plain <img> for simplicity instead of next/image)

  // Proxy Supabase requests through the local dev server so sandboxed preview
  // browsers (which can't reach external URLs) can still hit the API.
  async rewrites() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) return []
    return [
      {
        source: '/_supabase/:path*',
        destination: `${supabaseUrl}/:path*`,
      },
    ]
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
