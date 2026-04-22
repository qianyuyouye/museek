'use client'

import { useEffect, useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open, title = '确认操作', message, confirmText = '确认', cancelText = '取消', danger = false,
  onConfirm, onCancel,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="bg-[var(--bg3)] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] w-[400px] max-w-[90vw] p-6"
        style={{ animation: 'modalIn 0.3s ease both' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {danger && <AlertTriangle size={18} className="text-[var(--red)]" />}
            <h3 className="text-[15px] font-semibold text-[var(--text)]">{title}</h3>
          </div>
          <button onClick={onCancel} className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--bg2)] transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Message */}
        <p className="text-sm text-[var(--text2)] leading-relaxed mb-6">{message}</p>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-transparent text-[var(--text2)] border border-[var(--border)] cursor-pointer hover:bg-[var(--bg4)] transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-xs font-medium text-white border-0 cursor-pointer transition-opacity hover:opacity-90 ${
              danger
                ? 'bg-[var(--red)]'
                : 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---- Prompt Modal ---- */

interface PromptModalProps {
  open: boolean
  title: string
  message: string
  defaultValue?: string
  placeholder?: string
  multiline?: boolean
  onConfirm: (value: string) => void
  onCancel: () => void
}

export function PromptModal({
  open, title, message, defaultValue = '', placeholder = '', multiline = false, onConfirm, onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    if (open) setValue(defaultValue)
  }, [open, defaultValue])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="bg-[var(--bg3)] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] w-[440px] max-w-[90vw] p-6"
        style={{ animation: 'modalIn 0.3s ease both' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-[var(--text)]">{title}</h3>
          <button onClick={onCancel} className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--bg2)] transition-colors">
            <X size={14} />
          </button>
        </div>

        <p className="text-sm text-[var(--text2)] leading-relaxed mb-4 whitespace-pre-line">{message}</p>

        {multiline ? (
          <textarea
            className="w-full px-3.5 py-2.5 bg-[var(--bg4)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] mb-6 font-mono text-[12px] min-h-[200px] resize-y"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
          />
        ) : (
          <input
            className="w-full px-3.5 py-2.5 bg-[var(--bg4)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] mb-6"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => e.key === 'Enter' && value.trim() && onConfirm(value)}
          />
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-transparent text-[var(--text2)] border border-[var(--border)] cursor-pointer hover:bg-[var(--bg4)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => value.trim() && onConfirm(value)}
            className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] border-0 cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!value.trim()}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}
