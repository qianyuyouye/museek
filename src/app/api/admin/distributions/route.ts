import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, safeHandler} from '@/lib/api-utils'
import { getEnabledPlatforms } from '@/lib/platforms'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.distributions.view')
  if ('error' in auth) return auth.error

  const platforms = await getEnabledPlatforms()
  const platformSet = new Set(platforms)

  const songs = await prisma.platformSong.findMany({
    where: { status: 'published' },
    select: {
      id: true,
      title: true,
      coverUrl: true,
      distributions: {
        select: { platform: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const matrix: Record<number, Record<string, string>> = {}
  const songList = songs.map((s) => {
    const row: Record<string, string> = {}
    for (const p of platforms) row[p] = 'none'
    for (const d of s.distributions) {
      if (platformSet.has(d.platform)) row[d.platform] = d.status
    }
    matrix[s.id] = row
    return { id: s.id, title: s.title, cover: s.coverUrl }
  })

  return ok({ songs: songList, platforms, matrix })
})
