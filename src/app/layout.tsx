import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { profile } from '@/content'
import './globals.css'

const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-display',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: `${profile.name} — Signal Array`,
  description: `${profile.role}. ${profile.education}.`,
}

export const viewport: Viewport = {
  themeColor: '#0b0e11',
  // The scene fills the viewport exactly; letting the user zoom would expose
  // the canvas edges.
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="h-dvh overflow-hidden bg-[#0b0e11] antialiased">{children}</body>
    </html>
  )
}
