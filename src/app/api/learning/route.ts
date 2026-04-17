import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'

// GET /api/learning — 当前创作者的学习记录列表（按最近学习倒序）
export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'creator') return err('无权限', 401)

  const records = await prisma.learningRecord.findMany({
    where: { userId },
    orderBy: { lastViewedAt: 'desc' },
    include: {
      content: {
        select: { id: true, title: true, category: true, type: true, cover: true },
      },
    },
  })

  return ok({ list: records })
})

// POST /api/learning — upsert 学习进度（心跳/进度上报）
// body: { contentId: number, progressDelta?: number (0-100), durationDelta?: number (秒), completed?: boolean }
export const POST = safeHandler(async function POST(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'creator') return err('无权限', 401)

  const body = await request.json().catch(() => null) as {
    contentId?: number
    progress?: number
    durationDelta?: number
    completed?: boolean
  } | null
  if (!body || !body.contentId) return err('缺少 contentId')

  const contentId = Number(body.contentId)
  if (isNaN(contentId)) return err('contentId 非法')

  const content = await prisma.cmsContent.findUnique({
    where: { id: contentId },
    select: { id: true, status: true },
  })
  if (!content || content.status !== 'published') return err('课程不存在或未发布', 404)

  const durationDelta = Math.max(0, Math.min(3600, Math.floor(body.durationDelta ?? 0)))
  const progress = typeof body.progress === 'number'
    ? Math.max(0, Math.min(100, Math.floor(body.progress)))
    : undefined
  const completed = body.completed === true

  const existing = await prisma.learningRecord.findUnique({
    where: { userId_contentId: { userId, contentId } },
  })

  const nextProgress = progress ?? existing?.progress ?? 0
  const nextDuration = (existing?.duration ?? 0) + durationDelta
  const nextCompletedAt = completed || nextProgress >= 100
    ? (existing?.completedAt ?? new Date())
    : existing?.completedAt ?? null

  const record = await prisma.learningRecord.upsert({
    where: { userId_contentId: { userId, contentId } },
    create: {
      userId,
      contentId,
      progress: nextProgress,
      duration: nextDuration,
      completedAt: nextCompletedAt,
      lastViewedAt: new Date(),
    },
    update: {
      progress: nextProgress,
      duration: nextDuration,
      completedAt: nextCompletedAt,
      lastViewedAt: new Date(),
    },
  })

  return ok({ record })
})
