import { NextRequest } from 'next/server'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { pingSms } from '@/lib/sms'
import { logAdminAction } from '@/lib/log-action'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { phone } = await request.json() as { phone?: string }
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) return err('手机号格式错误')

  const result = await pingSms(phone)
  await logAdminAction(request, {
    action: 'test_sms_config',
    targetType: 'system_setting',
    detail: { phone, ...result },
  })
  return ok(result)
})
