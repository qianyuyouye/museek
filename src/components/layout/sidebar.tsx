'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'

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
  const [confirmLogout, setConfirmLogout] = useState(false)

  const handleLogout = async () => {
    if (!confirmLogout) {
      setConfirmLogout(true)
      setTimeout(() => setConfirmLogout(false), 3000)
      return
    }
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
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[200px] flex-col" style={{ background: 'linear-gradient(180deg, #4f46e5 0%, #6366f1 40%, #7c7cf7 100%)' }}>
      <div className="flex flex-col items-center gap-1 px-4 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-lg text-white shadow-md">
          🎵
        </div>
        <span className="text-sm font-semibold text-white">AI音乐平台</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
        >
          {portalLabel}
        </span>
      </div>

      <div className="sidebar-scroll flex-1 overflow-y-auto px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`.sidebar-scroll::-webkit-scrollbar { display: none; }`}</style>
        <nav className="flex flex-col gap-px">
          {items.map((item, i) => {
            if (item.divider) {
              return (
                <div key={`d-${i}`} className="mb-1 mt-3 px-3 text-[10px] font-medium uppercase tracking-wider text-white/50">
                  {item.divider}
                </div>
              )
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-all no-underline',
                  isActive
                    ? 'bg-white/20 font-medium text-white'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                )}
              >
                <span className="text-base">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
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

      <div className="border-t border-white/15 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-[12px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          🚪 {confirmLogout ? '再次点击确认退出' : '退出登录'}
        </button>
      </div>
    </aside>
  )
}
