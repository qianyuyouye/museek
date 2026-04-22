import { NextRequest } from 'next/server'
import { requirePermission, ok, err, getClientIp, safeHandler} from '@/lib/api-utils'
import { logAction } from '@/lib/log-action'

// 手动记录操作日志端点（供外部系统通过 HTTP 调用）
// 内部路由统一使用 logAdminAction() 直接写入，不走此端点
export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.logs.view')
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { action, targetType, targetId, detail } = body

  if (!action) return err('action 不能为空')

  // 从 header 获取操作者信息
  const operatorId = auth.userId
  const operatorName = request.headers.get('x-user-name') || ''
  const ip = getClientIp(request)

  await logAction({
    operatorId,
    operatorName,
    action,
    targetType,
    targetId,
    detail,
    ip,
  })

  return ok(null)
})
