import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

const PRESET_TITLES: Record<string, string> = {
  realname_resubmit: '您的实名认证已被驳回，请登录后重新提交',
  realname_unverified: '请尽快完成实名认证以解锁全部功能',
  agency_contract: '请完善代理发行协议签署',
}

export const POST = safeHandler(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission(request, 'admin.students.operate')
  if ('error' in auth) return auth.error

  const { id } = await params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) return err('无效的用户 ID')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return err('用户不存在', 404)

  const body = await request.json().catch(() => ({}))
  const { preset, title: customTitle } = body as { preset?: string; title?: string }

  const title = customTitle?.trim() || (preset && PRESET_TITLES[preset]) || '来自管理员的提醒'

  const notification = await prisma.notification.create({
    data: { userId, type: 'system', title },
  })

  await logAdminAction(request, {
    action: 'notify_student',
    targetType: 'user',
    targetId: userId,
    detail: { name: user.name, phone: user.phone, preset: preset ?? null, title },
  })
  return ok({ id: notification.id, title: notification.title })
})
