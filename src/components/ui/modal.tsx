'use client'

import { ReactNode } from 'react'
import { X } from 'lucide-react'

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={disableBackdropClose ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: '90vw',
          borderRadius: 12,
          background: 'var(--bg3)',
          padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'modalIn 0.3s ease both',
        }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{title}</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-full text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--bg2)] transition-colors"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}
