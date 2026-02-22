import type { Metadata } from 'next'
import { Noto_Sans } from 'next/font/google'
import './globals.css'

const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: 'My Bookshelf',
  description: 'Track every book you read',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${notoSans.className} bg-white antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
