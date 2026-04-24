'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Rocket, CheckCircle2, X, XCircle, AlertTriangle, Star, BarChart3, Package, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { useApi, apiCall } from '@/lib/use-api'
import { SONG_STATUS_MAP } from '@/lib/constants'
import { pageWrap, cardCls, btnPrimary, btnGhost, btnSmall, inputCls } from '@/lib/ui-tokens'

interface SongItem {
  id: number
  userId: number
  title: string
  cover: string
  genre: string
  bpm: number
  aiTools: string[] | string | null
  score: number | null
  copyrightCode: string
  status: string
  source: string
  creatorName?: string
  audioUrl?: string | null
  coverUrl?: string | null
  agencyContract?: boolean
  realNameStatus?: 'unverified' | 'pending' | 'verified' | 'rejected'
}

function aiToolsText(t: string[] | string | null | undefined): string {
  if (Array.isArray(t)) return t.join(' / ')
  if (typeof t === 'string' && t) return t
  return '—'
}

interface ValidationIssue {
  song: SongItem
  missingAgency: boolean
  missingRealName: boolean
}

function validateSong(s: SongItem): ValidationIssue {
  return {
    song: s,
    missingAgency: s.agencyContract !== true,
    missingRealName: s.realNameStatus !== 'verified',
  }
}

function hasAnyIssue(v: ValidationIssue) {
  return v.missingAgency || v.missingRealName
}

// ── Button / style helpers ──────────────────────────────────────


// ── Status filter mapping ───────────────────────────────────────
const STATUS_FILTERS = [
  { label: '待发行', value: 'ready_to_publish' },
  { label: '已发行', value: 'published' },
  { label: '已评审', value: 'reviewed' },
  { label: '全部', value: 'all' },
] as const

// ── Download helpers ────────────────────────────────────────────

function escapeCsvField(s: string): string {
  return s.startsWith('=') || s.startsWith('+') || s.startsWith('-') || s.startsWith('@')
    ? "'" + s
    : s
}

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return
  const headers = Object.keys(data[0])
  const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${escapeCsvField(String(row[h] ?? ''))}"`).join(','))].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Main component ──────────────────────────────────────────────
export default function BatchDownloadPage() {
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ready_to_publish')
  const [genreFilter, setGenreFilter] = useState<string>('all')
  const [aiToolFilter, setAiToolFilter] = useState<string>('all')
  const [scoreFilter, setScoreFilter] = useState<string>('all')
  const [keyword, setKeyword] = useState('')

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Toast
  const [toast, setToast] = useState('')
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  // ZIP packing state
  const [zipping, setZipping] = useState(false)
  // 下载前校验预览
  const [previewIssues, setPreviewIssues] = useState<ValidationIssue[] | null>(null)

  async function packAndDownload(selected: SongItem[]) {
    setZipping(true)
    try {
      const songIds = selected.map(s => s.id)
      const res = await fetch('/api/admin/batch-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songIds }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({ message: '请求失败' }))
        showToast(json.message || '打包失败')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `批量下载_${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
      showToast('打包完成')
    } catch {
      showToast('网络请求失败')
    } finally {
      setZipping(false)
    }
  }

  // API data
  const { data, loading } = useApi<{ list: SongItem[]; total: number }>(
    `/api/admin/songs?status=${statusFilter}`,
    [statusFilter],
  )
  const allSongs = data?.list ?? []

  // Derive unique genres & aiTools
  const genres = useMemo(
    () => Array.from(new Set(allSongs.map((s) => s.genre))).sort(),
    [allSongs]
  )
  const aiTools = useMemo(
    () => {
      const set = new Set<string>()
      for (const s of allSongs) {
        if (Array.isArray(s.aiTools)) s.aiTools.forEach((t) => t && set.add(t))
        else if (typeof s.aiTools === 'string' && s.aiTools) set.add(s.aiTools)
      }
      return Array.from(set).sort()
    },
    [allSongs]
  )

  // Filtered data
  const filtered = useMemo(() => {
    return allSongs.filter((song) => {
      // status
      if (statusFilter !== 'all' && song.status !== statusFilter) return false
      // genre
      if (genreFilter !== 'all' && song.genre !== genreFilter) return false
      // aiTool：歌曲 aiTools 数组中任一命中即保留
      if (aiToolFilter !== 'all') {
        const arr = Array.isArray(song.aiTools) ? song.aiTools : (song.aiTools ? [song.aiTools] : [])
        if (!arr.includes(aiToolFilter)) return false
      }
      // score
      if (scoreFilter === '90+' && (song.score === null || song.score < 90)) return false
      if (scoreFilter === '80-89' && (song.score === null || song.score < 80 || song.score >= 90)) return false
      // keyword
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase()
        const creatorName = (song.creatorName ?? `用户${song.userId}`).toLowerCase()
        if (!song.title.toLowerCase().includes(kw) && !creatorName.includes(kw)) return false
      }
      return true
    })
  }, [allSongs, statusFilter, genreFilter, aiToolFilter, scoreFilter, keyword])

  // Selection helpers
  const allFilteredIds = useMemo(() => new Set(filtered.map((s) => s.id)), [filtered])
  const selectedInView = useMemo(
    () => new Set([...selectedIds].filter((id) => allFilteredIds.has(id))),
    [selectedIds, allFilteredIds]
  )
  const allSelected = filtered.length > 0 && selectedInView.size === filtered.length
  const someSelected = selectedInView.size > 0 && !allSelected

  function toggleAll() {
    if (allSelected) {
      // Deselect all in current view
      const next = new Set(selectedIds)
      filtered.forEach((s) => next.delete(s.id))
      setSelectedIds(next)
    } else {
      // Select all in current view
      const next = new Set(selectedIds)
      filtered.forEach((s) => next.add(s.id))
      setSelectedIds(next)
    }
  }

  function toggleOne(id: number) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  // Header checkbox ref for indeterminate
  const headerCheckRef = useRef<HTMLInputElement>(null)
  const actionCheckRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headerCheckRef.current) {
      headerCheckRef.current.indeterminate = someSelected
    }
    if (actionCheckRef.current) {
      actionCheckRef.current.indeterminate = someSelected
    }
  }, [someSelected])

  return (
    <div className={pageWrap}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-[var(--bg3)] border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        title="作品库批量下载"
        subtitle={loading ? '加载中...' : `共 ${allSongs.length} 首作品 · 筛选后 ${filtered.length} 首`}
      />

      {/* Status Tabs */}
      <div className={cardCls}>
        <div className="flex flex-wrap items-center gap-1 mb-3" role="tablist">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value
            return (
              <button
                key={f.value}
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  active
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                    : 'bg-[var(--bg3)] text-[var(--text2)] border-[var(--border)] hover:bg-[var(--bg2)]'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* 风格 */}
          <select
            className={inputCls}
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
          >
            <option value="all">全部风格</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* AI 工具 */}
          <select
            className={inputCls}
            value={aiToolFilter}
            onChange={(e) => setAiToolFilter(e.target.value)}
          >
            <option value="all">全部工具</option>
            {aiTools.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* 评分区间 */}
          <select
            className={inputCls}
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value)}
          >
            <option value="all">全部分数</option>
            <option value="90+">90分以上（强推）</option>
            <option value="80-89">80-89分</option>
          </select>

          {/* 关键词 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text3)]" />
            <input
              className={`${inputCls} w-52 pl-9`}
              placeholder="搜索歌名或创作者姓名"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className={cardCls}>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text2)] cursor-pointer select-none">
            <input
              ref={actionCheckRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
            />
            {selectedIds.size > 0
              ? `已选 ${selectedIds.size} 首`
              : '全选'}
          </label>

          {selectedIds.size > 0 && (
            <button
              className={`${btnGhost} ${btnSmall}`}
              onClick={clearSelection}
            >
              清空选择
            </button>
          )}

          <div className="flex-1" />

          <button
            className={`${btnGhost} ${btnSmall}`}
            onClick={() => {
              if (selectedIds.size === 0) {
                showToast('请先选择歌曲')
                return
              }
              const selected = allSongs.filter((s) => selectedIds.has(s.id))
              const exportData = selected.map((s) => ({
                '歌曲名': s.title,
                '创作者': s.creatorName ?? `用户${s.userId}`,
                '风格': s.genre,
                'BPM': s.bpm,
                'AI工具': aiToolsText(s.aiTools),
                '评分': s.score ?? '',
                '版权编号': s.copyrightCode,
                '状态': (SONG_STATUS_MAP[s.status] ?? { label: s.status }).label,
              }))
              downloadCSV(exportData, `作品元数据_${new Date().toISOString().slice(0, 10)}.csv`)
              showToast(`已导出 ${selected.length} 首歌曲的元数据表`)
            }}
          >
            <BarChart3 className="inline w-4 h-4 mr-1" />导出元数据表
          </button>

          <button
            className={`${btnPrimary} ${btnSmall}`}
            disabled={zipping}
            onClick={() => {
              if (selectedIds.size === 0) {
                showToast('请先选择歌曲')
                return
              }
              const selected = allSongs.filter((s) => selectedIds.has(s.id))
              setPreviewIssues(selected.map(validateSong))
            }}
          >
            {zipping ? '打包中...' : `批量打包${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
          </button>
        </div>
      </div>

      {/* 下载前校验预览 Modal */}
      {previewIssues && (
        <ValidationPreviewModal
          issues={previewIssues}
          onCancel={() => setPreviewIssues(null)}
          onConfirm={async () => {
            const selected = previewIssues.map(v => v.song)
            setPreviewIssues(null)
            await packAndDownload(selected)
          }}
        />
      )}

      {/* Table */}
      <div className={cardCls}>
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap w-8">
                  <input
                    type="checkbox"
                    ref={headerCheckRef}
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
                  />
                </th>
                {['封面', '歌曲名', '创作者', '风格', 'BPM', 'AI工具', '评分', '版权编号', '状态', '操作'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-10 text-center text-sm text-[var(--text3)]"
                  >
                    📭 暂无数据
                  </td>
                </tr>
              ) : (
                filtered.map((song) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    selected={selectedIds.has(song.id)}
                    onToggle={() => toggleOne(song.id)}
                    onDownload={() => showToast(`开始下载「${song.title}」`)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Validation Preview Modal ────────────────────────────────────

function ValidationPreviewModal({
  issues,
  onCancel,
  onConfirm,
}: {
  issues: ValidationIssue[]
  onCancel: () => void
  onConfirm: () => void
}) {
  const passed = issues.filter(v => !hasAnyIssue(v))
  const failed = issues.filter(v => hasAnyIssue(v))

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--bg3)] rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">下载前校验预览</h2>
          <p className="mt-1 text-xs text-[var(--text3)]">
            共 {issues.length} 首 · <span className="text-[var(--green2)] font-semibold">通过 {passed.length}</span>
            {failed.length > 0 && (
              <> · <span className="text-[var(--red)] font-semibold">不合规 {failed.length}</span></>
            )}
          </p>
          {failed.length > 0 && (
            <p className="mt-2 text-xs text-[var(--orange)]">
              <AlertTriangle className="inline w-3.5 h-3.5 mr-1" />继续下载时，不合规项仍会入包，但 ZIP 内 `validation-report.txt` 会标红具体缺失项。
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {failed.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--red)] mb-2">不合规列表</h3>
              <div className="space-y-2">
                {failed.map((v) => (
                  <div key={v.song.id} className="p-2.5 rounded-lg bg-[rgba(255,107,107,.06)] border border-[rgba(255,107,107,.2)]">
                    <div className="text-sm font-medium text-[var(--text)]">
                      [{v.song.copyrightCode}] {v.song.title}
                    </div>
                    <div className="text-xs text-[var(--text3)] mt-0.5">
                      {v.song.creatorName ?? `用户${v.song.userId}`}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {v.missingAgency && <span className="px-1.5 py-0.5 rounded bg-[var(--red)] text-white">未签代理协议</span>}
                      {v.missingRealName && <span className="px-1.5 py-0.5 rounded bg-[var(--red)] text-white">未实名认证</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {passed.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--green2)] mb-2">通过列表</h3>
              <div className="space-y-1 text-xs text-[var(--text2)]">
                {passed.slice(0, 50).map((v) => (
                  <div key={v.song.id}>
                    [{v.song.copyrightCode}] {v.song.title} — {v.song.creatorName ?? `用户${v.song.userId}`}
                  </div>
                ))}
                {passed.length > 50 && (
                  <div className="text-[var(--text3)]">……还有 {passed.length - 50} 首（完整清单见 ZIP 内报告）</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--border)] flex justify-end gap-2">
          <button className={`${btnGhost} ${btnSmall}`} onClick={onCancel}>取消</button>
          <button className={`${btnPrimary} ${btnSmall}`} onClick={onConfirm}>
            继续下载
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Row component ───────────────────────────────────────────────

function SongRow({
  song,
  selected,
  onToggle,
  onDownload,
}: {
  song: SongItem
  selected: boolean
  onToggle: () => void
  onDownload: () => void
}) {
  const creator = song.creatorName ?? `用户${song.userId}`
  const statusInfo = SONG_STATUS_MAP[song.status] ?? { label: song.status, color: 'var(--text2)', bg: 'rgba(107,114,128,.06)' }

  const scoreEl = (() => {
    if (song.score === null) return <span className="text-[var(--text3)]">-</span>
    const color = song.score >= 80 ? 'var(--green2)' : 'var(--orange)'
    return <span style={{ color, fontWeight: 600 }}>{song.score}</span>
  })()

  return (
    <tr
      className="hover:bg-[var(--bg4)] transition-colors"
    >
      <td className="px-3 py-3 text-sm border-b border-[var(--border)] whitespace-nowrap">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
        />
      </td>
      <td className="px-3 py-3 text-sm border-b border-[var(--border)] whitespace-nowrap">
        <span className="text-lg">{song.cover}</span>
      </td>
      <td className="px-3 py-3 text-sm border-b border-[var(--border)] whitespace-nowrap font-semibold">
        {song.title}
      </td>
      <td className="px-3 py-3 text-sm text-[var(--text)] border-b border-[var(--border)] whitespace-nowrap">
        {creator}
      </td>
      <td className="px-3 py-3 text-sm text-[var(--text)] border-b border-[var(--border)] whitespace-nowrap">
        {song.genre}
      </td>
      <td className="px-3 py-3 text-sm text-[var(--text)] border-b border-[var(--border)] whitespace-nowrap">
        {song.bpm}
      </td>
      <td className="px-3 py-3 text-sm text-[var(--text)] border-b border-[var(--border)] whitespace-nowrap">
        {aiToolsText(song.aiTools)}
      </td>
      <td className="px-3 py-3 text-sm border-b border-[var(--border)] whitespace-nowrap">
        {scoreEl}
      </td>
      <td className="px-3 py-3 text-sm border-b border-[var(--border)] whitespace-nowrap">
        <span className="font-mono text-xs text-[var(--text2)]">{song.copyrightCode}</span>
      </td>
      <td className="px-3 py-3 text-sm border-b border-[var(--border)] whitespace-nowrap">
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 10,
            background: statusInfo.bg,
            color: statusInfo.color,
            fontWeight: 500,
          }}
        >
          {statusInfo.label}
        </span>
      </td>
      <td className="px-3 py-3 text-sm border-b border-[var(--border)] whitespace-nowrap">
        <button
          className={`${btnGhost} ${btnSmall}`}
          onClick={onDownload}
        >
          下载
        </button>
      </td>
    </tr>
  )
}
