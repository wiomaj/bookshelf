/** @type {import('next').NextConfig} */

// Applied to every response. CSP uses 'unsafe-inline' for scripts because
// Next.js App Router inlines hydration scripts — nonce-based CSP would be
// the hardened next step but requires custom middleware instrumentation.
const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Disallow embedding in iframes (clickjacking protection)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Limit referrer information sent to third parties
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable browser features the app does not use
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // Force HTTPS for 2 years (only active on HTTPS — Vercel always serves HTTPS)
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js requires unsafe-inline + unsafe-eval for hydration scripts
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Tailwind inline styles + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Book covers from Google Books and Open Library, Figma asset, Vercel insights
      "img-src 'self' data: blob: https://books.google.com https://covers.openlibrary.org https://www.figma.com https://openlibrary.org",
      // Supabase realtime + REST, Google Books API, Open Library API
      [
        "connect-src 'self'",
        `https://${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '') ?? '*.supabase.co'}`,
        `wss://${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '') ?? '*.supabase.co'}`,
        'https://www.googleapis.com',
        'https://openlibrary.org',
        'https://covers.openlibrary.org',
        'https://vitals.vercel-insights.com',
      ].join(' '),
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
