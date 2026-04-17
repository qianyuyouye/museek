import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'

/** POST /api/songs/:id/like — 切换点赞状态（likeCount +1/-1） */
export const POST = safeHandler(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = getCurrentUser(request)
  if (!userId) return err('未登录', 401)

  const { id } = await params
  const songId = parseInt(id, 10)
  if (isNaN(songId)) return err('无效的歌曲ID')

  // 前端传 liked 表示当前是否已点赞，据此决定 +1 或 -1
  const body = await request.json().catch(() => ({}))
  const liked = (body as { liked?: boolean }).liked ?? false

  // 原子操作，并发安全
  const song = await prisma.platformSong.update({
    where: { id: songId },
    data: { likeCount: liked ? { decrement: 1 } : { increment: 1 } },
    select: { likeCount: true },
  })

  // 防止负数
  if (song.likeCount < 0) {
    await prisma.platformSong.update({ where: { id: songId }, data: { likeCount: 0 } })
    return ok({ liked: !liked, likeCount: 0 })
  }

  return ok({ liked: !liked, likeCount: song.likeCount })
})
