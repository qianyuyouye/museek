'use client'

import { ReactNode } from 'react'

interface AdminModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: number
  disableBackdropClose?: boolean
}

export function AdminModal({ open, onClose, title, children, width = 520, disableBackdropClose = false }: AdminModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[4px]"
      onClick={disableBackdropClose ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: '90vw',
          borderRadius: 'var(--radius-lg)',
          background: '#fff',
          padding: 24,
          boxShadow: '0 20px 60px rgba(99,102,241,0.12)',
          animation: 'modalIn 0.3s ease both',
        }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{title}</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-full text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--bg2)] transition-colors text-sm"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}
