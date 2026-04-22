'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { useApi } from '@/lib/use-api'
import { pageWrap } from '@/lib/ui-tokens'
import { Users, Music, ClipboardList, Rocket, Banknote } from 'lucide-react'

interface DashboardData {
  stats: {
    totalCreators: number
    totalReviewers: number
    totalUsers: number
    totalSongs: number
    songsFromUpload: number
    songsFromAssignment: number
    pendingReview: number
    published: number
    publishRate: number
    totalRevenue: number
    groupCount: number
  }
  trend: {
    months: string[]
    values: number[]
  }
  rates: { n: number; label: string; v: number; c: string }[]
}

const W = 560, H = 196, PL = 44, PR = 16, PT = 12, PB = 36

const FALLBACK_TREND_MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const FALLBACK_TREND_VALUES = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

const FALLBACK_RATES = [
  { n: 1, label: '代理签约认证率', v: 0, c: '#6366f1' },
  { n: 2, label: '签约企业认证率', v: 0, c: '#7c3aed' },
  { n: 3, label: '内容创作活跃率', v: 0, c: '#818cf8' },
  { n: 4, label: '实名认证完成率', v: 0, c: '#6366f1' },
]

// Smooth cubic bezier curve through points
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, points.length - 1)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

/* Icon mapping for stat cards */
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  users: Users,
  music: Music,
  clipboard: ClipboardList,
  rocket: Rocket,
  yen: Banknote,
  group: Users,
}

/* 3D chart illustration for banner */
function BannerIllustration() {
  return (
    <svg width="180" height="120" viewBox="0 0 180 120" style={{ opacity: 0.85 }}>
      {/* Bar chart bars */}
      <rect x="20" y="70" width="16" height="40" rx="3" fill="rgba(255,255,255,0.35)" />
      <rect x="42" y="50" width="16" height="60" rx="3" fill="rgba(255,255,255,0.45)" />
      <rect x="64" y="60" width="16" height="50" rx="3" fill="rgba(255,255,255,0.35)" />
      <rect x="86" y="35" width="16" height="75" rx="3" fill="rgba(255,255,255,0.5)" />
      <rect x="108" y="45" width="16" height="65" rx="3" fill="rgba(255,255,255,0.4)" />
      <rect x="130" y="25" width="16" height="85" rx="3" fill="rgba(255,255,255,0.55)" />
      {/* Trend line */}
      <path d="M28 65 Q50 42, 72 52 T108 30 T148 18" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Dots on trend line */}
      <circle cx="28" cy="65" r="3" fill="#fff" opacity="0.8" />
      <circle cx="72" cy="52" r="3" fill="#fff" opacity="0.8" />
      <circle cx="108" cy="30" r="3" fill="#fff" opacity="0.8" />
      <circle cx="148" cy="18" r="4" fill="#fff" opacity="0.9" />
      {/* Arrow indicator */}
      <path d="M148 18 L155 12 L152 20 Z" fill="rgba(255,255,255,0.7)" />
    </svg>
  )
}

export default function AdminDashboard() {
  const [hov, setHov] = useState<number | null>(null)
  const router = useRouter()
  const { data, loading } = useApi<DashboardData>('/api/admin/dashboard')

  const trendMonths = data?.trend?.months?.length ? data.trend.months : FALLBACK_TREND_MONTHS
  const trendValues = data?.trend?.values?.length ? data.trend.values : FALLBACK_TREND_VALUES
  const rates = data?.rates?.length ? data.rates : FALLBACK_RATES

  const maxV = useMemo(() => Math.max(...trendValues, 1), [trendValues])
  const pts = useMemo(() => trendValues.map((v, i) => ({
    x: PL + (i / Math.max(trendValues.length - 1, 1)) * (W - PL - PR),
    y: PT + (1 - v / maxV) * (H - PT - PB),
  })), [trendValues, maxV])

  const linePath = useMemo(() => smoothPath(pts), [pts])
  const areaPath = useMemo(() =>
    pts.length >= 2
      ? linePath + ` L${pts[pts.length - 1].x.toFixed(1)},${(H - PB)} L${pts[0].x.toFixed(1)},${(H - PB)} Z`
      : '',
    [linePath, pts])

  const DASHBOARD_STATS = useMemo(() => {
    const s = data?.stats
    const totalUsersSub = s ? `创作者 ${s.totalCreators} · 评审 ${s.totalReviewers}` : ''
    const totalSongsSub = s ? `上传 ${s.songsFromUpload} · 作业 ${s.songsFromAssignment}` : ''
    const publishedSub = s ? `发行率 ${s.publishRate}%` : ''
    return [
      { icon: 'users', label: '注册用户', val: s?.totalUsers ?? '-', sub: totalUsersSub, subc: '#16a34a', grad: 'linear-gradient(135deg, #6366f1, #818cf8)', pg: '/admin/students' },
      { icon: 'music', label: '作品总数', val: s?.totalSongs ?? '-', sub: totalSongsSub, subc: '#16a34a', grad: 'linear-gradient(135deg, #ec4899, #f472b6)', pg: '/admin/songs' },
      { icon: 'clipboard', label: '评审中', val: s?.pendingReview ?? '-', sub: '', subc: '#16a34a', grad: 'linear-gradient(135deg, #0694a2, #22d3ee)', pg: '/admin/songs' },
      { icon: 'rocket', label: '已发行', val: s?.published ?? '-', sub: publishedSub, subc: '#16a34a', grad: 'linear-gradient(135deg, #3b82f6, #60a5fa)', pg: '/admin/songs' },
      { icon: 'yen', label: '总收益', val: s ? `¥${s.totalRevenue.toLocaleString()}` : '-', sub: '', subc: '#16a34a', grad: 'linear-gradient(135deg, #f59e0b, #fbbf24)', pg: '/admin/revenue' },
      { icon: 'group', label: '用户组', val: s?.groupCount ?? '-', sub: '', subc: '#16a34a', grad: 'linear-gradient(135deg, #14b8a6, #5eead4)', pg: '/admin/groups' },
    ]
  }, [data])

  const hovPt = hov !== null ? pts[hov] : null
  const tx = hovPt ? Math.min(Math.max(hovPt.x, 56), W - 56) : 0

  if (loading) {
    return (
      <div className={pageWrap}>
        <PageHeader title="运营看板" subtitle="数据总览" />
        <div className="flex justify-center items-center text-sm" style={{ height: 300, color: 'var(--text3)' }}>
          加载中...
        </div>
      </div>
    )
  }

  return (
    <div className={pageWrap}>
      <PageHeader title="运营看板" subtitle="数据总览" />

      {/* Purple gradient banner */}
      <div
        className="rounded-xl overflow-hidden relative"
        style={{
          minHeight: 100,
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 40%, #4338ca 70%, #6366f1 100%)',
          boxShadow: '0 8px 32px rgba(99,102,241,.28)',
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            right: -20,
            top: -40,
            width: 240,
            height: 240,
            background: 'rgba(255,255,255,.06)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 70,
            bottom: -50,
            width: 180,
            height: 180,
            background: 'rgba(255,255,255,.04)',
            borderRadius: '50%',
          }}
        />

        {/* 3D chart illustration on right */}
        <div style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)' }}>
          <BannerIllustration />
        </div>

        {/* Content */}
        <div className="relative" style={{ padding: '24px 30px' }}>
          <h2
            className="text-lg font-bold text-white"
            style={{
              marginBottom: 5,
              lineHeight: 1.35,
            }}
          >
            运营数据全透视，寻找下一个增长奇点
          </h2>
          <p className="text-[13px]" style={{ color: 'rgba(255,255,255,.68)' }}>
            实时掌握平台关键指标，驱动业务持续增长
          </p>
        </div>
      </div>

      {/* 5 stat cards */}
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: 'repeat(6, 1fr)',
        }}
      >
        {DASHBOARD_STATS.map((s, i) => {
          const IconComp = ICON_MAP[s.icon] || Users
          return (
            <div
              key={i}
              onClick={() => s.pg && router.push(s.pg)}
              className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl cursor-pointer transition-all flex items-center"
              style={{
                padding: '18px 16px',
                boxShadow: '0 1px 4px rgba(0,0,0,.2)',
                gap: 14,
              }}
              onMouseOver={e => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(129,140,248,.15)'
              }}
              onMouseOut={e => {
                e.currentTarget.style.transform = ''
                e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.2)'
              }}
            >
              {/* Circular gradient icon */}
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
                  boxShadow: '0 4px 12px rgba(99,102,241,.2)',
                }}
              >
                <IconComp size={22} color="#fff" />
              </div>

              {/* Text content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-[11px] text-[var(--text3)]" style={{ marginBottom: 3 }}>{s.label}</div>
                <div className="text-2xl font-bold text-[var(--text)]" style={{ lineHeight: 1, marginBottom: 3 }}>
                  {s.val}
                </div>
                <div className="text-[11px] font-medium" style={{ color: s.subc }}>{s.sub}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Two-column grid */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '3fr 2fr' }}>

        {/* Revenue trend line chart */}
        <div
          className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl"
          style={{
            padding: '18px 16px 10px',
            boxShadow: '0 1px 4px rgba(0,0,0,.2)',
          }}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-[13.5px] font-semibold text-[var(--text)]">收益趋势</span>
            <span
              className="text-[11px] text-[var(--text3)] border border-[var(--border)]"
              style={{
                background: 'var(--bg4)',
                padding: '2px 10px',
                borderRadius: 20,
              }}
            >
              收益趋势
            </span>
          </div>

          <svg
            width="100%"
            viewBox={`0 0 ${W} ${H}`}
            style={{ display: 'block', overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="dashAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity=".22" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity=".02" />
              </linearGradient>
            </defs>

            {/* Grid lines + Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
              const y = PT + (1 - r) * (H - PT - PB)
              return (
                <g key={i}>
                  <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--border)" strokeWidth="1" />
                  <text x={PL - 5} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text3)">
                    {Math.round((r * maxV) / 1000) + 'k'}
                  </text>
                </g>
              )
            })}

            {/* X-axis month labels */}
            {trendMonths.map((m, i) => {
              const x = PL + (i / Math.max(trendValues.length - 1, 1)) * (W - PL - PR)
              return (
                <text key={i} x={x} y={H + 2} textAnchor="middle" fontSize="10" fill="var(--text3)">
                  {m}
                </text>
              )
            })}

            {/* Area fill */}
            <path d={areaPath} fill="url(#dashAreaGrad)" />

            {/* Smooth line */}
            <path
              d={linePath}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Interactive dots */}
            {pts.map((p, i) => (
              <g
                key={i}
                onMouseEnter={() => setHov(i)}
                onMouseLeave={() => setHov(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={p.x} cy={p.y} r="9" fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hov === i ? 5 : 2.5}
                  fill={hov === i ? '#818cf8' : 'var(--text)'}
                  stroke="#6366f1"
                  strokeWidth="2.5"
                />
              </g>
            ))}

            {/* Hover tooltip */}
            {hovPt && hov !== null && (
              <g>
                <rect
                  x={tx - 54}
                  y={hovPt.y - 50}
                  width="108"
                  height="38"
                  rx="8"
                  fill="var(--bg3)"
                  stroke="var(--border)"
                  strokeWidth="1"
                  filter="drop-shadow(0 2px 6px rgba(0,0,0,.08))"
                />
                <text x={tx} y={hovPt.y - 32} textAnchor="middle" fontSize="10" fill="#94a3b8">
                  {trendMonths[hov]}
                </text>
                <text
                  x={tx}
                  y={hovPt.y - 18}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="700"
                  fill="#6366f1"
                >
                  {'¥' + trendValues[hov].toLocaleString()}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Conversion rates */}
        <div
          className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl"
          style={{
            padding: '18px 16px',
            boxShadow: '0 1px 4px rgba(0,0,0,.2)',
          }}
        >
          <span className="text-[13.5px] font-semibold text-[var(--text)] block mb-4">
            关键转化率
          </span>

          {rates.map(r => (
            <div key={r.n} style={{ marginBottom: 18 }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: r.c + '18',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l4 4 6-7" stroke={r.c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="flex-1 text-xs text-[var(--text2)]">{r.label}</span>
                <span className="text-[13px] font-bold" style={{ color: r.c }}>{r.v + '%'}</span>
              </div>
              <div
                className="overflow-hidden"
                style={{
                  height: 8,
                  background: 'var(--bg4)',
                  borderRadius: 4,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: r.v + '%',
                    background: `linear-gradient(90deg, ${r.c}, ${r.c}aa)`,
                    borderRadius: 4,
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
