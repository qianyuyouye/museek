'use client'

import { useState } from 'react'
import { CheckCircle2, Hourglass, Clipboard } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-header'
import { AdminModal } from '@/components/admin/admin-modal'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, btnPrimary, btnGhost, inputCls, labelCls } from '@/lib/ui-tokens'

interface DistributionItem {
  songId: number
  songTitle: string
  platforms: Record<string, 'live' | 'submitted' | 'pending' | 'none'>
}

interface DistributionsApiData {
  songs: { id: number; title: string; cover: string | null }[]
  platforms: string[]
  matrix: Record<number, Record<string, string>>
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  live: { label: '已上架', color: 'var(--green2)', bg: '#f0fdf4', icon: <CheckCircle2 className="w-3.5 h-3.5 inline" /> },
  submitted: { label: '已提交', color: 'var(--orange)', bg: '#fef9ec', icon: <Hourglass className="w-3.5 h-3.5 inline" /> },
  pending: { label: '待提交', color: '#3b82f6', bg: '#eff6ff', icon: <Clipboard className="w-3.5 h-3.5 inline" /> },
  none: { label: '未安排', color: 'var(--text3)', bg: 'transparent', icon: '—' },
}

const cardCls =
  'bg-white border border-[var(--border)] rounded-xl shadow-[0_1px_4px_rgba(99,102,241,0.06)]'

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

  const { data, loading, refetch } = useApi<DistributionsApiData>(
    '/api/admin/distributions',
  )

  const distributions: DistributionItem[] = (data?.songs ?? []).map((s) => ({
    songId: s.id,
    songTitle: s.title,
    platforms: (data?.matrix?.[s.id] ?? {}) as Record<string, 'live' | 'submitted' | 'pending' | 'none'>,
  }))

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

      <PageHeader title="发行渠道管理" subtitle={loading ? '加载中...' : '歌曲和平台上架状态矩阵'} />

      {/* Matrix Table */}
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
                  <span className="text-sm font-medium text-[var(--text)]">
                    {item.songTitle}
                  </span>
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

      {/* Legend */}
      <div className="flex items-center gap-6 px-2">
        {(['live', 'submitted', 'pending', 'none'] as const).map((key) => {
          const cfg = STATUS_CONFIG[key]
          return (
            <div key={key} className="flex items-center gap-1.5 text-xs text-[var(--text3)]">
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
