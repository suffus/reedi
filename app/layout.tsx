import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import { Providers } from '../components/providers'
import { SharedMediaDetailModal } from '../components/common/shared-media-detail-modal'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({ 
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Reedi - Connect with Family & Friends',
  description: 'A secure social media platform for family and friends to share moments, stories, and stay connected.',
  keywords: ['social media', 'family', 'friends', 'secure', 'community'],
  authors: [{ name: 'Reedi Team' }],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    apple: '/favicon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased bg-white text-primary-900">
        <Providers>
          {children}
          <SharedMediaDetailModal />
        </Providers>
      </body>
    </html>
  )
} 