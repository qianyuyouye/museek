import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, err, safeHandler } from '@/lib/api-utils'

export const PUT = safeHandler(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
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
      return ok(updated)
    }

    case 'reject': {
      const updated = await prisma.songMapping.update({
        where: { id: mappingId },
        data: { status: 'irrelevant' },
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
      return ok(updated)
    }

    default:
      return err('无效的 action，支持 confirm/reject/bind')
  }
})
