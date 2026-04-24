'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// URL 路径 → 权限 key 的推断规则：
// /admin/{module}[/...] → admin.{module}.view
// 内置超管（isSuperAdmin=true）所有路径放行
// 以下路径不需要权限（仅登录态）
const PUBLIC_ADMIN_PATHS = ['/admin/dashboard', '/admin/login']

// 部分 URL 使用菜单的父模块权限（子路径共享）
const PATH_ALIAS: Record<string, string> = {
  '/admin/batch-download': 'admin.songs.view',
  // '/admin/isrc': 'admin.songs.view',
}

function inferPermKey(pathname: string): string | null {
  if (PUBLIC_ADMIN_PATHS.includes(pathname)) return null
  if (PATH_ALIAS[pathname]) return PATH_ALIAS[pathname]
  const m = pathname.match(/^\/admin\/([^\/]+)/)
  if (!m) return null
  return `admin.${m[1]}.view`
}

interface Me {
  isSuperAdmin?: boolean
  permissions?: Record<string, boolean>
}

/**
 * 管理端路由守卫：加载当前用户权限，若访问路径无对应 view 权限则跳转 dashboard。
 * 与后端 requirePermission 形成双层防御。
 */
export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/profile')
        if (!res.ok) {
          setChecked(true)
          return
        }
        const json = await res.json()
        if (cancelled || json?.code !== 200) {
          setChecked(true)
          return
        }
        const me: Me = json.data
        if (me.isSuperAdmin) {
          setChecked(true)
          return
        }
        const key = inferPermKey(pathname)
        if (!key) {
          setChecked(true)
          return
        }
        const perms = me.permissions ?? {}
        if (perms[key] !== true) {
          // 无权限：跳转到默认入口 dashboard（如果连 dashboard 也没有则跳 login）
          const target = perms['admin.dashboard.view'] === true ? '/admin/dashboard' : '/admin/login'
          router.replace(target)
          return
        }
        setChecked(true)
      } catch {
        setChecked(true)
      }
    })()
    return () => { cancelled = true }
  }, [pathname, router])

  if (!checked) {
    // 骨架屏：占位 3 块矩形，避免"权限校验中"字样突兀
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ height: 32, width: '40%', background: 'var(--bg2, #eef2f9)', borderRadius: 6, animation: 'sk-pulse 1.2s ease-in-out infinite' }} />
        <div style={{ display: 'flex', gap: 16 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ flex: 1, height: 80, background: 'var(--bg2, #eef2f9)', borderRadius: 8, animation: 'sk-pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
        <div style={{ height: 240, background: 'var(--bg2, #eef2f9)', borderRadius: 8, animation: 'sk-pulse 1.2s ease-in-out infinite', animationDelay: '0.3s' }} />
        <style>{`@keyframes sk-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.55 } }`}</style>
      </div>
    )
  }
  return <>{children}</>
}
