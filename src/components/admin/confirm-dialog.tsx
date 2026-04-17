'use client'

import { useState, useCallback, createContext, useContext, type ReactNode } from 'react'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType>({ confirm: () => Promise.resolve(false) })

export function useConfirm() {
  return useContext(ConfirmContext).confirm
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean
    options: ConfirmOptions
    resolve: ((v: boolean) => void) | null
  }>({ open: false, options: { message: '' }, resolve: null })

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, options, resolve })
    })
  }, [])

  const handleClose = (result: boolean) => {
    state.resolve?.(result)
    setState({ open: false, options: { message: '' }, resolve: null })
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.open && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,.3)',
            backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 9999,
          }}
          onClick={() => handleClose(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 14, padding: '24px 24px 20px',
              width: 380, maxWidth: '90vw', boxShadow: '0 12px 40px rgba(0,0,0,.12)',
              animation: 'modalIn .2s ease',
            }}
            onClick={e => e.stopPropagation()}
          >
            {state.options.title && (
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>
                {state.options.title}
              </div>
            )}
            <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 20 }}>
              {state.options.message}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleClose(false)}
                style={{
                  padding: '8px 20px', border: '1px solid #e2e8f0', borderRadius: 8,
                  background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', transition: 'background .15s',
                }}
                onMouseOver={e => (e.currentTarget.style.background = '#f8fafc')}
                onMouseOut={e => (e.currentTarget.style.background = '#fff')}
              >
                {state.options.cancelText || '取消'}
              </button>
              <button
                onClick={() => handleClose(true)}
                style={{
                  padding: '8px 20px', border: 'none', borderRadius: 8,
                  background: state.options.danger
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                    : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  boxShadow: state.options.danger
                    ? '0 2px 8px rgba(239,68,68,.3)'
                    : '0 2px 8px rgba(99,102,241,.3)',
                }}
              >
                {state.options.confirmText || '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
