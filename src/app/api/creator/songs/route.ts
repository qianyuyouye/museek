import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { SongStatus } from '@prisma/client'

const VALID_STATUSES: Set<string> = new Set(Object.values(SongStatus))

export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'creator') return err('无权限', 403)

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const status = searchParams.get('status')

  if (status && status !== 'all' && !VALID_STATUSES.has(status)) {
    return err('无效的状态值')
  }

  const where = {
    userId,
    ...(status && status !== 'all' ? { status: status as SongStatus } : {}),
  }

  const [songs, total] = await Promise.all([
    prisma.platformSong.findMany({
      where,
      include: {
        reviews: {
          select: {
            id: true,
            totalScore: true,
            recommendation: true,
            comment: true,
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
            url: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.platformSong.count({ where }),
  ])

  const list = songs.map((s) => ({
    id: s.id,
    copyrightCode: s.copyrightCode,
    title: s.title,
    aiTools: s.aiTools,
    genre: s.genre,
    bpm: s.bpm,
    source: s.source,
    assignmentId: s.assignmentId,
    score: s.score,
    isrc: s.isrc,
    status: s.status,
    likeCount: s.likeCount,
    reviews: s.reviews,
    distributions: s.distributions,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }))

  return ok({ list, total, page, pageSize })
})
