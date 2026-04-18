import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'
import { SongStatus } from '@prisma/client'

const VALID_STATUSES: Set<string> = new Set(Object.values(SongStatus))

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const status = searchParams.get('status')
  const userId = searchParams.get('userId')
  const genre = searchParams.get('genre')
  const aiTool = searchParams.get('aiTool')
  const search = searchParams.get('search')?.trim()
  const minScore = searchParams.get('minScore')
  const maxScore = searchParams.get('maxScore')

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
  if (genre) where.genre = genre
  // AI 工具存在 JSON 数组，用 array_contains
  if (aiTool) (where as { aiTools?: unknown }).aiTools = { array_contains: aiTool }
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { copyrightCode: { contains: search } },
      { user: { is: { name: { contains: search } } } },
    ]
  }
  if (minScore || maxScore) {
    const scoreRange: Record<string, number> = {}
    if (minScore) {
      const v = parseInt(minScore, 10)
      if (!isNaN(v)) scoreRange.gte = v
    }
    if (maxScore) {
      const v = parseInt(maxScore, 10)
      if (!isNaN(v)) scoreRange.lte = v
    }
    if (Object.keys(scoreRange).length) where.score = scoreRange
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
