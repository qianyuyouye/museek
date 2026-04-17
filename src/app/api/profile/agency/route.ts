import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler} from '@/lib/api-utils'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId) return err('未登录', 401)

  if (portal === 'admin') return err('管理员无需签署代理协议')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { agencyContract: true },
  })
  if (!user) return err('用户不存在', 404)
  if (user.agencyContract) return err('已签署代理协议，无需重复签署')

  await prisma.user.update({
    where: { id: userId },
    data: {
      agencyContract: true,
      agencySignedAt: new Date(),
    },
  })

  return ok()
})
