import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, parsePagination, safeHandler } from '@/lib/api-utils'
import { Prisma } from '@prisma/client'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.teachers.view')
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const search = searchParams.get('search')

  const where: Prisma.UserWhereInput = { type: 'reviewer' }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { realName: { contains: search } },
      { phone: { contains: search } },
    ]
  }

  const [total, reviewers] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        realName: true,
        phone: true,
        avatarUrl: true,
        adminLevel: true,
      },
    }),
  ])

  const reviewerIds = reviewers.map((u) => u.id)
  const stats = new Map<number, { reviewCount: number; avgTimeSeconds: number; avgScore: number; recommendRate: number }>()

  if (reviewerIds.length > 0) {
    const agg = await prisma.review.groupBy({
      by: ['reviewerId'],
      where: { reviewerId: { in: reviewerIds } },
      _count: { _all: true },
      _avg: { totalScore: true, durationSeconds: true },
    })
    const recCounts = await prisma.review.groupBy({
      by: ['reviewerId'],
      where: { reviewerId: { in: reviewerIds }, recommendation: 'strongly_recommend' },
      _count: { _all: true },
    })
    const recMap = new Map(recCounts.map((r) => [r.reviewerId, r._count._all]))
    for (const row of agg) {
      const cnt = row._count._all
      const strongly = recMap.get(row.reviewerId) ?? 0
      stats.set(row.reviewerId, {
        reviewCount: cnt,
        avgTimeSeconds: Math.round(row._avg.durationSeconds ?? 0),
        avgScore: Math.round((row._avg.totalScore ?? 0) * 10) / 10,
        recommendRate: cnt > 0 ? Math.round((strongly / cnt) * 100) : 0,
      })
    }
  }

  const list = reviewers.map((u) => ({
    id: u.id,
    name: u.realName || u.name,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    adminLevel: u.adminLevel,
    type: 'reviewer' as const,
    ...(stats.get(u.id) ?? { reviewCount: 0, avgTimeSeconds: 0, avgScore: 0, recommendRate: 0 }),
  }))

  return ok({ list, total, page, pageSize })
})
