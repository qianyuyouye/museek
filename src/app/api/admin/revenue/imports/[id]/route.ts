import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

export const DELETE = safeHandler(async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.revenue.operate')
  if ('error' in auth) return auth.error

  const { id } = await params
  const importId = parseInt(id, 10)
  if (isNaN(importId)) return err('无效的 ID')

  const record = await prisma.revenueImport.findUnique({
    where: { id: importId },
    select: { id: true, fileName: true, platform: true, period: true },
  })
  if (!record) return err('导入记录不存在', 404)

  // 安全校验：如果该批次任一 revenue_row 的 settlement 已 exported/paid，禁止回滚
  const rows = await prisma.revenueRow.findMany({
    where: { importId },
    select: { id: true },
  })
  const rowIds = rows.map((r) => r.id)

  const lockedSettlements = await prisma.settlement.count({
    where: {
      revenueRowId: { in: rowIds },
      settleStatus: { in: ['exported', 'paid'] },
    },
  })
  if (lockedSettlements > 0) {
    return err(
      `该批次有 ${lockedSettlements} 条结算已导出/已付款，无法回滚。请先处理相关结算。`,
      409,
    )
  }

  // 事务回滚：settlements → revenue_rows → revenue_import
  const result = await prisma.$transaction(async (tx) => {
    const delSettlements = await tx.settlement.deleteMany({
      where: { revenueRowId: { in: rowIds } },
    })
    const delRows = await tx.revenueRow.deleteMany({
      where: { importId },
    })
    await tx.revenueImport.delete({ where: { id: importId } })
    return { settlements: delSettlements.count, rows: delRows.count }
  })

  try {
    await logAdminAction(request, {
      action: 'rollback_revenue_import',
      targetType: 'revenue_import',
      targetId: importId,
      detail: {
        fileName: record.fileName,
        platform: record.platform,
        period: record.period,
        rollback: result,
      },
    })
  } catch { /* 日志失败不阻断 */ }

  return ok(result)
})

export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.revenue.view')
  if ('error' in auth) return auth.error

  const { id } = await params
  const importId = parseInt(id, 10)
  if (isNaN(importId)) return err('无效的 ID')

  // 返回分类详情（原 /detail 路由逻辑，已合并）
  const rows = await prisma.revenueRow.findMany({
    where: { importId },
    include: { mapping: { include: { creator: { select: { name: true, realName: true } } } } },
    orderBy: { id: 'asc' },
  })

  const idConfirmed = rows
    .filter((r) => r.matchStatus === 'matched')
    .map((r) => ({
      id: r.id,
      songName: r.songName,
      month: r.period,
      douyinRevenue: parseFloat(r.douyinRevenue.toString()),
      qishuiRevenue: parseFloat(r.qishuiRevenue.toString()),
      matchStatus: r.matchStatus,
    }))

  const namePending = rows
    .filter((r) => r.matchStatus === 'suspect')
    .map((r) => ({
      id: r.id,
      songName: r.songName,
      qishuiSongId: r.qishuiSongId,
      matchedUserName: r.mapping?.creator?.realName ?? r.mapping?.creator?.name ?? null,
      douyinRevenue: parseFloat(r.douyinRevenue.toString()),
      qishuiRevenue: parseFloat(r.qishuiRevenue.toString()),
      totalRevenue: parseFloat(r.totalRevenue.toString()),
      matchStatus: r.matchStatus,
    }))

  const unmatched = rows
    .filter((r) => r.matchStatus === 'unmatched')
    .map((r) => ({
      id: r.id,
      songName: r.songName,
      qishuiSongId: r.qishuiSongId,
      totalRevenue: parseFloat(r.totalRevenue.toString()),
      matchStatus: r.matchStatus,
    }))

  return ok({ idConfirmed, namePending, unmatched })
})
