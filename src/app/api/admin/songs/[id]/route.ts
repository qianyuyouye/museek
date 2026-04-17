import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, err, safeHandler} from '@/lib/api-utils'

export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const songId = parseInt(id, 10)
  if (isNaN(songId)) return err('无效的歌曲 ID')

  const song = await prisma.platformSong.findUnique({
    where: { id: songId },
    include: {
      user: { select: { id: true, name: true, realName: true, phone: true } },
      reviews: {
        include: { reviewer: { select: { id: true, name: true } } },
        orderBy: { reviewedAt: 'desc' },
      },
      distributions: true,
    },
  })

  if (!song) return err('歌曲不存在', 404)

  return ok(song)
})

export const PUT = safeHandler(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const songId = parseInt(id, 10)
  if (isNaN(songId)) return err('无效的歌曲 ID')

  const song = await prisma.platformSong.findUnique({ where: { id: songId } })
  if (!song) return err('歌曲不存在', 404)

  const body = await request.json()
  const { title, genre, bpm, performer, lyricist, composer, lyrics, styleDesc, albumName, albumArtist, contribution, creationDesc } = body

  const updated = await prisma.platformSong.update({
    where: { id: songId },
    data: {
      ...(title !== undefined && { title }),
      ...(genre !== undefined && { genre }),
      ...(bpm !== undefined && { bpm }),
      ...(performer !== undefined && { performer }),
      ...(lyricist !== undefined && { lyricist }),
      ...(composer !== undefined && { composer }),
      ...(lyrics !== undefined && { lyrics }),
      ...(styleDesc !== undefined && { styleDesc }),
      ...(albumName !== undefined && { albumName }),
      ...(albumArtist !== undefined && { albumArtist }),
      ...(contribution !== undefined && { contribution }),
      ...(creationDesc !== undefined && { creationDesc }),
    },
  })

  return ok(updated)
})
