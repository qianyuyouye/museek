'use client'

import { Sidebar, type MenuItem } from './sidebar'
import { Home, ClipboardList, BookOpen, Upload, Music, Coins, Globe, TrendingUp, User, Bell } from 'lucide-react'

const CREATOR_MENUS: MenuItem[] = [
  { key: 'd1', label: '', icon: '', href: '', divider: '主要功能' },
  { key: 'home', label: '首页', icon: <Home size={16} />, href: '/creator/home' },
  { key: 'assignments', label: '作业提交', icon: <ClipboardList size={16} />, href: '/creator/assignments' },
  { key: 'courses', label: '课程中心', icon: <BookOpen size={16} />, href: '/creator/courses' },
  { key: 'upload', label: '上传作品', icon: <Upload size={16} />, href: '/creator/upload' },
  { key: 'works', label: '我的作品库', icon: <Music size={16} />, href: '/creator/songs' },
  { key: 'revenue', label: '我的收益', icon: <Coins size={16} />, href: '/creator/revenue' },
  { key: 'd2', label: '', icon: '', href: '', divider: '发现' },
  { key: 'gallery', label: '作品广场', icon: <Globe size={16} />, href: '/creator/community' },
  { key: 'learning', label: '我的学习', icon: <TrendingUp size={16} />, href: '/creator/learning' },
  { key: 'd3', label: '', icon: '', href: '', divider: '个人' },
  { key: 'profile', label: '个人中心', icon: <User size={16} />, href: '/creator/profile' },
  { key: 'messages', label: '消息中心', icon: <Bell size={16} />, href: '/creator/notifications' },
]

export function CreatorSidebar() {
  return <Sidebar items={CREATOR_MENUS} portalLabel="创作者端" portalColor="var(--accent)" onLogout={() => {}} />
}
