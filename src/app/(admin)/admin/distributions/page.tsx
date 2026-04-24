'use client'

import { useState, useMemo } from 'react'
import { CheckCircle2, Hourglass, Clipboard, Music, Globe, TrendingUp, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { AdminModal } from '@/components/ui/modal'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, cardCls, btnPrimary, btnGhost, inputCls, labelCls } from '@/lib/ui-tokens'

interface DistributionItem {
  songId: number
  songTitle: string
  songCover: string | null
  songStatus: string
  platforms: Record<string, 'live' | 'submitted' | 'pending' | 'none'>
}

interface DistributionsApiData {
  songs: { id: number; title: string; cover: string | null; status: string }[]
  platforms: string[]
  matrix: Record<number, Record<string, string>>
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  live: { label: '已上架', color: 'var(--green2)', bg: 'rgba(85,239,196,.1)', icon: <CheckCircle2 className="w-3.5 h-3.5 inline" /> },
  submitted: { label: '已提交', color: 'var(--orange)', bg: 'rgba(253,203,110,.08)', icon: <Hourglass className="w-3.5 h-3.5 inline" /> },
  pending: { label: '待提交', color: 'var(--accent)', bg: 'rgba(99,102,241,.08)', icon: <Clipboard className="w-3.5 h-3.5 inline" /> },
  none: { label: '未安排', color: 'var(--text3)', bg: 'transparent', icon: '—' },
}


interface EditingCell {
  songId: number
  songTitle: string
  platform: string
  status: string
  submittedAt: string
  liveDate: string
  url: string
}

export default function AdminDistributionsPage() {
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [saving, setSaving] = useState(false)
  const [keyword, setKeyword] = useState('')

  const { data, loading, refetch } = useApi<DistributionsApiData>(
    '/api/admin/distributions',
  )

  const allDistributions: DistributionItem[] = (data?.songs ?? []).map((s) => ({
    songId: s.id,
    songTitle: s.title,
    songCover: s.cover,
    songStatus: s.status,
    platforms: (data?.matrix?.[s.id] ?? {}) as Record<string, 'live' | 'submitted' | 'pending' | 'none'>,
  }))

  const distributions = useMemo(() => {
    if (!keyword.trim()) return allDistributions
    const kw = keyword.trim().toLowerCase()
    return allDistributions.filter((d) =>
      d.songTitle.toLowerCase().includes(kw)
    )
  }, [allDistributions, keyword])

  const platforms = data?.platforms ?? []

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function handleCellClick(item: DistributionItem, platform: string) {
    const status = item.platforms[platform] ?? 'none'
    setEditing({
      songId: item.songId,
      songTitle: item.songTitle,
      platform,
      status: status === 'none' ? 'pending' : status,
      submittedAt: '',
      liveDate: '',
      url: '',
    })
  }

  async function saveDistribution() {
    if (!editing) return
    setSaving(true)
    const res = await apiCall(`/api/admin/distributions/${editing.songId}`, 'POST', {
      platform: editing.platform,
      status: editing.status,
      submittedAt: editing.submittedAt || undefined,
      liveDate: editing.liveDate || undefined,
      url: editing.url || undefined,
    })
    setSaving(false)
    if (res.ok) {
      showToast(`${editing.songTitle} · ${editing.platform} 已更新`)
      setEditing(null)
      refetch()
    } else {
      showToast(res.message || '保存失败')
    }
  }

  return (
    <div className={pageWrap}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-[var(--bg3)] border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader title="发行渠道管理" subtitle={loading ? '加载中...' : `共 ${allDistributions.length} 首歌曲`} />

      {/* Search */}
      <div className={`${cardCls} flex items-center gap-3`}>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text3)]" />
          <input
            className={`${inputCls} w-full pl-9`}
            placeholder="搜索歌曲名称"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        {keyword && (
          <span className="text-xs text-[var(--text3)]">找到 {distributions.length} 首</span>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          icon={<Music className="w-5 h-5" />}
          label="可发行歌曲"
          val={distributions.length}
          color="var(--accent)"
          iconBg="rgba(155,142,240,0.1)"
        />
        <StatCard
          icon={<Globe className="w-5 h-5" />}
          label="发行平台"
          val={platforms.length}
          color="var(--green)"
          iconBg="rgba(0,229,160,0.1)"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="已上架"
          val={distributions.reduce((n, d) => n + Object.values(d.platforms).filter(v => v === 'live').length, 0)}
          color="var(--green2)"
          iconBg="rgba(0,204,142,0.1)"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="待提交"
          val={distributions.reduce((n, d) => n + Object.values(d.platforms).filter(v => v === 'pending' || v === 'none').length, 0)}
          color="var(--orange)"
          iconBg="rgba(255,179,71,0.1)"
        />
      </div>

      {/* Matrix Table */}
      {distributions.length === 0 ? (
        <div className={`${cardCls} text-center py-16`}>
          <Music className="w-12 h-12 text-[var(--text3)] mx-auto mb-4" />
          <p className="text-[var(--text3)] text-sm">暂无可管理发行渠道的歌曲</p>
          <p className="text-[var(--text3)] text-xs mt-2">请先在"歌曲管理"中将歌曲设为待发行或已发行状态</p>
        </div>
      ) : (
        <div className={cardCls}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left text-sm font-semibold text-[var(--text2)] px-5 py-3.5 w-[180px]">
                歌曲
              </th>
              {platforms.map((p) => (
                <th
                  key={p}
                  className="text-left text-sm font-semibold text-[var(--text2)] px-5 py-3.5"
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {distributions.map((item) => (
              <tr
                key={item.songId}
                className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg4)] transition-colors"
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {item.songCover ? (
                      <img src={item.songCover} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-[var(--bg4)] flex items-center justify-center shrink-0">
                        <Music className="w-4 h-4 text-[var(--text3)]" />
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-medium text-[var(--text)] block">
                        {item.songTitle}
                      </span>
                      <span className="text-[11px] text-[var(--text3)]">{item.songStatus === 'published' ? '已发行' : item.songStatus === 'ready_to_publish' ? '待发行' : '已入库'}</span>
                    </div>
                  </div>
                </td>
                {platforms.map((platform) => {
                  const status = item.platforms[platform] ?? 'none'
                  const cfg = STATUS_CONFIG[status]
                  return (
                    <td
                      key={platform}
                      className="px-5 py-3.5 cursor-pointer"
                      onClick={() => handleCellClick(item, platform)}
                    >
                      <span
                        className="text-xs inline-block"
                        style={{ color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 px-2 mt-2 text-[var(--text3)]">
        <span className="text-xs font-medium">矩阵状态说明：</span>
        {(['live', 'submitted', 'pending', 'none'] as const).map((key) => {
          const cfg = STATUS_CONFIG[key]
          return (
            <div key={key} className="flex items-center gap-1.5 text-xs">
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
            </div>
          )
        })}
      </div>

      {/* 编辑分发 Modal */}
      <AdminModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `分发管理 · ${editing.songTitle}` : ''}
        width={460}
      >
        {editing && (
          <div className="flex flex-col gap-4">
            <div className="text-sm text-[var(--text2)]">
              平台：<span className="font-medium text-[var(--text)]">{editing.platform}</span>
            </div>
            <div>
              <label className={labelCls}>状态</label>
              <select
                className={inputCls}
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value })}
              >
                <option value="pending">待提交</option>
                <option value="submitted">已提交（审核中）</option>
                <option value="live">已上架</option>
                <option value="failed">异常</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>提交时间（可选）</label>
              <input
                type="date"
                className={inputCls}
                value={editing.submittedAt}
                onChange={(e) => setEditing({ ...editing, submittedAt: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>上架日期（可选）</label>
              <input
                type="date"
                className={inputCls}
                value={editing.liveDate}
                onChange={(e) => setEditing({ ...editing, liveDate: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>发行链接（可选）</label>
              <input
                className={inputCls}
                placeholder="https://..."
                value={editing.url}
                onChange={(e) => setEditing({ ...editing, url: e.target.value })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button className={btnGhost} onClick={() => setEditing(null)}>取消</button>
              <button className={btnPrimary} onClick={saveDistribution} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  )
}
