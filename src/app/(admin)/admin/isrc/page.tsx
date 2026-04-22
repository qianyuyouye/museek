'use client'

import { useState, useMemo } from 'react'
import { CheckCircle2, Clipboard, FileAudio, Download, FileText } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { DataTable, Column } from '@/components/ui/data-table'
import { useRef } from 'react'
import { useApi, apiCall } from '@/lib/use-api'
import { parseCSV } from '@/lib/csv'
import { downloadCSV, today } from '@/lib/export'
import { pageWrap, cardCls, btnPrimary, btnGhost, paginationBtn, paginationBtnActive } from '@/lib/ui-tokens'

// ── Types ───────────────────────────────────────────────────────

interface SongItem {
  id: number
  title: string
  copyrightCode: string
  userId: number
  creatorName?: string
  genre: string
  isrc: string | null
  status: string
}

// ── Pagination helpers ───────────────────────────────────────────

const PAGE_SIZE = 8

// ── Main component ───────────────────────────────────────────────

export default function AdminIsrcPage() {
  const [toast, setToast] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const backfillInputRef = useRef<HTMLInputElement>(null)

  async function handleBackfillFile(file: File) {
    setImporting(true)
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      let ok = 0, fail = 0
      // 跳过表头（如果第一行包含"歌曲ID"或"ISRC"）
      const start = rows[0]?.some((c) => /歌曲|ISRC|id/i.test(c)) ? 1 : 0
      for (let i = start; i < rows.length; i++) {
        const r = rows[i]
        if (!r || r.length < 2) continue
        // 读所有 cell 中的数字 id 和 ISRC 编码
        const idCell = r.find((c) => /^\d+$/.test(c?.trim() ?? ''))
        const isrcCell = r.map((c) => (c ?? '').replace(/-/g, '').trim().toUpperCase())
          .find((c) => /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(c))
        if (!idCell || !isrcCell) { fail++; continue }
        const res = await apiCall(`/api/admin/songs/${idCell}/isrc`, 'POST', { isrc: isrcCell })
        if (res.ok) ok++; else fail++
      }
      showToast(`回填完成：成功 ${ok} · 失败 ${fail}`)
      refetch()
    } catch {
      showToast('文件读取失败')
    } finally {
      setImporting(false)
      if (backfillInputRef.current) backfillInputRef.current.value = ''
    }
  }

  const { data, loading, refetch } = useApi<{ list: SongItem[]; total: number }>(
    '/api/admin/songs?status=ready_to_publish',
  )

  const allSongs = data?.list ?? []

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // Filter songs without ISRC
  const pendingSongs = useMemo(
    () => allSongs.filter((s) => !s.isrc && (s.status === 'ready_to_publish' || s.status === 'published')),
    [allSongs],
  )

  const isrcCount = useMemo(() => allSongs.filter((s) => s.isrc).length, [allSongs])

  const totalPages = Math.max(1, Math.ceil(pendingSongs.length / PAGE_SIZE))
  const pagedSongs = pendingSongs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  const columns: Column<SongItem>[] = [
    {
      key: 'title',
      title: '歌曲名',
      render: (v) => <span style={{ fontWeight: 600 }}>{v as string}</span>,
    },
    {
      key: 'copyrightCode',
      title: '平台编号',
      render: (v) => (
        <span className="font-mono text-[var(--text2)]">{v as string}</span>
      ),
    },
    {
      key: 'creatorName',
      title: '表演者',
      render: (v) => <span>{(v as string) ?? '未知'}</span>,
    },
    {
      key: 'genre',
      title: '流派',
    },
    {
      key: '_duration',
      title: '时长',
      render: () => <span>3:24</span>,
    },
    {
      key: '_action',
      title: '操作',
      render: (_v, row) => {
        const song = row as SongItem
        return (
          <button
            className="text-[var(--accent)] hover:text-[var(--accent2)] text-sm font-medium cursor-pointer bg-transparent border-0"
            onClick={async (e) => {
              e.stopPropagation()
              const input = window.prompt(`请输入「${song.title}」的 ISRC 编码\n（12 位格式，如：CN-A01-24-00001 或 CNA0124000001）`)
              if (!input) return
              const cleaned = input.replace(/-/g, '').trim().toUpperCase()
              if (!/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(cleaned)) {
                showToast('ISRC 格式错误：应为 2 位国家码 + 3 位注册码 + 7 位数字')
                return
              }
              const res = await apiCall(`/api/admin/songs/${song.id}/isrc`, 'POST', { isrc: cleaned })
              if (res.ok) {
                showToast(`已录入「${song.title}」的 ISRC：${cleaned}`)
                refetch()
              } else {
                showToast(res.message ?? '录入失败')
              }
            }}
          >
            录入 ISRC
          </button>
        )
      },
    },
  ]

  // ── Pagination UI ──────────────────────────────────────────────

  function renderPagination() {
    const pages: (number | string)[] = []
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - 2 && i <= currentPage + 2)
      ) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...')
      }
    }

    return (
      <div className="flex items-center justify-center gap-1 mt-4 text-sm text-[var(--text2)]">
        <span className="mr-2">
          第 {(currentPage - 1) * PAGE_SIZE + 1}~{Math.min(currentPage * PAGE_SIZE, pendingSongs.length)} 条/总共 {pendingSongs.length} 条
        </span>
        <button
          className={`${paginationBtn} disabled:opacity-40 disabled:cursor-not-allowed`}
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => p - 1)}
        >
          &lt;
        </button>
        {pages.map((p, i) =>
          typeof p === 'number' ? (
            <button
              key={i}
              className={`${paginationBtn} ${p === currentPage ? paginationBtnActive : ''}`}
              onClick={() => setCurrentPage(p)}
            >
              {p}
            </button>
          ) : (
            <span key={i} className="w-8 text-center">
              ···
            </span>
          )
        )}
        <button
          className={`${paginationBtn} disabled:opacity-40 disabled:cursor-not-allowed`}
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((p) => p + 1)}
        >
          &gt;
        </button>
        <span className="ml-2 text-xs text-[var(--text3)]">{PAGE_SIZE} 条/页</span>
      </div>
    )
  }

  return (
    <div className={pageWrap}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-[var(--bg3)] border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        title="ISRC批量管理"
        subtitle={loading ? '加载中...' : '版权编号申报与管理'}
      />

      {/* StatCards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Clipboard size={18} />}
          label="待申报"
          val={pendingSongs.length}
          color="var(--accent)"
          iconBg="rgba(99,102,241,0.1)"
        />
        <StatCard
          icon="🕐"
          label="申报中"
          val={2}
          color="var(--orange)"
          iconBg="rgba(245,158,11,0.1)"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="已获取ISRC"
          val={isrcCount}
          color="var(--green2)"
          iconBg="rgba(22,163,74,0.1)"
        />
      </div>

      {/* Main content: table + upload side by side */}
      <div className="grid grid-cols-[1fr_300px] gap-5">
        {/* Left: 待申报歌曲 */}
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">待申报歌曲</h3>
            <div className="flex items-center gap-2">
              <button
                className={btnGhost}
                onClick={async () => {
                  if (pendingSongs.length === 0) { showToast('没有待申报歌曲'); return }
                  const input = window.prompt(
                    `将为 ${pendingSongs.length} 首歌批量录入 ISRC。\n每行格式：歌曲ID,ISRC（如 12,CNA0124000001），空行跳过：`,
                    pendingSongs.map((s) => `${s.id},`).join('\n'),
                  )
                  if (!input) return
                  const lines = input.split('\n').map((l) => l.trim()).filter(Boolean)
                  let ok = 0, fail = 0
                  for (const line of lines) {
                    const [idStr, rawCode] = line.split(',').map((s) => s.trim())
                    const id = parseInt(idStr, 10)
                    const cleaned = (rawCode ?? '').replace(/-/g, '').trim().toUpperCase()
                    if (isNaN(id) || !/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(cleaned)) {
                      fail++
                      continue
                    }
                    const res = await apiCall(`/api/admin/songs/${id}/isrc`, 'POST', { isrc: cleaned })
                    if (res.ok) ok++; else fail++
                  }
                  showToast(`批量录入完成：成功 ${ok} · 失败 ${fail}`)
                  refetch()
                }}
              >
                批量录入 ISRC
              </button>
              <button
                className={btnPrimary}
                onClick={() => {
                  if (pendingSongs.length === 0) { showToast('没有待申报歌曲'); return }
                  const rows = pendingSongs.map((s) => ({
                    歌曲ID: s.id,
                    歌曲名: s.title,
                    平台编号: s.copyrightCode,
                    表演者: s.creatorName ?? '',
                    流派: s.genre,
                    状态: s.status,
                    'ISRC编码（待申报后填写）': '',
                  }))
                  downloadCSV(rows, `ISRC申报清单_${today()}.csv`)
                  showToast(`已导出 ${rows.length} 首歌曲的申报清单`)
                }}
              >
                <Download className="inline w-4 h-4 mr-1" />导出申报清单
              </button>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={pagedSongs}
            rowKey={(r) => r.id}
          />

          {renderPagination()}
        </div>

        {/* Right: 批量回填 ISRC */}
        <div className={cardCls} style={{ height: 'fit-content' }}>
          <h3 className="text-base font-semibold mb-1">批量回填ISRC</h3>
          <p className="text-xs text-[var(--text3)] mb-4">
            从ISRC申报平台获取编码后，上传回填文件批量录入。
          </p>

          <input
            ref={backfillInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBackfillFile(f) }}
          />
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f) handleBackfillFile(f)
            }}
            onClick={() => !importing && backfillInputRef.current?.click()}
            className="text-center rounded-xl py-10 px-5 transition-all"
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
              background: dragOver ? 'rgba(99,102,241,0.04)' : 'var(--bg4)',
              cursor: importing ? 'wait' : 'pointer',
              opacity: importing ? 0.6 : 1,
            }}
          >
            <div className="mb-3 opacity-50"><FileText className="w-10 h-10 text-[var(--text3)]" /></div>
            <div className="text-sm text-[var(--text2)] mb-1">
              {importing ? '处理中...' : '点击或将 CSV 拖到此处'}
            </div>
            <div className="text-xs text-[var(--text3)]">
              每行一条记录：歌曲ID 和 ISRC 编码两列，自动识别
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
