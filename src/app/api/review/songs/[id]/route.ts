import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'
import { toSignedUrl } from '@/lib/signed-url'

type Params = { params: Promise<{ id: string }> }

export const GET = safeHandler(async function GET(request: NextRequest, { params }: Params) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'reviewer') return err('无权限', 403)

  const { id } = await params
  const songId = parseInt(id, 10)
  if (isNaN(songId)) return err('无效的歌曲 ID')

  const song = await prisma.platformSong.findUnique({
    where: { id: songId },
    include: { user: { select: { name: true, realName: true, phone: true } } },
  })

  if (!song) return err('歌曲不存在', 404)
  if (song.status !== 'pending_review') return err('该歌曲不在评审队列中', 403)

  return ok({
    id: song.id,
    title: song.title,
    userId: song.userId,
    coverUrl: await toSignedUrl(song.coverUrl, userId),
    audioUrl: await toSignedUrl(song.audioUrl, userId),
    genre: song.genre,
    bpm: song.bpm,
    aiTools: song.aiTools,
    performer: song.performer,
    lyricist: song.lyricist,
    composer: song.composer,
    albumName: song.albumName,
    albumArtist: song.albumArtist,
    isrc: song.isrc,
    lyrics: song.lyrics,
    styleDesc: song.styleDesc,
    creationDesc: song.creationDesc,
    contribution: song.contribution,
    status: song.status,
    version: song.version,
    studentName: song.user.realName || song.user.name || song.user.phone || '未命名',
    createdAt: song.createdAt,
  })
})
