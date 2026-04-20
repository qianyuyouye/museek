import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { backfillSettlements } from '@/lib/revenue-backfill'

export const PUT = safeHandler(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.revenue.operate')
  if ('error' in auth) return auth.error

  const { id } = await params
  const mappingId = parseInt(id, 10)
  if (isNaN(mappingId)) return err('无效的 ID')

  const existing = await prisma.songMapping.findUnique({ where: { id: mappingId } })
  if (!existing) return err('映射记录不存在', 404)

  const body = await request.json()
  const { action, creatorId, platformSongId } = body

  if (!action) return err('action 必填')

  switch (action) {
    case 'confirm': {
      const updated = await prisma.songMapping.update({
        where: { id: mappingId },
        data: {
          status: 'confirmed',
          confirmedAt: new Date(),
          confirmedBy: auth.userId,
        },
      })
      const backfill = await backfillSettlements(prisma, mappingId)
      await logAdminAction(request, {
        action: 'confirm_mapping',
        targetType: 'song_mapping',
        targetId: mappingId,
        detail: { qishuiSongId: existing.qishuiSongId, backfill },
      })
      return ok({ ...updated, backfill })
    }

    case 'reject': {
      const updated = await prisma.songMapping.update({
        where: { id: mappingId },
        data: { status: 'irrelevant' },
      })
      await logAdminAction(request, {
        action: 'reject_mapping',
        targetType: 'song_mapping',
        targetId: mappingId,
        detail: { qishuiSongId: existing.qishuiSongId },
      })
      return ok(updated)
    }

    case 'bind': {
      if (!creatorId) return err('bind 操作需要 creatorId')
      // bind 时一并自动 confirm（PRD §6.4 操作矩阵：指定创作者/关联作品后即 confirmed + 触发回溯）
      const updated = await prisma.songMapping.update({
        where: { id: mappingId },
        data: {
          creatorId,
          ...(platformSongId !== undefined && { platformSongId }),
          status: 'confirmed',
          confirmedAt: new Date(),
          confirmedBy: auth.userId,
        },
      })
      const backfill = updated.creatorId ? await backfillSettlements(prisma, mappingId) : null
      await logAdminAction(request, {
        action: 'bind_mapping',
        targetType: 'song_mapping',
        targetId: mappingId,
        detail: {
          qishuiSongId: existing.qishuiSongId,
          creatorId,
          platformSongId: platformSongId ?? null,
          backfill,
        },
      })
      return ok({ ...updated, backfill })
    }

    default:
      return err('无效的 action，支持 confirm/reject/bind')
  }
})
