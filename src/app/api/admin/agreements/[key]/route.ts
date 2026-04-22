import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { SETTING_KEYS } from '@/lib/system-settings'
import { logAdminAction } from '@/lib/log-action'

/** 简单的 HTML 安全过滤：移除 script/style/iframe 等危险标签 */
function sanitizeHtml(dirty: string): string {
  return dirty
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?<\/embed>/gi, '')
    .replace(/on\w+\s*=/gi, '')
}

const ALLOWED_AGREEMENT_KEYS = [
  SETTING_KEYS.AGENCY_TERMS,
  SETTING_KEYS.SERVICE_AGREEMENT,
  SETTING_KEYS.PRIVACY_POLICY,
] as const

type AgreementKey = (typeof ALLOWED_AGREEMENT_KEYS)[number]

const KEY_LABEL: Record<string, string> = {
  [SETTING_KEYS.AGENCY_TERMS]: '代理发行协议',
  [SETTING_KEYS.SERVICE_AGREEMENT]: '用户服务协议',
  [SETTING_KEYS.PRIVACY_POLICY]: '隐私政策',
}

/**
 * GET /api/admin/agreements/:key
 * 获取指定协议内容
 */
export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const auth = await requirePermission(request, 'admin.settings.view')
  if ('error' in auth) return auth.error

  const { key } = await params
  if (!ALLOWED_AGREEMENT_KEYS.includes(key as AgreementKey)) {
    return err('不支持的协议类型', 400)
  }

  const row = await prisma.systemSetting.findUnique({ where: { key } })
  const value = row?.value as Record<string, unknown> | undefined

  return ok({
    key,
    label: KEY_LABEL[key],
    content: (value?.content as string) || '',
    version: (value?.version as string) || '1.0',
    updatedAt: (value?.updatedAt as string) || '',
  })
})

/**
 * PUT /api/admin/agreements/:key
 * 保存协议内容
 */
export const PUT = safeHandler(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const auth = await requirePermission(request, 'admin.settings.edit')
  if ('error' in auth) return auth.error

  const { key } = await params
  if (!ALLOWED_AGREEMENT_KEYS.includes(key as AgreementKey)) {
    return err('不支持的协议类型', 400)
  }

  const body = await request.json()
  const { content, version } = body as { content?: string; version?: string }

  if (content === undefined && version === undefined) {
    return err('缺少 content 或 version', 400)
  }

  // 获取现有值
  const existingRow = await prisma.systemSetting.findUnique({ where: { key } })
  const existing = (existingRow?.value as Record<string, unknown>) || {}

  // 合并更新
  const next: Record<string, unknown> = {
    content: content !== undefined ? sanitizeHtml(content) : (existing.content || ''),
    version: version || (existing.version as string) || '1.0',
    updatedAt: new Date().toISOString(),
  }

  // 保留其他已有字段
  for (const [k, v] of Object.entries(existing)) {
    if (!(k in next)) next[k] = v
  }

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: next as Prisma.InputJsonValue },
    create: { key, value: next as Prisma.InputJsonValue },
  })

  try {
    await logAdminAction(request, {
      action: 'update_agreement',
      targetType: 'agreement',
      targetId: key,
      detail: { label: KEY_LABEL[key], version: next.version },
    })
  } catch { /* 日志失败不阻断 */ }

  return ok({ message: '协议已保存', version: next.version, updatedAt: next.updatedAt })
})
