import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, err, safeHandler } from '@/lib/api-utils'

export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const importId = parseInt(id, 10)
  if (isNaN(importId)) return err('无效的 ID')

  const record = await prisma.revenueImport.findUnique({
    where: { id: importId },
  })
  if (!record) return err('导入记录不存在', 404)

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
