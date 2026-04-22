'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Music, LogOut } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/confirm-modal'

export interface MenuItem {
  key: string
  label: string
  icon: React.ReactNode
  href: string
  badge?: number
  divider?: string
}

interface SidebarProps {
  items: MenuItem[]
  portalLabel: string
  portalColor: string
  onLogout: () => void
}

export function Sidebar({ items, portalLabel, portalColor, onLogout }: SidebarProps) {
  const pathname = usePathname()
  const [logoutConfirm, setLogoutConfirm] = useState(false)

  const handleLogout = async () => {
    setLogoutConfirm(false)
    await fetch('/api/auth/logout', { method: 'POST' })
    onLogout()
    const loginMap: Record<string, string> = {
      '/admin': '/admin/login',
      '/creator': '/creator/login',
      '/review': '/review/login',
    }
    const prefix = Object.keys(loginMap).find(p => pathname.startsWith(p))
    window.location.href = prefix ? loginMap[prefix] : '/creator/login'
  }

  return (
    <>
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col bg-[var(--bg2)] border-r border-[var(--border)]">
      {/* Header */}
      <div className="flex flex-col items-center justify-center gap-1 px-4 py-4 border-b border-[var(--border)]">
        <img src="/logo-white.svg" alt="Museek" className="w-[180px] h-auto" />
        <span className="rounded-md px-2 py-0.5 text-[10px] font-medium bg-[var(--bg4)] text-[var(--text3)] mt-0.5">
          {portalLabel}
        </span>
      </div>

      {/* Nav */}
      <div className="sidebar-scroll flex-1 overflow-y-auto px-3 py-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`.sidebar-scroll::-webkit-scrollbar { display: none; }`}</style>
        <nav className="flex flex-col gap-1">
          {items.map((item, i) => {
            if (item.divider) {
              return (
                <div key={`d-${i}`} className="flex items-center gap-2 mt-3 mb-2 px-1">
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-[10px] font-medium text-[var(--text3)] tracking-wide">{item.divider}</span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                </div>
              )
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors no-underline',
                  isActive
                    ? 'bg-[var(--bg4)] text-[var(--accent)] font-medium'
                    : 'text-[var(--text2)] hover:bg-[var(--bg4)] hover:text-[var(--text)]'
                )}
              >
                {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--accent)] rounded-r" />}
                <span className="flex items-center shrink-0">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--red)] px-1 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border)] p-3">
        <button
          onClick={() => setLogoutConfirm(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] text-[var(--text3)] transition-colors hover:bg-[var(--bg4)] hover:text-[var(--text)]"
        >
          <LogOut size={14} /> 退出登录
        </button>
      </div>
    </aside>
    <ConfirmModal
      open={logoutConfirm}
      message="确定要退出登录吗？"
      confirmText="退出登录"
      cancelText="取消"
      onConfirm={handleLogout}
      onCancel={() => setLogoutConfirm(false)}
    />
    </>
  )
}
