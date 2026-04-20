import { getSetting, SETTING_KEYS } from './system-settings'
import { prisma } from './prisma'
import type { Notification } from '@prisma/client'

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
  | 'tpl.isrc_bound'

/** 内置默认模板（fallback） */
const DEFAULT_TEMPLATES: Record<TemplateKey, NotificationTemplate> = {
  'tpl.review_done': { type: 'work', title: '评审完成：《{songTitle}》', content: '评审员已完成评审，综合评分 {score} 分。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.song_published': { type: 'work', title: '作品发行：《{songTitle}》', content: '您的作品《{songTitle}》已成功发行。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.song_needs_revision': { type: 'work', title: '作品需修改：《{songTitle}》', content: '评审员建议修改：{comment}。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.song_archived': { type: 'work', title: '作品归档：《{songTitle}》', content: '您的作品已从发行状态归档。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.settlement_created': { type: 'revenue', title: '结算生成：{periodLabel}', content: '您在 {periodLabel} 的结算金额 ¥{amount} 已生成。', linkUrl: '/creator/revenue' },
  'tpl.settlement_paid': { type: 'revenue', title: '打款到账：¥{amount}', content: '您在 {periodLabel} 的结算已打款到账。', linkUrl: '/creator/revenue' },
  'tpl.realname_approved': { type: 'system', title: '实名认证已通过', content: '您的实名认证审核通过，可正常发行和打款。', linkUrl: '/creator/profile' },
  'tpl.realname_rejected': { type: 'system', title: '实名认证被驳回', content: '驳回原因：{reason}。请修改后重新提交。', linkUrl: '/creator/profile' },
  'tpl.assignment_created': { type: 'assignment', title: '新作业：《{assignmentTitle}》', content: '{assignmentDescription} 截止时间：{deadline}。', linkUrl: '/creator/assignments' },
  'tpl.assignment_due_soon': { type: 'assignment', title: '作业即将截止：《{assignmentTitle}》', content: '距离截止还有 24 小时，尚未提交。', linkUrl: '/creator/assignments' },
  'tpl.welcome': { type: 'system', title: '欢迎加入 Museek', content: '注册成功！请前往个人中心完成实名认证。', linkUrl: '/creator/profile' },
  'tpl.isrc_bound': {
    type: 'work',
    title: '版权编号已分配：《{songTitle}》',
    content: '平台已为作品分配 ISRC 编号：{isrc}。',
    linkUrl: '/creator/songs?id={songId}',
  },
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

/**
 * 业务动作触发通知：渲染模板 + 落库。
 *
 * **错误处理契约**：
 * - 模板不存在：返回 null（静默降级）
 * - `prisma.notification.create` 失败（DB 连接 / FK 违反 / 字段超长等）：**会上抛**
 *
 * **调用方必须自己 try/catch**，否则通知故障会传染到主业务响应（主业务事务已提交的情况下）。
 * 各调用点应 `console.error('[notify] <场景> failed:', e)` 打 context 方便排障。
 *
 * - targetId 统一 String 化
 */
export async function notify(
  userId: number,
  templateKey: TemplateKey,
  vars: Record<string, unknown>,
  targetType?: string,
  targetId?: string | number,
): Promise<Notification | null> {
  const rendered = await renderTemplate(templateKey, vars)
  if (!rendered) return null
  return prisma.notification.create({
    data: {
      userId,
      type: rendered.type,
      title: rendered.title,
      content: rendered.content,
      linkUrl: rendered.linkUrl,
      targetType: targetType ?? null,
      targetId: targetId != null ? String(targetId) : null,
    },
  })
}
