import type { Metadata, Viewport } from 'next'
import { Inter, Unbounded } from 'next/font/google'
import './globals.css'
import { AppProvider } from '@/contexts/AppContext'
import CozyBody from '@/components/CozyBody'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

// Display font for titles (h1/h2) — see globals.css. latin-ext covers the
// Polish locale; self-hosted by next/font, so no external font request.
const unbounded = Unbounded({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-unbounded',
})

export const metadata: Metadata = {
  title: 'My Bookshelf',
  description: 'Track every book you read',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'My Bookshelf',
  },
}

// Status-bar / browser-chrome color follows the system appearance.
// AppContext keeps it in sync when the user forces dark mode in Settings.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2F2F7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // suppressHydrationWarning: the inline theme script adds the `dark` class
    // to <html> before React hydrates (standard next-themes pattern).
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply dark mode before first paint — prevents a white flash for
            dark-mode users while React hydrates and AppContext loads. */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var th = localStorage.getItem('bookshelf_theme');
            var dark = th === 'dark' || (th !== 'dark' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            if (dark) document.documentElement.classList.add('dark');
          } catch (e) {}
        `}} />
        {/* Capture beforeinstallprompt as early as possible — before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window.__installPrompt = e;
          });
        `}} />
      </head>
      <body className={`${inter.className} ${unbounded.variable}`}>
        <AppProvider>
          <CozyBody>{children}</CozyBody>
        </AppProvider>
      </body>
    </html>
  )
}
