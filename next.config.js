/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow <img> tags to load covers from external book APIs
  // (we use plain <img> for simplicity instead of next/image)

  // Proxy Supabase requests through the local dev server so the preview
  // browser (which can't reach external URLs) can still hit the API.
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
}

module.exports = nextConfig
