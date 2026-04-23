import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'
import { toSignedUrl } from '@/lib/signed-url'

type Params = { params: Promise<{ id: string }> }

export const GET = safeHandler(async function GET(request: NextRequest, { params }: Params) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'reviewer') return err('无权限', 403)

  const { id } = await params
  const reviewId = parseInt(id, 10)
  if (isNaN(reviewId)) return err('无效的评审ID')

  const review = await prisma.review.findFirst({
    where: { id: reviewId, reviewerId: userId },
    include: {
      song: {
        select: {
          id: true,
          title: true,
          genre: true,
          bpm: true,
          status: true,
          audioUrl: true,
          coverUrl: true,
          aiTools: true,
          lyricist: true,
          composer: true,
          performer: true,
          albumName: true,
          albumArtist: true,
          isrc: true,
          lyrics: true,
          styleDesc: true,
          creationDesc: true,
          contribution: true,
          copyrightCode: true,
          createdAt: true,
          user: { select: { name: true, realName: true, phone: true } },
        },
      },
    },
  })

  if (!review) return err('评审记录不存在', 404)

  return ok({
    reviewId: review.id,
    songId: review.songId,
    songTitle: review.song.title,
    songGenre: review.song.genre,
    songBpm: review.song.bpm,
    songStatus: review.song.status,
    audioUrl: await toSignedUrl(review.song.audioUrl, userId),
    coverUrl: await toSignedUrl(review.song.coverUrl, userId),
    studentName: review.song.user.realName || review.song.user.name || review.song.user.phone || '未命名',
    performer: review.song.performer,
    lyricist: review.song.lyricist,
    composer: review.song.composer,
    albumName: review.song.albumName,
    albumArtist: review.song.albumArtist,
    isrc: review.song.isrc,
    lyrics: review.song.lyrics,
    styleDesc: review.song.styleDesc,
    creationDesc: review.song.creationDesc,
    contribution: review.song.contribution,
    copyrightCode: review.song.copyrightCode,
    songCreatedAt: review.song.createdAt,
    technique: review.technique,
    creativity: review.creativity,
    commercial: review.commercial,
    totalScore: review.totalScore,
    recommendation: review.recommendation,
    comment: review.comment,
    reviewedAt: review.reviewedAt,
  })
})
