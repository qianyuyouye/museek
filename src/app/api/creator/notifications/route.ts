import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'creator') return err('无权限', 403)

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const type = searchParams.get('type')

  const where = {
    userId,
    ...(type ? { type } : {}),
  }

  const [notifications, total, unreadCount, workCount, revenueCount, systemCount, allCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, read: false } }),
    prisma.notification.count({ where: { userId, type: 'work' } }),
    prisma.notification.count({ where: { userId, type: 'revenue' } }),
    prisma.notification.count({ where: { userId, type: 'system' } }),
    prisma.notification.count({ where: { userId } }),
  ])

  const list = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    read: n.read,
    createdAt: n.createdAt,
  }))

  return ok({ list, total, page, pageSize, unreadCount, typeCounts: { all: allCount, work: workCount, revenue: revenueCount, system: systemCount } })
})

export const PUT = safeHandler(async function PUT(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'creator') return err('无权限', 403)

  const body = await request.json()
  const { id, all } = body

  if (all) {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })
    return ok()
  }

  if (!id) return err('缺少消息ID')

  const notification = await prisma.notification.findFirst({
    where: { id: parseInt(id, 10), userId },
  })
  if (!notification) return err('消息不存在', 404)

  await prisma.notification.update({
    where: { id: notification.id },
    data: { read: true },
  })

  return ok()
})
