import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { Decimal } from '@prisma/client/runtime/library'

function toNumber(val: Decimal | null | undefined): number {
  return val ? Number(val) : 0
}

export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'creator') return err('无权限', 403)

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)

  // 结算列表
  const [settlements, settleTotal] = await Promise.all([
    prisma.settlement.findMany({
      where: { creatorId: userId },
      include: {
        revenueRow: {
          select: {
            songName: true,
            period: true,
            douyinRevenue: true,
            qishuiRevenue: true,
            totalRevenue: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.settlement.count({ where: { creatorId: userId } }),
  ])

  const settleList = settlements.map((s) => ({
    id: s.id,
    qishuiSongId: s.qishuiSongId,
    songName: s.songName,
    period: s.period,
    douyinRevenue: toNumber(s.douyinRevenue),
    qishuiRevenue: toNumber(s.qishuiRevenue),
    totalRevenue: toNumber(s.totalRevenue),
    creatorAmount: toNumber(s.creatorAmount),
    platformRatio: toNumber(s.platformRatio),
    creatorRatio: toNumber(s.creatorRatio),
    settleStatus: s.settleStatus,
    paidAt: s.paidAt,
    createdAt: s.createdAt,
    revenueRow: s.revenueRow
      ? {
          songName: s.revenueRow.songName,
          period: s.revenueRow.period,
          douyinRevenue: toNumber(s.revenueRow.douyinRevenue),
          qishuiRevenue: toNumber(s.revenueRow.qishuiRevenue),
          totalRevenue: toNumber(s.revenueRow.totalRevenue),
        }
      : null,
  }))

  // 汽水收益聚合：通过 revenueRows joined via songMappings
  const qishuiAgg = await prisma.revenueRow.aggregate({
    where: { mapping: { creatorId: userId } },
    _sum: { totalRevenue: true },
  })
  const qishuiTotal = toNumber(qishuiAgg._sum.totalRevenue)

  // 统计：用 aggregate 代替全量拉取
  const [totalAgg, paidAgg, pendingAgg] = await Promise.all([
    prisma.settlement.aggregate({
      where: { creatorId: userId },
      _sum: { creatorAmount: true },
    }),
    prisma.settlement.aggregate({
      where: { creatorId: userId, settleStatus: 'paid' },
      _sum: { creatorAmount: true },
    }),
    prisma.settlement.aggregate({
      where: { creatorId: userId, settleStatus: { notIn: ['paid', 'exception'] } },
      _sum: { creatorAmount: true },
    }),
  ])

  const totalEarnings = toNumber(totalAgg._sum.creatorAmount)
  const paidAmount = toNumber(paidAgg._sum.creatorAmount)
  const pendingAmount = toNumber(pendingAgg._sum.creatorAmount)

  return ok({
    settlements: { list: settleList, total: settleTotal, page, pageSize },
    qishuiRevenue: qishuiTotal,
    stats: {
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      paidAmount: Math.round(paidAmount * 100) / 100,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
    },
  })
})
