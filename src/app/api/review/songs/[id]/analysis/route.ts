import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'
import { analyzeSong, type AudioFeatures } from '@/lib/ai-analysis'

/** 获取歌曲的 AI 预分析报告 */
export const GET = safeHandler(async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'reviewer') return err('无权限', 403)

  const { id } = await context.params
  const songId = parseInt(id, 10)
  if (isNaN(songId)) return err('无效的歌曲 ID')

  const song = await prisma.platformSong.findUnique({
    where: { id: songId },
    select: {
      title: true,
      genre: true,
      bpm: true,
      aiTools: true,
      styleDesc: true,
      audioFeatures: true,
    },
  })

  if (!song) return err('歌曲不存在', 404)

  const analysis = await analyzeSong({
    title: song.title,
    genre: song.genre,
    bpm: song.bpm,
    aiTools: song.aiTools,
    styleDesc: song.styleDesc,
    audioFeatures: (song.audioFeatures as unknown as AudioFeatures) || null,
  })

  return ok(analysis)
})
