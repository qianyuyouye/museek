'use client'

import { useEffect, useState, useCallback } from 'react'

interface ToastItem {
  id: number
  message: string
  createdAt: number
}

/**
 * 全局 toast 容器，挂在任何一个 providers 组件下即可。
 * 会把 showToast 注入到 window.__globalToast，让 lib/use-api.ts 的 apiCall 在失败时自动调用。
 */
export function GlobalToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, createdAt: Date.now() }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  useEffect(() => {
    ;(window as unknown as { __globalToast?: (m: string) => void }).__globalToast = showToast
    return () => {
      delete (window as unknown as { __globalToast?: unknown }).__globalToast
    }
  }, [showToast])

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            pointerEvents: 'auto',
            padding: '10px 16px',
            background: 'rgba(17, 24, 39, 0.92)',
            color: '#fff',
            fontSize: 13,
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            maxWidth: 360,
            animation: 'toast-in 180ms ease',
          }}
        >
          {t.message}
        </div>
      ))}
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </div>
  )
}
