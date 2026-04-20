import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, safeHandler} from '@/lib/api-utils'
import { cacheGet } from '@/lib/cache'

const DASHBOARD_TTL_MS = 5 * 60 * 1000  // PRD §10.2 看板 5 分钟缓存

async function loadDashboard() {
  const [
    totalCreators,
    totalReviewers,
    totalSongs,
    songsFromUpload,
    songsFromAssignment,
    pendingReview,
    published,
    revenueAgg,
    creatorsWithSongs,
    verifiedCreators,
    agencyCreators,
    trendRaw,
    groupCount,
  ] = await Promise.all([
    prisma.user.count({ where: { type: 'creator' } }),
    prisma.user.count({ where: { type: 'reviewer' } }),
    prisma.platformSong.count(),
    prisma.platformSong.count({ where: { source: 'upload' } }),
    prisma.platformSong.count({ where: { source: 'assignment' } }),
    prisma.platformSong.count({ where: { status: 'pending_review' } }),
    prisma.platformSong.count({ where: { status: 'published' } }),
    prisma.settlement.aggregate({ _sum: { creatorAmount: true } }),
    prisma.platformSong.groupBy({
      by: ['userId'],
      _count: true,
    }).then((rows) => rows.length),
    prisma.user.count({ where: { type: 'creator', realNameStatus: 'verified' } }),
    prisma.user.count({ where: { type: 'creator', agencyContract: true } }),
    prisma.settlement.groupBy({
      by: ['period'],
      _sum: { creatorAmount: true },
      orderBy: { period: 'asc' },
    }),
    prisma.group.count(),
  ])

  const totalRevenue = Number(revenueAgg._sum.creatorAmount ?? 0)

  // 转化率（百分比，保留一位小数）
  const safe = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0)

  const rates = [
    { n: 1, label: '代理签约认证率', v: safe(agencyCreators, totalCreators), c: '#6366f1' },
    { n: 2, label: '实名认证完成率', v: safe(verifiedCreators, totalCreators), c: '#7c3aed' },
    { n: 3, label: '内容创作活跃率', v: safe(creatorsWithSongs, totalCreators), c: '#818cf8' },
    { n: 4, label: '作品发行率', v: safe(published, totalSongs), c: '#6366f1' },
  ]

  // 收益趋势：将 period 转为月份标签
  const trendMonths = trendRaw.map((r) => r.period ?? '')
  const trendValues = trendRaw.map((r) => Number(r._sum.creatorAmount ?? 0))

  const publishRate = totalSongs > 0 ? Math.round((published / totalSongs) * 1000) / 10 : 0

  return {
    stats: {
      totalCreators,
      totalReviewers,
      totalUsers: totalCreators + totalReviewers,
      totalSongs,
      songsFromUpload,
      songsFromAssignment,
      pendingReview,
      published,
      publishRate,
      totalRevenue,
      groupCount,
    },
    trend: {
      months: trendMonths,
      values: trendValues,
    },
    rates,
  }
}

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error
  const data = await cacheGet('dashboard', DASHBOARD_TTL_MS, loadDashboard)
  return ok(data)
})
