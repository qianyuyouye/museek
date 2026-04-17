'use client'

import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { AdminTab } from '@/components/admin/admin-tab'
import { DataTable, Column } from '@/components/admin/data-table'
import { StatusBadge } from '@/components/admin/status-badge'
import { AdminModal } from '@/components/admin/admin-modal'
import { useApi, apiCall } from '@/lib/use-api'
import { SONG_STATUS_MAP } from '@/lib/constants'
import { pageWrap, cardCls, btnPrimary, btnGhost, inputCls, labelCls } from '@/lib/ui-tokens'

// ── Button helpers ───────────────────────────────────────────────

const btnSmall = 'text-[11px] px-2.5 py-1'
const btnSuccess =
  'bg-gradient-to-r from-[var(--green2)] to-[var(--green)] text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-0'
const btnDanger =
  'bg-gradient-to-r from-[var(--red)] to-[#c53030] text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-0'

// ── Tab config ───────────────────────────────────────────────────

type TabKey = 'pending_review' | 'ready_to_publish' | 'reviewed' | 'published' | 'needs_revision' | 'archived' | 'all'

const TAB_LABELS: { key: TabKey; label: string }[] = [
  { key: 'pending_review', label: '待评审' },
  { key: 'ready_to_publish', label: '待发行' },
  { key: 'reviewed', label: '已入库' },
  { key: 'published', label: '已发行' },
  { key: 'needs_revision', label: '需修改' },
  { key: 'archived', label: '已归档' },
  { key: 'all', label: '全部' },
]

// ── Helpers ──────────────────────────────────────────────────────

interface SongDist {
  platform: string
  status: string
}

interface SongItem {
  id: number
  userId: number
  title: string
  cover: string
  source: string
  score: number | null
  copyrightCode: string
  isrc: string | null
  status: string
  creatorName?: string
  agencyContract?: boolean
  realNameStatus?: string
  distributions?: SongDist[]
}

const CHANNEL_META: { key: string; icon: string }[] = [
  { key: 'QQ音乐', icon: '🎵' },
  { key: '网易云音乐', icon: '☁️' },
  { key: 'Apple Music', icon: '🍎' },
  { key: 'Spotify', icon: '🟢' },
  { key: '酷狗音乐', icon: '🎶' },
]

const DIST_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  live: { label: '已上架', color: 'var(--green2)' },
  submitted: { label: '审核中', color: 'var(--orange)' },
  pending: { label: '待提交', color: 'var(--text3)' },
  failed: { label: '异常', color: 'var(--red)' },
  none: { label: '未分发', color: 'var(--text3)' },
}

function sourceLabel(source: string): string {
  return source === 'assignment' ? '📝作业' : '⬆️自由'
}

// ── Main component ───────────────────────────────────────────────

export default function AdminSongsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('pending_review')
  const [page] = useState(1)
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  // ISRC modal
  const [isrcModal, setIsrcModal] = useState<SongItem | null>(null)
  const [isrcInput, setIsrcInput] = useState('')

  // Channel modal
  const [channelModal, setChannelModal] = useState<SongItem | null>(null)

  const { data, loading, refetch } = useApi<{ list: SongItem[]; total: number; statusCounts?: Record<string, number> }>(
    `/api/admin/songs?status=${activeTab}&page=${page}`,
    [activeTab, page],
  )

  const songs = data?.list ?? []
  const statusCounts = data?.statusCounts ?? {}

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast(msg)
    setToastType(type)
    setTimeout(() => setToast(''), 3000)
  }

  const tabs = TAB_LABELS.map((t) => ({
    key: t.key,
    label: t.label,
    count: statusCounts[t.key] ?? 0,
  }))

  // Filtered songs
  const filteredSongs = useMemo(() => {
    if (activeTab === 'all') return songs
    return songs.filter((s) => s.status === activeTab)
  }, [songs, activeTab])

  // ── Status change via API ──────────────────────────────────────

  async function handleStatusChange(songId: number, action: string) {
    const song = songs.find((s) => s.id === songId)
    if (!song) return

    if (action === 'publish') {
      if (!song.agencyContract) {
        showToast(`发行失败：创作者「${song.creatorName ?? '未知'}」尚未签署代理合同`, 'error')
        return
      }
      if (song.realNameStatus !== 'verified') {
        showToast(`发行失败：创作者「${song.creatorName ?? '未知'}」尚未完成实名认证`, 'error')
        return
      }
      if (!song.isrc) {
        showToast(`发行失败：歌曲「${song.title}」尚未绑定 ISRC 编码`, 'error')
        return
      }
    }

    const res = await apiCall(`/api/admin/songs/${songId}/status`, 'POST', { action })
    if (res.ok) {
      const labels: Record<string, string> = {
        publish: '已确认发行',
        return: '已退回修改',
        archive: '已归档',
        restore: '已恢复为已入库',
      }
      showToast(`歌曲「${song.title}」${labels[action] ?? '操作成功'}`)
      refetch()
    } else {
      showToast(res.message ?? '操作失败', 'error')
    }
  }

  async function handleBindIsrc() {
    if (!isrcModal) return
    const trimmed = isrcInput.trim()
    if (!trimmed) {
      showToast('请输入 ISRC 编码', 'error')
      return
    }
    const res = await apiCall(`/api/admin/songs/${isrcModal.id}/isrc`, 'POST', { isrc: trimmed })
    if (res.ok) {
      showToast(`歌曲「${isrcModal.title}」已绑定 ISRC：${trimmed}`)
      setIsrcModal(null)
      setIsrcInput('')
      refetch()
    } else {
      showToast(res.message ?? '绑定失败', 'error')
    }
  }

  // ── Table columns ──────────────────────────────────────────────

  const columns: Column<SongItem>[] = [
    {
      key: 'cover',
      title: '封面',
      render: (v) => <span style={{ fontSize: 22 }}>{v as string}</span>,
    },
    {
      key: 'title',
      title: '歌曲名',
      render: (v) => <span style={{ fontWeight: 600 }}>{v as string}</span>,
    },
    {
      key: 'creatorName',
      title: '创作者',
      render: (v) => <span>{(v as string) ?? '未知用户'}</span>,
    },
    {
      key: 'source',
      title: '来源',
      render: (v) => <span>{sourceLabel(v as string)}</span>,
    },
    {
      key: 'score',
      title: '评分',
      render: (v) => {
        const score = v as number | null
        if (score === null || score === undefined) return <span style={{ color: 'var(--text3)' }}>-</span>
        const color = score >= 80 ? 'var(--green2)' : 'var(--orange)'
        return <span style={{ fontWeight: 600, color }}>{score}</span>
      },
    },
    {
      key: 'copyrightCode',
      title: '版权编号',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v as string}</span>
      ),
    },
    {
      key: 'isrc',
      title: 'ISRC',
      render: (v) => {
        const isrc = v as string | null
        if (isrc) {
          return (
            <span style={{ color: 'var(--green2)', fontFamily: 'monospace', fontSize: 12 }}>
              {isrc}
            </span>
          )
        }
        return <span style={{ color: 'var(--text3)', fontSize: 12 }}>待申报</span>
      },
    },
    {
      key: 'status',
      title: '状态',
      render: (v) => {
        const status = v as string
        const map = SONG_STATUS_MAP[status]
        if (map) {
          return <StatusBadge label={map.label} color={map.color} bg={map.bg} />
        }
        return <span>{status}</span>
      },
    },
    {
      key: 'id',
      title: '操作',
      render: (_v, row) => {
        const song = row as SongItem
        return <ActionButtons song={song} />
      },
    },
  ]

  // ── Action buttons per status ──────────────────────────────────

  function ActionButtons({ song }: { song: SongItem }) {
    switch (song.status) {
      case 'ready_to_publish':
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`${btnSuccess} ${btnSmall}`}
              onClick={(e) => { e.stopPropagation(); handleStatusChange(song.id, 'publish') }}
            >
              确认发行
            </button>
            <button
              className={`${btnGhost} ${btnSmall}`}
              onClick={(e) => { e.stopPropagation(); setIsrcModal(song); setIsrcInput(song.isrc ?? '') }}
            >
              绑ISRC
            </button>
            <button
              className={`${btnDanger} ${btnSmall}`}
              onClick={(e) => { e.stopPropagation(); handleStatusChange(song.id, 'return') }}
            >
              退回
            </button>
          </div>
        )
      case 'pending_review':
        return (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>在评审端处理</span>
        )
      case 'reviewed':
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`${btnPrimary} ${btnSmall}`}
              onClick={(e) => { e.stopPropagation(); handleStatusChange(song.id, 'publish') }}
            >
              手动发行
            </button>
            <button
              className={`${btnGhost} ${btnSmall}`}
              onClick={(e) => { e.stopPropagation(); setIsrcModal(song); setIsrcInput(song.isrc ?? '') }}
            >
              绑ISRC
            </button>
          </div>
        )
      case 'published':
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`${btnGhost} ${btnSmall}`}
              onClick={(e) => { e.stopPropagation(); setChannelModal(song) }}
            >
              查看渠道
            </button>
            <button
              className={`${btnDanger} ${btnSmall}`}
              onClick={(e) => { e.stopPropagation(); handleStatusChange(song.id, 'archive') }}
            >
              归档
            </button>
          </div>
        )
      case 'needs_revision':
        return <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>
      case 'archived':
        return (
          <button
            className={`${btnGhost} ${btnSmall}`}
            onClick={(e) => { e.stopPropagation(); handleStatusChange(song.id, 'restore') }}
          >
            恢复
          </button>
        )
      default:
        return null
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className={pageWrap}>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-white text-sm font-medium shadow-lg border ${
            toastType === 'error'
              ? 'border-[var(--red)] text-[var(--red)]'
              : 'border-[var(--green)] text-[var(--green)]'
          }`}
        >
          {toast}
        </div>
      )}

      <PageHeader
        title="歌曲库管理"
        subtitle={loading ? '加载中...' : `共 ${songs.length} 首歌曲`}
      />

      {/* Tabs */}
      <div>
        <AdminTab tabs={tabs} active={activeTab} onChange={(k) => setActiveTab(k as TabKey)} />
      </div>

      {/* Table */}
      <div className={cardCls}>
        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={filteredSongs as unknown as Record<string, unknown>[]}
          rowKey={(r) => (r as unknown as SongItem).id}
        />
      </div>

      {/* ISRC 绑定弹窗 */}
      <AdminModal
        open={!!isrcModal}
        onClose={() => { setIsrcModal(null); setIsrcInput('') }}
        title={`绑定 ISRC · ${isrcModal?.title ?? ''}`}
        width={420}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>ISRC 编码</label>
            <input
              className={inputCls}
              placeholder="如：CNF121200001"
              value={isrcInput}
              onChange={(e) => setIsrcInput(e.target.value)}
              style={{ fontFamily: 'monospace' }}
            />
          </div>
          <div
            className="p-3 rounded-lg text-xs leading-relaxed text-[var(--accent2)]"
            style={{ background: 'rgba(108,92,231,.08)' }}
          >
            💡 ISRC（国际标准录音制品编码）是歌曲发行的必要条件。绑定后将用于数字音乐分发与版税追踪。
          </div>
          <button
            className={`${btnPrimary} w-full flex justify-center`}
            onClick={handleBindIsrc}
          >
            确认绑定
          </button>
        </div>
      </AdminModal>

      {/* 渠道查看弹窗 */}
      <AdminModal
        open={!!channelModal}
        onClose={() => setChannelModal(null)}
        title={`发行渠道 · ${channelModal?.title ?? ''}`}
        width={480}
      >
        {channelModal && (() => {
          const distMap: Record<string, string> = {}
          ;(channelModal.distributions ?? []).forEach((d) => { distMap[d.platform] = d.status })
          return (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2.5">
                {CHANNEL_META.map((ch) => {
                  const st = distMap[ch.key] ?? 'none'
                  const meta = DIST_STATUS_LABEL[st] ?? DIST_STATUS_LABEL.none
                  return (
                    <div
                      key={ch.key}
                      className="rounded-lg flex justify-between items-center text-[13px]"
                      style={{ padding: '12px 14px', background: '#f0f4fb' }}
                    >
                      <span>{ch.icon} {ch.key}</span>
                      <span className="text-[11px] font-medium" style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="text-xs text-[var(--text3)] text-center pt-2">
                ISRC：{channelModal.isrc ?? '未分配'} · 版权编号：{channelModal.copyrightCode}
              </div>
            </div>
          )
        })()}
      </AdminModal>
    </div>
  )
}
