'use client'

import { useRouter } from 'next/navigation'
import { useApi } from '@/lib/use-api'

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
  {
    key: 'pending' as const,
    icon: (
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="9" y="3" width="6" height="4" rx="1" stroke="#fff" strokeWidth="2"/>
        <path d="M9 14l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    label: '待评审',
    grad: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    shadow: 'rgba(245,158,11,.25)',
  },
  {
    key: 'completed' as const,
    icon: (
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M22 4L12 14.01l-3-3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    label: '已评审',
    grad: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    shadow: 'rgba(16,185,129,.25)',
  },
  {
    key: 'avgDuration' as const,
    icon: (
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2"/>
        <path d="M12 6v6l4 2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    label: '平均用时',
    grad: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    shadow: 'rgba(99,102,241,.25)',
  },
  {
    key: 'avgScore' as const,
    icon: (
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <path d="M18 20V10M12 20V4M6 20v-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    label: '平均评分',
    grad: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
    shadow: 'rgba(236,72,153,.25)',
  },
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
            <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="#e8edf5" strokeWidth="1" />
            <text x={padX - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{label}</text>
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
          <text key={i} x={x} y={H + 12} textAnchor="middle" fontSize="10" fill="#94a3b8">
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
    <div>
      {/* Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 50%, #a78bfa 100%)',
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 24,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            right: -30,
            top: -30,
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 80,
            bottom: -40,
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
            当严谨的评审，遇见流动的旋律
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
            评审工作台 | 专业音乐评审平台
          </div>
        </div>
      </div>

      {/* 4 stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        {STAT_CARDS.map((s) => (
          <div
            key={s.key}
            style={{
              background: '#fff',
              border: '1px solid #e8edf5',
              borderRadius: 12,
              padding: '20px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 1px 4px rgba(99,102,241,.05)',
              transition: 'all .2s',
              cursor: 'default',
            }}
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
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: s.grad,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 4px 12px ${s.shadow}`,
              }}
            >
              {s.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>
                {cardValues[s.key]}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e8edf5',
          borderRadius: 12,
          padding: '20px 24px',
          marginBottom: 28,
          boxShadow: '0 1px 4px rgba(99,102,241,.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: 0 }}>
            近30天评审数量
          </h2>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            按日统计
          </span>
        </div>
        <TrendChart data={trendData} />
      </div>

      {/* Quick actions + recent reviews */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        {/* Quick actions */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e8edf5',
            borderRadius: 12,
            padding: '20px',
            boxShadow: '0 1px 4px rgba(99,102,241,.06)',
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: '0 0 16px' }}>
            快捷入口
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => router.push('/review/queue')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 16px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all .2s',
                boxShadow: '0 2px 8px rgba(99,102,241,.25)',
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseOut={(e) => { e.currentTarget.style.transform = '' }}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              开始评审
            </button>
            <button
              onClick={() => router.push('/review/stats')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 16px',
                background: '#f8faff',
                color: '#6366f1',
                border: '1px solid #e8edf5',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all .2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#f0f2ff' }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#f8faff' }}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <path d="M18 20V10M12 20V4M6 20v-6" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              查看绩效
            </button>
          </div>
        </div>

        {/* Recent reviews */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e8edf5',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(99,102,241,.06)',
          }}
        >
          <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #e8edf5' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: 0 }}>
              最近评审记录
            </h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e8edf5' }}>
                {['歌曲', '创作者', '评分', '建议', '日期'].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: '12px 18px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#94a3b8',
                      background: '#fafbfe',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentHistory.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
                    暂无评审记录
                  </td>
                </tr>
              )}
              {recentHistory.map((row) => (
                <tr
                  key={row.id}
                  style={{ borderBottom: '1px solid #f1f5f9', transition: 'background .15s' }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#f8faff' }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '' }}
                >
                  <td style={{ padding: '14px 18px', fontSize: 13, fontWeight: 500, color: '#1e293b' }}>
                    {row.songTitle}
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: 13, color: '#64748b' }}>
                    {row.creatorName}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: (row.totalScore ?? 0) >= 80 ? '#16a34a' : '#d97706',
                      }}
                    >
                      {row.totalScore ?? '-'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: 13, color: '#64748b' }}>
                    {REC_LABELS[row.recommendation ?? ''] ?? '-'}
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: 13, color: '#94a3b8' }}>
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
