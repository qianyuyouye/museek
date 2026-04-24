import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

export const POST = safeHandler(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.students')
  if ('error' in auth) return auth.error

  const { id } = await params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) return err('无效的用户 ID')

  const { action, reason } = await request.json() as { action: string; reason?: string }
  if (!['confirm', 'reject'].includes(action)) return err('无效的操作')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return err('用户不存在', 404)
  if (user.agencyContract) return err('该用户已签署协议')
  if (!user.agencyApplied) return err('该用户尚未提交申请')

  if (action === 'confirm') {
    await prisma.user.update({
      where: { id: userId },
      data: {
        agencyContract: true,
        agencySignedAt: new Date(),
        agencyApplied: false,
        agencyRejectReason: null,
      },
    })
    await logAdminAction(request, {
      action: 'confirm_agency',
      targetType: 'user',
      targetId: userId,
      detail: { userName: user.name, email: user.email },
    }).catch(() => {})
    return ok({ status: 'confirmed' })
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: {
        agencyApplied: false,
        agencyRejectReason: reason || '未通过审核',
      },
    })
    await logAdminAction(request, {
      action: 'reject_agency',
      targetType: 'user',
      targetId: userId,
      detail: { userName: user.name, email: user.email, reason: reason || '未通过审核' },
    }).catch(() => {})
    return ok({ status: 'rejected' })
  }
})
