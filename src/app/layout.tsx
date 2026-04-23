import type { Metadata } from 'next'
import { RouteProgress } from '@/components/layout/route-progress'
import './globals.css'

export const metadata: Metadata = {
  title: 'Museek · AI音乐平台',
  description: 'AI音乐教学与版权代理平台',
  icons: {
    icon: '/favicon-icon.svg',
    apple: '/favicon-icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <RouteProgress />
        {children}
      </body>
    </html>
  )
}
