'use client'

import { useApi } from '@/lib/use-api'

// ── Types ───────────────────────────────────────────────────────

interface ReviewHistoryApi {
  id: number
  songId: number
  songTitle: string
  creatorName: string
  technique: number | null
  creativity: number | null
  commercial: number | null
  totalScore: number | null
  recommendation: string | null
  comment: string | null
  reviewedAt: string | null
}

interface ReviewHistory {
  id: number
  title: string
  student: string
  score: number
  rec: string
  duration: string
  date: string
}

interface StatsApiData {
  stats: {
    totalCount: number
    totalDuration: number
    avgScore: number
    recommendRate: number
  }
  history: ReviewHistoryApi[]
}

// ── Stat card config ─────────────────────────────────────────────

const STAT_CARD_CONFIG = [
  {
    key: 'reviewCount' as const,
    icon: 'edit',
    label: '批改数量',
    grad: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    shadow: 'rgba(99,102,241,.25)',
  },
  {
    key: 'totalDuration' as const,
    icon: 'clock',
    label: '总评审时长',
    grad: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    shadow: 'rgba(16,185,129,.25)',
  },
  {
    key: 'avgScore' as const,
    icon: 'chart',
    label: '平均评分',
    grad: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    shadow: 'rgba(245,158,11,.25)',
  },
  {
    key: 'publishRate' as const,
    icon: 'rocket',
    label: '推荐发行率',
    grad: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
    shadow: 'rgba(236,72,153,.25)',
  },
]

// ── SVG Icons ────────────────────────────────────────────────────

function StatIcon({ type, size = 22 }: { type: string; size?: number }) {
  const s = size
  const c = '#fff'
  switch (type) {
    case 'edit':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'clock':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={c} strokeWidth="2"/>
          <path d="M12 6v6l4 2" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'chart':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M18 20V10M12 20V4M6 20v-6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'rocket':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11.95A22 22 0 0112 15z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    default:
      return null
  }
}

// ── Monthly line chart (SVG) ─────────────────────────────────────

function MonthlyLineChart({ data }: { data: { month: string; count: number }[] }) {
  if (data.length === 0) return null

  const W = 700
  const H = 180
  const padX = 50
  const padY = 24
  const chartW = W - padX * 2
  const chartH = H - padY * 2
  const maxVal = Math.max(...data.map(d => d.count), 1)

  const points = data.map((d, i) => ({
    x: padX + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
    y: padY + chartH * (1 - d.count / maxVal),
  }))

  // Smooth bezier path
  let linePath = `M${points[0].x},${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cpx = (prev.x + curr.x) / 2
    linePath += ` C${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`
  }

  // Area fill
  const areaPath = `${linePath} L${points[points.length - 1].x},${padY + chartH} L${points[0].x},${padY + chartH} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="monthAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid lines + Y labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padY + chartH * ratio
        const label = Math.round(maxVal * (1 - ratio))
        return (
          <g key={ratio}>
            <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="#e8edf5" strokeWidth="1" />
            <text x={padX - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{label}</text>
          </g>
        )
      })}
      {/* Area */}
      <path d={areaPath} fill="url(#monthAreaGrad)" />
      {/* Line */}
      <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
      {/* Dots + labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#6366f1" strokeWidth="2" />
          {data[i].count > 0 && (
            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="600" fill="#6366f1">
              {data[i].count}
            </text>
          )}
          <text x={p.x} y={H + 14} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {data[i].month}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ── Table columns ────────────────────────────────────────────────

const COLUMNS = ['歌曲', '学生', '总分', '建议', '用时', '日期'] as const

// ── Page component ───────────────────────────────────────────────

export default function ReviewStatsPage() {
  const { data, loading } = useApi<StatsApiData>('/api/review/stats')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-[var(--text3)]">加载中...</div>
      </div>
    )
  }

  const apiStats = data?.stats
  const cards = {
    reviewCount: apiStats ? String(apiStats.totalCount) : '-',
    totalDuration: apiStats ? `${(apiStats.totalDuration / 3600).toFixed(1)}h` : '-',
    avgScore: apiStats ? String(apiStats.avgScore) : '-',
    publishRate: apiStats ? `${apiStats.recommendRate}%` : '-',
  }

  const REC_LABELS: Record<string, string> = {
    strongly_recommend: '强烈推荐发行',
    recommend_after_revision: '建议修改后发行',
    not_recommend: '不建议发行',
  }

  const history: ReviewHistory[] = (data?.history ?? []).map((h) => ({
    id: h.id,
    title: h.songTitle,
    student: h.creatorName,
    score: h.totalScore ?? 0,
    rec: REC_LABELS[h.recommendation ?? ''] ?? (h.recommendation ?? '-'),
    duration: '-',
    date: h.reviewedAt ? new Date(h.reviewedAt).toLocaleDateString() : '-',
  }))

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text, #1e293b)', margin: 0 }}>
            我的绩效
          </h1>
          <span style={{ fontSize: 13, color: 'var(--text3, #94a3b8)' }}>2026年3月</span>
        </div>
      </div>

      {/* 4 stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          marginBottom: 28,
        }}
      >
        {STAT_CARD_CONFIG.map((s, i) => (
          <div
            key={i}
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
            {/* Circular icon */}
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
              <StatIcon type={s.icon} size={22} />
            </div>
            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>
                {cards[s.key]}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly line chart */}
      {(() => {
        // Aggregate history by month
        const monthMap: Record<string, number> = {}
        ;(data?.history ?? []).forEach((h) => {
          if (!h.reviewedAt) return
          const d = new Date(h.reviewedAt)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          monthMap[key] = (monthMap[key] ?? 0) + 1
        })
        const months = Object.keys(monthMap).sort()
        const monthlyData = months.map(m => ({ month: m, count: monthMap[m] }))

        if (monthlyData.length === 0) return null
        return (
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
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: '0 0 16px' }}>
              月度评审量趋势
            </h2>
            <MonthlyLineChart data={monthlyData} />
          </div>
        )
      })()}

      {/* History table */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text, #1e293b)', margin: 0 }}>
          历史评审记录
        </h2>
      </div>

      <div
        style={{
          background: '#fff',
          border: '1px solid #e8edf5',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(99,102,241,.06)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e8edf5' }}>
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  style={{
                    padding: '13px 18px',
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
            {history.map((row) => (
              <tr
                key={row.id}
                style={{ borderBottom: '1px solid #f1f5f9', transition: 'background .15s' }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#f8faff' }}
                onMouseOut={(e) => { e.currentTarget.style.background = '' }}
              >
                {/* 歌曲 */}
                <td style={{ padding: '14px 18px', fontSize: 13, fontWeight: 500, color: '#1e293b' }}>
                  {row.title}
                </td>
                {/* 学生 */}
                <td style={{ padding: '14px 18px', fontSize: 13, color: '#64748b' }}>
                  {row.student}
                </td>
                {/* 总分 */}
                <td style={{ padding: '14px 18px' }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: row.score >= 80 ? '#16a34a' : '#d97706',
                    }}
                  >
                    {row.score}
                  </span>
                </td>
                {/* 建议 */}
                <td style={{ padding: '14px 18px', fontSize: 13, color: '#64748b' }}>
                  {row.rec}
                </td>
                {/* 用时 */}
                <td style={{ padding: '14px 18px', fontSize: 13, color: '#64748b' }}>
                  {row.duration}
                </td>
                {/* 日期 */}
                <td style={{ padding: '14px 18px', fontSize: 13, color: '#94a3b8' }}>
                  {row.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
