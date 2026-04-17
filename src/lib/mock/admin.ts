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
  { icon: 'users', label: '注册学生', val: 156, sub: '▲ 4.12', subc: '#16a34a', grad: 'linear-gradient(135deg, #6366f1, #818cf8)', pg: '/admin/students' },
  { icon: 'music', label: '作品总数', val: 428, sub: '▲ 4.12', subc: '#16a34a', grad: 'linear-gradient(135deg, #ec4899, #f472b6)', pg: '/admin/songs' },
  { icon: 'clipboard', label: '评审中', val: 3, sub: '▲ 4.12', subc: '#16a34a', grad: 'linear-gradient(135deg, #0694a2, #22d3ee)', pg: '/admin/songs' },
  { icon: 'rocket', label: '已发行', val: 89, sub: '▲ 4.12', subc: '#16a34a', grad: 'linear-gradient(135deg, #3b82f6, #60a5fa)', pg: '/admin/songs' },
  { icon: 'yen', label: '总收益', val: '¥52,600', sub: '▲ 4.12', subc: '#16a34a', grad: 'linear-gradient(135deg, #f59e0b, #fbbf24)', pg: '/admin/revenue' },
]

export const DASHBOARD_TREND_MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
export const DASHBOARD_TREND_VALUES = [2800, 3600, 2200, 3100, 3400, 3800, 14155, 2900, 3200, 3600, 4100, 4800]

export const DASHBOARD_RATES = [
  { n: 1, label: '代理签约认证率', v: 72, c: '#6366f1' },
  { n: 2, label: '签约企业认证率', v: 68, c: '#7c3aed' },
  { n: 3, label: '内容创作活跃率', v: 45, c: '#818cf8' },
  { n: 4, label: '实名认证完成率', v: 61, c: '#6366f1' },
]

// ═══ CMS Content Data ═══

export interface MockCmsItem {
  id: number
  title: string
  cover: string
  category: string
  type: 'video' | 'article'
  views: number
  status: 'published' | 'draft'
}

export const MOCK_CMS_ITEMS: MockCmsItem[] = [
  { id: 1, title: 'Suno AI音乐制作入门', cover: '🎹', category: 'AI工具教程', type: 'video', views: 4746, status: 'published' },
  { id: 2, title: 'Udio创作全流程解析', cover: '🎧', category: 'AI工具教程', type: 'video', views: 3892, status: 'published' },
  { id: 3, title: 'AI和弦进阶技巧', cover: '🎼', category: 'AI工具教程', type: 'video', views: 3102, status: 'draft' },
  { id: 4, title: '流行音乐混音入门', cover: '📖', category: '基础乐理', type: 'article', views: 2840, status: 'published' },
  { id: 5, title: '汽水音乐实验室操作指南', cover: '🥤', category: 'AI工具教程', type: 'video', views: 4120, status: 'published' },
  { id: 6, title: '什么是音乐版权？', cover: '📜', category: '版权知识', type: 'article', views: 1923, status: 'published' },
  { id: 7, title: 'AI编曲的节奏设计', cover: '🥁', category: 'AI工具教程', type: 'video', views: 2654, status: 'published' },
  { id: 8, title: '基础乐理：音阶与调式', cover: '🎵', category: '基础乐理', type: 'article', views: 3450, status: 'published' },
  { id: 9, title: 'Suno提示词高级技巧', cover: '💡', category: 'AI工具教程', type: 'video', views: 5120, status: 'published' },
  { id: 10, title: 'ISRC编码与版权登记', cover: '🔖', category: '版权知识', type: 'article', views: 1580, status: 'draft' },
  { id: 11, title: 'AI人声合成技术概览', cover: '🎤', category: 'AI工具教程', type: 'video', views: 2980, status: 'published' },
  { id: 12, title: '音乐发行渠道全解析', cover: '🚀', category: '版权知识', type: 'article', views: 2105, status: 'draft' },
]

// ═══ Assignment Data ═══

export interface MockAssignment {
  id: number
  title: string
  groupId: number
  description: string
  deadline: string
  status: 'active' | 'closed'
  createdAt: string
}

export interface MockAssignmentSubmission {
  id: number
  assignmentId: number
  userId: number
  songId: number
  songTitle: string
  aiTool: string
  submittedAt: string
  status: 'reviewed' | 'pending_review' | 'needs_revision'
  score: number | null
}

export interface MockAssignmentField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'multiselect'
  required: boolean
  defaultValue: string
  options?: string[]
}

export const MOCK_ASSIGNMENTS: MockAssignment[] = [
  { id: 1, title: '第一次AI音乐创作实践', groupId: 1, description: '使用AI工具创作一首完整歌曲', deadline: '2026-04-30', status: 'active', createdAt: '2026-03-01' },
  { id: 2, title: '电子音乐风格探索', groupId: 1, description: '探索电子音乐的不同子流派', deadline: '2026-03-15', status: 'closed', createdAt: '2026-02-15' },
  { id: 3, title: '流行歌曲创作入门', groupId: 2, description: '创作一首流行风格的歌曲', deadline: '2026-05-15', status: 'active', createdAt: '2026-03-20' },
]

export const MOCK_ASSIGNMENT_SUBMISSIONS: MockAssignmentSubmission[] = [
  { id: 1, assignmentId: 1, userId: 1, songId: 10, songTitle: '父爱的魔法', aiTool: '汽水创作实验室', submittedAt: '2026-03-10', status: 'reviewed', score: 86 },
  { id: 2, assignmentId: 1, userId: 8, songId: 9, songTitle: '晨光序曲', aiTool: 'Suno', submittedAt: '2026-04-05', status: 'pending_review', score: null },
  { id: 3, assignmentId: 1, userId: 3, songId: 11, songTitle: '虚假客户', aiTool: 'Suno', submittedAt: '2026-03-12', status: 'reviewed', score: 81 },
  { id: 4, assignmentId: 2, userId: 1, songId: 5, songTitle: '深海之歌', aiTool: 'Suno', submittedAt: '2026-03-14', status: 'needs_revision', score: 65 },
  { id: 5, assignmentId: 2, userId: 3, songId: 6, songTitle: '数字黄昏', aiTool: '汽水创作实验室', submittedAt: '2026-03-13', status: 'pending_review', score: null },
  { id: 6, assignmentId: 3, userId: 4, songId: 8, songTitle: '初次尝试', aiTool: 'Suno', submittedAt: '2026-03-25', status: 'pending_review', score: null },
]

export const MOCK_ASSIGNMENT_FIELDS: MockAssignmentField[] = [
  { key: 'aiTool', label: '创作工具', type: 'multiselect', required: true, defaultValue: '', options: ['汽水创作实验室', 'Suno', 'Udio', 'TME Studio'] },
  { key: 'songTitle', label: '歌曲标题', type: 'text', required: true, defaultValue: '' },
  { key: 'performer', label: '表演者', type: 'text', required: true, defaultValue: '{realName}' },
  { key: 'lyricist', label: '词作者', type: 'text', required: true, defaultValue: '{realName}' },
  { key: 'composer', label: '曲作者', type: 'text', required: true, defaultValue: '{realName}' },
  { key: 'lyrics', label: '歌词', type: 'textarea', required: true, defaultValue: '' },
  { key: 'styleDesc', label: '风格描述', type: 'text', required: false, defaultValue: '' },
  { key: 'albumName', label: '专辑名称', type: 'text', required: false, defaultValue: '{songTitle}' },
  { key: 'albumArtist', label: '专辑歌手', type: 'text', required: false, defaultValue: '{realName}' },
]

// ═══ Teacher Performance Data ═══

export interface MockTeacher {
  id: number
  name: string
  adminLevel: 'group_admin' | null
  reviewCount: number
  avgTimeSeconds: number
  avgScore: number
  recommendRate: number
}

export const MOCK_TEACHERS: MockTeacher[] = [
  { id: 1, name: '刘老师', adminLevel: null, reviewCount: 45, avgTimeSeconds: 480, avgScore: 81.5, recommendRate: 42 },
  { id: 2, name: '陈评审', adminLevel: null, reviewCount: 32, avgTimeSeconds: 420, avgScore: 78.2, recommendRate: 38 },
  { id: 3, name: '林班长', adminLevel: 'group_admin', reviewCount: 28, avgTimeSeconds: 360, avgScore: 85.0, recommendRate: 50 },
]

// ═══ Distribution Data ═══

export interface MockDistribution {
  songId: number
  platform: string
  status: 'live' | 'submitted' | 'pending' | 'none'
}

export const MOCK_DISTRIBUTIONS: MockDistribution[] = [
  // 星河漫步 (id:1) - published
  { songId: 1, platform: 'QQ音乐', status: 'live' },
  { songId: 1, platform: '网易云音乐', status: 'live' },
  { songId: 1, platform: 'Spotify', status: 'submitted' },
  { songId: 1, platform: 'Apple Music', status: 'pending' },
  { songId: 1, platform: '酷狗音乐', status: 'none' },
  // 春风十里 (id:3) - published
  { songId: 3, platform: 'QQ音乐', status: 'live' },
  { songId: 3, platform: '网易云音乐', status: 'submitted' },
  { songId: 3, platform: 'Spotify', status: 'pending' },
  { songId: 3, platform: 'Apple Music', status: 'none' },
  { songId: 3, platform: '酷狗音乐', status: 'none' },
  // 父爱的魔法 (id:10) - published
  { songId: 10, platform: 'QQ音乐', status: 'live' },
  { songId: 10, platform: '网易云音乐', status: 'live' },
  { songId: 10, platform: 'Spotify', status: 'live' },
  { songId: 10, platform: 'Apple Music', status: 'submitted' },
  { songId: 10, platform: '酷狗音乐', status: 'pending' },
  // 虚假客户 (id:11) - published
  { songId: 11, platform: 'QQ音乐', status: 'submitted' },
  { songId: 11, platform: '网易云音乐', status: 'pending' },
  { songId: 11, platform: 'Spotify', status: 'none' },
  { songId: 11, platform: 'Apple Music', status: 'none' },
  { songId: 11, platform: '酷狗音乐', status: 'none' },
  // 沉重肩膀 (id:12) - published
  { songId: 12, platform: 'QQ音乐', status: 'live' },
  { songId: 12, platform: '网易云音乐', status: 'submitted' },
  { songId: 12, platform: 'Spotify', status: 'submitted' },
  { songId: 12, platform: 'Apple Music', status: 'pending' },
  { songId: 12, platform: '酷狗音乐', status: 'none' },
  // 霓虹下的隐形人 (id:13) - published
  { songId: 13, platform: 'QQ音乐', status: 'live' },
  { songId: 13, platform: '网易云音乐', status: 'live' },
  { songId: 13, platform: 'Spotify', status: 'live' },
  { songId: 13, platform: 'Apple Music', status: 'live' },
  { songId: 13, platform: '酷狗音乐', status: 'submitted' },
  // 地下的河流 (id:14) - published
  { songId: 14, platform: 'QQ音乐', status: 'live' },
  { songId: 14, platform: '网易云音乐', status: 'pending' },
  { songId: 14, platform: 'Spotify', status: 'none' },
  { songId: 14, platform: 'Apple Music', status: 'none' },
  { songId: 14, platform: '酷狗音乐', status: 'none' },
]

// ═══ Publish Confirm Data ═══

export interface MockPublishTrack {
  id: number
  songId: number
  platform: string
  autoStatus: 'pending' | 'submitted' | 'live' | 'data_confirmed' | 'exception'
  submittedAt: string | null
  liveDate: string | null
  hasData: boolean
}

export const MOCK_PUBLISH_TRACKS: MockPublishTrack[] = [
  { id: 1, songId: 1, platform: 'QQ音乐', autoStatus: 'live', submittedAt: '2026-01-25', liveDate: '2026-02-01', hasData: true },
  { id: 2, songId: 1, platform: '网易云音乐', autoStatus: 'data_confirmed', submittedAt: '2026-01-25', liveDate: '2026-02-03', hasData: true },
  { id: 3, songId: 1, platform: 'Spotify', autoStatus: 'submitted', submittedAt: '2026-03-10', liveDate: null, hasData: false },
  { id: 4, songId: 3, platform: 'QQ音乐', autoStatus: 'live', submittedAt: '2026-02-20', liveDate: '2026-02-28', hasData: true },
  { id: 5, songId: 3, platform: '网易云音乐', autoStatus: 'submitted', submittedAt: '2026-03-05', liveDate: null, hasData: false },
  { id: 6, songId: 10, platform: 'QQ音乐', autoStatus: 'live', submittedAt: '2026-02-01', liveDate: '2026-02-10', hasData: true },
  { id: 7, songId: 10, platform: 'Apple Music', autoStatus: 'exception', submittedAt: '2026-01-15', liveDate: null, hasData: false },
  { id: 8, songId: 11, platform: 'QQ音乐', autoStatus: 'pending', submittedAt: null, liveDate: null, hasData: false },
  { id: 9, songId: 12, platform: 'Spotify', autoStatus: 'pending', submittedAt: null, liveDate: null, hasData: false },
  { id: 10, songId: 13, platform: '酷狗音乐', autoStatus: 'submitted', submittedAt: '2026-03-20', liveDate: null, hasData: false },
  { id: 11, songId: 14, platform: '网易云音乐', autoStatus: 'exception', submittedAt: '2026-02-01', liveDate: null, hasData: false },
]

// ═══ Revenue Management ═══

export interface MockRevenueImport {
  id: number
  fileName: string
  period: string
  totalRows: number
  idHit: number
  nameMatch: number
  unmatched: number
  duplicates: number
  totalRevenue: number
}

export interface MockMapping {
  id: number
  qishuiId: string
  songName: string
  creatorName: string | null
  source: 'auto' | 'manual'
  status: 'confirmed' | 'pending' | 'unbound'
  confirmedAt: string | null
  confirmedBy: string | null
}

export interface MockSettlement {
  id: number
  songTitle: string
  platform: string
  plays: number
  rawRevenue: number
  creatorRatio: number
  creatorAmount: number
  status: 'pending' | 'confirmed' | 'exported' | 'paid'
}

export interface MockQishuiDetail {
  id: number
  songName: string
  month: string
  douyinRevenue: number
  qishuiRevenue: number
  matchStatus: string
}

export const MOCK_REVENUE_IMPORTS: MockRevenueImport[] = [
  { id: 1, fileName: '汽水音乐_2026Q1.csv', period: '2026-01 ~ 2026-03', totalRows: 156, idHit: 89, nameMatch: 42, unmatched: 18, duplicates: 7, totalRevenue: 28450.60 },
  { id: 2, fileName: '汽水音乐_2025Q4.csv', period: '2025-10 ~ 2025-12', totalRows: 98, idHit: 72, nameMatch: 20, unmatched: 4, duplicates: 2, totalRevenue: 18200.30 },
]

export const MOCK_MAPPINGS: MockMapping[] = [
  { id: 1, qishuiId: 'QS-78001', songName: '星河漫步', creatorName: '张小明', source: 'auto', status: 'confirmed', confirmedAt: '2026-02-15', confirmedBy: '系统' },
  { id: 2, qishuiId: 'QS-78002', songName: '春风十里', creatorName: '王强', source: 'auto', status: 'confirmed', confirmedAt: '2026-02-15', confirmedBy: '系统' },
  { id: 3, qishuiId: 'QS-78010', songName: '父爱的魔法', creatorName: '张小明', source: 'manual', status: 'confirmed', confirmedAt: '2026-03-01', confirmedBy: '张运营' },
  { id: 4, qishuiId: 'QS-78015', songName: '夜空中最亮的星', creatorName: null, source: 'auto', status: 'pending', confirmedAt: null, confirmedBy: null },
  { id: 5, qishuiId: 'QS-78020', songName: '海边日落', creatorName: null, source: 'auto', status: 'unbound', confirmedAt: null, confirmedBy: null },
]

export const MOCK_SETTLEMENTS: MockSettlement[] = [
  { id: 1, songTitle: '星河漫步', platform: 'QQ音乐', plays: 12500, rawRevenue: 156.80, creatorRatio: 70, creatorAmount: 109.76, status: 'paid' },
  { id: 2, songTitle: '星河漫步', platform: '网易云音乐', plays: 8900, rawRevenue: 98.50, creatorRatio: 70, creatorAmount: 68.95, status: 'exported' },
  { id: 3, songTitle: '春风十里', platform: 'QQ音乐', plays: 9200, rawRevenue: 112.40, creatorRatio: 70, creatorAmount: 78.68, status: 'confirmed' },
  { id: 4, songTitle: '父爱的魔法', platform: 'Spotify', plays: 5600, rawRevenue: 85.20, creatorRatio: 70, creatorAmount: 59.64, status: 'pending' },
  { id: 5, songTitle: '霓虹下的隐形人', platform: 'QQ音乐', plays: 15800, rawRevenue: 198.50, creatorRatio: 70, creatorAmount: 138.95, status: 'pending' },
]

export const MOCK_QISHUI_DETAILS: MockQishuiDetail[] = [
  { id: 1, songName: '星河漫步', month: '2026-03', douyinRevenue: 45.20, qishuiRevenue: 28.50, matchStatus: 'id_confirmed' },
  { id: 2, songName: '星河漫步', month: '2026-02', douyinRevenue: 38.60, qishuiRevenue: 22.10, matchStatus: 'id_confirmed' },
  { id: 3, songName: '春风十里', month: '2026-03', douyinRevenue: 32.80, qishuiRevenue: 18.90, matchStatus: 'id_confirmed' },
  { id: 4, songName: '父爱的魔法', month: '2026-03', douyinRevenue: 28.50, qishuiRevenue: 15.60, matchStatus: 'id_confirmed' },
  { id: 5, songName: '霓虹下的隐形人', month: '2026-03', douyinRevenue: 52.30, qishuiRevenue: 31.20, matchStatus: 'id_confirmed' },
]

// ═══ Operation Logs ═══

export interface MockLog {
  id: number
  time: string
  operator: string
  action: string
  actionType: string
  target: string
  ip: string
}

export const MOCK_LOGS: MockLog[] = [
  { id: 1, time: '2026-04-15 10:32', operator: '超级管理员', action: '确认发行', actionType: '发行确认', target: '《星河漫步》→ QQ音乐', ip: '27.154.192.50' },
  { id: 2, time: '2026-04-15 09:15', operator: '张运营', action: '导入收益报表', actionType: '收益结算', target: '汽水音乐_2026Q1.csv', ip: '116.25.38.91' },
  { id: 3, time: '2026-04-14 16:45', operator: '李主管', action: '批量确认结算', actionType: '收益结算', target: '2026-Q1 共12笔', ip: '101.68.77.44' },
  { id: 4, time: '2026-04-14 14:20', operator: '超级管理员', action: '审核实名通过', actionType: '用户管理', target: '李芳', ip: '27.154.192.50' },
  { id: 5, time: '2026-04-13 11:00', operator: '刘老师', action: '提交评审', actionType: '歌曲评审', target: '《雨后彩虹》评分 85', ip: '183.62.44.18' },
]
