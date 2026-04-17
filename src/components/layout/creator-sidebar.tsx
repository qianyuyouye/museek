'use client'

import { Sidebar, type MenuItem } from './sidebar'

const CREATOR_MENUS: MenuItem[] = [
  { key: 'd1', label: '', icon: '', href: '', divider: '主要功能' },
  { key: 'home', label: '首页', icon: '🏠', href: '/creator/home' },
  { key: 'assignments', label: '作业提交', icon: '📝', href: '/creator/assignments' },
  { key: 'courses', label: '课程中心', icon: '📚', href: '/creator/courses' },
  { key: 'upload', label: '上传作品', icon: '⬆️', href: '/creator/upload' },
  { key: 'works', label: '我的作品库', icon: '🎵', href: '/creator/songs' },
  { key: 'revenue', label: '我的收益', icon: '💰', href: '/creator/revenue' },
  { key: 'd2', label: '', icon: '', href: '', divider: '发现' },
  { key: 'gallery', label: '作品广场', icon: '🌐', href: '/creator/community' },
  { key: 'learning', label: '我的学习', icon: '📈', href: '/creator/learning' },
  { key: 'd3', label: '', icon: '', href: '', divider: '个人' },
  { key: 'profile', label: '个人中心', icon: '👤', href: '/creator/profile' },
  { key: 'messages', label: '消息中心', icon: '🔔', href: '/creator/notifications' },
]

export function CreatorSidebar() {
  return <Sidebar items={CREATOR_MENUS} portalLabel="创作者端" portalColor="var(--accent)" onLogout={() => {}} />
}
