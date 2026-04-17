'use client'

import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { StatCard } from '@/components/admin/stat-card'
import { DataTable, Column } from '@/components/admin/data-table'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, cardCls, btnPrimary, btnGhost } from '@/lib/ui-tokens'

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
              const res = await apiCall(`/api/admin/songs/${song.id}/isrc`, 'POST', { isrc: 'pending' })
              if (res.ok) {
                showToast(`已提交「${song.title}」的 ISRC 申报`)
                refetch()
              } else {
                showToast(res.message ?? '提交失败')
              }
            }}
          >
            提交申报
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
          className="w-8 h-8 flex items-center justify-center rounded border border-[var(--border)] bg-white cursor-pointer text-[var(--text3)] disabled:opacity-40"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => p - 1)}
        >
          &lt;
        </button>
        {pages.map((p, i) =>
          typeof p === 'number' ? (
            <button
              key={i}
              className={`w-8 h-8 flex items-center justify-center rounded border text-sm cursor-pointer ${
                p === currentPage
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-white border-[var(--border)] text-[var(--text2)]'
              }`}
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
          className="w-8 h-8 flex items-center justify-center rounded border border-[var(--border)] bg-white cursor-pointer text-[var(--text3)] disabled:opacity-40"
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
        <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-white border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
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
          icon="📋"
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
          icon="✅"
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
                onClick={() =>
                  showToast(`已批量提交 ${pendingSongs.length} 首歌曲的 ISRC 申报`)
                }
              >
                批量提交申报
              </button>
              <button
                className={btnPrimary}
                onClick={() => showToast('已导出申报清单.xlsx')}
              >
                📥 导出申报清单
              </button>
            </div>
          </div>

          <DataTable
            columns={columns as unknown as Column<Record<string, unknown>>[]}
            data={pagedSongs as unknown as Record<string, unknown>[]}
            rowKey={(r) => (r as unknown as SongItem).id}
          />

          {renderPagination()}
        </div>

        {/* Right: 批量回填 ISRC */}
        <div className={cardCls} style={{ height: 'fit-content' }}>
          <h3 className="text-base font-semibold mb-1">批量回填ISRC</h3>
          <p className="text-xs text-[var(--text3)] mb-4">
            从ISRC申报平台获取编码后，上传回填文件批量录入。
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              showToast('已上传 ISRC 回填文件，正在处理...')
            }}
            onClick={() => showToast('已上传 ISRC 回填文件，正在处理...')}
            className="cursor-pointer text-center rounded-xl py-10 px-5 transition-all"
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : '#e0e4ed'}`,
              background: dragOver ? 'rgba(99,102,241,0.04)' : '#fafbfd',
            }}
          >
            <div className="text-[40px] mb-3 opacity-50">📄</div>
            <div className="text-sm text-[var(--text2)] mb-1">
              点击或将文件拖拽到这里上传
            </div>
            <div className="text-xs text-[var(--text3)]">
              支持扩展名：.Excel
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
