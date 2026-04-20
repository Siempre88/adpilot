import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AdPilot — Centro de Control de Facebook Ads',
  description: 'Analiza campañas, detecta problemas y toma mejores decisiones con IA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`dark ${inter.variable}`}>
      <body className="min-h-screen text-white antialiased font-sans">
        {children}
      </body>
    </html>
  )
}
