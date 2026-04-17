'use client'

import { Sidebar, type MenuItem } from './sidebar'

const REVIEWER_MENUS: MenuItem[] = [
  { key: 'd1', label: '', icon: '', href: '', divider: '工作' },
  { key: 'workbench', label: '工作台', icon: '📊', href: '/review/workbench' },
  { key: 'pending', label: '待评审列表', icon: '📋', href: '/review/queue' },
  { key: 'evaluate', label: '评审页面', icon: '🎧', href: '/review/assess' },
  { key: 'd2', label: '', icon: '', href: '', divider: '统计' },
  { key: 'performance', label: '我的绩效', icon: '📈', href: '/review/stats' },
  { key: 'd3', label: '', icon: '', href: '', divider: '个人' },
  { key: 'profile', label: '个人中心', icon: '👤', href: '/review/profile' },
]

export function ReviewerSidebar() {
  return <Sidebar items={REVIEWER_MENUS} portalLabel="评审端" portalColor="var(--green)" onLogout={() => {}} />
}
