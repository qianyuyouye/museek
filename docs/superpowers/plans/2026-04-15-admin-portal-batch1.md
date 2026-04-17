# Admin Portal Batch 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first 5 admin portal pages (Dashboard, User Groups, Student Profiles, Platform Admins, Role Management) with mock data, fully replicating the HTML prototype functionality and PNG screenshot styling.

**Architecture:** Next.js 15 App Router pages under `src/app/(admin)/admin/`. Shared admin components in `src/components/admin/`. All data from a single mock file `src/lib/mock/admin.ts`. Pages are client components using `useState` for local state (list/detail view switching, modals, forms). No API calls in this batch.

**Tech Stack:** Next.js 15, React 18, TypeScript, Tailwind CSS, shadcn/ui (Table, Dialog, ScrollArea), existing CSS variables from `globals.css`.

**Design spec:** `docs/superpowers/specs/2026-04-15-admin-portal-batch1-design.md`
**HTML prototype:** `docs/管理端.html` (complete functional reference)
**UI screenshots:** `docs/AI音乐平台/*.png` (visual reference)

---

## File Structure

```
src/
├── lib/mock/
│   └── admin.ts                    # All mock data + types + constants
├── components/admin/
│   ├── page-header.tsx             # Title + subtitle + actions slot
│   ├── stat-card.tsx               # Dashboard/overview stat cards
│   ├── data-table.tsx              # Reusable table with pagination
│   ├── search-bar.tsx              # Search input + filters + buttons
│   ├── status-badge.tsx            # Colored status labels
│   ├── admin-modal.tsx             # Modal dialog overlay
│   ├── admin-tab.tsx               # Capsule-style tab switcher
│   └── permission-tree.tsx         # 3-tier permission checkbox tree
├── app/(admin)/admin/
│   ├── dashboard/page.tsx          # Dashboard (rewrite existing stub)
│   ├── groups/page.tsx             # User group management
│   ├── students/page.tsx           # Student profiles
│   ├── admins/page.tsx             # Platform admin management
│   └── roles/page.tsx              # Role management
```

---

### Task 1: Mock Data & Types

**Files:**
- Create: `src/lib/mock/admin.ts`

This is the foundation — all pages consume this data. Types align with Prisma schema. Data copied from HTML prototype's `MOCK` object.

- [ ] **Step 1: Create mock data file with types and data**

```typescript
// src/lib/mock/admin.ts

// ═══ Types ═══

export interface MockUserGroup {
  id: number
  name: string
  description: string
  inviteCode: string
  inviteLink: string
  memberCount: number
  status: 'active' | 'paused'
  createdBy: number
  createdAt: string
}

export interface MockStudent {
  id: number
  name: string
  phone: string
  email: string
  role: 'creator' | 'reviewer' | 'admin'
  adminLevel: 'group_admin' | 'system_admin' | null
  realNameStatus: 'verified' | 'pending' | 'unverified' | 'rejected'
  realName: string
  idCard: string
  verifiedPhone: string
  agencyContract: boolean
  signedAt: string | null
  songCount: number
  totalRevenue: number
  avatar: string
  groupIds: number[]
}

export interface MockSong {
  id: number
  userId: number
  title: string
  lyricist: string
  composer: string
  aiTool: string
  genre: string
  bpm: number
  status: 'pending_review' | 'needs_revision' | 'reviewed' | 'ready_to_publish' | 'published' | 'archived'
  score: number | null
  copyrightCode: string
  isrc: string | null
  likeCount: number
  createdAt: string
  cover: string
  source: 'upload' | 'assignment'
  assignmentId?: number
  reviewComment?: string
}

export interface MockRole {
  id: number
  name: string
  description: string
  permissions: Record<string, boolean>
  createdAt: string
  isSuper?: boolean
}

export interface MockPlatformAdmin {
  id: number
  account: string
  name: string
  roleId: number
  roleName: string
  avatar: string
  status: boolean
  multiLogin: boolean
  createdAt: string
  lastLogin: string
  lastIp: string
}

export interface PermissionNode {
  key: string
  label: string
  actions: string[]
}

export interface PermissionPortal {
  portal: string
  icon: string
  key: string
  children: PermissionNode[]
}

// ═══ Status Maps ═══

export const SONG_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending_review: { label: '待评分', color: '#d97706', bg: '#fef9ec' },
  needs_revision: { label: '需修改', color: '#e53e3e', bg: '#fff0f0' },
  reviewed: { label: '已评分', color: '#6366f1', bg: '#eef2ff' },
  archived: { label: '已归档', color: '#64748b', bg: '#f1f5f9' },
  ready_to_publish: { label: '待发行', color: '#0694a2', bg: '#e0f7fa' },
  published: { label: '已发行', color: '#16a34a', bg: '#f0fdf4' },
}

export const ACTION_LABELS: Record<string, string> = {
  view: '查看', edit: '编辑', manage: '管理',
  operate: '操作', export: '导出', settle: '结算',
}

// ═══ Permission Tree ═══

export const PERMISSION_TREE: PermissionPortal[] = [
  {
    portal: '创作者端', icon: '🎵', key: 'student',
    children: [
      { key: 'student.home', label: '首页', actions: ['view'] },
      { key: 'student.upload', label: '作品上传', actions: ['view', 'operate'] },
      { key: 'student.songs', label: '我的作品库', actions: ['view', 'operate'] },
      { key: 'student.assignments', label: '作业提交', actions: ['view', 'operate'] },
      { key: 'student.revenue', label: '收益查询', actions: ['view'] },
      { key: 'student.learning', label: '课程学习', actions: ['view'] },
      { key: 'student.community', label: '社区发现', actions: ['view'] },
      { key: 'student.profile', label: '个人中心', actions: ['view', 'edit'] },
    ],
  },
  {
    portal: '评审端', icon: '🎧', key: 'teacher',
    children: [
      { key: 'teacher.dashboard', label: '工作台', actions: ['view'] },
      { key: 'teacher.queue', label: '待评审列表', actions: ['view'] },
      { key: 'teacher.review', label: '评审操作', actions: ['view', 'operate'] },
      { key: 'teacher.stats', label: '我的绩效', actions: ['view'] },
      { key: 'teacher.profile', label: '个人中心', actions: ['view', 'edit'] },
    ],
  },
  {
    portal: '管理端', icon: '⚙️', key: 'admin',
    children: [
      { key: 'admin.dashboard', label: '运营看板', actions: ['view'] },
      { key: 'admin.cms', label: '内容管理', actions: ['view', 'edit'] },
      { key: 'admin.groups', label: '用户组管理', actions: ['view', 'manage'] },
      { key: 'admin.assignments', label: '作业管理', actions: ['view', 'manage'] },
      { key: 'admin.students', label: '用户档案', actions: ['view', 'manage'] },
      { key: 'admin.contracts', label: '合同台账', actions: ['view', 'export'] },
      { key: 'admin.teachers', label: '评审绩效', actions: ['view'] },
      { key: 'admin.accounts', label: '账号与权限', actions: ['view', 'manage'] },
      { key: 'admin.songs', label: '歌曲库管理', actions: ['view', 'manage'] },
      { key: 'admin.batch_download', label: '作品库批量下载', actions: ['view', 'operate'] },
      { key: 'admin.isrc', label: 'ISRC管理', actions: ['view', 'manage'] },
      { key: 'admin.distributions', label: '发行渠道', actions: ['view', 'manage'] },
      { key: 'admin.publish_confirm', label: '发行状态确认', actions: ['view', 'operate'] },
      { key: 'admin.revenue', label: '收益管理', actions: ['view', 'settle'] },
      { key: 'admin.settings', label: '系统设置', actions: ['view', 'edit'] },
      { key: 'admin.logs', label: '操作日志', actions: ['view'] },
      { key: 'admin.roles', label: '角色管理', actions: ['view', 'manage'] },
      { key: 'admin.admins', label: '平台管理员', actions: ['view', 'manage'] },
    ],
  },
]

// ═══ Mock Data ═══

export const MOCK_USER_GROUPS: MockUserGroup[] = [
  { id: 1, name: '三明医学科技职业技术学院', description: '三明医学科技职业技术学院AI音乐创作班', inviteCode: 'SMYKJZY', inviteLink: 'https://aimusic.com/join/SMYKJZY', memberCount: 45, status: 'active', createdBy: 10, createdAt: '2026-01-05' },
  { id: 2, name: '社会组', description: '面向社会公众的AI音乐创作组', inviteCode: 'SOCIAL26', inviteLink: 'https://aimusic.com/join/SOCIAL26', memberCount: 28, status: 'active', createdBy: 10, createdAt: '2026-01-05' },
  { id: 3, name: '评审专家组', description: '平台签约评审专家团队', inviteCode: 'REVIEW26', inviteLink: 'https://aimusic.com/join/REVIEW26', memberCount: 5, status: 'active', createdBy: 10, createdAt: '2025-12-20' },
  { id: 4, name: '内部运营团队', description: '平台运营管理团队', inviteCode: 'OPS2026', inviteLink: 'https://aimusic.com/join/OPS2026', memberCount: 3, status: 'active', createdBy: 10, createdAt: '2025-12-01' },
  { id: 5, name: '合作机构A-试点组', description: '与合作音乐机构A的试点班级', inviteCode: 'PARTA01', inviteLink: 'https://aimusic.com/join/PARTA01', memberCount: 12, status: 'paused', createdBy: 10, createdAt: '2026-02-10' },
]

export const MOCK_STUDENTS: MockStudent[] = [
  { id: 1, name: '张小明', phone: '138****1234', email: 'zhangxm@test.com', role: 'creator', adminLevel: null, realNameStatus: 'verified', realName: '张小明', idCard: '310***********1234', verifiedPhone: '138****1234', agencyContract: true, signedAt: '2026-01-15', songCount: 8, totalRevenue: 2450.80, avatar: '🎵', groupIds: [1] },
  { id: 2, name: '李芳', phone: '139****5678', email: 'lifang@test.com', role: 'creator', adminLevel: null, realNameStatus: 'pending', realName: '李芳', idCard: '320***********5678', verifiedPhone: '139****5678', agencyContract: false, signedAt: null, songCount: 3, totalRevenue: 0, avatar: '🎶', groupIds: [1] },
  { id: 3, name: '王强', phone: '137****9012', email: 'wangq@test.com', role: 'creator', adminLevel: null, realNameStatus: 'verified', realName: '王强', idCard: '110***********9012', verifiedPhone: '137****9012', agencyContract: true, signedAt: '2026-02-20', songCount: 12, totalRevenue: 5280.50, avatar: '🎸', groupIds: [1, 2] },
  { id: 4, name: '陈雨', phone: '136****3456', email: 'chenyu@test.com', role: 'creator', adminLevel: null, realNameStatus: 'rejected', realName: '', idCard: '', verifiedPhone: '', agencyContract: false, signedAt: null, songCount: 1, totalRevenue: 0, avatar: '🎤', groupIds: [2] },
  { id: 8, name: '林班长', phone: '138****2222', email: 'linbz@ai.com', role: 'creator', adminLevel: 'group_admin', realNameStatus: 'verified', realName: '林志远', idCard: '350***********2222', verifiedPhone: '138****2222', agencyContract: true, signedAt: '2026-01-10', songCount: 15, totalRevenue: 6800.00, avatar: '⭐', groupIds: [1] },
]

export const MOCK_SONGS: MockSong[] = [
  { id: 1, userId: 1, title: '星河漫步', lyricist: '张小明', composer: 'AI协作', aiTool: 'Suno', genre: '电子', bpm: 120, status: 'published', score: 92, copyrightCode: 'AIMU-2026-000001', isrc: 'CNF121200001', likeCount: 234, createdAt: '2026-01-20', cover: '🌌', source: 'upload' },
  { id: 2, userId: 1, title: '城市灯火', lyricist: '张小明', composer: 'AI协作', aiTool: 'Suno', genre: 'Hip-Hop', bpm: 85, status: 'ready_to_publish', score: 88, copyrightCode: 'AIMU-2026-000002', isrc: null, likeCount: 0, createdAt: '2026-02-10', cover: '🏙️', source: 'upload' },
  { id: 3, userId: 3, title: '春风十里', lyricist: '王强', composer: 'AI协作', aiTool: 'Udio', genre: '民谣', bpm: 95, status: 'published', score: 85, copyrightCode: 'AIMU-2026-000003', isrc: 'CNF121200003', likeCount: 189, createdAt: '2026-02-15', cover: '🌸', source: 'upload' },
  { id: 4, userId: 2, title: '雨后彩虹', lyricist: '李芳', composer: '李芳', aiTool: 'Suno', genre: 'Pop', bpm: 128, status: 'pending_review', score: null, copyrightCode: 'AIMU-2026-000004', isrc: null, likeCount: 0, createdAt: '2026-03-20', cover: '🌈', source: 'assignment', assignmentId: 1 },
  { id: 5, userId: 1, title: '深海之歌', lyricist: '张小明', composer: '张小明', aiTool: 'Suno', genre: '古典', bpm: 72, status: 'needs_revision', score: 65, copyrightCode: 'AIMU-2026-000005', isrc: null, likeCount: 0, createdAt: '2026-03-15', cover: '🌊', source: 'assignment', assignmentId: 2, reviewComment: '混音需要大幅优化' },
  { id: 6, userId: 3, title: '数字黄昏', lyricist: '王强', composer: '王强', aiTool: '汽水创作实验室', genre: '电子', bpm: 110, status: 'pending_review', score: null, copyrightCode: 'AIMU-2026-000006', isrc: null, likeCount: 0, createdAt: '2026-03-22', cover: '🌅', source: 'assignment', assignmentId: 2 },
  { id: 7, userId: 1, title: '梦境边缘', lyricist: '张小明', composer: 'AI协作', aiTool: 'Suno', genre: 'Rock', bpm: 100, status: 'reviewed', score: 78, copyrightCode: 'AIMU-2026-000007', isrc: null, likeCount: 0, createdAt: '2026-03-10', cover: '💫', source: 'upload' },
  { id: 8, userId: 4, title: '初次尝试', lyricist: '陈雨', composer: '陈雨', aiTool: 'Suno', genre: 'Pop', bpm: 100, status: 'pending_review', score: null, copyrightCode: 'AIMU-2026-000008', isrc: null, likeCount: 0, createdAt: '2026-03-25', cover: '🎵', source: 'assignment', assignmentId: 3 },
  { id: 9, userId: 8, title: '晨光序曲', lyricist: '林志远', composer: '林志远', aiTool: 'Suno', genre: 'Pop', bpm: 118, status: 'pending_review', score: null, copyrightCode: 'AIMU-2026-000009', isrc: null, likeCount: 0, createdAt: '2026-04-05', cover: '🌅', source: 'assignment', assignmentId: 1 },
  { id: 10, userId: 1, title: '父爱的魔法', lyricist: '张小明', composer: '张小明', aiTool: '汽水创作实验室', genre: 'Pop', bpm: 92, status: 'published', score: 86, copyrightCode: 'AIMU-2026-000010', isrc: 'CNF121200010', likeCount: 45, createdAt: '2026-01-25', cover: '👨‍👦', source: 'assignment', assignmentId: 1 },
  { id: 11, userId: 3, title: '虚假客户', lyricist: '王强', composer: '王强', aiTool: 'Suno', genre: 'Hip-Hop', bpm: 95, status: 'published', score: 81, copyrightCode: 'AIMU-2026-000011', isrc: 'CNF121200011', likeCount: 28, createdAt: '2026-01-28', cover: '🤵', source: 'assignment', assignmentId: 1 },
  { id: 12, userId: 1, title: '沉重肩膀', lyricist: '张小明', composer: '张小明', aiTool: '汽水创作实验室', genre: '民谣', bpm: 78, status: 'published', score: 83, copyrightCode: 'AIMU-2026-000012', isrc: 'CNF121200012', likeCount: 32, createdAt: '2026-02-05', cover: '💪', source: 'assignment', assignmentId: 1 },
  { id: 13, userId: 8, title: '霓虹下的隐形人', lyricist: '林志远', composer: '林志远', aiTool: 'Suno', genre: '电子', bpm: 115, status: 'published', score: 88, copyrightCode: 'AIMU-2026-000013', isrc: 'CNF121200013', likeCount: 67, createdAt: '2026-02-08', cover: '🌃', source: 'assignment', assignmentId: 1 },
  { id: 14, userId: 3, title: '地下的河流', lyricist: '王强', composer: '王强', aiTool: '汽水创作实验室', genre: 'Rock', bpm: 105, status: 'published', score: 84, copyrightCode: 'AIMU-2026-000014', isrc: 'CNF121200014', likeCount: 41, createdAt: '2026-02-12', cover: '🌊', source: 'assignment', assignmentId: 1 },
]

export const MOCK_ROLES: MockRole[] = [
  { id: 1, name: '超级管理员', description: '拥有所有权限，无法删除', permissions: {}, createdAt: '2025-10-22 15:20', isSuper: true },
  { id: 2, name: '运营专员', description: '负责日常运营工作，可管理内容与用户', permissions: {}, createdAt: '2025-11-01 09:00' },
  { id: 3, name: '评审主管', description: '管理评审账号与绩效统计', permissions: {}, createdAt: '2025-11-15 14:30' },
  { id: 4, name: '财务专员', description: '负责收益管理与结算操作', permissions: {}, createdAt: '2025-12-01 10:00' },
]

export const MOCK_PLATFORM_ADMINS: MockPlatformAdmin[] = [
  { id: 1, account: 'admin', name: '超级管理员', roleId: 1, roleName: '超级管理员', avatar: '👑', status: true, multiLogin: true, createdAt: '2025-10-22 15:20', lastLogin: '2026-04-15 10:47', lastIp: '27.154.192.50' },
  { id: 2, account: 'ops_zhang', name: '张运营', roleId: 2, roleName: '运营专员', avatar: '👤', status: true, multiLogin: false, createdAt: '2025-11-01 09:00', lastLogin: '2026-04-14 16:22', lastIp: '116.25.38.91' },
  { id: 3, account: 'review_li', name: '李主管', roleId: 3, roleName: '评审主管', avatar: '👤', status: true, multiLogin: false, createdAt: '2025-11-15 14:30', lastLogin: '2026-04-15 09:10', lastIp: '101.68.77.44' },
  { id: 4, account: 'finance_wang', name: '王财务', roleId: 4, roleName: '财务专员', avatar: '👤', status: false, multiLogin: false, createdAt: '2025-12-01 10:00', lastLogin: '2026-03-20 11:30', lastIp: '59.37.140.22' },
]

// ═══ Dashboard Data ═══

export const DASHBOARD_STATS = [
  { icon: '👥', label: '注册学生', val: 156, sub: '本月 ▲ 23', subc: '#16a34a', c: '#6366f1', ibg: '#eef2ff', pg: '/admin/students' },
  { icon: '🎵', label: '总作品数', val: 428, sub: '本月 ▲ 52', subc: '#16a34a', c: '#ec4899', ibg: '#fdf2f8', pg: '/admin/songs' },
  { icon: '📋', label: '待审核', val: 4, sub: '平均待 2.3天', subc: '#d97706', c: '#0694a2', ibg: '#e0f7fa', pg: '/admin/songs' },
  { icon: '🚀', label: '已发行', val: 6, sub: '入库率 68%', subc: '#64748b', c: '#3b82f6', ibg: '#eff6ff', pg: '/admin/songs' },
  { icon: '💰', label: '总收益', val: '¥52,600', sub: '环比 ▲18%', subc: '#16a34a', c: '#f59e0b', ibg: '#fffbeb', pg: '/admin/revenue' },
  { icon: '🏘️', label: '用户组', val: 5, sub: '4个活跃', subc: '#64748b', c: '#7c3aed', ibg: '#f5f3ff', pg: '/admin/groups' },
]

export const DASHBOARD_TREND_MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
export const DASHBOARD_TREND_VALUES = [2800, 3600, 2200, 3100, 3400, 3800, 14155, 2900, 3200, 3600, 4100, 4800]

export const DASHBOARD_RATES = [
  { n: 1, label: '注册和首次上传率', v: 72, c: '#6366f1' },
  { n: 2, label: '评审通过率', v: 68, c: '#4f46e5' },
  { n: 3, label: '代理协议签署率', v: 45, c: '#7c3aed' },
  { n: 4, label: '实名认证完成率', v: 61, c: '#6366f1' },
]
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/lib/mock/admin.ts 2>&1 | head -5`
Expected: No errors (or only unrelated existing errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/mock/admin.ts
git commit -m "添加管理端 Mock 数据和类型定义"
```

---

### Task 2: Shared Components — PageHeader, StatCard, StatusBadge

**Files:**
- Create: `src/components/admin/page-header.tsx`
- Create: `src/components/admin/stat-card.tsx`
- Create: `src/components/admin/status-badge.tsx`

- [ ] **Step 1: Create PageHeader**

```tsx
// src/components/admin/page-header.tsx
import { type ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-lg font-bold text-[var(--text)]">
          {title}
          {subtitle && (
            <span className="ml-2 text-xs font-normal text-[var(--text3)]">{subtitle}</span>
          )}
        </h1>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Create StatCard**

```tsx
// src/components/admin/stat-card.tsx
'use client'

import { type ReactNode } from 'react'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string | number
  sub?: string
  subColor?: string
  color: string
  iconBg?: string
  onClick?: () => void
}

export function StatCard({ icon, label, value, sub, subColor, color, iconBg, onClick }: StatCardProps) {
  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_4px_rgba(99,102,241,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(99,102,241,0.1)]"
      onClick={onClick}
      style={{ borderColor: undefined }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color + '55'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = ''
      }}
    >
      <div
        className="absolute left-0 right-0 top-0 h-[3px] rounded-t-xl"
        style={{ background: color }}
      />
      <div
        className="mb-2.5 flex h-[42px] w-[42px] items-center justify-center rounded-[11px] text-[21px]"
        style={{ background: iconBg || '#eef2ff' }}
      >
        {icon}
      </div>
      <div className="mb-[3px] text-[11px] text-[#94a3b8]">{label}</div>
      <div className="mb-[5px] text-2xl font-bold leading-none text-[var(--text)]">{value}</div>
      {sub && (
        <div className="text-[11px] font-medium" style={{ color: subColor || '#64748b' }}>
          {sub}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create StatusBadge**

```tsx
// src/components/admin/status-badge.tsx

interface StatusBadgeProps {
  label: string
  color: string
  bg?: string
}

export function StatusBadge({ label, color, bg }: StatusBadgeProps) {
  return (
    <span
      className="inline-block rounded-[20px] px-2.5 py-[3px] text-xs font-medium"
      style={{ color, background: bg || undefined }}
    >
      {label}
    </span>
  )
}

// Preset helpers
export function RealNameBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    verified: { label: '已认证', color: 'var(--green2)' },
    pending: { label: '待审核', color: 'var(--orange)' },
    unverified: { label: '未认证', color: 'var(--text3)' },
    rejected: { label: '已驳回', color: 'var(--red)' },
  }
  const s = map[status]
  return s ? <span className="text-xs" style={{ color: s.color }}>{s.label}</span> : null
}
```

- [ ] **Step 4: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds (components are not yet imported by any page, so no errors)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/page-header.tsx src/components/admin/stat-card.tsx src/components/admin/status-badge.tsx
git commit -m "添加管理端共享组件：PageHeader、StatCard、StatusBadge"
```

---

### Task 3: Shared Components — DataTable, Modal, Tab, SearchBar

**Files:**
- Create: `src/components/admin/data-table.tsx`
- Create: `src/components/admin/admin-modal.tsx`
- Create: `src/components/admin/admin-tab.tsx`
- Create: `src/components/admin/search-bar.tsx`

- [ ] **Step 1: Create DataTable**

Reusable table with column definitions and optional row click. Matches the HTML prototype's `Table` component styling. Includes optional pagination.

```tsx
// src/components/admin/data-table.tsx
'use client'

import { type ReactNode } from 'react'

export interface Column<T> {
  key: keyof T | string
  title: string
  render?: (value: unknown, row: T) => ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                className="whitespace-nowrap border-b border-[var(--border)] px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--text2)]"
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, ri) => (
            <tr
              key={ri}
              onClick={() => onRowClick?.(row)}
              className="border-b border-[var(--border)] transition-colors hover:bg-[#f8faff]"
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {columns.map((c, ci) => (
                <td key={ci} className="px-3 py-3 text-[var(--text)]">
                  {c.render
                    ? c.render(row[c.key as keyof T], row)
                    : String(row[c.key as keyof T] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="py-16 text-center text-[var(--text3)]">
          <div className="mb-3 text-5xl">📭</div>
          <div>暂无数据</div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create Modal**

```tsx
// src/components/admin/admin-modal.tsx
'use client'

import { type ReactNode } from 'react'

interface ModalProps {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
  width?: number
}

export function AdminModal({ title, open, onClose, children, width = 520 }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1000]">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[4px]"
        onClick={onClose}
      />
      <div className="fixed inset-0 overflow-y-auto" onClick={onClose}>
        <div className="flex min-h-full items-center justify-center p-12">
          <div
            className="relative animate-[modalIn_0.3s_ease_both] rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(99,102,241,0.12)]"
            style={{ width, maxWidth: '90vw', flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{title}</h3>
              <button
                onClick={onClose}
                className="rounded p-1 text-xl text-[var(--text3)] hover:text-[var(--red)]"
              >
                ✕
              </button>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create Tab**

```tsx
// src/components/admin/admin-tab.tsx
'use client'

interface TabItem {
  key: string
  label: string
  count?: number
}

interface TabProps {
  tabs: TabItem[]
  active: string
  onChange: (key: string) => void
}

export function AdminTab({ tabs, active, onChange }: TabProps) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 rounded-[10px] bg-[#f0f4fb] p-[3px]">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className="whitespace-nowrap rounded-lg border-none px-4 py-2 text-[13px] font-medium transition-all"
          style={{
            background: active === t.key ? 'var(--accent)' : 'transparent',
            color: active === t.key ? '#fff' : 'var(--text2)',
            cursor: 'pointer',
          }}
        >
          {t.label}
          {t.count != null && (
            <span className="ml-1.5 text-[11px] opacity-70">({t.count})</span>
          )}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create SearchBar**

```tsx
// src/components/admin/search-bar.tsx
'use client'

interface SearchBarProps {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
}

export function SearchBar({ placeholder = '搜索...', value, onChange }: SearchBarProps) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-[var(--text3)]">
        🔍
      </span>
      <input
        className="w-full rounded-lg border-[1.5px] border-[#e8edf5] bg-white px-3 py-2.5 pl-[38px] text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  )
}
```

- [ ] **Step 5: Add modalIn keyframe to globals.css**

Add after the existing `@layer base` block:

```css
@keyframes modalIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/data-table.tsx src/components/admin/admin-modal.tsx src/components/admin/admin-tab.tsx src/components/admin/search-bar.tsx src/app/globals.css
git commit -m "添加管理端共享组件：DataTable、Modal、Tab、SearchBar"
```

---

### Task 4: Dashboard Page

**Files:**
- Modify: `src/app/(admin)/admin/dashboard/page.tsx` (rewrite existing stub)

- [ ] **Step 1: Implement the full Dashboard page**

Rewrite the existing stub. This is the most complex visual page — includes a purple banner, 6 stat cards, SVG line chart with hover tooltips, and conversion rate progress bars. All data from mock imports. The page is a client component because of `useState` for chart hover state and router for card clicks.

Reference: HTML prototype `AdminDashboard` function (lines 521-676 of `docs/管理端.html`) and `运营看板.png`.

Key implementation details:
- Purple gradient banner with decorative circles and emoji overlays
- 6-column grid of StatCard components, each clickable (router.push to target page)
- SVG line chart: compute points from DASHBOARD_TREND_VALUES, draw area path + line path + interactive dots with hover tooltip
- Conversion rates: numbered progress bars with gradient fills

- [ ] **Step 2: Start dev server and verify visually**

Run: `npx next dev`
Open: `http://localhost:3000/login?portal=admin` → login with admin/Abc12345 → should redirect to `/admin/dashboard`
Verify: Purple banner, 6 stat cards, line chart, progress bars all render correctly

- [ ] **Step 3: Commit**

```bash
git add src/app/(admin)/admin/dashboard/page.tsx
git commit -m "实现管理端运营看板页面，含统计卡片、收益趋势图、关键转化率"
```

---

### Task 5: User Groups Page

**Files:**
- Create: `src/app/(admin)/admin/groups/page.tsx`

- [ ] **Step 1: Implement User Groups page with list + detail views**

This page has two views controlled by `useState`:
1. **List view**: 3 stat cards (total/active/paused groups) + data table + create modal + invite code modal
2. **Detail view**: group info card + invite section + member table

Reference: HTML prototype `AdminUserGroups` function (lines 2077-2197) and other list page PNGs for table style.

Key implementation details:
- List view table columns: name (bold + description subtitle), inviteCode (monospace purple badge), memberCount, status (✅/⏸️), createdAt, actions (invite code button, detail → button)
- Row click enters detail view
- Create modal: name (required), description (textarea), custom invite code (optional)
- Invite code modal: large code display (32px monospace), registration link + copy, regenerate/disable buttons
- Detail view: 2-column grid (group info card + invite section), member table with role management actions
- Member table uses MOCK_STUDENTS filtered by groupIds

- [ ] **Step 2: Verify visually**

Navigate to `/admin/groups` via sidebar.
Verify: stat cards, table with 5 groups, click a row opens detail, create button opens modal, invite code modal works.

- [ ] **Step 3: Commit**

```bash
git add src/app/(admin)/admin/groups/page.tsx
git commit -m "实现用户组管理页面，含列表、详情、创建、邀请码功能"
```

---

### Task 6: Student Profiles Page

**Files:**
- Create: `src/app/(admin)/admin/students/page.tsx`

- [ ] **Step 1: Implement Student Profiles page with list + detail views**

Two views controlled by `useState`:
1. **List view**: search bar (input + select dropdown) + data table
2. **Detail view**: 2-column grid — left (basic info + real name auth section + disable button), right (song list)

Reference: HTML prototype `AdminStudents` function (lines 678-746) and `学生档案.png`.

Key implementation details:
- Search bar: text input + real name status select (全部/已认证/待审核/未认证/已驳回)
- Table columns: avatar emoji, name (bold), role attribute (creator/reviewer + group_admin tag), phone, realNameStatus (colored text), user groups (from groupIds → MOCK_USER_GROUPS name lookup), agencyContract (已签署 green / 未签署 gray), songCount, totalRevenue (¥ format)
- Detail view left card: key-value rows on #f0f4fb background. Real name auth section differs by status:
  - `pending`: yellow alert + approve/reject buttons
  - `verified`: green badge + real name, ID card, verified phone
  - `rejected`: red alert + send reminder button
  - `unverified`: gray alert + send reminder button
- Detail view right card: user's songs from MOCK_SONGS filtered by userId, each row shows cover emoji + title + StatusBadge
- All button clicks show toast (mock action) — implement toast as simple state with setTimeout

- [ ] **Step 2: Verify visually against 学生档案.png**

Navigate to `/admin/students`. Compare table layout with PNG screenshot. Click a student to verify detail view.

- [ ] **Step 3: Commit**

```bash
git add src/app/(admin)/admin/students/page.tsx
git commit -m "实现用户档案页面，含列表搜索、详情查看、实名认证审核"
```

---

### Task 7: Platform Admins Page

**Files:**
- Create: `src/app/(admin)/admin/admins/page.tsx`

- [ ] **Step 1: Implement Platform Admins page with list + form views**

Two views: `'list' | 'add' | 'edit'` controlled by `useState`.

Reference: HTML prototype `AdminPlatformAdmins` function (lines 2434-2577) and `账号管理.png`.

Key implementation details:
- **List view**: search bar (account input + name input + query/reset/export buttons) in a card container, then data table
- Table columns: avatar emoji, account (monospace bold), name, roleName (purple badge), createdAt, lastLogin, lastIp (monospace), status (toggle switch), edit button
- Toggle switch: 44x24px rounded div with sliding 18x18 circle, click toggles admin status
- **Add/Edit form** (full page, not modal): PageHeader with "← 返回" button, max-width 500px form
  - Fields: account (disabled on edit), name, role select (from MOCK_ROLES), password + confirm password (add only), status toggle, multiLogin toggle, avatar upload placeholder
  - Validation: required fields check on save

- [ ] **Step 2: Verify visually against 账号管理.png**

Navigate to `/admin/admins`. Compare table with PNG. Click "添加管理员" to verify form.

- [ ] **Step 3: Commit**

```bash
git add src/app/(admin)/admin/admins/page.tsx
git commit -m "实现平台管理员页面，含列表搜索、添加/编辑管理员、状态开关"
```

---

### Task 8: Permission Tree Component

**Files:**
- Create: `src/components/admin/permission-tree.tsx`

- [ ] **Step 1: Implement PermissionTree component**

Three-level checkbox tree used by Role Management. This is a standalone component because it's complex enough to warrant isolation.

Reference: HTML prototype `PermissionTree` function (lines 2269-2337).

```tsx
// src/components/admin/permission-tree.tsx
'use client'

import { useRef, useEffect } from 'react'
import { PERMISSION_TREE, ACTION_LABELS } from '@/lib/mock/admin'

interface PermissionTreeProps {
  value: Record<string, boolean>
  onChange: (value: Record<string, boolean>) => void
}

export function PermissionTree({ value, onChange }: PermissionTreeProps) {
  const val = value || {}

  const isPortalChecked = (portal: typeof PERMISSION_TREE[0]) =>
    portal.children.every((m) => m.actions.every((a) => val[`${m.key}.${a}`]))
  const isPortalIndet = (portal: typeof PERMISSION_TREE[0]) =>
    !isPortalChecked(portal) && portal.children.some((m) => m.actions.some((a) => val[`${m.key}.${a}`]))
  const isMenuChecked = (menu: typeof PERMISSION_TREE[0]['children'][0]) =>
    menu.actions.every((a) => val[`${menu.key}.${a}`])
  const isMenuIndet = (menu: typeof PERMISSION_TREE[0]['children'][0]) =>
    !isMenuChecked(menu) && menu.actions.some((a) => val[`${menu.key}.${a}`])

  const togglePortal = (portal: typeof PERMISSION_TREE[0]) => {
    const all = isPortalChecked(portal)
    const next = { ...val }
    portal.children.forEach((m) => m.actions.forEach((a) => { next[`${m.key}.${a}`] = !all }))
    onChange(next)
  }
  const toggleMenu = (menu: typeof PERMISSION_TREE[0]['children'][0]) => {
    const all = isMenuChecked(menu)
    const next = { ...val }
    menu.actions.forEach((a) => { next[`${menu.key}.${a}`] = !all })
    onChange(next)
  }
  const toggleAction = (menuKey: string, action: string) => {
    onChange({ ...val, [`${menuKey}.${action}`]: !val[`${menuKey}.${action}`] })
  }
  const selectAll = () => {
    const next: Record<string, boolean> = {}
    PERMISSION_TREE.forEach((p) =>
      p.children.forEach((m) => m.actions.forEach((a) => { next[`${m.key}.${a}`] = true }))
    )
    onChange(next)
  }
  const clearAll = () => onChange({})

  return (
    <div>
      <div className="mb-3 flex gap-3">
        <span className="cursor-pointer text-[13px] text-[var(--accent2)]" onClick={selectAll}>全选</span>
        <span className="cursor-pointer text-[13px] text-[var(--accent2)]" onClick={clearAll}>不全选</span>
      </div>
      {PERMISSION_TREE.map((portal) => (
        <div key={portal.key} className="mb-4">
          <div className="mb-2 flex items-center gap-2 border-b border-[var(--border)] pb-1.5">
            <IndeterminateCheckbox
              checked={isPortalChecked(portal)}
              indeterminate={isPortalIndet(portal)}
              onChange={() => togglePortal(portal)}
            />
            <span className="text-sm font-semibold">{portal.icon} {portal.portal}</span>
          </div>
          <div className="pl-5">
            {portal.children.map((menu) => (
              <div key={menu.key} className="mb-2">
                <div className="mb-1 flex items-center gap-2">
                  <IndeterminateCheckbox
                    checked={isMenuChecked(menu)}
                    indeterminate={isMenuIndet(menu)}
                    onChange={() => toggleMenu(menu)}
                  />
                  <span className="text-[13px] font-medium">{menu.label}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pl-[22px]">
                  {menu.actions.map((action) => (
                    <label key={action} className="flex cursor-pointer items-center gap-1 text-xs text-[var(--text3)]">
                      <input
                        type="checkbox"
                        checked={!!val[`${menu.key}.${action}`]}
                        onChange={() => toggleAction(menu.key, action)}
                        className="h-[13px] w-[13px] accent-[var(--accent2)]"
                      />
                      {ACTION_LABELS[action] || action}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-[15px] w-[15px] cursor-pointer accent-[var(--accent2)]"
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/permission-tree.tsx
git commit -m "实现权限树组件，支持三端菜单权限的层级勾选"
```

---

### Task 9: Role Management Page

**Files:**
- Create: `src/app/(admin)/admin/roles/page.tsx`

- [ ] **Step 1: Implement Role Management page with list + form views**

Two views: `'list' | 'edit'` controlled by `useState`.

Reference: HTML prototype `AdminRoles` function (lines 2339-2432).

Key implementation details:
- **List view**: data table with columns: ID, name (bold + "内置" orange tag for isSuper), permissions count (purple), description, createdAt, actions (edit for all, delete for non-isSuper with confirm)
- **Edit view** (full page): PageHeader with "← 返回", max-width 680px form
  - Name input (maxLength 8, show char count `x/8` on right)
  - Description textarea
  - PermissionTree component in a bordered container
  - Save + Cancel buttons
- Role state managed locally with `useState` initialized from MOCK_ROLES
- Add: pushes new role with Date.now() id
- Edit: updates existing role in state
- Delete: removes from state (after confirm), blocks isSuper roles

- [ ] **Step 2: Verify visually**

Navigate to `/admin/roles`. Verify table, click "编辑" on a role to see permission tree, create new role.

- [ ] **Step 3: Commit**

```bash
git add src/app/(admin)/admin/roles/page.tsx
git commit -m "实现角色管理页面，含角色列表、添加/编辑角色、权限树配置"
```

---

### Task 10: Final Integration & Visual Review

**Files:**
- Possibly modify: any component files if visual review reveals discrepancies

- [ ] **Step 1: Run dev server and test all 5 pages end-to-end**

Run: `npx next dev`

Test checklist:
1. `/admin/dashboard` — banner, 6 cards, chart hover, progress bars, card click navigation
2. `/admin/groups` — stat cards, table, row click detail, create modal, invite code modal, detail view member table
3. `/admin/students` — search/filter, table, row click detail, real name auth sections (test all 4 statuses), song list
4. `/admin/admins` — search, table, toggle switch, add form, edit form
5. `/admin/roles` — table, add role, edit with permission tree, delete non-builtin role

- [ ] **Step 2: Compare each page visually against PNG screenshots**

Open side-by-side:
- `/admin/dashboard` vs `docs/AI音乐平台/运营看板.png`
- `/admin/students` vs `docs/AI音乐平台/学生档案.png`
- `/admin/admins` vs `docs/AI音乐平台/账号管理.png`

Fix any visual discrepancies (spacing, colors, font sizes).

- [ ] **Step 3: Compare each page functionally against HTML prototype**

Open `docs/管理端.html` in browser. Navigate to each page in the prototype and verify:
- Same data displayed
- Same interactions work (modals, form validations, view switching)
- Same status colors and badge styles

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "管理端第一批页面视觉和功能对齐修复"
```

- [ ] **Step 5: Build check**

Run: `npx next build`
Expected: Build succeeds with no errors.
