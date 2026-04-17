import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'

// 徽章规则：id 必须稳定（用于前端 mapping），threshold 用于解锁判定
const BADGE_RULES: Array<{
  id: string
  icon: string
  name: string
  type: 'completed' | 'duration_hours' | 'streak_days'
  threshold: number
}> = [
  { id: 'complete_5', icon: '📚', name: '完成5课', type: 'completed', threshold: 5 },
  { id: 'complete_30', icon: '🎓', name: '完成30课', type: 'completed', threshold: 30 },
  { id: 'duration_10h', icon: '⏱', name: '学习10小时', type: 'duration_hours', threshold: 10 },
  { id: 'duration_50h', icon: '💎', name: '学习50小时', type: 'duration_hours', threshold: 50 },
  { id: 'streak_7', icon: '🔥', name: '连续7天', type: 'streak_days', threshold: 7 },
  { id: 'streak_30', icon: '🚀', name: '连续30天', type: 'streak_days', threshold: 30 },
]

/** 根据日期集合计算最长连续天数 */
function calcMaxStreak(daysSet: Set<string>): number {
  if (daysSet.size === 0) return 0
  const days = Array.from(daysSet).sort()
  let max = 1
  let cur = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1])
    const curDate = new Date(days[i])
    const diff = (curDate.getTime() - prev.getTime()) / 86400000
    if (Math.round(diff) === 1) {
      cur += 1
      if (cur > max) max = cur
    } else {
      cur = 1
    }
  }
  return max
}

export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'creator') return err('无权限', 401)

  const records = await prisma.learningRecord.findMany({
    where: { userId },
    select: { duration: true, completedAt: true, lastViewedAt: true },
  })

  const totalDurationSeconds = records.reduce((sum, r) => sum + r.duration, 0)
  const totalDurationHours = totalDurationSeconds / 3600
  const completedCount = records.filter(r => r.completedAt !== null).length

  // 本周学习时长（最近 7 天内 lastViewedAt 命中的 record 时长近似）
  const weekAgo = Date.now() - 7 * 86400000
  const weekDurationSeconds = records
    .filter(r => r.lastViewedAt.getTime() >= weekAgo)
    .reduce((sum, r) => sum + r.duration, 0)

  // 连续学习天数：按 lastViewedAt 的日期去重算最大连续段
  const daysSet = new Set<string>()
  for (const r of records) {
    const d = new Date(r.lastViewedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    daysSet.add(key)
  }
  const maxStreakDays = calcMaxStreak(daysSet)

  // 总课程数（published）
  const totalCourses = await prisma.cmsContent.count({ where: { status: 'published' } })

  const badges = BADGE_RULES.map(b => {
    let earned = false
    if (b.type === 'completed') earned = completedCount >= b.threshold
    else if (b.type === 'duration_hours') earned = totalDurationHours >= b.threshold
    else if (b.type === 'streak_days') earned = maxStreakDays >= b.threshold
    return { id: b.id, icon: b.icon, name: b.name, earned }
  })

  return ok({
    totalCourses,
    completedCount,
    totalDurationSeconds,
    totalDurationHours: Math.round(totalDurationHours * 10) / 10,
    weekDurationSeconds,
    weekDurationHours: Math.round((weekDurationSeconds / 3600) * 10) / 10,
    maxStreakDays,
    badges,
  })
})
