import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'

/**
 * 评审草稿：切换歌曲 / 刷新页面前，前端主动 POST 暂存。
 * userId + songId 唯一（upsert 覆盖）。
 */

export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'reviewer') return err('无权限', 403)

  const { searchParams } = request.nextUrl
  const songIdRaw = searchParams.get('songId')
  if (songIdRaw) {
    const songId = Number(songIdRaw)
    if (isNaN(songId)) return err('无效的 songId')
    const draft = await prisma.reviewDraft.findUnique({
      where: { userId_songId: { userId, songId } },
    })
    return ok(draft)
  }

  // 列表：当前 reviewer 的所有草稿（最新优先）
  const list = await prisma.reviewDraft.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })
  return ok({ list })
})

export const POST = safeHandler(async function POST(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'reviewer') return err('无权限', 403)

  const body = await request.json()
  const {
    songId, lyrics, melody, arrangement, styleCreativity, commercial, comment, tags, recommendation,
  } = body as {
    songId: number
    lyrics?: number
    melody?: number
    arrangement?: number
    styleCreativity?: number
    commercial?: number
    comment?: string
    tags?: unknown
    recommendation?: string
  }

  if (!songId || isNaN(Number(songId))) return err('songId 无效')

  // 确认歌曲存在并且在 pending_review 状态，否则拒绝存草稿（避免脏数据）
  const song = await prisma.platformSong.findUnique({
    where: { id: Number(songId) },
    select: { status: true },
  })
  if (!song) return err('歌曲不存在', 404)
  if (song.status !== 'pending_review') return err('该歌曲已非评审中状态，无需保存草稿', 400)

  function clampScore(v: unknown): number | undefined {
    if (v === undefined || v === null) return undefined
    const n = Number(v)
    if (isNaN(n)) return undefined
    return Math.max(0, Math.min(100, Math.round(n)))
  }

  const lyricsVal = clampScore(lyrics)
  const melodyVal = clampScore(melody)
  const arrangementVal = clampScore(arrangement)
  const styleCreativityVal = clampScore(styleCreativity)
  const commercialVal = clampScore(commercial)
  const commentVal = typeof comment === 'string' ? comment.slice(0, 5000) : undefined
  const recommendationVal = typeof recommendation === 'string' ? recommendation.slice(0, 30) : undefined
  // Prisma 对 Json? 字段：undefined 表示保持不变；object 表示写值。此处不支持显式写 null。
  const tagsVal = tags !== undefined && tags !== null ? (tags as object) : undefined

  const createData = {
    userId,
    songId: Number(songId),
    lyrics: lyricsVal,
    melody: melodyVal,
    arrangement: arrangementVal,
    styleCreativity: styleCreativityVal,
    commercial: commercialVal,
    comment: commentVal,
    tags: tagsVal,
    recommendation: recommendationVal,
  }
  const updateData = {
    lyrics: lyricsVal,
    melody: melodyVal,
    arrangement: arrangementVal,
    styleCreativity: styleCreativityVal,
    commercial: commercialVal,
    comment: commentVal,
    tags: tagsVal,
    recommendation: recommendationVal,
  }

  const saved = await prisma.reviewDraft.upsert({
    where: { userId_songId: { userId, songId: Number(songId) } },
    update: updateData,
    create: createData,
  })

  return ok(saved)
})

export const DELETE = safeHandler(async function DELETE(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'reviewer') return err('无权限', 403)

  const { searchParams } = request.nextUrl
  const songIdRaw = searchParams.get('songId')
  if (!songIdRaw) return err('songId 必填')
  const songId = Number(songIdRaw)
  if (isNaN(songId)) return err('无效的 songId')

  await prisma.reviewDraft.deleteMany({ where: { userId, songId } })
  return ok()
})
