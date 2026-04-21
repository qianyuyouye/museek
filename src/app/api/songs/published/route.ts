import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, parsePagination, safeHandler } from '@/lib/api-utils'
import { toSignedUrl } from '@/lib/signed-url'

/** 公开接口：获取已发行歌曲列表（作品广场用） */
export const GET = safeHandler(async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const { skip, pageSize } = parsePagination(searchParams)

  const where = { status: 'published' as const }

  const [list, total] = await Promise.all([
    prisma.platformSong.findMany({
      where,
      include: { user: { select: { id: true, name: true, realName: true } } },
      orderBy: { likeCount: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.platformSong.count({ where }),
  ])

  return ok({
    list: await Promise.all(list.map(async s => ({
      id: s.id,
      title: s.title,
      genre: s.genre,
      bpm: s.bpm,
      score: s.score,
      copyrightCode: s.copyrightCode,
      likeCount: s.likeCount,
      coverUrl: await toSignedUrl(s.coverUrl),
      authorName: s.user?.realName || s.user?.name || '未知',
      createdAt: s.createdAt,
    }))),
    total,
  })
})
