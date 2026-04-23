import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, safeHandler} from '@/lib/api-utils'
import { getEnabledPlatforms } from '@/lib/platforms'
import { toSignedUrl } from '@/lib/signed-url'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.distributions.view')
  if ('error' in auth) return auth.error

  const platforms = await getEnabledPlatforms()
  const platformSet = new Set(platforms)

  // 同时查询已发行和待发行的歌曲（待发行 = ready_to_publish）
  const songs = await prisma.platformSong.findMany({
    where: { status: { in: ['published', 'ready_to_publish', 'reviewed'] } },
    select: {
      id: true,
      title: true,
      coverUrl: true,
      status: true,
      distributions: {
        select: { platform: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const matrix: Record<number, Record<string, string>> = {}
  const songList = await Promise.all(songs.map(async (s) => {
    const row: Record<string, string> = {}
    for (const p of platforms) row[p] = 'none'
    for (const d of s.distributions) {
      if (platformSet.has(d.platform)) row[d.platform] = d.status
    }
    matrix[s.id] = row
    return { id: s.id, title: s.title, cover: await toSignedUrl(s.coverUrl, auth.userId), status: s.status }
  }))

  return ok({ songs: songList, platforms, matrix })
})
