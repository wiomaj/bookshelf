/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Disallow embedding in iframes (clickjacking protection)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Limit referrer information sent to third parties
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable browser features not used by the app
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js requires 'unsafe-inline' for its runtime scripts and styles.
      // Tighten to nonce-based CSP once Next.js nonce support is wired in.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      // Cover images come from Google Books, Open Library, and Supabase storage.
      // Everything else is proxied through /api/cover which enforces its own allowlist.
      "img-src 'self' data: blob: https://books.google.com https://covers.openlibrary.org https://*.supabase.co",
      // API calls: Supabase (auth + DB), Open Library, Google Books
      "connect-src 'self' https://*.supabase.co https://openlibrary.org https://www.googleapis.com",
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
