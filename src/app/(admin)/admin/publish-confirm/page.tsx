'use client'

import { useState, useMemo } from 'react'
import { CheckCircle2, AlertTriangle, Check } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-header'
import { AdminTab } from '@/components/admin/admin-tab'
import { DataTable, Column } from '@/components/admin/data-table'
import { AdminModal } from '@/components/admin/admin-modal'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, cardCls, btnPrimary, btnGhost } from '@/lib/ui-tokens'
import { formatDate } from '@/lib/format'

// ── Style helpers ────────────────────────────────────────────────
const btnDanger =
  'bg-gradient-to-r from-[var(--red)] to-[#c53030] text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-0'
const btnSuccess =
  'bg-gradient-to-r from-[var(--green2)] to-[var(--green)] text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-0'
const btnSmall = 'text-[11px] px-2.5 py-1'

// ── Types ────────────────────────────────────────────────────────

interface PublishTrack {
  id: number
  songId: number
  title: string
  coverUrl: string | null
  creatorName: string
  platform: string
  submittedAt: string | null
  liveDate: string | null
  hasRevenue: boolean
  status: 'pending' | 'submitted' | 'live' | 'data_confirmed' | 'exception'
  isrc?: string | null
  copyrightCode?: string
}

// ── Helpers ──────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待提交', color: 'var(--text2)', bg: '#f1f5f9' },
  submitted: { label: '待确认上架', color: 'var(--orange)', bg: '#fef9ec' },
  live: { label: '已上架', color: 'var(--green)', bg: '#e0f7fa' },
  data_confirmed: { label: '数据已确认', color: 'var(--green2)', bg: '#f0fdf4' },
  exception: { label: '异常', color: 'var(--red)', bg: '#fff0f0' },
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / 86400000)
}

// ── Tabs ─────────────────────────────────────────────────────────

type TabKey = 'pending' | 'submitted' | 'live' | 'exception' | 'all'

function filterByTab(tracks: PublishTrack[], tab: TabKey): PublishTrack[] {
  if (tab === 'all') return tracks
  if (tab === 'live') return tracks.filter((t) => t.status === 'live' || t.status === 'data_confirmed')
  return tracks.filter((t) => t.status === tab)
}

// ── Main Component ───────────────────────────────────────────────

export default function PublishConfirmPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [toast, setToast] = useState('')
  const [detailTrack, setDetailTrack] = useState<PublishTrack | null>(null)

  const { data, loading, refetch } = useApi<{ list: PublishTrack[]; total: number; statusCounts?: Record<string, number> }>(
    `/api/admin/publish-confirm?status=${activeTab}`,
    [activeTab],
  )

  const tracks = data?.list ?? []
  const statusCounts = data?.statusCounts ?? {}

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const tabCounts = useMemo(() => ({
    pending: statusCounts.pending ?? 0,
    submitted: statusCounts.submitted ?? 0,
    live: statusCounts.live ?? 0,
    exception: statusCounts.exception ?? 0,
    all: statusCounts.all ?? Object.values(statusCounts).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0),
  }), [statusCounts])

  const tabs = [
    { key: 'pending', label: '\uD83D\uDCE4 \u5F85\u63D0\u4EA4', count: tabCounts.pending },
    { key: 'submitted', label: '\uD83D\uDD14 \u5F85\u786E\u8BA4\u4E0A\u67B6', count: tabCounts.submitted },
    { key: 'live', label: '\u2705 \u5DF2\u53D1\u884C', count: tabCounts.live },
    { key: 'exception', label: '\u26A0\uFE0F \u5F02\u5E38', count: tabCounts.exception },
    { key: 'all', label: '\u5168\u90E8', count: tabCounts.all },
  ]

  const filteredTracks = useMemo(() => filterByTab(tracks, activeTab), [tracks, activeTab])

  // ── Actions ────────────────────────────────────────────────────

  async function handleAction(trackId: number, action: string) {
    const res = await apiCall(`/api/admin/publish-confirm/${trackId}`, 'POST', { action })
    if (res.ok) {
      const labels: Record<string, string> = {
        submit: '已提交发行，等待平台确认上架',
        confirm: '已确认上架',
        exception: '已标记为异常',
        resubmit: '已重新提交',
      }
      showToast(labels[action] ?? '操作成功')
      refetch()
    } else {
      showToast(res.message ?? '操作失败')
    }
  }

  async function handleSync() {
    const res = await apiCall('/api/admin/publish-confirm/sync', 'POST')
    if (res.ok) {
      showToast('🔄 对账同步完成')
      refetch()
    } else {
      showToast(res.message ?? '同步失败')
    }
  }

  // ── Table columns ──────────────────────────────────────────────

  const columns: Column<PublishTrack>[] = [
    {
      key: 'title',
      title: '歌曲',
      render: (_: unknown, t: PublishTrack) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t.coverUrl ? (
            <img src={t.coverUrl} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
          ) : null}
          <span style={{ fontWeight: 600 }}>{t.title}</span>
        </div>
      ),
    },
    {
      key: 'creatorName',
      title: '创作者',
      render: (v) => <span>{(v as string) ?? '-'}</span>,
    },
    {
      key: 'platform',
      title: '\u5E73\u53F0',
      render: (v) => <span>{v as string}</span>,
    },
    {
      key: 'submittedAt',
      title: '\u63D0\u4EA4\u65E5\u671F',
      render: (v) => <span>{v ? formatDate(v as string) : '-'}</span>,
    },
    {
      key: 'daysSince',
      title: '\u5DF2\u63D0\u4EA4\u5929\u6570',
      render: (_v, row) => {
        const t = row as PublishTrack
        const days = daysSince(t.submittedAt)
        if (days === null) return <span style={{ color: 'var(--text3)' }}>-</span>
        return (
          <span style={{ color: days > 30 ? 'var(--red)' : 'var(--text)', fontWeight: days > 30 ? 600 : 400 }}>
            {days}{'\u5929'}{days > 30 ? ' \u26A0\uFE0F' : ''}
          </span>
        )
      },
    },
    {
      key: 'liveDate',
      title: '\u4E0A\u67B6\u65E5\u671F',
      render: (v) => <span>{v ? formatDate(v as string) : '-'}</span>,
    },
    {
      key: 'hasRevenue',
      title: '\u672C\u671F\u6709\u6570\u636E?',
      render: (v) =>
        (v as boolean) ? (
          <span style={{ color: 'var(--green2)', fontWeight: 600 }}>{'\u2713 \u662F'}</span>
        ) : (
          <span style={{ color: 'var(--text3)' }}>{'\u672A\u8FD4\u56DE'}</span>
        ),
    },
    {
      key: 'status',
      title: '\u7CFB\u7EDF\u5224\u5B9A\u72B6\u6001',
      render: (v) => {
        const s = STATUS_MAP[v as string]
        return s ? (
          <span
            className="text-xs font-medium"
            style={{
              padding: '2px 10px',
              borderRadius: 10,
              background: s.bg,
              color: s.color,
            }}
          >
            {s.label}
          </span>
        ) : (
          <span>-</span>
        )
      },
    },
    {
      key: 'id',
      title: '\u64CD\u4F5C',
      render: (_v, row) => {
        const t = row as PublishTrack
        switch (t.status) {
          case 'pending':
            return (
              <button
                className={`${btnPrimary} ${btnSmall}`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleAction(t.id, 'submit')
                }}
              >
                {'提交发行'}
              </button>
            )
          case 'submitted':
            return (
              <div className="flex gap-1">
                <button
                  className={`${btnSuccess} ${btnSmall}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAction(t.id, 'confirm')
                  }}
                >
                  {'确认上架'}
                </button>
                <button
                  className={`${btnDanger} ${btnSmall}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAction(t.id, 'exception')
                  }}
                >
                  {'标记异常'}
                </button>
              </div>
            )
          case 'exception':
            return (
              <div className="flex gap-1">
                <button
                  className={`${btnPrimary} ${btnSmall}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAction(t.id, 'resubmit')
                  }}
                >
                  {'重新提交'}
                </button>
                <button
                  className={`${btnGhost} ${btnSmall}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    showToast('\uD83D\uDCDE \u5DF2\u53D1\u8D77\u5E73\u53F0\u5DE5\u5355\uFF0C\u8BF7\u7B49\u5F85\u56DE\u590D')
                  }}
                >
                  {'\uD83D\uDCDE'} {'\u8054\u7CFB\u5E73\u53F0'}
                </button>
              </div>
            )
          case 'live':
          case 'data_confirmed':
            return (
              <button
                className={`${btnGhost} ${btnSmall}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setDetailTrack(t)
                }}
              >
                {'\u67E5\u770B\u8BE6\u60C5'}
              </button>
            )
          default:
            return null
        }
      },
    },
  ]

  // ── Detail modal content ───────────────────────────────────────

  function renderDetail() {
    if (!detailTrack) return null
    const days = daysSince(detailTrack.submittedAt)

    const fields: [string, string][] = [
      ['歌曲', detailTrack.title],
      ['创作者', detailTrack.creatorName ?? '-'],
      ['平台', detailTrack.platform],
      ['提交日期', detailTrack.submittedAt ? `${detailTrack.submittedAt}（已提交${days}天）` : '-'],
      ['上架日期', detailTrack.liveDate ?? '-'],
      ['本期数据', detailTrack.hasRevenue ? '有数据' : '未返回'],
      ['ISRC', detailTrack.isrc ?? '-'],
      ['版权编号', detailTrack.copyrightCode ?? '-'],
    ]

    return (
      <div className="flex flex-col gap-2">
        {fields.map(([k, v]) => (
          <div
            key={k}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'var(--bg4)',
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--text3)' }}>{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className={pageWrap}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-[var(--bg3)] border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        title={'发行状态确认'}
        subtitle={loading ? '加载中...' : `共 ${tracks.length} 条发行记录`}
        actions={
          <button className={btnPrimary} onClick={handleSync}>
            {'\uD83D\uDD04'} {'\u89E6\u53D1\u5BF9\u8D26\u540C\u6B65'}
          </button>
        }
      />

      {/* Strategy cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 20 }}>{'\u2705'}</span>
            <span className="font-semibold text-sm">{'\u81EA\u52A8\u786E\u8BA4'}</span>
          </div>
          <p className="text-xs text-[var(--text3)] leading-relaxed m-0">
            {'\u5BF9\u8D26\u5BFC\u5165\u65F6\u5E73\u53F0\u6709\u6570\u636E\u81EA\u52A8\u7F6E\u4E3A\u201C\u5DF2\u53D1\u884C\u201D'}
          </p>
        </div>
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 20 }}>{'\uD83D\uDC4B'}</span>
            <span className="font-semibold text-sm">{'\u4EBA\u5DE5\u786E\u8BA4'}</span>
          </div>
          <p className="text-xs text-[var(--text3)] leading-relaxed m-0">
            {'\u5E73\u53F0\u5DF2\u4E0A\u67B6\u4F46\u5C1A\u65E0\u6570\u636E\u53EF\u63D0\u524D\u624B\u52A8\u786E\u8BA4'}
          </p>
        </div>
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 20 }}>{'\u26A0\uFE0F'}</span>
            <span className="font-semibold text-sm">{'\u5F02\u5E38\u5904\u7406'}</span>
          </div>
          <p className="text-xs text-[var(--text3)] leading-relaxed m-0">
            {'\u63D0\u4EA4\u8D8530\u5929\u65E0\u6570\u636E\u8FDB\u5165\u5F02\u5E38\u961F\u5217'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <AdminTab
          tabs={tabs}
          active={activeTab}
          onChange={(k) => setActiveTab(k as TabKey)}
        />
      </div>

      {/* Table */}
      <div className={cardCls}>
        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={filteredTracks as unknown as Record<string, unknown>[]}
          rowKey={(r) => (r as unknown as PublishTrack).id}
        />
      </div>

      {/* Detail Modal */}
      <AdminModal
        open={!!detailTrack}
        onClose={() => setDetailTrack(null)}
        title={'\u53D1\u884C\u8BE6\u60C5'}
      >
        {renderDetail()}
      </AdminModal>
    </div>
  )
}
