/**
 * 前后端共享的 API 请求/响应类型定义
 *
 * 规则：
 * - 前端 apiCall 的 body 类型必须引用这里的 Request 类型
 * - 后端 route.ts 的 body 解构必须引用这里的 Request 类型
 * - 字段名改了这里报错，两端同时改
 */

// ═══ 认证 ═══

export interface LoginRequest {
  account: string
  password: string
  portal: 'admin' | 'creator' | 'reviewer'
}

export interface PasswordChangeRequest {
  oldPassword: string
  newPassword: string
}

export interface SmsVerifyRequest {
  phone: string
  code: string
  password?: string
  inviteCode?: string
}

// ═══ 评审 ═══

export interface ReviewSubmitRequest {
  songId: number
  technique: number
  lyrics: number
  melody: number
  arrangement: number
  styleCreativity: number
  commercial: number
  tags?: string[]
  comment: string
  recommendation: 'strongly_recommend' | 'recommend_after_revision' | 'not_recommend'
}

// ═══ 创作者上传 ═══

export interface SongUploadRequest {
  title: string
  lyricist?: string
  composer?: string
  aiTools?: string[]
  genre?: string
  bpm?: number
  lyrics?: string
  styleDesc?: string
  contribution?: string
  creationDesc?: string
  audioUrl?: string
  coverUrl?: string
}

export interface AssignmentSubmitRequest {
  title: string
  aiTools?: string[]
  performer?: string
  lyricist?: string
  composer?: string
  lyrics?: string
  styleDesc?: string
  genre?: string
  bpm?: number
  albumName?: string
  albumArtist?: string
  audioUrl?: string
}

// ═══ 系统设置 ═══

export interface SettingItem {
  key: string
  value: unknown
}

export interface SettingsSaveRequest {
  settings: SettingItem[]
}

// ═══ 管理端操作 ═══

export interface SongStatusRequest {
  action: 'publish' | 'reject' | 'archive' | 'restore'
}

export interface IsrcBindRequest {
  isrc: string
}

export interface VerifyRequest {
  action: 'approve' | 'reject'
}

export interface PublishConfirmRequest {
  action: 'submit' | 'confirm_live' | 'mark_exception' | 'resubmit'
}

// 站内通知（Theme-2）
export type NotificationTypeKey = 'work' | 'revenue' | 'system' | 'assignment'

export interface NotificationResponse {
  id: number
  type: NotificationTypeKey
  title: string
  content: string | null
  targetType: string | null
  targetId: string | null
  linkUrl: string | null
  read: boolean
  createdAt: string
}

export interface NotificationsListResponse {
  list: NotificationResponse[]
  total: number
  page: number
  pageSize: number
  unreadCount: number
  typeCounts: {
    all: number
    work: number
    revenue: number
    system: number
    assignment: number
  }
}
