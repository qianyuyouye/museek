import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler} from '@/lib/api-utils'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || !portal) {
    return err('未登录', 401)
  }

  const logs = await prisma.loginLog.findMany({
    where: { userId, portal },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return ok(
    logs.map((l) => ({
      id: l.id,
      time: l.createdAt.toISOString(),
      ip: l.ip || '-',
      userAgent: l.userAgent || '-',
    })),
  )
})
