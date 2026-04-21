'use client'

import { useState } from 'react'
import { useApi } from '@/lib/use-api'
import { pageWrap, textPageTitle, textSectionTitle } from '@/lib/ui-tokens'

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
  page: number
  pageSize: number
  total: number
}

const HISTORY_PAGE_SIZE = 10

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
  const [page, setPage] = useState(1)
  const { data, loading } = useApi<StatsApiData>(
    `/api/review/stats?page=${page}&pageSize=${HISTORY_PAGE_SIZE}`,
    [page],
  )
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE))

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
    <div className={pageWrap}>
      {/* Header */}
      <div className="flex items-baseline gap-2.5">
        <h1 className={textPageTitle}>
          我的绩效
        </h1>
        <span className="text-sm text-[var(--text3)]">2026年3月</span>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-4 gap-3.5">
        {STAT_CARD_CONFIG.map((s, i) => (
          <div
            key={i}
            className="bg-white border border-[var(--border)] rounded-xl px-[18px] py-5 flex items-center gap-3.5 shadow-[0_1px_4px_rgba(99,102,241,0.05)] transition-all cursor-default"
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
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: s.grad,
                boxShadow: `0 4px 12px ${s.shadow}`,
              }}
            >
              <StatIcon type={s.icon} size={22} />
            </div>
            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-[var(--text3)] mb-1">{s.label}</div>
              <div className="text-[26px] font-bold text-[var(--text)] leading-none">
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
          <div className="bg-white border border-[var(--border)] rounded-xl px-6 py-5 shadow-[0_1px_4px_rgba(99,102,241,0.06)]">
            <h2 className={`${textSectionTitle} mb-4`}>
              月度评审量趋势
            </h2>
            <MonthlyLineChart data={monthlyData} />
          </div>
        )
      })()}

      {/* History table */}
      <div>
        <h2 className={textSectionTitle}>
          历史评审记录
        </h2>
      </div>

      <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(99,102,241,0.06)]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  className="px-[18px] py-[13px] text-left text-xs font-semibold text-[var(--text3)] bg-[#fafbfe] whitespace-nowrap"
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
                className="border-b border-[var(--border)] transition-colors"
                onMouseOver={(e) => { e.currentTarget.style.background = '#f8faff' }}
                onMouseOut={(e) => { e.currentTarget.style.background = '' }}
              >
                <td className="px-[18px] py-3.5 text-sm font-medium text-[var(--text)]">{row.title}</td>
                <td className="px-[18px] py-3.5 text-sm text-[var(--text2)]">{row.student}</td>
                <td className="px-[18px] py-3.5">
                  <span
                    className="text-sm font-bold"
                    style={{ color: row.score >= 80 ? 'var(--green2)' : 'var(--orange)' }}
                  >
                    {row.score}
                  </span>
                </td>
                <td className="px-[18px] py-3.5 text-sm text-[var(--text2)]">{row.rec}</td>
                <td className="px-[18px] py-3.5 text-sm text-[var(--text2)]">{row.duration}</td>
                <td className="px-[18px] py-3.5 text-sm text-[var(--text3)]">{row.date}</td>
              </tr>
            ))}
            {history.length === 0 && !loading && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-[18px] py-8 text-center text-sm text-[var(--text3)]">
                  暂无评审记录
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {total > 0 && (
          <div className="px-5 py-3 flex justify-between items-center border-t border-[#f0f4fb] bg-[#fafbff]">
            <span className="text-xs text-[var(--text3)]">
              第 {(page - 1) * HISTORY_PAGE_SIZE + 1}–{Math.min(page * HISTORY_PAGE_SIZE, total)} 条 / 总共 {total} 条
            </span>
            <div className="flex items-center gap-[3px]">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 border border-[var(--border)] rounded-md bg-white flex items-center justify-center text-[13px]"
                style={{
                  cursor: page === 1 ? 'default' : 'pointer',
                  color: page === 1 ? '#d1dae8' : 'var(--text2)',
                }}
              >
                ‹
              </button>
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                const n = start + i
                if (n > totalPages) return null
                return (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className="w-7 h-7 rounded-md text-[12.5px] cursor-pointer"
                    style={{
                      border: '1px solid',
                      borderColor: page === n ? 'var(--accent)' : 'var(--border)',
                      background: page === n ? 'var(--accent)' : '#fff',
                      color: page === n ? '#fff' : 'var(--text2)',
                      fontWeight: page === n ? 600 : 400,
                    }}
                  >
                    {n}
                  </button>
                )
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-7 h-7 border border-[var(--border)] rounded-md bg-white flex items-center justify-center text-[13px]"
                style={{
                  cursor: page === totalPages ? 'default' : 'pointer',
                  color: page === totalPages ? '#d1dae8' : 'var(--text2)',
                }}
              >
                ›
              </button>
              <span className="ml-2 text-[11.5px] text-[var(--text3)] bg-[#f4f7fe] px-2.5 py-[3px] rounded-md border border-[var(--border)]">
                {HISTORY_PAGE_SIZE} 条/页
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
