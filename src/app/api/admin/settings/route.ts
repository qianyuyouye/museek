import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { DEFAULT_REVENUE_RULES } from '@/lib/commission'
import { SETTING_KEYS, setSetting, getSettingMasked } from '@/lib/system-settings'
import { invalidatePlatforms } from '@/lib/platforms'

const DEFAULT_AI_CONFIG = {
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  timeoutMs: 10000,
}

const DEFAULT_STORAGE_CONFIG = {
  mode: 'local' as 'local' | 'oss',
  oss: { accessKeyId: '', accessKeySecret: '', region: 'oss-cn-hangzhou', bucket: '', domain: '' },
  signedUrlTtlSec: 3600,
  uploadTokenTtlSec: 300,
  zipRetainHours: 24,
}

const DEFAULT_SMS_CONFIG = {
  enabled: false,
  accessKeyId: '',
  accessKeySecret: '',
  signName: '',
  templateCode: { register: '', resetPassword: '', changePhone: '' },
  perPhoneDailyLimit: 10,
  verifyMaxAttempts: 5,
}

const DEFAULT_NOTIFICATION_TEMPLATES = {
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
}

const PRESET_KEYS: Record<string, unknown> = {
  [SETTING_KEYS.SCORING_WEIGHTS]: { technique: 30, creativity: 40, commercial: 30 },
  [SETTING_KEYS.AUTO_ARCHIVE_THRESHOLD]: 80,
  [SETTING_KEYS.REVENUE_RULES]: DEFAULT_REVENUE_RULES,
  [SETTING_KEYS.REVIEW_TEMPLATES]: [],
  [SETTING_KEYS.PLATFORM_CONFIGS]: [{ name: '', region: '', enabled: true, mapped: false }],
  [SETTING_KEYS.AI_TOOLS]: [],
  [SETTING_KEYS.GENRES]: [],
  // Batch 1A 新增
  [SETTING_KEYS.AI_CONFIG]: DEFAULT_AI_CONFIG,
  [SETTING_KEYS.STORAGE_CONFIG]: DEFAULT_STORAGE_CONFIG,
  [SETTING_KEYS.SMS_CONFIG]: DEFAULT_SMS_CONFIG,
  [SETTING_KEYS.NOTIFICATION_TEMPLATES]: DEFAULT_NOTIFICATION_TEMPLATES,
}

/** 这些 key 走 setSetting（支持加密字段 + 合并补丁）路径 */
const PATCH_KEYS = new Set<string>([SETTING_KEYS.AI_CONFIG, SETTING_KEYS.STORAGE_CONFIG, SETTING_KEYS.SMS_CONFIG])

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.settings.view')
  if ('error' in auth) return auth.error

  const rows = await prisma.systemSetting.findMany()
  const map = new Map(rows.map((r) => [r.key, r.value]))

  const settings = await Promise.all(
    Object.entries(PRESET_KEYS).map(async ([key, defaultValue]) => {
      if (PATCH_KEYS.has(key)) {
        const masked = await getSettingMasked(key)
        return { key, value: masked ?? defaultValue }
      }
      return { key, value: map.has(key) ? map.get(key) : defaultValue }
    }),
  )

  return ok(settings)
})

export const PUT = safeHandler(async function PUT(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.settings.edit')
  if ('error' in auth) return auth.error

  const body = await request.json()
  const rawSettings = (body as { settings: { key: string; value: unknown }[] }).settings
  if (!Array.isArray(rawSettings)) return err('settings 必须为数组')

  // 兼容历史/文档命名：commission_rules 别名到 revenue_rules
  const KEY_ALIAS: Record<string, string> = { commission_rules: 'revenue_rules' }
  const settings = rawSettings.map(({ key, value }) => ({ key: KEY_ALIAS[key] ?? key, value }))

  const ALLOWED_KEYS = Object.keys(PRESET_KEYS)
  const invalidKeys = settings.filter(({ key }) => !ALLOWED_KEYS.includes(key)).map(({ key }) => key)
  if (invalidKeys.length > 0) return err(`不允许的 key：${invalidKeys.join(', ')}`)

  for (const s of settings) {
    if (PATCH_KEYS.has(s.key)) {
      const patch = s.value as Record<string, unknown>
      if (patch && typeof patch === 'object') {
        if ('apiKey' in patch && patch.apiKey === '') delete patch.apiKey
        if ('accessKeySecret' in patch && patch.accessKeySecret === '') delete patch.accessKeySecret
        if ('accessKeyId' in patch && patch.accessKeyId === '') delete patch.accessKeyId
        if ('oss' in patch && patch.oss && typeof patch.oss === 'object') {
          const oss = patch.oss as Record<string, unknown>
          if (oss.accessKeyId === '') delete oss.accessKeyId
          if (oss.accessKeySecret === '') delete oss.accessKeySecret
        }
      }
      await setSetting(s.key, patch)
    } else {
      await prisma.systemSetting.upsert({
        where: { key: s.key },
        update: { value: s.value as Prisma.InputJsonValue },
        create: { key: s.key, value: s.value as Prisma.InputJsonValue },
      })
    }
  }

  if (settings.some((s) => s.key === SETTING_KEYS.PLATFORM_CONFIGS)) {
    invalidatePlatforms()
  }

  await logAdminAction(request, {
    action: 'update_system_setting',
    targetType: 'system_setting',
    detail: { keys: settings.map((s) => s.key) },
  })
  return ok(null)
})
