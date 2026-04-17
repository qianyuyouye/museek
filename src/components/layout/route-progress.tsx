'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'

export function RouteProgress() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevPathRef = useRef(pathname)

  const start = useCallback(() => {
    setProgress(0)
    setVisible(true)
    let p = 0
    timerRef.current = setInterval(() => {
      p += Math.random() * 12 + 3
      if (p > 90) p = 90
      setProgress(p)
    }, 120)
  }, [])

  const done = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setProgress(100)
    setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 300)
  }, [])

  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      done()
      prevPathRef.current = pathname
    }
  }, [pathname, done])

  // Intercept link clicks to start progress
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (href && href.startsWith('/') && href !== pathname) {
        start()
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [pathname, start])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
          borderRadius: '0 2px 2px 0',
          transition: progress === 100 ? 'width 200ms ease-out, opacity 200ms ease-out' : 'width 300ms ease',
          opacity: progress === 100 ? 0 : 1,
          boxShadow: '0 0 8px rgba(99,102,241,0.4)',
        }}
      />
    </div>
  )
}
