import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

export const POST = safeHandler(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.accounts.manage')
  if ('error' in auth) return auth.error

  const { id } = await params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) return err('无效的用户 ID')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return err('用户不存在', 404)

  const newStatus = user.status === 'active' ? 'disabled' : 'active'
  await prisma.user.update({
    where: { id: userId },
    data: { status: newStatus },
  })

  await logAdminAction(request, {
    action: newStatus === 'disabled' ? 'disable_user' : 'enable_user',
    targetType: 'user',
    targetId: userId,
    detail: { name: user.name, phone: user.phone },
  })
  return ok({ id: userId, status: newStatus })
})
