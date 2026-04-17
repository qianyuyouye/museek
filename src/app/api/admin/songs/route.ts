import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { SongStatus } from '@prisma/client'

const VALID_STATUSES: Set<string> = new Set(Object.values(SongStatus))

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const status = searchParams.get('status')
  const userId = searchParams.get('userId')

  if (status && status !== 'all' && !VALID_STATUSES.has(status)) {
    return err('无效的状态值')
  }

  const where: Record<string, unknown> = {}
  if (status && status !== 'all') where.status = status as SongStatus
  if (userId) {
    const parsedUserId = parseInt(userId, 10)
    if (isNaN(parsedUserId)) return err('无效的用户 ID')
    where.userId = parsedUserId
  }

  const [songs, total, statusCountsRaw] = await Promise.all([
    prisma.platformSong.findMany({
      where,
      include: {
        user: { select: { name: true, agencyContract: true, realNameStatus: true } },
        distributions: { select: { platform: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.platformSong.count({ where }),
    prisma.platformSong.groupBy({
      by: ['status'],
      _count: true,
    }),
  ])

  const statusCounts: Record<string, number> = { all: 0 }
  for (const row of statusCountsRaw) {
    statusCounts[row.status] = row._count
    statusCounts.all += row._count
  }

  const list = songs.map((s) => ({
    id: s.id,
    copyrightCode: s.copyrightCode,
    title: s.title,
    userId: s.userId,
    userName: s.user.name,
    creatorName: s.user.name,
    agencyContract: s.user.agencyContract,
    realNameStatus: s.user.realNameStatus,
    aiTools: s.aiTools,
    genre: s.genre,
    bpm: s.bpm,
    source: s.source,
    assignmentId: s.assignmentId,
    score: s.score,
    isrc: s.isrc,
    status: s.status,
    likeCount: s.likeCount,
    distributions: s.distributions,
    audioUrl: s.audioUrl,
    coverUrl: s.coverUrl,
    createdAt: s.createdAt,
  }))

  return ok({ list, total, page, pageSize, statusCounts })
})
