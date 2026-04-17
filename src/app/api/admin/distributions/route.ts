import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, safeHandler} from '@/lib/api-utils'

const PLATFORMS = ['QQ音乐', '网易云音乐', 'Spotify', 'Apple Music', '酷狗音乐']

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

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
    for (const p of PLATFORMS) {
      row[p] = 'none'
    }
    for (const d of s.distributions) {
      if (PLATFORMS.includes(d.platform)) {
        row[d.platform] = d.status
      }
    }
    matrix[s.id] = row
    return { id: s.id, title: s.title, cover: s.coverUrl }
  })

  return ok({ songs: songList, platforms: PLATFORMS, matrix })
})
