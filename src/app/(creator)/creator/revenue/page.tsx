'use client'

import { useState } from 'react'
import { useApi } from '@/lib/use-api'
import { pageWrap, textPageTitle } from '@/lib/ui-tokens'
import { Coins, CheckCircle2, Hourglass, Music } from 'lucide-react'

function getCurrentQuarter(): string {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3) + 1
  return `${now.getFullYear()}-Q${q}`
}

// ── Status config ──────────────────────────────────────────────

const SETTLE_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待确认', color: 'var(--orange)' },
  confirmed: { label: '已确认', color: 'var(--accent)' },
  exported: { label: '已导出', color: 'var(--green)' },
  paid: { label: '已打款', color: '#10b981' },
}

// ── Types ──────────────────────────────────────────────────────

interface Settlement {
  id: number
  songTitle: string
  platform: string
  plays: number
  rawRevenue: number
  creatorAmount: number
  status: string
}

interface QishuiDetail {
  id: number
  songName: string
  month?: string
  period?: string
  douyinRevenue: number
  qishuiRevenue: number
}

interface RevenueData {
  settlements: Settlement[]
  qishuiDetails: QishuiDetail[]
  stats: {
    total: number
    qishuiTotal: number
    paid: number
    pending: number
  }
}

// ── Stat Card ──────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-[var(--bg3)] rounded-xl border border-[var(--border)] px-5 py-4 flex items-center gap-4">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: `${color}18`, color }}
      >
        {icon}
      </div>
      <div>
        <div className="text-xs text-[var(--text3)] mb-1">{label}</div>
        <div className="text-xl font-bold" style={{ color }}>{value}</div>
      </div>
    </div>
  )
}

// ── Pagination ─────────────────────────────────────────────────

function Pagination({ current, total, pageSize, onChange }: {
  current: number
  total: number
  pageSize: number
  onChange: (page: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const pages: (number | string)[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= current - 1 && i <= current + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5 mt-4 text-xs text-[var(--text2)]">
      <span>第 {(current - 1) * pageSize + 1}-{Math.min(current * pageSize, total)} 条/共 {total} 条</span>
      <button
        className="w-7 h-7 rounded border border-[var(--border)] bg-[var(--bg3)] flex items-center justify-center cursor-pointer hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition"
        disabled={current === 1}
        onClick={() => onChange(current - 1)}
      >
        &lt;
      </button>
      {pages.map((p, i) =>
        typeof p === 'string' ? (
          <span key={`e${i}`} className="px-1">...</span>
        ) : (
          <button
            key={p}
            className={`w-7 h-7 rounded border flex items-center justify-center cursor-pointer transition text-xs ${
              p === current
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-[var(--bg3)] border-[var(--border)] hover:border-[var(--accent)] text-[var(--text2)]'
            }`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        )
      )}
      <button
        className="w-7 h-7 rounded border border-[var(--border)] bg-[var(--bg3)] flex items-center justify-center cursor-pointer hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition"
        disabled={current === totalPages}
        onClick={() => onChange(current + 1)}
      >
        &gt;
      </button>
      <span className="ml-1">{pageSize} 条/页</span>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────

export default function CreatorRevenuePage() {
  const [activeTab, setActiveTab] = useState<'platform' | 'qishui'>('platform')
  const [platformPage, setPlatformPage] = useState(1)
  const [qishuiPage, setQishuiPage] = useState(1)
  const pageSize = 8

  const { data, loading } = useApi<RevenueData>('/api/creator/revenue')

  const settlementsObj = data?.settlements as { list?: Settlement[]; total?: number } | Settlement[] | undefined
  const settlements = Array.isArray(settlementsObj) ? settlementsObj : (settlementsObj?.list ?? [])
  const qishuiObj = data?.qishuiDetails as { list?: QishuiDetail[] } | QishuiDetail[] | undefined
  const qishuiDetails = Array.isArray(qishuiObj) ? qishuiObj : (qishuiObj?.list ?? [])
  const rawStats = data?.stats as { total?: number; qishuiTotal?: number; paid?: number; pending?: number; totalEarnings?: number; paidAmount?: number; pendingAmount?: number } | undefined
  const stats = {
    total: rawStats?.total ?? rawStats?.totalEarnings ?? 0,
    qishuiTotal: rawStats?.qishuiTotal ?? 0,
    paid: rawStats?.paid ?? rawStats?.paidAmount ?? 0,
    pending: rawStats?.pending ?? rawStats?.pendingAmount ?? 0,
  }

  // ── Pagination ──
  const platformData = settlements.slice((platformPage - 1) * pageSize, platformPage * pageSize)
  const qishuiData = qishuiDetails.slice((qishuiPage - 1) * pageSize, qishuiPage * pageSize)

  const tabs = [
    { key: 'platform' as const, label: '平台分发收益' },
    { key: 'qishui' as const, label: '汽水音乐收益' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-[var(--text3)]">加载中...</div>
      </div>
    )
  }

  return (
    <div className={pageWrap}>
      {/* Header */}
      <div>
        <h1 className={textPageTitle}>我的收益</h1>
        <p className="text-xs text-[var(--text3)] mt-1">收益来自已发行歌曲在各平台的播放分成</p>
      </div>

      {/* Update time */}
      {(() => {
        const now = new Date()
        const y = now.getFullYear()
        const q = Math.floor(now.getMonth() / 3) + 1
        const nextQ = q < 4 ? q + 1 : 1
        const nextY = q < 4 ? y : y + 1
        return (
          <div className="flex items-center gap-2 text-xs text-[var(--text3)]">
            <span>数据更新于 {now.toLocaleDateString('zh-CN')}</span>
            <span className="opacity-50">·</span>
            <span>下次更新: Q{nextQ} {nextY} 数据</span>
          </div>
        )
      })()}

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<Coins size={20} />} label="平台分发收益" value={`¥${stats.total.toFixed(0)}`} color="#10b981" />
        <StatCard icon={<Music size={20} />} label="汽水音乐收益" value={`¥${stats.qishuiTotal.toFixed(2)}`} color="var(--pink)" />
        <StatCard icon={<CheckCircle2 size={20} />} label="已打款" value={`¥${stats.paid.toFixed(0)}`} color="var(--accent)" />
        <StatCard icon={<Hourglass size={20} />} label="待结算" value={`¥${stats.pending.toFixed(0)}`} color="var(--orange)" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`px-4 py-[7px] rounded-full text-[13px] font-medium border-0 cursor-pointer transition-all ${
              activeTab === t.key
                ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white shadow-[0_2px_8px_rgba(99,102,241,0.3)]'
                : 'bg-[var(--bg4)] text-[var(--text2)] hover:bg-[var(--border)]'
            }`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Platform Revenue Table */}
      {activeTab === 'platform' && (
        <div className="bg-[var(--bg3)] rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-[15px] font-semibold text-[var(--text)] mb-4">平台分发收益明细 - {getCurrentQuarter()}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--text3)] border-b border-[var(--border)]">
                <th className="pb-3 font-medium">歌曲</th>
                <th className="pb-3 font-medium">来源平台</th>
                <th className="pb-3 font-medium">播放量</th>
                <th className="pb-3 font-medium">原始收益</th>
                <th className="pb-3 font-medium">我的分成</th>
                <th className="pb-3 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {platformData.map((row) => {
                const st = SETTLE_STATUS[row.status]
                return (
                  <tr key={row.id} className="border-b border-[var(--bg4)] hover:bg-[var(--bg4)] transition">
                    <td className="py-3 text-[var(--text2)]">{row.songTitle}</td>
                    <td className="py-3 text-[var(--text2)]">{row.platform}</td>
                    <td className="py-3 text-[var(--text2)]">{(row.plays ?? 0).toLocaleString()}</td>
                    <td className="py-3 text-[var(--text2)]">¥{(row.rawRevenue ?? 0).toFixed(2)}</td>
                    <td className="py-3 font-semibold text-[#10b981]">¥{(row.creatorAmount ?? 0).toFixed(2)}</td>
                    <td className="py-3">
                      <span className="text-xs" style={{ color: st?.color }}>{st?.label ?? row.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Pagination
            current={platformPage}
            total={settlements.length}
            pageSize={pageSize}
            onChange={setPlatformPage}
          />
        </div>
      )}

      {/* Qishui Revenue Table */}
      {activeTab === 'qishui' && (
        <div className="bg-[var(--bg3)] rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-[15px] font-semibold text-[var(--text)] mb-4">汽水音乐收益明细</h3>
          {qishuiDetails.length > 0 ? (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--text3)] border-b border-[var(--border)]">
                    <th className="pb-3 font-medium">歌曲</th>
                    <th className="pb-3 font-medium">月份</th>
                    <th className="pb-3 font-medium">抖音收入</th>
                    <th className="pb-3 font-medium">汽水收入</th>
                    <th className="pb-3 font-medium">合计</th>
                  </tr>
                </thead>
                <tbody>
                  {qishuiData.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--bg4)] hover:bg-[var(--bg4)] transition">
                      <td className="py-3 text-[var(--text2)]">{row.songName}</td>
                      <td className="py-3 text-[var(--text2)]">{row.month ?? row.period ?? '—'}</td>
                      <td className="py-3 text-[var(--text2)]">¥{(row.douyinRevenue ?? 0).toFixed(2)}</td>
                      <td className="py-3 text-[var(--text2)]">¥{(row.qishuiRevenue ?? 0).toFixed(2)}</td>
                      <td className="py-3 font-semibold text-[#10b981]">
                        ¥{((row.douyinRevenue ?? 0) + (row.qishuiRevenue ?? 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                current={qishuiPage}
                total={qishuiDetails.length}
                pageSize={pageSize}
                onChange={setQishuiPage}
              />
            </>
          ) : (
            <div className="text-center py-16 text-[var(--text3)]">
              <p className="text-sm mb-1">暂无汽水音乐收益数据</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
