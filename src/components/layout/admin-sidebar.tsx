'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sidebar, type MenuItem } from './sidebar'
import {
  LayoutDashboard, FileText, Users, ClipboardList, Headphones, KeyRound,
  Shield, ShieldCheck, Music, Download, Tag, Globe, CircleCheck,
  Coins, Settings, ScrollText
} from 'lucide-react'

// 菜单项按 permissions key 归属的模块。内置超管（isSuperAdmin=true）所有菜单放行。
// 检查 `admin.{module}.view` 是否为 true；为 true 则保留该菜单。
const ADMIN_MENUS: (MenuItem & { permKey?: string })[] = [
  { key: 'd1', label: '', icon: '', href: '', divider: '总览' },
  { key: 'dashboard', label: '运营看板', icon: <LayoutDashboard size={16} />, href: '/admin/dashboard', permKey: 'admin.dashboard.view' },

  { key: 'd2', label: '', icon: '', href: '', divider: '内容运营' },
  { key: 'cms', label: '内容管理', icon: <FileText size={16} />, href: '/admin/content', permKey: 'admin.cms.view' },
  { key: 'assignments', label: '作业管理', icon: <ClipboardList size={16} />, href: '/admin/assignments', permKey: 'admin.assignments.view' },

  { key: 'd3', label: '', icon: '', href: '', divider: '用户管理' },
  { key: 'students', label: '用户档案', icon: <Users size={16} />, href: '/admin/students', permKey: 'admin.students.view' },
  { key: 'groups', label: '用户组管理', icon: <Users size={16} />, href: '/admin/groups', permKey: 'admin.groups.view' },
  { key: 'contracts', label: '合同台账', icon: <FileText size={16} />, href: '/admin/contracts', permKey: 'admin.contracts.view' },

  { key: 'd4', label: '', icon: '', href: '', divider: '评审管理' },
  { key: 'teachers', label: '评审绩效', icon: <Headphones size={16} />, href: '/admin/teachers', permKey: 'admin.teachers.view' },
  { key: 'accounts', label: '评审账号', icon: <KeyRound size={16} />, href: '/admin/accounts', permKey: 'admin.accounts.view' },

  { key: 'd5', label: '', icon: '', href: '', divider: '歌曲与发行' },
  { key: 'songs', label: '歌曲库', icon: <Music size={16} />, href: '/admin/songs', permKey: 'admin.songs.view' },
  { key: 'isrc', label: 'ISRC管理', icon: <Tag size={16} />, href: '/admin/isrc', permKey: 'admin.isrc.view' },
  { key: 'distributions', label: '发行渠道', icon: <Globe size={16} />, href: '/admin/distributions', permKey: 'admin.distributions.view' },
  { key: 'publish-confirm', label: '发行确认', icon: <CircleCheck size={16} />, href: '/admin/publish-confirm', permKey: 'admin.publish_confirm.view' },
  { key: 'batch-download', label: '批量下载', icon: <Download size={16} />, href: '/admin/batch-download', permKey: 'admin.batch_download.view' },

  { key: 'd6', label: '', icon: '', href: '', divider: '收益' },
  { key: 'revenue', label: '收益管理', icon: <Coins size={16} />, href: '/admin/revenue', permKey: 'admin.revenue.view' },

  { key: 'd7', label: '', icon: '', href: '', divider: '系统管理' },
  { key: 'admins', label: '平台管理员', icon: <Shield size={16} />, href: '/admin/admins', permKey: 'admin.admins.view' },
  { key: 'roles', label: '角色管理', icon: <ShieldCheck size={16} />, href: '/admin/roles', permKey: 'admin.roles.view' },
  { key: 'settings', label: '系统设置', icon: <Settings size={16} />, href: '/admin/settings', permKey: 'admin.settings.view' },
  { key: 'logs', label: '操作日志', icon: <ScrollText size={16} />, href: '/admin/logs', permKey: 'admin.logs.view' },
]

interface Me {
  isSuperAdmin?: boolean
  permissions?: Record<string, boolean>
}

export function AdminSidebar() {
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.code === 200) setMe(json.data)
      })
      .catch(() => { /* 失败时继续展示全部，避免卡菜单 */ })
  }, [])

  const items = useMemo<MenuItem[]>(() => {
    if (!me) return ADMIN_MENUS  // 未加载完前全显示，避免闪烁
    if (me.isSuperAdmin) return ADMIN_MENUS
    const perms = me.permissions ?? {}
    // 过滤：菜单需 permKey 命中；同一 divider 段下无菜单项则一并隐藏该 divider
    const filtered: (MenuItem & { permKey?: string })[] = []
    for (const item of ADMIN_MENUS) {
      if (item.divider) {
        filtered.push(item)  // 暂加入，后面清理无孤立 divider
        continue
      }
      if (!item.permKey || perms[item.permKey] === true) {
        filtered.push(item)
      }
    }
    // 清理后面没菜单项的 divider（连续 divider 或末尾 divider）
    const cleaned: MenuItem[] = []
    for (let i = 0; i < filtered.length; i++) {
      const cur = filtered[i]
      if (cur.divider) {
        const nxt = filtered[i + 1]
        if (!nxt || nxt.divider) continue
      }
      cleaned.push(cur)
    }
    return cleaned
  }, [me])

  return <Sidebar items={items} portalLabel="管理端" portalColor="var(--orange)" onLogout={() => {}} />
}
