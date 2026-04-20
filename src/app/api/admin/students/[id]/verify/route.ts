import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { invalidate } from '@/lib/cache'
import { notify } from '@/lib/notifications'

type RouteContext = { params: Promise<{ id: string }> }

export const POST = safeHandler(async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requirePermission(request, 'admin.students.operate')
  if ('error' in auth) return auth.error

  const { id } = await context.params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) return err('无效的用户 ID')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return err('用户不存在', 404)

  const body = await request.json()
  const { action, reason } = body as { action: 'approve' | 'reject'; reason?: string }

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

  try {
    if (action === 'approve') {
      await notify(userId, 'tpl.realname_approved', {}, 'user', userId)
    } else {
      await notify(userId, 'tpl.realname_rejected', { reason: reason ?? '请重新提交' }, 'user', userId)
    }
  } catch (e) {
    console.error('[notify] realname verify failed:', e)
  }

  await logAdminAction(request, {
    action: action === 'approve' ? 'approve_realname' : 'reject_realname',
    targetType: 'user',
    targetId: userId,
    detail: { action, reason: reason ?? null, name: user.name, phone: user.phone, realName: user.realName },
  })
  return ok({
    id: updated.id,
    realNameStatus: updated.realNameStatus,
  })
})
