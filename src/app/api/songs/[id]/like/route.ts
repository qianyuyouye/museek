import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'

/**
 * POST /api/songs/:id/like — 切换当前用户对该作品的点赞。
 * 通过 like_records (user_id, song_id) 唯一约束保证幂等：
 * 同一用户多次 POST 不会重复 +1；已点赞再 POST 则取消点赞（-1）。
 */
export const POST = safeHandler(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = getCurrentUser(request)
  if (!userId) return err('未登录', 401)

  const { id } = await params
  const songId = parseInt(id, 10)
  if (isNaN(songId)) return err('无效的歌曲ID')

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.likeRecord.findUnique({
      where: { userId_songId: { userId, songId } },
    })
    if (existing) {
      // 已点赞 → 取消
      await tx.likeRecord.delete({
        where: { userId_songId: { userId, songId } },
      })
      const song = await tx.platformSong.update({
        where: { id: songId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      })
      // 防负数
      if (song.likeCount < 0) {
        const fixed = await tx.platformSong.update({
          where: { id: songId },
          data: { likeCount: 0 },
          select: { likeCount: true },
        })
        return { liked: false, likeCount: fixed.likeCount }
      }
      return { liked: false, likeCount: song.likeCount }
    }
    // 新点赞
    await tx.likeRecord.create({ data: { userId, songId } })
    const song = await tx.platformSong.update({
      where: { id: songId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    })
    return { liked: true, likeCount: song.likeCount }
  })

  return ok(result)
})
