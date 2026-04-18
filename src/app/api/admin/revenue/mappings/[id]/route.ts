import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { backfillSettlements } from '@/lib/revenue-backfill'

export const PUT = safeHandler(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request)
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
      const updated = await prisma.songMapping.update({
        where: { id: mappingId },
        data: {
          creatorId,
          ...(platformSongId !== undefined && { platformSongId }),
        },
      })
      // 如果该 mapping 已处于 confirmed 且具备 creatorId，本次 bind 相当于补齐信息，
      // 同步回溯历史 revenue_rows 生成 settlement
      let backfill
      if (updated.status === 'confirmed' && updated.creatorId) {
        backfill = await backfillSettlements(prisma, mappingId)
      }
      await logAdminAction(request, {
        action: 'bind_mapping',
        targetType: 'song_mapping',
        targetId: mappingId,
        detail: {
          qishuiSongId: existing.qishuiSongId,
          creatorId,
          platformSongId: platformSongId ?? null,
          backfill: backfill ?? null,
        },
      })
      return ok(backfill ? { ...updated, backfill } : updated)
    }

    default:
      return err('无效的 action，支持 confirm/reject/bind')
  }
})
