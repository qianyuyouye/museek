'use client'

import { useRouter } from 'next/navigation'
import { useApi } from '@/lib/use-api'
import { pageWrap, textSectionTitle } from '@/lib/ui-tokens'
import { ClipboardCheck, CheckCircle, Clock, BarChart3, PencilRuler, TrendingUp } from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────

interface QueueApiData {
  list: unknown[]
  total: number
}

interface StatsApiData {
  stats: {
    totalCount: number
    totalDuration: number
    avgScore: number
    recommendRate: number
  }
  history: {
    id: number
    songId: number
    songTitle: string
    creatorName: string
    totalScore: number | null
    recommendation: string | null
    reviewedAt: string | null
  }[]
}

// ── Stat card config ────────────────────────────────────────────

const STAT_CARDS = [
  { key: 'pending' as const, icon: <ClipboardCheck size={22} color="#fff" />, label: '待评审', grad: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', shadow: 'rgba(245,158,11,.25)' },
  { key: 'completed' as const, icon: <CheckCircle size={22} color="#fff" />, label: '已评审', grad: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', shadow: 'rgba(16,185,129,.25)' },
  { key: 'avgDuration' as const, icon: <Clock size={22} color="#fff" />, label: '平均用时', grad: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', shadow: 'rgba(99,102,241,.25)' },
  { key: 'avgScore' as const, icon: <BarChart3 size={22} color="#fff" />, label: '平均评分', grad: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', shadow: 'rgba(236,72,153,.25)' },
]

// ── Trend chart (SVG bar) ───────────────────────────────────────

function TrendChart({ data }: { data: number[] }) {
  if (data.length === 0) return null

  const W = 800
  const H = 180
  const padX = 36
  const padY = 20
  const maxVal = Math.max(...data, 1)
  const chartW = W - padX * 2
  const chartH = H - padY * 2
  const barGap = 2
  const barW = Math.max((chartW - barGap * (data.length - 1)) / data.length, 4)

  // Y-axis grid values
  const gridSteps = [0, 0.25, 0.5, 0.75, 1]

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      {/* Grid lines + Y labels */}
      {gridSteps.map((ratio) => {
        const y = padY + chartH * ratio
        const label = Math.round(maxVal * (1 - ratio))
        return (
          <g key={ratio}>
            <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="var(--border)" strokeWidth="1" />
            <text x={padX - 6} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text3)">{label}</text>
          </g>
        )
      })}
      {/* Bars */}
      {data.map((v, i) => {
        const x = padX + i * (barW + barGap)
        const barH = Math.max((v / maxVal) * chartH, v > 0 ? 3 : 0)
        const y = padY + chartH - barH
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx={2}
            fill="url(#barGrad)"
            opacity={v > 0 ? 1 : 0.15}
          />
        )
      })}
      {/* X axis labels — show every few days to avoid crowding */}
      {data.map((_, i) => {
        const step = Math.ceil(data.length / 10)
        if (i % step !== 0 && i !== data.length - 1) return null
        const x = padX + i * (barW + barGap) + barW / 2
        return (
          <text key={i} x={x} y={H + 12} textAnchor="middle" fontSize="10" fill="var(--text3)">
            {i + 1}日
          </text>
        )
      })}
    </svg>
  )
}

// ── Page component ──────────────────────────────────────────────

export default function ReviewWorkbench() {
  const router = useRouter()
  const { data: queueData } = useApi<QueueApiData>('/api/review/queue?pageSize=1')
  const { data: statsData, loading } = useApi<StatsApiData>('/api/review/stats')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-[var(--text3)]">加载中...</div>
      </div>
    )
  }

  const pendingCount = queueData?.total ?? 0
  const stats = statsData?.stats
  const history = statsData?.history ?? []

  const cardValues: Record<string, string> = {
    pending: String(pendingCount),
    completed: stats ? String(stats.totalCount) : '-',
    avgDuration: stats && stats.totalCount > 0
      ? `${Math.round(stats.totalDuration / stats.totalCount / 60)}分钟`
      : '-',
    avgScore: stats ? String(stats.avgScore) : '-',
  }

  // Build last-30-days trend data: group history by date
  const now = new Date()
  const trendData = Array.from({ length: 30 }, () => 0)
  history.forEach((h) => {
    if (!h.reviewedAt) return
    const d = new Date(h.reviewedAt)
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays >= 0 && diffDays < 30) {
      trendData[29 - diffDays]++
    }
  })

  const recentHistory = history.slice(0, 5)

  const REC_LABELS: Record<string, string> = {
    strongly_recommend: '强烈推荐',
    recommend_after_revision: '修改后发行',
    not_recommend: '不推荐',
  }

  return (
    <div className={pageWrap}>
      {/* Banner */}
      <div
        className="rounded-xl px-8 py-7 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 50%, #a78bfa 100%)',
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -right-[30px] -top-[30px] w-40 h-40 rounded-full bg-white/[0.08]" />
        <div className="absolute right-20 -bottom-10 w-[100px] h-[100px] rounded-full bg-white/[0.05]" />
        <div className="relative z-[1]">
          <div className="text-xl font-bold text-white mb-1.5">
            当严谨的评审，遇见流动的旋律
          </div>
          <div className="text-sm text-white/75">
            评审工作台 | 专业音乐评审平台
          </div>
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {STAT_CARDS.map((s) => (
          <div
            key={s.key}
            className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl px-[18px] py-5 flex items-center gap-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.2)] transition-all cursor-default"
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = `0 8px 20px ${s.shadow}`
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = ''
              e.currentTarget.style.boxShadow = '0 1px 4px rgba(99,102,241,.05)'
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: s.grad,
                boxShadow: `0 4px 12px ${s.shadow}`,
              }}
            >
              {s.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-[var(--text3)] mb-1">{s.label}</div>
              <div className="text-[26px] font-bold text-[var(--text)] leading-none">
                {cardValues[s.key]}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl px-6 py-5 shadow-[0_1px_4px_rgba(0,0,0,0.2)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className={textSectionTitle}>
            近30天评审数量
          </h2>
          <span className="text-xs text-[var(--text3)]">
            按日统计
          </span>
        </div>
        <TrendChart data={trendData} />
      </div>

      {/* Quick actions + recent reviews */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '280px 1fr' }}>
        {/* Quick actions */}
        <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.2)]">
          <h2 className={`${textSectionTitle} mb-4`}>
            快捷入口
          </h2>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => router.push('/review/queue')}
              className="flex items-center gap-2.5 px-4 py-3.5 text-white border-0 rounded-[10px] text-sm font-semibold cursor-pointer transition-all shadow-[0_2px_8px_rgba(99,102,241,0.25)] bg-gradient-to-br from-[var(--accent)] to-[var(--accent2)]"
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseOut={(e) => { e.currentTarget.style.transform = '' }}
            >
              <PencilRuler size={18} />
              开始评审
            </button>
            <button
              onClick={() => router.push('/review/stats')}
              className="flex items-center gap-2.5 px-4 py-3.5 bg-[var(--bg4)] text-[var(--accent)] border border-[var(--border)] rounded-[10px] text-sm font-medium cursor-pointer transition-all"
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg2)' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg4)' }}
            >
              <TrendingUp size={18} />
              查看绩效
            </button>
          </div>
        </div>

        {/* Recent reviews */}
        <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.2)]">
          <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
            <h2 className={textSectionTitle}>
              最近评审记录
            </h2>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['歌曲', '创作者', '评分', '建议', '日期'].map((col) => (
                  <th
                    key={col}
                    className="px-[18px] py-3 text-left text-xs font-semibold text-[var(--text3)] bg-[var(--bg4)] whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentHistory.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-[var(--text3)]">
                    暂无评审记录
                  </td>
                </tr>
              )}
              {recentHistory.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--border)] transition-colors"
                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg4)' }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '' }}
                >
                  <td className="px-[18px] py-3.5 text-sm font-medium text-[var(--text)]">
                    {row.songTitle}
                  </td>
                  <td className="px-[18px] py-3.5 text-sm text-[var(--text2)]">
                    {row.creatorName}
                  </td>
                  <td className="px-[18px] py-3.5">
                    <span
                      className="text-sm font-bold"
                      style={{
                        color: (row.totalScore ?? 0) >= 80 ? 'var(--green2)' : 'var(--orange)',
                      }}
                    >
                      {row.totalScore ?? '-'}
                    </span>
                  </td>
                  <td className="px-[18px] py-3.5 text-sm text-[var(--text2)]">
                    {REC_LABELS[row.recommendation ?? ''] ?? '-'}
                  </td>
                  <td className="px-[18px] py-3.5 text-sm text-[var(--text3)]">
                    {row.reviewedAt ? new Date(row.reviewedAt).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
