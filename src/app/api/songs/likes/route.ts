import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, safeHandler } from '@/lib/api-utils'

/** GET /api/songs/likes — 获取当前用户已点赞的歌曲 ID 列表 */
export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId } = getCurrentUser(request)
  if (!userId) return ok({ ids: [] as number[] })

  const records = await prisma.likeRecord.findMany({
    where: { userId },
    select: { songId: true },
  })

  return ok({ ids: records.map((r) => r.songId) as number[] })
})
