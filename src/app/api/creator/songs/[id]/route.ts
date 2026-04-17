import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler} from '@/lib/api-utils'

export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'creator') return err('无权限', 403)

  const { id } = await params
  const songId = parseInt(id, 10)
  if (isNaN(songId)) return err('无效的作品ID')

  const song = await prisma.platformSong.findUnique({
    where: { id: songId },
    include: {
      reviews: {
        select: {
          id: true,
          technique: true,
          creativity: true,
          commercial: true,
          totalScore: true,
          comment: true,
          tags: true,
          reviewer: { select: { name: true } },
          reviewedAt: true,
        },
        orderBy: { reviewedAt: 'desc' },
      },
      distributions: {
        select: {
          id: true,
          platform: true,
          status: true,
          liveDate: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          realName: true,
          avatarUrl: true,
        },
      },
    },
  })

  if (!song) return err('作品不存在', 404)
  if (song.userId !== userId) return err('无权限', 403)

  return ok(song)
})
