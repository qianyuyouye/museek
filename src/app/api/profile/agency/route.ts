import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId) return err('未登录', 401)

  if (portal === 'admin') return err('管理员无需签署代理协议')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { agencyContract: true, agencyApplied: true },
  })
  if (!user) return err('用户不存在', 404)
  if (user.agencyContract) return err('协议已签署，无需重复申请')
  if (user.agencyApplied) return err('申请审核中，请勿重复提交')

  await prisma.user.update({
    where: { id: userId },
    data: {
      agencyApplied: true,
      agencyAppliedAt: new Date(),
      agencyRejectReason: null,
    },
  })

  return ok()
})
