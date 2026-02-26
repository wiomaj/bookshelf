import type { Metadata, Viewport } from 'next'
import { Noto_Sans } from 'next/font/google'
import './globals.css'
import { AppProvider } from '@/contexts/AppContext'
import CozyBody from '@/components/CozyBody'

const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: 'My Bookshelf',
  description: 'Track every book you read',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={notoSans.className}>
        <AppProvider>
          <CozyBody>{children}</CozyBody>
        </AppProvider>
      </body>
    </html>
  )
}
