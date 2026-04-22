'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, Column } from '@/components/ui/data-table'
import { useApi } from '@/lib/use-api'
import { pageWrap, cardCls, btnPrimary, btnGhost } from '@/lib/ui-tokens'
import { formatDateTime } from '@/lib/format'

const GENRE_OPTIONS = ['全部', 'Pop', 'Rock', '电子', 'Hip-Hop', '民谣', '古典']

interface QueueSong {
  id: number
  title: string
  userId: number
  studentName: string
  genre: string
  aiTool: string
  bpm: number
  createdAt: string
}

export default function ReviewQueuePage() {
  const router = useRouter()
  const [genre, setGenre] = useState('全部')
  const [search, setSearch] = useState('')
  const [appliedGenre, setAppliedGenre] = useState('全部')
  const [appliedSearch, setAppliedSearch] = useState('')

  const genreParam = appliedGenre === '全部' ? '' : appliedGenre
  const { data, loading } = useApi<{ list: QueueSong[]; total: number }>(
    `/api/review/queue?genre=${encodeURIComponent(genreParam)}&search=${encodeURIComponent(appliedSearch)}`,
    [appliedGenre, appliedSearch],
  )

  const filtered = useMemo(() => data?.list ?? [], [data])

  function handleSearch() {
    setAppliedGenre(genre)
    setAppliedSearch(search)
  }

  function handleReset() {
    setGenre('全部')
    setSearch('')
    setAppliedGenre('全部')
    setAppliedSearch('')
  }

  function handleStartReview(songId: number) {
    router.push(`/review/assess?songId=${songId}`)
  }

  const columns: Column<QueueSong>[] = [
    {
      key: 'title',
      title: '歌曲名',
      render: (v) => <span style={{ fontWeight: 600 }}>{v as string}</span>,
    },
    {
      key: 'studentName',
      title: '学生',
      render: (v) => <span>{v as string}</span>,
    },
    {
      key: 'genre',
      title: '流派',
      render: (v) => <span>{v as string}</span>,
    },
    {
      key: 'aiTools',
      title: 'AI工具',
      render: (v) => {
        const arr = Array.isArray(v) ? (v as string[]) : []
        return <span>{arr.length > 0 ? arr.join(' / ') : '—'}</span>
      },
    },
    {
      key: 'bpm',
      title: 'BPM',
      render: (v) => <span>{v as number}</span>,
    },
    {
      key: 'createdAt',
      title: '上传时间',
      render: (v) => <span>{formatDateTime(v as string)}</span>,
    },
    {
      key: 'id',
      title: '操作',
      render: (_v, row) => {
        const song = row as QueueSong
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleStartReview(song.id)
            }}
            className="text-[var(--accent)] hover:text-[var(--accent2)] text-sm font-medium cursor-pointer bg-transparent border-0"
          >
            开始评审
          </button>
        )
      },
    },
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
      <PageHeader
        title="待评审列表"
        subtitle={`${filtered.length} 首歌曲等待评审`}
      />

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--text2)]">流派</span>
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="px-3 py-2 bg-white border border-[var(--border)] rounded-lg text-sm text-[var(--text)] outline-none cursor-pointer min-w-[120px]"
        >
          {GENRE_OPTIONS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)] text-sm">🔍</span>
          <input
            type="text"
            placeholder="请输入学生姓名"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-8 pr-3 py-2 bg-white border border-[var(--border)] rounded-lg text-sm text-[var(--text)] outline-none w-[200px] focus:border-[var(--accent)]"
          />
        </div>

        <button className={btnPrimary} onClick={handleSearch}>
          搜索
        </button>
        <button className={btnGhost} onClick={handleReset}>
          重置
        </button>
      </div>

      {/* Table */}
      <div className={cardCls}>
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--text3)]">
            暂无待评审歌曲
          </div>
        ) : (
          <DataTable
            columns={columns as unknown as Column<Record<string, unknown>>[]}
            data={filtered as unknown as Record<string, unknown>[]}
            rowKey={(r) => (r as unknown as QueueSong).id}
          />
        )}
      </div>
    </div>
  )
}
