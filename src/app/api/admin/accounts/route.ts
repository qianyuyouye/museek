import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, parsePagination, safeHandler} from '@/lib/api-utils'
import { Prisma } from '@prisma/client'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)

  const tab = searchParams.get('tab')
  const search = searchParams.get('search')

  const where: Prisma.UserWhereInput = {}

  if (tab === 'reviewer' || tab === 'creator') {
    where.type = tab
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { realName: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
    ]
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        userGroups: {
          include: { group: { select: { id: true, name: true } } },
        },
      },
    }),
  ])

  // 评审 Tab 附带评审绩效统计（批改数/平均用时/平均评分/推荐率）
  let reviewerStats: Map<number, { reviewCount: number; avgTimeSeconds: number; avgScore: number; recommendRate: number }> = new Map()
  if (tab === 'reviewer' && users.length > 0) {
    const reviewerIds = users.map((u) => u.id)
    const rows = await prisma.review.groupBy({
      by: ['reviewerId'],
      where: { reviewerId: { in: reviewerIds } },
      _count: { _all: true },
      _avg: { totalScore: true, durationSeconds: true },
    })
    const recommendCounts = await prisma.review.groupBy({
      by: ['reviewerId'],
      where: { reviewerId: { in: reviewerIds }, recommendation: 'strongly_recommend' },
      _count: { _all: true },
    })
    const recommendMap = new Map(recommendCounts.map((r) => [r.reviewerId, r._count._all]))
    for (const r of rows) {
      const total = r._count._all
      const strongly = recommendMap.get(r.reviewerId) ?? 0
      reviewerStats.set(r.reviewerId, {
        reviewCount: total,
        avgTimeSeconds: Math.round(r._avg.durationSeconds ?? 0),
        avgScore: Math.round((r._avg.totalScore ?? 0) * 10) / 10,
        recommendRate: total > 0 ? Math.round((strongly / total) * 100) : 0,
      })
    }
  }

  const list = users.map((u) => ({
    id: u.id,
    name: u.name,
    realName: u.realName,
    phone: u.phone,
    email: u.email,
    avatarUrl: u.avatarUrl,
    type: u.type,
    adminLevel: u.adminLevel,
    realNameStatus: u.realNameStatus,
    status: u.status,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    groups: u.userGroups.map((ug) => ({ id: ug.group.id, name: ug.group.name })),
    ...(tab === 'reviewer' ? (reviewerStats.get(u.id) ?? { reviewCount: 0, avgTimeSeconds: 0, avgScore: 0, recommendRate: 0 }) : {}),
  }))

  return ok({ list, total, page, pageSize })
})
