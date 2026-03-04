import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AppProvider } from '@/contexts/AppContext'
import CozyBody from '@/components/CozyBody'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'My Bookshelf',
  description: 'Track every book you read',
  themeColor: '#d3f0fb',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'My Bookshelf',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppProvider>
          <CozyBody>{children}</CozyBody>
        </AppProvider>
      </body>
    </html>
  )
}
