import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { invalidate } from '@/lib/cache'

type RouteContext = { params: Promise<{ id: string }> }

export const POST = safeHandler(async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { id } = await context.params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) return err('无效的用户 ID')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return err('用户不存在', 404)

  const body = await request.json()
  const { action } = body

  if (action !== 'approve' && action !== 'reject') {
    return err('action 必须为 approve 或 reject')
  }

  if (user.realNameStatus !== 'pending') {
    return err('当前实名状态不可审核')
  }

  const realNameStatus = action === 'approve' ? 'verified' : 'rejected'

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { realNameStatus },
  })

  // 看板"实名认证完成率"依赖此字段
  invalidate('dashboard')

  await logAdminAction(request, {
    action: action === 'approve' ? 'approve_realname' : 'reject_realname',
    targetType: 'user',
    targetId: userId,
    detail: { name: user.name, phone: user.phone, realName: user.realName },
  })
  return ok({
    id: updated.id,
    realNameStatus: updated.realNameStatus,
  })
})
