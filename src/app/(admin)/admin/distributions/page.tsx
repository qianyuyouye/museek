'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { useApi } from '@/lib/use-api'
import { pageWrap } from '@/lib/ui-tokens'

const PLATFORMS = ['QQ音乐', '网易云音乐', 'Spotify', 'Apple Music', '酷狗音乐']

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
  { label: string; color: string; bg: string; icon: string }
> = {
  live: { label: '已上架', color: 'var(--green2)', bg: '#f0fdf4', icon: '✅' },
  submitted: { label: '已提交', color: 'var(--orange)', bg: '#fef9ec', icon: '⏳' },
  pending: { label: '待提交', color: '#3b82f6', bg: '#eff6ff', icon: '📋' },
  none: { label: '未安排', color: 'var(--text3)', bg: 'transparent', icon: '—' },
}

const cardCls =
  'bg-white border border-[var(--border)] rounded-xl shadow-[0_1px_4px_rgba(99,102,241,0.06)]'

export default function AdminDistributionsPage() {
  const [toast, setToast] = useState('')

  const { data, loading } = useApi<DistributionsApiData>(
    '/api/admin/distributions',
  )

  const distributions: DistributionItem[] = (data?.songs ?? []).map((s) => ({
    songId: s.id,
    songTitle: s.title,
    platforms: (data?.matrix?.[s.id] ?? {}) as Record<string, 'live' | 'submitted' | 'pending' | 'none'>,
  }))

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function handleCellClick(item: DistributionItem, platform: string) {
    const status = item.platforms[platform] ?? 'none'
    const cfg = STATUS_CONFIG[status]
    if (status === 'none') {
      showToast(`点击提交 ${item.songTitle} 至 ${platform}`)
    } else {
      showToast(`${item.songTitle} · ${platform}：${cfg.label}`)
    }
  }

  return (
    <div className={pageWrap}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-white border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
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
              {PLATFORMS.map((p) => (
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
                className="border-b border-[#f0f4fb] last:border-b-0 hover:bg-[#fafaff] transition-colors"
              >
                <td className="px-5 py-3.5">
                  <span className="text-sm font-medium text-[var(--text)]">
                    {item.songTitle}
                  </span>
                </td>
                {PLATFORMS.map((platform) => {
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
    </div>
  )
}
