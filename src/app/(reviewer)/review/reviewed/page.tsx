'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, Column } from '@/components/ui/data-table'
import { AdminModal } from '@/components/ui/modal'
import { useApi } from '@/lib/use-api'
import { formatDateTime, formatDate } from '@/lib/format'
import { pageWrap, cardCls } from '@/lib/ui-tokens'
import { Headphones, Music, ChevronDown } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────

interface ReviewedSong {
  id: number
  songId: number
  songTitle: string
  songGenre: string
  songBpm: number
  songStatus: string
  studentName: string
  totalScore: number
  recommendation: string
  comment: string
  reviewedAt: string
  audioUrl?: string | null
  coverUrl?: string | null
}

interface ReviewedDetail {
  reviewId: number
  songId: number
  songTitle: string
  songGenre: string
  songBpm: number
  songStatus: string
  audioUrl?: string | null
  coverUrl?: string | null
  studentName: string
  performer?: string | null
  lyricist?: string | null
  composer?: string | null
  albumName?: string | null
  albumArtist?: string | null
  isrc?: string | null
  lyrics?: string | null
  styleDesc?: string | null
  creationDesc?: string | null
  contribution?: string
  copyrightCode: string
  songCreatedAt: string
  technique: number
  creativity: number
  commercial: number
  totalScore: number
  recommendation: string
  comment: string
  reviewedAt: string
}

const REC_LABELS: Record<string, string> = {
  strongly_recommend: '强烈推荐发行',
  recommend_after_revision: '建议修改后发行',
  not_recommend: '暂不推荐',
}

function recColor(v: string) {
  switch (v) {
    case 'strongly_recommend': return 'var(--green2)'
    case 'recommend_after_revision': return 'var(--orange)'
    default: return 'var(--text3)'
  }
}

function scoreColor(v: number) {
  if (v >= 80) return 'var(--green2)'
  if (v >= 60) return 'var(--orange)'
  return 'var(--red)'
}

// ── Status badge (reuse pattern from creator) ───────────────────

const SONG_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending_review: { label: '待评分', color: 'var(--orange)', bg: 'rgba(245,158,11,0.12)' },
  needs_revision: { label: '需修改', color: 'var(--orange)', bg: 'rgba(245,158,11,0.12)' },
  reviewed: { label: '已入库', color: 'var(--green2)', bg: 'rgba(34,197,94,0.12)' },
  ready_to_publish: { label: '待发行', color: 'var(--accent2)', bg: 'rgba(99,102,241,0.12)' },
  published: { label: '已发行', color: 'var(--accent2)', bg: 'rgba(99,102,241,0.12)' },
  archived: { label: '已归档', color: 'var(--text3)', bg: 'rgba(107,114,128,0.12)' },
}

function Badge({ status }: { status: string }) {
  const st = SONG_STATUS_MAP[status] || { label: status, color: 'var(--text2)', bg: 'rgba(107,114,128,0.12)' }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium inline-block" style={{ color: st.color, background: st.bg }}>
      {st.label}
    </span>
  )
}

// ── Detail Modal ─────────────────────────────────────────────────

function DetailModal({ reviewId, onClose }: { reviewId: number; onClose: () => void }) {
  const { data, loading } = useApi<ReviewedDetail>(`/api/review/reviewed/${reviewId}`, [reviewId])

  if (!data && !loading) return null

  return (
    <AdminModal open={!!reviewId} onClose={onClose} title="评审详情" width={800}>
      {loading && <div className="py-12 text-center text-sm text-[var(--text3)]">加载中...</div>}
      {data && (
        <div className="flex flex-col gap-5">
          {/* Header row */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-[var(--bg4)] rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
              {data.coverUrl ? (
                <img src={data.coverUrl} alt={data.songTitle} className="w-full h-full object-cover" />
              ) : (
                <Music size={28} className="text-[var(--text3)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold text-[var(--text)]">{data.songTitle}</div>
              <div className="text-sm text-[var(--text3)] mt-1">by {data.studentName} · {data.songGenre} · {data.songBpm} BPM</div>
              <div className="flex items-center gap-2 mt-2">
                <Badge status={data.songStatus} />
                <span className="text-xs text-[var(--text3)]">版权编号：{data.copyrightCode}</span>
              </div>
            </div>
          </div>

          {/* Audio preview */}
          {data.audioUrl && (
            <div className="p-3 bg-[var(--bg4)] rounded-lg">
              <div className="text-xs text-[var(--text3)] mb-2">试听</div>
              <audio src={data.audioUrl} controls className="w-full h-9" />
            </div>
          )}

          {/* Scores */}
          <div className="grid grid-cols-4 gap-3">
            {[
              ['技术', data.technique, '30%'],
              ['创意', data.creativity, '40%'],
              ['商业', data.commercial, '30%'],
              ['总分', data.totalScore, ''],
            ].map(([label, val, weight]) => (
              <div key={label as string} className="text-center p-3 bg-[var(--bg4)] rounded-lg">
                <div className="text-xl font-bold" style={{ color: scoreColor(val as number) }}>{val as number}</div>
                <div className="text-xs text-[var(--text3)] mt-1">{label}{weight && ` (${weight})`}</div>
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div className="p-3 bg-[var(--bg4)] rounded-lg">
            <span className="text-xs text-[var(--text3)]">发行建议：</span>
            <span className="text-sm font-semibold ml-2" style={{ color: recColor(data.recommendation) }}>
              {REC_LABELS[data.recommendation] ?? data.recommendation}
            </span>
          </div>

          {/* Comment */}
          <div className="p-3 bg-[var(--bg4)] rounded-lg">
            <div className="text-xs text-[var(--text3)] mb-1">专业评语</div>
            <div className="text-sm text-[var(--text2)] leading-relaxed whitespace-pre-wrap">{data.comment}</div>
          </div>

          {/* Song metadata */}
          <div>
            <div className="text-xs text-[var(--text3)] mb-2">作品信息</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {([
                ['演唱', data.performer],
                ['作词', data.lyricist],
                ['作曲', data.composer],
                ['专辑', data.albumName],
                ['专辑艺人', data.albumArtist],
                ['ISRC', data.isrc],
              ] as [string, string | null | undefined][]).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-[var(--text3)] w-16 shrink-0">{k}：</span>
                  <span className="text-[var(--text2)]">{v || '-'}</span>
                </div>
              ))}
            </div>
            {data.styleDesc && (
              <div className="mt-2">
                <span className="text-[var(--text3)]">Prompt：</span>
                <div className="p-2 bg-[var(--bg3)] rounded-md mt-1 text-xs text-[var(--text2)] leading-relaxed whitespace-pre-wrap max-h-20 overflow-auto">
                  {data.styleDesc}
                </div>
              </div>
            )}
            {data.lyrics && (
              <div className="mt-2">
                <span className="text-[var(--text3)]">歌词：</span>
                <div className="p-2 bg-[var(--bg3)] rounded-md mt-1 text-xs text-[var(--text2)] leading-relaxed whitespace-pre-wrap max-h-20 overflow-auto">
                  {data.lyrics}
                </div>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="flex gap-6 text-xs text-[var(--text3)]">
            <span>评审时间：{formatDateTime(data.reviewedAt)}</span>
            <span>上传时间：{formatDateTime(data.songCreatedAt)}</span>
          </div>
        </div>
      )}
    </AdminModal>
  )
}

// ── Main Page ────────────────────────────────────────────────────

export default function ReviewReviewedPage() {
  const [page, setPage] = useState(1)
  const [detailReviewId, setDetailReviewId] = useState<number | null>(null)

  const PAGE_SIZE = 12

  const { data, loading } = useApi<{ list: ReviewedSong[]; total: number }>(
    `/api/review/reviewed?page=${page}&pageSize=${PAGE_SIZE}`,
    [page],
  )

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const columns: Column<ReviewedSong>[] = [
    {
      key: 'songTitle',
      title: '歌曲名',
      render: (v) => <span style={{ fontWeight: 600 }}>{v as string}</span>,
    },
    {
      key: 'studentName',
      title: '学生',
      render: (v) => <span>{v as string}</span>,
    },
    {
      key: 'songGenre',
      title: '流派',
      render: (v) => <span>{v as string}</span>,
    },
    {
      key: 'totalScore',
      title: '总分',
      render: (v, row) => (
        <span className="text-sm font-bold" style={{ color: scoreColor(v as number) }}>{v as number}</span>
      ),
    },
    {
      key: 'recommendation',
      title: '建议',
      render: (v) => (
        <span className="text-sm" style={{ color: recColor(v as string) }}>
          {REC_LABELS[v as string] ?? (v as string)}
        </span>
      ),
    },
    {
      key: 'songStatus',
      title: '歌曲状态',
      render: (v) => <Badge status={v as string} />,
    },
    {
      key: 'reviewedAt',
      title: '评审时间',
      render: (v) => <span className="text-xs">{formatDateTime(v as string)}</span>,
    },
    {
      key: 'id',
      title: '操作',
      render: (_v, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); setDetailReviewId((row as ReviewedSong).id) }}
          className="text-[var(--accent)] hover:text-[var(--accent2)] text-sm font-medium cursor-pointer bg-transparent border-0"
        >
          查看详情
        </button>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-[var(--text3)]">加载中...</div>
      </div>
    )
  }

  const list = data?.list ?? []

  return (
    <div className={pageWrap}>
      <PageHeader
        title="已评审歌曲"
        subtitle={`共 ${total} 首`}
      />

      <div className={cardCls}>
        {list.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--text3)]">
            暂无已评审歌曲
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={list}
              rowKey={(r) => r.id}
              onRowClick={(row) => setDetailReviewId(row.id)}
            />

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-end gap-1 mt-4 text-sm text-[var(--text3)] px-2">
                <span className="mr-2">
                  第 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} 条 / 总共 {total} 条
                </span>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`w-7 h-7 border border-[var(--border)] rounded-md flex items-center justify-center text-[13px] ${page === 1 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{ background: page === 1 ? 'var(--bg4)' : 'var(--bg3)', color: 'var(--text2)' }}
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                  const n = start + i
                  if (n > totalPages) return null
                  return (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className="w-7 h-7 rounded-md text-[12.5px] cursor-pointer"
                      style={{
                        border: '1px solid',
                        borderColor: page === n ? 'var(--accent)' : 'var(--border)',
                        background: page === n ? 'var(--accent)' : 'var(--bg3)',
                        color: page === n ? '#fff' : 'var(--text2)',
                        fontWeight: page === n ? 600 : 400,
                      }}
                    >
                      {n}
                    </button>
                  )
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={`w-7 h-7 border border-[var(--border)] rounded-md flex items-center justify-center text-[13px] ${page === totalPages ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{ background: page === totalPages ? 'var(--bg4)' : 'var(--bg3)', color: 'var(--text2)' }}
                >
                  ›
                </button>
                <span className="ml-2 text-[11.5px] text-[var(--text3)] bg-[var(--bg4)] px-2.5 py-[3px] rounded-md border border-[var(--border)]">
                  {PAGE_SIZE} 条/页
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {detailReviewId !== null && (
        <DetailModal reviewId={detailReviewId} onClose={() => setDetailReviewId(null)} />
      )}
    </div>
  )
}
