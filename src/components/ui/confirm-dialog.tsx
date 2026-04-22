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
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
            backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 9999,
          }}
          onClick={() => handleClose(false)}
        >
          <div
            style={{
              background: 'var(--bg3)', borderRadius: 12, padding: '24px 24px 20px',
              width: 380, maxWidth: '90vw', boxShadow: '0 12px 40px rgba(0,0,0,.4)',
              animation: 'modalIn .2s ease',
            }}
            onClick={e => e.stopPropagation()}
          >
            {state.options.title && (
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                {state.options.title}
              </div>
            )}
            <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20 }}>
              {state.options.message}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleClose(false)}
                style={{
                  padding: '8px 20px', border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--bg3)', color: 'var(--text2)', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', transition: 'background .15s',
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--bg4)')}
                onMouseOut={e => (e.currentTarget.style.background = 'var(--bg3)')}
              >
                {state.options.cancelText || '取消'}
              </button>
              <button
                onClick={() => handleClose(true)}
                style={{
                  padding: '8px 20px', border: 'none', borderRadius: 8,
                  background: state.options.danger
                    ? 'linear-gradient(135deg, var(--red), #ef4444)'
                    : 'linear-gradient(135deg, var(--accent), var(--accent2))',
                  color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  boxShadow: state.options.danger
                    ? '0 2px 8px rgba(248,113,113,.3)'
                    : '0 2px 8px rgba(129,140,248,.3)',
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
