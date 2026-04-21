import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { DistributionStatus } from '@prisma/client'

const VALID_STATUSES: Set<string> = new Set(Object.values(DistributionStatus))

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.publish_confirm.view')
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const status = searchParams.get('status')

  if (status && status !== 'all' && !VALID_STATUSES.has(status)) {
    return err('无效的状态值')
  }

  const where = (status && status !== 'all') ? { status: status as DistributionStatus } : {}

  const [distributions, total, statusCountsRaw] = await Promise.all([
    prisma.distribution.findMany({
      where,
      include: {
        song: {
          select: {
            title: true,
            coverUrl: true,
            copyrightCode: true,
            isrc: true,
            userId: true,
            user: { select: { name: true } },
            mappings: {
              select: {
                revenueRows: {
                  select: {
                    settlement: { select: { id: true } },
                  },
                  take: 1,
                },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { id: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.distribution.count({ where }),
    prisma.distribution.groupBy({
      by: ['status'],
      _count: true,
    }),
  ])

  const statusCounts: Record<string, number> = { all: 0 }
  for (const row of statusCountsRaw) {
    statusCounts[row.status] = row._count
    statusCounts.all += row._count
  }
  // Merge live + data_confirmed into 'live' for the tab
  statusCounts.live = (statusCounts.live ?? 0) + (statusCounts.data_confirmed ?? 0)

  const now = Date.now()

  const list = distributions.map((d) => {
    const hasRevenue = d.song.mappings.some((m) =>
      m.revenueRows.some((r) => r.settlement !== null),
    )

    return {
      id: d.id,
      songId: d.songId,
      platform: d.platform,
      status: d.status,
      submittedAt: d.submittedAt,
      liveDate: d.liveDate,
      url: d.url,
      title: d.song.title,
      coverUrl: d.song.coverUrl,
      copyrightCode: d.song.copyrightCode,
      isrc: d.song.isrc,
      creatorName: d.song.user.name,
      daysSinceSubmit: d.submittedAt
        ? Math.floor((now - d.submittedAt.getTime()) / 86400000)
        : null,
      hasRevenue,
    }
  })

  return ok({ list, total, page, pageSize, statusCounts })
})
