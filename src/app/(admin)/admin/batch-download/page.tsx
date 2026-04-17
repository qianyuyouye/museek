'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { useApi } from '@/lib/use-api'
import { SONG_STATUS_MAP } from '@/lib/constants'
import { pageWrap, cardCls, btnPrimary, btnGhost } from '@/lib/ui-tokens'

interface SongItem {
  id: number
  userId: number
  title: string
  cover: string
  genre: string
  bpm: number
  aiTool: string
  score: number | null
  copyrightCode: string
  isrc: string | null
  status: string
  source: string
  creatorName?: string
}

// ── Button / style helpers ──────────────────────────────────────
const btnSmall = 'text-[11px] px-2.5 py-1'

const selectCls =
  'px-3 py-2 bg-white border-[1.5px] border-[var(--border)] rounded-lg text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] cursor-pointer'
const inputCls =
  'px-3 py-2 bg-white border-[1.5px] border-[var(--border)] rounded-lg text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'

// ── Status filter mapping ───────────────────────────────────────
const STATUS_FILTERS = [
  { label: '🚀 待发行', value: 'ready_to_publish' },
  { label: '✅ 已发行', value: 'published' },
  { label: '📝 已评审', value: 'reviewed' },
  { label: '全部', value: 'all' },
] as const

// ── Download helpers ────────────────────────────────────────────

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return
  const headers = Object.keys(data[0])
  const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${String(row[h] ?? '')}"`).join(','))].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function downloadJSON(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' })
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
    setTimeout(() => setToast(''), 3000)
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
    () => Array.from(new Set(allSongs.map((s) => s.aiTool))).sort(),
    [allSongs]
  )

  // Filtered data
  const filtered = useMemo(() => {
    return allSongs.filter((song) => {
      // status
      if (statusFilter !== 'all' && song.status !== statusFilter) return false
      // genre
      if (genreFilter !== 'all' && song.genre !== genreFilter) return false
      // aiTool
      if (aiToolFilter !== 'all' && song.aiTool !== aiToolFilter) return false
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
        <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-white border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        title="作品库批量下载"
        subtitle={loading ? '加载中...' : `共 ${allSongs.length} 首作品 · 筛选后 ${filtered.length} 首`}
      />

      {/* Filters row */}
      <div className={cardCls}>
        <div className="flex flex-wrap items-center gap-3">
          {/* 状态 */}
          <select
            className={selectCls}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          {/* 风格 */}
          <select
            className={selectCls}
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
            className={selectCls}
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
            className={selectCls}
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value)}
          >
            <option value="all">全部分数</option>
            <option value="90+">90分以上（强推）</option>
            <option value="80-89">80-89分</option>
          </select>

          {/* 关键词 */}
          <input
            className={`${inputCls} w-52`}
            placeholder="🔍 歌名或创作者姓名"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
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
              ✕ 清空选择
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
                'AI工具': s.aiTool,
                '评分': s.score ?? '',
                '版权编号': s.copyrightCode,
                'ISRC': s.isrc ?? '',
                '状态': (SONG_STATUS_MAP[s.status] ?? { label: s.status }).label,
              }))
              downloadCSV(exportData as unknown as Record<string, unknown>[], `作品元数据_${new Date().toISOString().slice(0, 10)}.csv`)
              showToast(`已导出 ${selected.length} 首歌曲的元数据表`)
            }}
          >
            📊 导出元数据表
          </button>

          <button
            className={`${btnPrimary} ${btnSmall}`}
            onClick={() => {
              if (selectedIds.size === 0) {
                showToast('请先选择歌曲')
                return
              }
              const selected = allSongs.filter((s) => selectedIds.has(s.id))
              const metadata = selected.map((s) => ({
                id: s.id,
                title: s.title,
                creator: s.creatorName ?? `用户${s.userId}`,
                genre: s.genre,
                bpm: s.bpm,
                aiTool: s.aiTool,
                score: s.score,
                copyrightCode: s.copyrightCode,
                isrc: s.isrc,
                status: s.status,
                source: s.source,
              }))
              downloadJSON(metadata, `批量下载_歌曲元数据_${new Date().toISOString().slice(0, 10)}.json`)
              showToast(`已导出 ${selected.length} 首歌曲的元数据 JSON`)
            }}
          >
            ⬇️ 批量下载{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={cardCls}>
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-[var(--text2)] border-b border-[var(--border)] whitespace-nowrap w-8">
                  <input
                    type="checkbox"
                    ref={headerCheckRef}
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
                  />
                </th>
                {['封面', '歌曲名', '创作者', '风格', 'BPM', 'AI工具', '评分', '版权编号', 'ISRC', '状态', '操作'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-xs font-medium text-[var(--text2)] border-b border-[var(--border)] whitespace-nowrap"
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
                    colSpan={12}
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
                    onDownload={() => showToast(`⬇️ 开始下载「${song.title}」`)}
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
  const statusInfo = SONG_STATUS_MAP[song.status] ?? { label: song.status, color: 'var(--text2)', bg: '#f1f5f9' }

  const scoreEl = (() => {
    if (song.score === null) return <span className="text-[var(--text3)]">-</span>
    const color = song.score >= 80 ? 'var(--green2)' : 'var(--orange)'
    return <span style={{ color, fontWeight: 600 }}>{song.score}</span>
  })()

  const isrcEl = song.isrc ? (
    <span className="text-[var(--green2)] font-mono text-xs">{song.isrc}</span>
  ) : (
    <span className="text-[var(--red)] text-xs">⚠️ 无</span>
  )

  return (
    <tr
      className="hover:bg-[#f8faff] transition-colors"
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
        {song.aiTool}
      </td>
      <td className="px-3 py-3 text-sm border-b border-[var(--border)] whitespace-nowrap">
        {scoreEl}
      </td>
      <td className="px-3 py-3 text-sm border-b border-[var(--border)] whitespace-nowrap">
        <span className="font-mono text-xs text-[var(--text2)]">{song.copyrightCode}</span>
      </td>
      <td className="px-3 py-3 text-sm border-b border-[var(--border)] whitespace-nowrap">
        {isrcEl}
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
          ⬇️ 下载
        </button>
      </td>
    </tr>
  )
}
