// ── Permission Tree Types & Data ─────────────────────────────────

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

export const ACTION_LABELS: Record<string, string> = {
  view: '查看', edit: '编辑', manage: '管理',
  operate: '操作', export: '导出', settle: '结算',
}

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

// ── Song Status Map ─────────────────────────────────────────────

export const SONG_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending_review: { label: '待评分', color: '#d97706', bg: '#fef9ec' },
  needs_revision: { label: '需修改', color: '#e53e3e', bg: '#fff0f0' },
  reviewed: { label: '已评分', color: '#6366f1', bg: '#eef2ff' },
  archived: { label: '已归档', color: '#64748b', bg: '#f1f5f9' },
  ready_to_publish: { label: '待发行', color: '#0694a2', bg: '#e0f7fa' },
  published: { label: '已发行', color: '#16a34a', bg: '#f0fdf4' },
}
