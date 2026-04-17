import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { loadRevenueRules, resolveCommissionRatio } from './commission'

export interface BackfillResult {
  created: number
  skipped: number
  reason?: string
}

/**
 * 当映射状态变为 confirmed 时，扫描该 qishuiSongId 下尚未生成 settlement 的 revenue_rows，
 * 批量按 PRD §6.2 规则生成 settlement，并把 revenue_rows.matchStatus / mappingId 同步到匹配态。
 *
 * 幂等：仅处理 matchStatus in (suspect, unmatched) 且 settlement 不存在的行；
 *      irrelevant / 已 matched 的行会被跳过。
 */
export async function backfillSettlements(
  prisma: PrismaClient,
  mappingId: number,
): Promise<BackfillResult> {
  const mapping = await prisma.songMapping.findUnique({
    where: { id: mappingId },
    select: {
      id: true,
      qishuiSongId: true,
      status: true,
      creatorId: true,
      platformSongId: true,
    },
  })

  if (!mapping) return { created: 0, skipped: 0, reason: 'mapping 不存在' }
  if (mapping.status !== 'confirmed') {
    return { created: 0, skipped: 0, reason: '映射未处于 confirmed 状态，跳过回溯' }
  }
  if (!mapping.creatorId) {
    return { created: 0, skipped: 0, reason: '映射缺少 creatorId，跳过回溯' }
  }

  // 候选行：同一 qishuiSongId、尚未 matched、且没有关联 settlement
  const rows = await prisma.revenueRow.findMany({
    where: {
      qishuiSongId: mapping.qishuiSongId,
      matchStatus: { in: ['suspect', 'unmatched'] },
      settlement: null,
    },
    select: {
      id: true,
      qishuiSongId: true,
      songName: true,
      period: true,
      douyinRevenue: true,
      qishuiRevenue: true,
      totalRevenue: true,
    },
  })

  if (rows.length === 0) return { created: 0, skipped: 0 }

  const rules = await loadRevenueRules(prisma)

  const settlements: Prisma.SettlementCreateManyInput[] = []
  for (const r of rows) {
    const ratio = await resolveCommissionRatio(
      prisma,
      { creatorId: mapping.creatorId, songId: mapping.platformSongId ?? null },
      rules,
    )
    settlements.push({
      revenueRowId: r.id,
      qishuiSongId: r.qishuiSongId,
      songName: r.songName,
      period: r.period,
      douyinRevenue: r.douyinRevenue,
      qishuiRevenue: r.qishuiRevenue,
      totalRevenue: r.totalRevenue,
      creatorId: mapping.creatorId,
      platformRatio: ratio.platformRatio,
      creatorRatio: ratio.creatorRatio,
      creatorAmount: r.totalRevenue.mul(ratio.creatorRatio),
      settleStatus: 'pending',
    })
  }

  const rowIds = rows.map((r) => r.id)

  // 事务：插入 settlements + 把对应 revenue_rows 切到 matched 并指向 mapping
  await prisma.$transaction([
    prisma.settlement.createMany({ data: settlements, skipDuplicates: true }),
    prisma.revenueRow.updateMany({
      where: { id: { in: rowIds } },
      data: { matchStatus: 'matched', mappingId: mapping.id },
    }),
  ])

  return { created: settlements.length, skipped: 0 }
}
