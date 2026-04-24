'use client'

import { useState, useEffect } from 'react'
import { Sidebar, type MenuItem } from './sidebar'
import { LayoutDashboard, ListChecks, Headphones, CircleCheck, TrendingUp, User } from 'lucide-react'

function usePendingCount() {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/review/queue?page=1&pageSize=1', { credentials: 'include' })
      .then(r => r.json())
      .then(j => { if (j.code === 200) setCount(j.data.total ?? 0) })
      .catch(() => {})
  }, [])
  return count
}

export function ReviewerSidebar() {
  const pendingCount = usePendingCount()
  const REVIEWER_MENUS: MenuItem[] = [
    { key: 'd1', label: '', icon: '', href: '', divider: '工作' },
    { key: 'workbench', label: '工作台', icon: <LayoutDashboard size={16} />, href: '/review/workbench' },
    { key: 'pending', label: '待评审列表', icon: <ListChecks size={16} />, href: '/review/queue', badge: pendingCount ?? undefined },
    { key: 'evaluate', label: '评审页面', icon: <Headphones size={16} />, href: '/review/assess' },
    { key: 'reviewed', label: '已评审歌曲', icon: <CircleCheck size={16} />, href: '/review/reviewed' },
    { key: 'd2', label: '', icon: '', href: '', divider: '统计' },
    { key: 'performance', label: '我的绩效', icon: <TrendingUp size={16} />, href: '/review/stats' },
    { key: 'd3', label: '', icon: '', href: '', divider: '个人' },
    { key: 'profile', label: '个人中心', icon: <User size={16} />, href: '/review/profile' },
  ]

  return <Sidebar items={REVIEWER_MENUS} portalLabel="评审端" portalColor="var(--green)" onLogout={() => {}} />
}
