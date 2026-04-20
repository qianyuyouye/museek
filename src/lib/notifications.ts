import { getSetting, SETTING_KEYS } from './system-settings'

export type NotificationType = 'work' | 'revenue' | 'system' | 'assignment'

export interface NotificationTemplate {
  type: NotificationType
  title: string
  content: string
  linkUrl: string
}

export interface RenderedNotification {
  type: NotificationType
  title: string
  content: string
  linkUrl: string
}

export type TemplateKey =
  | 'tpl.review_done'
  | 'tpl.song_published'
  | 'tpl.song_needs_revision'
  | 'tpl.song_archived'
  | 'tpl.settlement_created'
  | 'tpl.settlement_paid'
  | 'tpl.realname_approved'
  | 'tpl.realname_rejected'
  | 'tpl.assignment_created'
  | 'tpl.assignment_due_soon'
  | 'tpl.welcome'

/** 内置默认模板（fallback） */
const DEFAULT_TEMPLATES: Record<TemplateKey, NotificationTemplate> = {
  'tpl.review_done': { type: 'work', title: '评审完成：《{songTitle}》', content: '评审员已完成评审，综合评分 {score} 分。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.song_published': { type: 'work', title: '作品发行：《{songTitle}》', content: '您的作品已成功发行。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.song_needs_revision': { type: 'work', title: '作品需修改：《{songTitle}》', content: '评审员建议修改：{comment}。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.song_archived': { type: 'work', title: '作品归档：《{songTitle}》', content: '您的作品已从发行状态归档。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.settlement_created': { type: 'revenue', title: '结算生成：{periodLabel}', content: '您在 {periodLabel} 的结算金额 ¥{amount} 已生成。', linkUrl: '/creator/revenue' },
  'tpl.settlement_paid': { type: 'revenue', title: '打款到账：¥{amount}', content: '您在 {periodLabel} 的结算已打款到账。', linkUrl: '/creator/revenue' },
  'tpl.realname_approved': { type: 'system', title: '实名认证已通过', content: '您的实名认证审核通过，可正常发行和打款。', linkUrl: '/creator/profile' },
  'tpl.realname_rejected': { type: 'system', title: '实名认证被驳回', content: '驳回原因：{reason}。请修改后重新提交。', linkUrl: '/creator/profile' },
  'tpl.assignment_created': { type: 'work', title: '新作业：《{assignmentTitle}》', content: '{assignmentDescription} 截止时间：{deadline}。', linkUrl: '/creator/assignments' },
  'tpl.assignment_due_soon': { type: 'work', title: '作业即将截止：《{assignmentTitle}》', content: '距离截止还有 24 小时，尚未提交。', linkUrl: '/creator/assignments' },
  'tpl.welcome': { type: 'system', title: '欢迎加入 Museek', content: '注册成功！请前往个人中心完成实名认证。', linkUrl: '/creator/profile' },
}

export async function getTemplate(key: TemplateKey): Promise<NotificationTemplate | null> {
  const overrides = await getSetting<Partial<Record<TemplateKey, NotificationTemplate>>>(SETTING_KEYS.NOTIFICATION_TEMPLATES, {})
  return overrides[key] ?? DEFAULT_TEMPLATES[key] ?? null
}

function interpolate(str: string, vars: Record<string, unknown>): string {
  return str.replace(/\{(\w+)\}/g, (match, k) => {
    if (k in vars && vars[k] !== undefined && vars[k] !== null) return String(vars[k])
    return match // 保留原样
  })
}

export async function renderTemplate(key: TemplateKey, vars: Record<string, unknown>): Promise<RenderedNotification | null> {
  const tpl = await getTemplate(key)
  if (!tpl) return null
  return {
    type: tpl.type,
    title: interpolate(tpl.title, vars),
    content: interpolate(tpl.content, vars),
    linkUrl: interpolate(tpl.linkUrl, vars),
  }
}
