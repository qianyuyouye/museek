import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'

/**
 * GET /api/creator/dashboard
 * 聚合创作者首页所需数据（替代原来 7 个独立请求）
 */
export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'creator') return err('无权限', 403)

  // 1. 作品统计
  const [songs, songTotal] = await Promise.all([
    prisma.platformSong.findMany({
      where: { userId },
      select: { id: true, title: true, status: true, score: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.platformSong.count({ where: { userId } }),
  ])

  const scoredSongs = songs.filter((s) => s.score != null)
  const avgScore =
    scoredSongs.length > 0
      ? scoredSongs.reduce((a, s) => a + (s.score as number), 0) / scoredSongs.length
      : null

  // 2. 收益统计
  const settlements = await prisma.settlement.findMany({
    where: { creatorId: userId },
    select: { settleStatus: true, creatorAmount: true },
  })
  const totalEarnings = settlements.reduce(
    (a, s) => a + parseFloat(s.creatorAmount.toString()),
    0,
  )

  // 3. 最近通知（5条）
  const notifications = await prisma.notification.findMany({
    where: { userId },
    select: { id: true, type: true, title: true, read: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  // 4. 未提交作业
  const userGroups = await prisma.userGroup.findMany({
    where: { userId },
    select: { groupId: true },
  })
  const groupIds = userGroups.map((ug) => ug.groupId)
  const assignments = await prisma.assignment.findMany({
    where: { groupId: { in: groupIds }, status: 'active' },
    select: {
      id: true,
      title: true,
      deadline: true,
    },
  })
  const submissionAssignIds = await prisma.assignmentSubmission.findMany({
    where: { userId, assignmentId: { in: assignments.map((a) => a.id) } },
    select: { assignmentId: true },
  })
  const submittedIds = new Set(submissionAssignIds.map((s) => s.assignmentId))
  const unsubmitted = assignments.filter(
    (a) => !submittedIds.has(a.id),
  )

  // 5. 热门课程（按 views 排序，3条）
  const courses = await prisma.cmsContent.findMany({
    where: { status: 'published' },
    select: { id: true, title: true, category: true, cover: true, views: true },
    orderBy: { views: 'desc' },
    take: 3,
  })
  const totalCourses = await prisma.cmsContent.count({
    where: { status: 'published' },
  })

  // 6. 学习进度
  const learningRecords = await prisma.learningRecord.findMany({
    where: { userId },
    select: { contentId: true, progress: true, completedAt: true },
  })
  const learnedCourses = learningRecords.filter((r) => r.completedAt != null).length

  return ok({
    songs: {
      count: songTotal,
      avgScore,
      recent: songs.map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        score: s.score,
      })),
    },
    revenue: { totalEarnings },
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    assignments: {
      unsubmitted: unsubmitted.map((a) => ({
        id: a.id,
        title: a.title,
        deadline: a.deadline?.toISOString() ?? null,
      })),
    },
    courses: {
      hot: courses.map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        cover: c.cover,
        views: c.views,
      })),
      total: totalCourses,
    },
    learning: {
      completed: learnedCourses,
      total: totalCourses,
    },
  })
})
