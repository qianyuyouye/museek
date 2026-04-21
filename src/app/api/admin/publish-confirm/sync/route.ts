import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.publish_confirm.operate')
  if ('error' in auth) return auth.error

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)

  const result = await prisma.$transaction(async (tx) => {
    // 1. 先自动确认有收益数据的 submitted → live
    const submittedWithRevenue = await tx.distribution.findMany({
      where: {
        status: 'submitted',
      },
      select: {
        id: true,
        song: {
          select: {
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
    })

    const idsToConfirm = submittedWithRevenue
      .filter((d) =>
        d.song.mappings.some((m) => m.revenueRows.some((r) => r.settlement !== null)),
      )
      .map((d) => d.id)

    let autoConfirmed = 0
    if (idsToConfirm.length > 0) {
      const confirmResult = await tx.distribution.updateMany({
        where: { id: { in: idsToConfirm } },
        data: { status: 'live', liveDate: now },
      })
      autoConfirmed = confirmResult.count
    }

    // 2. 再标记超过 30 天未确认的 submitted → failed
    const expiredResult = await tx.distribution.updateMany({
      where: {
        status: 'submitted',
        submittedAt: { lt: thirtyDaysAgo },
      },
      data: { status: 'failed' },
    })

    return { autoConfirmed, exceptions: expiredResult.count }
  })

  await logAdminAction(request, {
    action: 'sync_distributions',
    targetType: 'distribution',
    detail: { autoConfirmed: result.autoConfirmed, exceptions: result.exceptions },
  })
  return ok(result)
})
