import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, parsePagination, safeHandler } from '@/lib/api-utils'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || !portal) {
    return err('未登录', 401)
  }

  const { searchParams } = request.nextUrl
  const { pageSize, skip } = parsePagination(searchParams)

  const [logs, total] = await Promise.all([
    prisma.loginLog.findMany({
      where: { userId, portal },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.loginLog.count({ where: { userId, portal } }),
  ])

  return ok({
    list: logs.map((l) => ({
      id: l.id,
      time: l.createdAt.toISOString(),
      ip: l.ip || '-',
      userAgent: l.userAgent || '-',
    })),
    total,
  })
})
