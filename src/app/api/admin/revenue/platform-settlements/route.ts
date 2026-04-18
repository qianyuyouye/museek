import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, safeHandler } from '@/lib/api-utils'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const settlements = await prisma.settlement.findMany({
    where: {
      revenueRow: {
        import: { platform: { not: 'qishui' } },
      },
    },
    include: {
      creator: { select: { id: true, name: true } },
      revenueRow: { select: { import: { select: { platform: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const list = settlements.map((s) => ({
    ...s,
    status: s.settleStatus,
    songTitle: s.songName,
    platform: s.revenueRow.import.platform,
    douyinRevenue: s.douyinRevenue ? parseFloat(s.douyinRevenue.toString()) : null,
    qishuiRevenue: s.qishuiRevenue ? parseFloat(s.qishuiRevenue.toString()) : null,
    totalRevenue: s.totalRevenue ? parseFloat(s.totalRevenue.toString()) : null,
    platformRatio: parseFloat(s.platformRatio.toString()),
    creatorRatio: parseFloat(s.creatorRatio.toString()),
    creatorAmount: s.creatorAmount ? parseFloat(s.creatorAmount.toString()) : null,
  }))

  return ok({ settlements: list })
})
