'use client'

import { Sidebar, type MenuItem } from './sidebar'

const ADMIN_MENUS: MenuItem[] = [
  { key: 'd1', label: '', icon: '', href: '', divider: '总览' },
  { key: 'dashboard', label: '运营看板', icon: '📊', href: '/admin/dashboard' },
  { key: 'd2', label: '', icon: '', href: '', divider: '内容' },
  { key: 'cms', label: '内容管理', icon: '📝', href: '/admin/content' },
  { key: 'd3', label: '', icon: '', href: '', divider: '用户与权限' },
  { key: 'groups', label: '用户组管理', icon: '🏘️', href: '/admin/groups' },
  { key: 'assignments', label: '作业管理', icon: '📝', href: '/admin/assignments' },
  { key: 'students', label: '用户档案', icon: '👥', href: '/admin/students' },
  { key: 'contracts', label: '合同台账', icon: '📄', href: '/admin/contracts' },
  { key: 'teachers', label: '评审绩效', icon: '🎧', href: '/admin/teachers' },
  { key: 'accounts', label: '账号与权限', icon: '🔑', href: '/admin/accounts' },
  { key: 'admins', label: '平台管理员', icon: '👤', href: '/admin/admins' },
  { key: 'roles', label: '角色管理', icon: '🛡️', href: '/admin/roles' },
  { key: 'd4', label: '', icon: '', href: '', divider: '歌曲' },
  { key: 'songs', label: '歌曲库管理', icon: '🎵', href: '/admin/songs' },
  { key: 'batch-download', label: '作品库批量下载', icon: '⬇️', href: '/admin/batch-download' },
  { key: 'isrc', label: 'ISRC管理', icon: '🔖', href: '/admin/isrc' },
  { key: 'distributions', label: '发行渠道', icon: '🌐', href: '/admin/distributions' },
  { key: 'publish-confirm', label: '发行状态确认', icon: '✅', href: '/admin/publish-confirm' },
  { key: 'd5', label: '', icon: '', href: '', divider: '收益' },
  { key: 'revenue', label: '收益管理', icon: '💰', href: '/admin/revenue' },
  { key: 'd6', label: '', icon: '', href: '', divider: '系统' },
  { key: 'settings', label: '系统设置', icon: '⚙️', href: '/admin/settings' },
  { key: 'logs', label: '操作日志', icon: '📋', href: '/admin/logs' },
]

export function AdminSidebar() {
  return <Sidebar items={ADMIN_MENUS} portalLabel="管理端" portalColor="var(--orange)" onLogout={() => {}} />
}
