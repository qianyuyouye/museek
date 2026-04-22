'use client'

import { useApi } from '@/lib/use-api'
import { pageWrap, textPageTitle, cardCls } from '@/lib/ui-tokens'
import { BookOpen, Timer, Award } from 'lucide-react'

interface Badge {
  id: string
  icon: string
  name: string
  earned: boolean
}

interface AchievementsData {
  totalCourses: number
  completedCount: number
  totalDurationSeconds: number
  totalDurationHours: number
  weekDurationSeconds: number
  weekDurationHours: number
  maxStreakDays: number
  badges: Badge[]
}

// 学习路径阶段映射（按 cms category 聚合真实进度）
const PATH_STAGES = [
  { stage: '入门', desc: 'AI音乐工具基础操作', categories: ['AI工具教程'], color: 'var(--green2)' },
  { stage: '进阶', desc: '基础乐理与音乐流派', categories: ['基础乐理', '音乐流派'], color: 'var(--accent2)' },
  { stage: '高阶', desc: 'Prompt工程与版权知识', categories: ['版权知识'], color: 'var(--orange)' },
]

interface LearningRecordItem {
  id: number
  progress: number
  duration: number
  completedAt: string | null
  lastViewedAt: string
  content: { id: number; title: string; category: string; type: 'video' | 'article'; cover: string | null }
}

export default function CreatorLearning() {
  const { data: achievements, loading: loadingAch } = useApi<AchievementsData>('/api/learning/achievements')
  const { data: recordsData, loading: loadingRec } = useApi<{ list: LearningRecordItem[] }>('/api/learning')

  if (loadingAch || loadingRec) {
    return (
      <div className={pageWrap}>
        <div className="flex items-center justify-center py-20 text-sm text-[var(--text3)]">加载中...</div>
      </div>
    )
  }

  const totalCourses = achievements?.totalCourses ?? 0
  const completed = achievements?.completedCount ?? 0
  const weekHours = achievements?.weekDurationHours ?? 0
  const earnedBadges = achievements?.badges.filter(b => b.earned).length ?? 0
  const records = recordsData?.list ?? []

  const STATS = [
    { icon: <BookOpen size={20} />, label: '已完成课程', value: `${completed}/${totalCourses}`, color: 'var(--accent2)', bg: 'rgba(79,70,229,0.08)' },
    { icon: <Timer size={20} />, label: '本周学习', value: `${weekHours}h`, color: 'var(--green)', bg: 'rgba(6,148,162,0.08)' },
    { icon: <Award size={20} />, label: '成就徽章', value: String(earnedBadges), color: 'var(--orange)', bg: 'rgba(217,119,6,0.08)' },
  ]

  // 按阶段聚合：progress 平均值（该阶段下所有属于 categories 的课程 progress 取均值）
  const stageProgress = PATH_STAGES.map(s => {
    const stageRecords = records.filter(r => s.categories.includes(r.content.category))
    const avg = stageRecords.length === 0
      ? 0
      : Math.round(stageRecords.reduce((sum, r) => sum + r.progress, 0) / stageRecords.length)
    return { ...s, progress: avg }
  })

  return (
    <div className={pageWrap}>
      {/* Header */}
      <div>
        <h1 className={textPageTitle}>我的学习</h1>
        <p className="mt-1 text-sm text-[var(--text2)]">跟踪你的AI音乐学习进度</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className={cardCls}
            style={{ position: 'relative', overflow: 'hidden' }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: s.color,
                borderRadius: '12px 12px 0 0',
              }}
            />
            <div className="flex items-center gap-3 mt-1">
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: s.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Learning Path + Badges */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Learning Path */}
        <div className={cardCls}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>📈 学习路径</h3>
          {stageProgress.map((s) => (
            <div key={s.stage} style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  {s.stage} — {s.desc}
                </span>
                <span style={{ color: s.color }}>{s.progress}%</span>
              </div>
              <div
                style={{
                  height: 6,
                  background: 'var(--bg4)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${s.progress}%`,
                    background: s.color,
                    borderRadius: 3,
                    transition: 'width .5s',
                  }}
                />
              </div>
            </div>
          ))}
          {records.length === 0 && (
            <p className="text-xs text-[var(--text3)] mt-4">尚未开始学习任何课程，前往<a href="/creator/courses" className="text-[var(--accent)] underline mx-1">课程中心</a>开启学习之旅。</p>
          )}
        </div>

        {/* Achievement Badges */}
        <div className={cardCls}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>🏅 成就徽章</h3>
          <div className="grid grid-cols-2 gap-3">
            {(achievements?.badges ?? []).map((a) => (
              <div
                key={a.id}
                style={{
                  textAlign: 'center',
                  padding: 12,
                  background: 'var(--bg4)',
                  borderRadius: 8,
                  opacity: a.earned ? 1 : 0.35,
                }}
              >
                <div style={{ fontSize: 24 }}>{a.icon}</div>
                <div
                  style={{
                    fontSize: 11,
                    marginTop: 4,
                    color: a.earned ? 'var(--text)' : 'var(--text3)',
                  }}
                >
                  {a.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
