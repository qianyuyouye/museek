import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, safeHandler} from '@/lib/api-utils'
import { Prisma } from '@prisma/client'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  // 只统计 mapping status='confirmed' 的 revenueRows
  const confirmedFilter: Prisma.RevenueRowWhereInput = {
    mapping: { status: 'confirmed' },
  }

  // 总体聚合
  const totals = await prisma.revenueRow.aggregate({
    where: confirmedFilter,
    _sum: {
      totalRevenue: true,
      douyinRevenue: true,
      qishuiRevenue: true,
    },
  })

  // 关联创作者数量
  const creatorCountResult = await prisma.revenueRow.findMany({
    where: {
      ...confirmedFilter,
      mapping: { status: 'confirmed', creatorId: { not: null } },
    },
    select: { mapping: { select: { creatorId: true } } },
    distinct: ['mappingId'],
  })
  const creatorIds = new Set(
    creatorCountResult
      .map((r) => r.mapping?.creatorId)
      .filter((id): id is number => id !== null)
  )

  // byCreator: 按 creatorId 分组 — 使用原生 SQL，因为 Prisma groupBy 不支持跨关联字段分组
  const byCreator = await prisma.$queryRaw<
    { creatorId: number; creatorName: string | null; totalRevenue: number; douyinRevenue: number; qishuiRevenue: number }[]
  >(Prisma.sql`
    SELECT
      sm.creator_id AS creatorId,
      u.name AS creatorName,
      CAST(SUM(rr.total_revenue) AS DECIMAL(14,2)) + 0 AS totalRevenue,
      CAST(SUM(rr.douyin_revenue) AS DECIMAL(14,2)) + 0 AS douyinRevenue,
      CAST(SUM(rr.qishui_revenue) AS DECIMAL(14,2)) + 0 AS qishuiRevenue
    FROM revenue_rows rr
    JOIN song_mappings sm ON rr.mapping_id = sm.id
    LEFT JOIN users u ON sm.creator_id = u.id
    WHERE sm.status = 'confirmed' AND sm.creator_id IS NOT NULL
    GROUP BY sm.creator_id, u.name
    ORDER BY totalRevenue DESC
  `)

  // bySong: 按 qishuiSongName 分组
  const bySong = await prisma.$queryRaw<
    { songName: string | null; qishuiSongId: string; totalRevenue: number; douyinRevenue: number; qishuiRevenue: number }[]
  >(Prisma.sql`
    SELECT
      rr.song_name AS songName,
      rr.qishui_song_id AS qishuiSongId,
      CAST(SUM(rr.total_revenue) AS DECIMAL(14,2)) + 0 AS totalRevenue,
      CAST(SUM(rr.douyin_revenue) AS DECIMAL(14,2)) + 0 AS douyinRevenue,
      CAST(SUM(rr.qishui_revenue) AS DECIMAL(14,2)) + 0 AS qishuiRevenue
    FROM revenue_rows rr
    JOIN song_mappings sm ON rr.mapping_id = sm.id
    WHERE sm.status = 'confirmed'
    GROUP BY rr.qishui_song_id, rr.song_name
    ORDER BY totalRevenue DESC
  `)

  // byMonth: 按 period 分组
  const byMonth = await prisma.$queryRaw<
    { period: string; totalRevenue: number; douyinRevenue: number; qishuiRevenue: number }[]
  >(Prisma.sql`
    SELECT
      rr.period,
      CAST(SUM(rr.total_revenue) AS DECIMAL(14,2)) + 0 AS totalRevenue,
      CAST(SUM(rr.douyin_revenue) AS DECIMAL(14,2)) + 0 AS douyinRevenue,
      CAST(SUM(rr.qishui_revenue) AS DECIMAL(14,2)) + 0 AS qishuiRevenue
    FROM revenue_rows rr
    JOIN song_mappings sm ON rr.mapping_id = sm.id
    WHERE sm.status = 'confirmed'
    GROUP BY rr.period
    ORDER BY rr.period DESC
  `)

  return ok({
    totalRevenue: parseFloat((totals._sum.totalRevenue ?? 0).toString()),
    douyinRevenue: parseFloat((totals._sum.douyinRevenue ?? 0).toString()),
    qishuiRevenue: parseFloat((totals._sum.qishuiRevenue ?? 0).toString()),
    creatorCount: creatorIds.size,
    byCreator: byCreator.map((r) => ({
      ...r,
      totalRevenue: parseFloat(r.totalRevenue.toString()),
      douyinRevenue: parseFloat(r.douyinRevenue.toString()),
      qishuiRevenue: parseFloat(r.qishuiRevenue.toString()),
    })),
    bySong: bySong.map((r) => ({
      ...r,
      totalRevenue: parseFloat(r.totalRevenue.toString()),
      douyinRevenue: parseFloat(r.douyinRevenue.toString()),
      qishuiRevenue: parseFloat(r.qishuiRevenue.toString()),
    })),
    byMonth: byMonth.map((r) => ({
      ...r,
      totalRevenue: parseFloat(r.totalRevenue.toString()),
      douyinRevenue: parseFloat(r.douyinRevenue.toString()),
      qishuiRevenue: parseFloat(r.qishuiRevenue.toString()),
    })),
  })
})
