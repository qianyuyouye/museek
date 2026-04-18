import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { DEFAULT_REVENUE_RULES } from '@/lib/commission'

const PRESET_KEYS: Record<string, unknown> = {
  scoring_weights: { technique: 30, creativity: 40, commercial: 30 },
  auto_archive_threshold: 80,
  revenue_rules: DEFAULT_REVENUE_RULES,
  review_templates: [],
  platform_configs: [{ name: '', region: '', enabled: true, mapped: false }],
  ai_tools: [],
  genres: [],
}

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const rows = await prisma.systemSetting.findMany()

  // 用已有值覆盖预设默认值
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const settings = Object.entries(PRESET_KEYS).map(([key, defaultValue]) => ({
    key,
    value: map.has(key) ? map.get(key) : defaultValue,
  }))

  return ok(settings)
})

export const PUT = safeHandler(async function PUT(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { settings } = body as { settings: { key: string; value: unknown }[] }

  if (!Array.isArray(settings)) return err('settings 必须为数组')

  const ALLOWED_KEYS = Object.keys(PRESET_KEYS)
  const invalidKeys = settings.filter(({ key }) => !ALLOWED_KEYS.includes(key)).map(({ key }) => key)
  if (invalidKeys.length > 0) return err(`不允许的 key：${invalidKeys.join(', ')}`)

  await prisma.$transaction(
    settings.map(({ key, value }) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value: value as Prisma.InputJsonValue },
        create: { key, value: value as Prisma.InputJsonValue },
      }),
    ),
  )

  await logAdminAction(request, {
    action: 'update_system_setting',
    targetType: 'system_setting',
    detail: { keys: settings.map(s => s.key) },
  })
  return ok(null)
})
