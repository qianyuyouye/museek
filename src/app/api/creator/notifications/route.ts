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

  const VALID_TYPES = ['work', 'revenue', 'system', 'assignment'] as const
  type ValidType = typeof VALID_TYPES[number]
  const normalizeType = (t: string): ValidType => (VALID_TYPES.includes(t as ValidType) ? (t as ValidType) : 'system')

  const baseWhere = { userId }
  const [notifications, total, unreadCount, workCount, revenueCount, systemCount, assignmentCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...baseWhere, read: false } }),
    prisma.notification.count({ where: { ...baseWhere, type: 'work' } }),
    prisma.notification.count({ where: { ...baseWhere, type: 'revenue' } }),
    prisma.notification.count({ where: { ...baseWhere, type: 'system' } }),
    prisma.notification.count({ where: { ...baseWhere, type: 'assignment' } }),
  ])

  const list = notifications.map((n) => ({
    id: n.id,
    type: normalizeType(n.type),
    title: n.title,
    content: n.content,
    targetType: n.targetType,
    targetId: n.targetId,
    linkUrl: n.linkUrl,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }))

  return ok({ list, total, page, pageSize, unreadCount, typeCounts: { all: total, work: workCount, revenue: revenueCount, system: systemCount, assignment: assignmentCount } })
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
