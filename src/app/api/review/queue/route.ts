import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, parsePagination, safeHandler} from '@/lib/api-utils'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'reviewer') return err('无权限', 403)

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const genre = searchParams.get('genre')
  const search = searchParams.get('search')

  const where: Record<string, unknown> = { status: 'pending_review' as const }

  if (genre) {
    where.genre = genre
  }

  if (search) {
    where.user = { name: { contains: search } }
  }

  const [songs, total] = await Promise.all([
    prisma.platformSong.findMany({
      where,
      include: { user: { select: { name: true } } },
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
    userId: s.userId,
    studentName: s.user.name,
    genre: s.genre,
    bpm: s.bpm,
    audioUrl: s.audioUrl,
    coverUrl: s.coverUrl,
    source: s.source,
    assignmentId: s.assignmentId,
    createdAt: s.createdAt,
  }))

  return ok({ list, total, page, pageSize })
})
