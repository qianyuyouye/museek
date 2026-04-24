import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'

export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission(request, 'admin.songs.view')
  if ('error' in auth) return auth.error

  const { id } = await params
  const songId = parseInt(id, 10)
  if (isNaN(songId)) return err('无效的歌曲 ID')

  const song = await prisma.platformSong.findUnique({
    where: { id: songId },
    select: {
      id: true,
      title: true,
      copyrightCode: true,
      isrc: true,
      status: true,
      distributions: {
        select: {
          id: true,
          platform: true,
          status: true,
          submittedAt: true,
          liveDate: true,
          url: true,
        },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!song) return err('歌曲不存在', 404)

  return ok(song)
})
