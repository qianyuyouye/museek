'use client'

import Link from 'next/link'
import { useApi } from '@/lib/use-api'
import { pageWrap, textPageTitle, cardCls, btnPrimary } from '@/lib/ui-tokens'
import { Piano, Headphones, Music, BookOpen, Coffee, Scroll, Drum, Lightbulb, Mic, Bookmark, Rocket, ClipboardList, Coins, TrendingUp, User, Bell, Upload, Globe } from 'lucide-react'

// ── Cover helpers (复用课程页逻辑) ────────────────────────────────

const COVER_GRADIENTS: Record<string, string> = {
  '🎹': 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  '🎧': 'linear-gradient(135deg, #2d1b69 0%, #11998e 100%)',
  '🎼': 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  '📖': 'linear-gradient(135deg, #1f1c2c 0%, #928dab 100%)',
  '🥤': 'linear-gradient(135deg, #e44d26 0%, #f7931e 100%)',
  '📜': 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
  '🥁': 'linear-gradient(135deg, #141e30 0%, #243b55 100%)',
  '🎵': 'linear-gradient(135deg, #4a00e0 0%, #8e2de2 100%)',
  '💡': 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)',
  '🎤': 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
  '🔖': 'linear-gradient(135deg, #373b44 0%, #4286f4 100%)',
  '🚀': 'linear-gradient(135deg, #8360c3 0%, #2ebf91 100%)',
}

const COVER_ICONS: Record<string, React.ComponentType<{ size: number; className?: string }>> = {
  '🎹': Piano, '🎧': Headphones, '🎼': Music, '📖': BookOpen,
  '🥤': Coffee, '📜': Scroll, '🥁': Drum, '🎵': Music,
  '💡': Lightbulb, '🎤': Mic, '🔖': Bookmark, '🚀': Rocket,
}

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #1a1a2e 0%, #3a3a5e 100%)'

// ── StatCard ───────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className={`${cardCls} relative overflow-hidden`}>
      <div className="absolute top-0 left-0 right-0 h-[3px] opacity-60" style={{ background: color }} />
      <div className="mb-1.5 text-[var(--text2)]">{icon}</div>
      <div className="text-[26px] font-bold leading-tight" style={{ color }}>{value}</div>
      <div className="text-[13px] text-[var(--text2)] mt-1.5 font-medium">{label}</div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────

export default function CreatorHome() {
  // 聚合接口：一次请求替代原来 7 个
  const { data, loading } = useApi<{
    songs: { count: number; avgScore: number | null }
    revenue: { totalEarnings: number }
    notifications: { id: number; type: string; title: string; read: boolean; createdAt: string }[]
    assignments: { unsubmitted: { id: number; title: string; deadline: string | null }[] }
    courses: { hot: { id: number; title: string; category: string; cover: string | null }[]; total: number }
    learning: { completed: number; total: number }
  }>('/api/creator/dashboard')

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>加载中...</div>

  const songCount = data?.songs?.count ?? 0
  const avgScore =
    data?.songs?.avgScore != null ? data.songs.avgScore.toFixed(1) : '—'
  const totalEarnings = data?.revenue?.totalEarnings ?? 0
  const notifications = data?.notifications ?? []
  const unsubmitted = data?.assignments?.unsubmitted ?? []
  const hotCourses = data?.courses?.hot ?? []
  const totalCourses = data?.courses?.total ?? 0
  const learnedCourses = data?.learning?.completed ?? 0
  const learningProgress = totalCourses > 0 ? `${learnedCourses}/${totalCourses} 课程` : '—'

  return (
    <div className={pageWrap}>
      {/* Header */}
      <div>
        <h1 className={textPageTitle}>首页</h1>
        <p className="mt-1 text-sm text-[var(--text2)]">欢迎回来</p>
      </div>

      {/* 未完成作业提醒 */}
      {unsubmitted.length > 0 && (
        <Link href="/creator/assignments" className="block no-underline">
          <div className={`${cardCls} cursor-pointer`} style={{ background: 'linear-gradient(135deg,rgba(108,92,231,.08),rgba(0,206,201,.05))', border: '1px solid rgba(108,92,231,.2)' }}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <ClipboardList className="text-[var(--accent)]" size={28} />
                <div>
                  <div className="text-[15px] font-semibold text-[var(--text)]">
                    你有 {unsubmitted.length} 个未完成的作业
                  </div>
                  <div className="text-xs text-[var(--text3)] mt-0.5">
                    {unsubmitted.map((a) => a.title).join('、')}
                  </div>
                </div>
              </div>
              <span className={btnPrimary}>去提交 →</span>
            </div>
          </div>
        </Link>
      )}

      {/* 数据概览卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<Music size={28} />} label="我的作品" value={songCount} color="var(--accent2)" />
        <StatCard icon={<TrendingUp size={28} />} label="平均评分" value={avgScore} color="var(--orange)" />
        <StatCard icon={<Coins size={28} />} label="累计收益" value={`¥${totalEarnings.toFixed(0)}`} color="var(--green2)" />
        <StatCard icon={<BookOpen size={28} />} label="学习进度" value={learningProgress} color="var(--pink)" />
      </div>

      {/* 热门课程推荐 */}
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-semibold">热门课程</h3>
          <Link href="/creator/courses" className="text-xs text-[var(--accent2)] no-underline hover:underline">查看全部 →</Link>
        </div>
        {hotCourses.length === 0 ? (
          <div className="text-center py-8 text-[var(--text3)] text-sm">暂无课程</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {hotCourses.map((course) => {
              const isImage = course.cover?.startsWith('/api/files/')
              const IconComp = !isImage ? (COVER_ICONS[course.cover ?? ''] || Music) : null
              return (
                <Link key={course.id} href="/creator/courses" className="no-underline">
                  <div className="rounded-lg bg-[var(--bg3)] border border-[var(--border)] overflow-hidden cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
                    <div className="h-28 overflow-hidden"
                      style={!isImage ? { background: COVER_GRADIENTS[course.cover ?? ''] || DEFAULT_GRADIENT } : undefined}
                    >
                      {isImage ? (
                        <img src={course.cover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <IconComp size={40} className="text-white/40 drop-shadow-md" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-[13px] font-medium text-[var(--text)] truncate">{course.title}</div>
                      <div className="text-[11px] text-[var(--text3)] mt-1">{course.category || '课程'}</div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* 下方两栏 */}
      <div className="grid grid-cols-[2fr_1fr] gap-5">
        {/* 最新动态 */}
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-semibold">最新动态</h3>
            <Link href="/creator/notifications" className="text-xs text-[var(--accent2)] no-underline hover:underline">查看全部 →</Link>
          </div>
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-[var(--text3)] text-sm">暂无动态</div>
          ) : (
            notifications.slice(0, 5).map((n) => (
              <div key={n.id} className="py-3 border-b border-[var(--border)] last:border-b-0 flex justify-between items-center">
                <div className="flex items-center gap-2 min-w-0">
                  {!n.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)] flex-shrink-0" />
                  )}
                  <span className="text-xs text-[var(--accent2)] flex-shrink-0">[{n.type}]</span>
                  <span className="text-[13px] text-[var(--text)] truncate">{n.title}</span>
                </div>
                <span className="text-[11px] text-[var(--text3)] whitespace-nowrap ml-3">
                  {typeof n.createdAt === 'string' ? n.createdAt.split('T')[0] : ''}
                </span>
              </div>
            ))
          )}
        </div>

        {/* 快捷入口 */}
        <div className={cardCls}>
          <h3 className="text-[16px] font-semibold mb-4">快捷入口</h3>
          <div className="grid gap-2.5">
            {[
              { icon: <ClipboardList size={20} />, label: '作业提交', desc: '查看并提交待完成作业', href: '/creator/assignments' },
              { icon: <Upload size={20} />, label: '上传作品', desc: '自由上传独立创作', href: '/creator/upload' },
              { icon: <Music size={20} />, label: '我的作品库', desc: '管理全部作品', href: '/creator/songs' },
              { icon: <Coins size={20} />, label: '我的收益', desc: '查看收益明细与结算', href: '/creator/revenue' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="no-underline">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg4)] cursor-pointer transition-all hover:bg-[var(--border)]">
                  <span className="text-[var(--accent)]">{item.icon}</span>
                  <div>
                    <div className="text-[13px] font-medium text-[var(--text)]">{item.label}</div>
                    <div className="text-[11px] text-[var(--text3)]">{item.desc}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
