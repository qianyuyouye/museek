import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, parsePagination, safeHandler } from '@/lib/api-utils'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'reviewer') return err('无权限', 403)

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)

  const where = { reviewerId: userId }

  const [aggregate, reviews, reviewTotal, stronglyRecommendCount] = await Promise.all([
    prisma.review.aggregate({
      where,
      _count: true,
      _sum: { durationSeconds: true },
      _avg: { totalScore: true, durationSeconds: true },
    }),
    prisma.review.findMany({
      where,
      include: {
        song: {
          select: {
            title: true,
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { reviewedAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.review.count({ where }),
    prisma.review.count({
      where: { ...where, recommendation: 'strongly_recommend' },
    }),
  ])

  const totalCount = aggregate._count
  const recommendRate = totalCount > 0
    ? Math.round((stronglyRecommendCount / totalCount) * 100)
    : 0

  const stats = {
    totalCount,
    totalDuration: aggregate._sum.durationSeconds ?? 0,
    avgDuration: aggregate._avg.durationSeconds ? Math.round(aggregate._avg.durationSeconds) : 0,
    avgScore: aggregate._avg.totalScore ? Math.round(aggregate._avg.totalScore * 10) / 10 : 0,
    recommendRate,
  }

  const history = reviews.map((r) => ({
    id: r.id,
    songId: r.songId,
    songTitle: r.song.title,
    creatorName: r.song.user.name,
    technique: r.technique,
    creativity: r.creativity,
    commercial: r.commercial,
    totalScore: r.totalScore,
    recommendation: r.recommendation,
    comment: r.comment,
    reviewedAt: r.reviewedAt,
  }))

  return ok({ stats, history, page, pageSize, total: reviewTotal })
})
