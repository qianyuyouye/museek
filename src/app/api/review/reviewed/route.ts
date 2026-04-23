import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, parsePagination, safeHandler } from '@/lib/api-utils'
import { toSignedUrl } from '@/lib/signed-url'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'reviewer') return err('无权限', 403)

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)

  const where = { reviewerId: userId }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        song: {
          select: {
            title: true,
            genre: true,
            bpm: true,
            status: true,
            audioUrl: true,
            coverUrl: true,
            aiTools: true,
            lyricist: true,
            composer: true,
            lyrics: true,
            styleDesc: true,
            creationDesc: true,
            contribution: true,
            user: { select: { name: true, realName: true, phone: true } },
          },
        },
      },
      orderBy: { reviewedAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.review.count({ where }),
  ])

  const list = await Promise.all(
    reviews.map(async (r) => ({
      id: r.id,
      songId: r.songId,
      songTitle: r.song.title,
      songGenre: r.song.genre,
      songBpm: r.song.bpm,
      songStatus: r.song.status,
      audioUrl: await toSignedUrl(r.song.audioUrl, userId),
      coverUrl: await toSignedUrl(r.song.coverUrl, userId),
      studentName: r.song.user.realName || r.song.user.name || r.song.user.phone || '未命名',
      technique: r.technique,
      creativity: r.creativity,
      commercial: r.commercial,
      totalScore: r.totalScore,
      recommendation: r.recommendation,
      comment: r.comment,
      reviewedAt: r.reviewedAt,
    })),
  )

  return ok({ list, total, page, pageSize })
})
