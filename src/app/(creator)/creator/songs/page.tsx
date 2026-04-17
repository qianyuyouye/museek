'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/lib/use-api'
import { SONG_STATUS_MAP } from '@/lib/constants'
import { pageWrap, textPageTitle, cardCls, btnPrimary, btnGhost } from '@/lib/ui-tokens'

// ── Types ──────────────────────────────────────────────────────

interface Song {
  id: number
  userId: number
  title: string
  lyricist: string
  composer: string
  aiTool: string
  genre: string
  bpm: number
  status: string
  score: number | null
  copyrightCode: string
  isrc: string | null
  likeCount: number
  createdAt: string
  cover: string
}

interface ReviewData {
  id: number
  technique: number
  creativity: number
  commercial: number
  totalScore: number
  comment: string
  tags: unknown
  reviewer: { name: string | null }
  reviewedAt: string
}

interface DistributionData {
  id: number
  platform: string
  status: string
  liveDate: string | null
}

interface SongDetail extends Song {
  reviews: ReviewData[]
  distributions: DistributionData[]
}

// ── Tab definitions ─────────────────────────────────────────────

type TabKey = 'all' | 'pending_review' | 'needs_revision' | 'in_library' | 'published'

const TAB_DEFS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending_review', label: '待评分' },
  { key: 'needs_revision', label: '需修改' },
  { key: 'in_library', label: '已入库' },
  { key: 'published', label: '已发行' },
]

// ── Waveform SVG ───────────────────────────────────────────────

function WaveformPlayer() {
  const [playing, setPlaying] = useState(false)
  const [bars] = useState(() =>
    Array.from({ length: 60 }, (_, i) => 12 + Math.sin(i * 0.5) * 18 + Math.random() * 14)
  )

  return (
    <div className={`${cardCls} !p-4`}>
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => setPlaying(!playing)}
          className="w-10 h-10 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white flex items-center justify-center text-lg border-0 cursor-pointer shadow-[0_2px_8px_rgba(99,102,241,0.3)]"
        >
          {playing ? '⏸' : '▶'}
        </button>
        <div className="flex-1">
          <div className="text-sm font-medium text-[var(--text)]">my_song.wav</div>
          <div className="text-xs text-[var(--text3)]">3:18 · 3.2MB · WAV</div>
        </div>
      </div>
      <svg viewBox="0 0 600 60" className="w-full h-[60px]">
        {bars.map((h, i) => (
          <rect
            key={i}
            x={i * 10}
            y={30 - h / 2}
            width={6}
            height={h}
            rx={3}
            fill={i < (playing ? 30 : 0) ? 'var(--accent)' : 'var(--border)'}
          />
        ))}
      </svg>
      <div className="flex justify-between text-[11px] text-[var(--text3)] mt-1">
        <span>{playing ? '1:39' : '0:00'}</span>
        <span>3:18</span>
      </div>
    </div>
  )
}

// ── Badge ───────────────────────────────────────────────────────

function Badge({ status }: { status: string }) {
  const st = SONG_STATUS_MAP[status] || { label: status, color: '#64748b', bg: '#f1f5f9' }
  return (
    <span
      className="text-xs px-2.5 py-0.5 rounded-full font-medium inline-block"
      style={{ color: st.color, background: st.bg }}
    >
      {st.label}
    </span>
  )
}

// ── Score color helper ──────────────────────────────────────────

function scoreColor(v: number): string {
  if (v >= 80) return 'var(--green2)'
  if (v >= 60) return 'var(--orange)'
  return 'var(--red)'
}

// ── Main Component ─────────────────────────────────────────────

export default function CreatorSongsPage() {
  const [tab, setTab] = useState<TabKey>('all')
  const [detail, setDetail] = useState<number | null>(null)

  const statusParam = tab === 'all' ? '' : tab
  const { data, loading } = useApi<{ list: Song[]; total: number }>(`/api/creator/songs?status=${statusParam}`, [tab])

  const mySongs = data?.list ?? []

  // Count per tab - we only have data for current tab, so show counts from current data
  // For tabs, the API returns filtered data; we show the current count
  const tabCounts: Record<TabKey, number | null> = {
    all: null,
    pending_review: null,
    needs_revision: null,
    in_library: null,
    published: null,
  }

  // ── Detail View ──────────────────────────────────────────────

  const { data: detailData, loading: detailLoading } = useApi<SongDetail>(
    detail !== null ? `/api/creator/songs/${detail}` : null,
    [detail],
  )

  if (detail !== null) {
    if (detailLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-[var(--text3)]">加载中...</div>
        </div>
      )
    }

    const song = detailData ?? mySongs.find((s) => s.id === detail)
    if (!song) return null
    const review = detailData?.reviews?.[0] ?? null
    const dists = detailData?.distributions ?? []

    return (
      <div className={pageWrap}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={textPageTitle}>{song.title}</h1>
            <p className="mt-1 text-sm text-[var(--text2)]">
              版权编号：{song.copyrightCode}
            </p>
          </div>
          <button className={btnGhost} onClick={() => setDetail(null)}>
            ← 返回列表
          </button>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Left: Song Info */}
          <div className={cardCls}>
            {/* Cover + status + title */}
            <div className="flex items-center gap-4 mb-4">
              <div className="text-[56px] w-20 h-20 bg-[#f0f4fb] rounded-xl flex items-center justify-center">
                {song.cover}
              </div>
              <div>
                <Badge status={song.status} />
                <div className="text-lg font-semibold mt-1.5">{song.title}</div>
                <div className="text-[13px] text-[var(--text3)]">上传于 {song.createdAt}</div>
              </div>
            </div>

            {/* Waveform */}
            <WaveformPlayer />

            {/* Meta info 2-column */}
            <div className="grid grid-cols-2 gap-2 mt-3 text-[13px]">
              {(
                [
                  ['作词', song.lyricist],
                  ['作曲', song.composer],
                  ['AI工具', song.aiTool],
                  ['流派', song.genre],
                  ['BPM', String(song.bpm)],
                  ['ISRC', song.isrc || '待申报'],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="px-2 py-2 bg-[#f0f4fb] rounded-md">
                  <span className="text-[var(--text3)]">{k}：</span>
                  {v}
                </div>
              ))}
            </div>

            {/* Revision button */}
            {song.status === 'needs_revision' && (
              <div className="mt-4">
                <Link href={`/creator/upload?songId=${song.id}`}>
                  <button className={btnPrimary}>📝 修改并重新提交</button>
                </Link>
              </div>
            )}
          </div>

          {/* Right: Review + Distribution */}
          <div>
            {review && (
              <div className={`${cardCls} mb-4`}>
                <h3 className="text-[15px] font-semibold mb-3.5">📊 评分成绩单</h3>

                {/* 3 dimension scores */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {(
                    [
                      ['技术', review.technique, '30%'],
                      ['创意', review.creativity, '40%'],
                      ['商业', review.commercial, '30%'],
                    ] as [string, number, string][]
                  ).map(([label, value, weight]) => (
                    <div
                      key={label}
                      className="text-center p-3 bg-[#f0f4fb] rounded-lg"
                    >
                      <div
                        className="text-2xl font-bold"
                        style={{ color: scoreColor(value) }}
                      >
                        {value}
                      </div>
                      <div className="text-xs text-[var(--text3)]">
                        {label} ({weight})
                      </div>
                    </div>
                  ))}
                </div>

                {/* Weighted total */}
                <div className="text-center p-4 bg-gradient-to-br from-[rgba(99,102,241,0.1)] to-[rgba(6,148,162,0.1)] rounded-[10px] mb-3.5">
                  <div className="text-xs text-[var(--text3)]">加权总分</div>
                  <div
                    className="text-4xl font-bold"
                    style={{ color: review.totalScore >= 80 ? 'var(--green2)' : 'var(--orange)' }}
                  >
                    {review.totalScore}
                  </div>
                </div>

                {/* Teacher comment */}
                <div className="text-[13px] text-[var(--text2)] leading-relaxed p-3 bg-[#f0f4fb] rounded-lg">
                  <div className="font-semibold mb-1.5 text-[var(--text)]">老师评语：</div>
                  {review.comment}
                </div>
              </div>
            )}

            {dists.length > 0 && (
              <div className={cardCls}>
                <h3 className="text-[15px] font-semibold mb-3.5">🌐 发行渠道</h3>
                {dists.map((d, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center py-2 border-b border-[var(--border)] last:border-b-0"
                  >
                    <span className="text-[13px]">{d.platform}</span>
                    <span
                      className="text-xs"
                      style={{
                        color:
                          d.status === 'live'
                            ? 'var(--green2)'
                            : d.status === 'submitted'
                              ? 'var(--orange)'
                              : 'var(--text3)',
                      }}
                    >
                      {d.status === 'live' ? '✅ 已上架' : '⏳ ' + d.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!review && (
              <div className={cardCls}>
                <div className="text-center py-5">
                  <div className="text-[40px]">⏳</div>
                  <p className="mt-2 text-[var(--text2)] text-sm">等待老师评分中...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-[var(--text3)]">加载中...</div>
      </div>
    )
  }

  // ── List View ────────────────────────────────────────────────

  return (
    <div className={pageWrap}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={textPageTitle}>我的作品库</h1>
          <p className="mt-1 text-sm text-[var(--text2)]">共 {mySongs.length} 首作品</p>
        </div>
        <Link href="/creator/upload">
          <button className={btnPrimary}>+ 自由上传</button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#f0f4fb] rounded-lg p-1 w-fit">
        {TAB_DEFS.map((t) => {
          const count = tabCounts[t.key]
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setDetail(null) }}
              className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium border-0 cursor-pointer transition-all ${
                active
                  ? 'bg-white text-[var(--accent2)] shadow-sm'
                  : 'bg-transparent text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              {t.label}{count != null ? ` (${count})` : ''}
            </button>
          )
        })}
      </div>

      {/* Song Grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
        {mySongs.map((s) => (
          <div
            key={s.id}
            onClick={() => setDetail(s.id)}
            className={`${cardCls} cursor-pointer transition-all duration-200 overflow-hidden hover:border-[var(--accent)] hover:-translate-y-0.5`}
          >
            {/* Cover */}
            <div className="text-5xl text-center py-4 bg-[#f0f4fb] rounded-[10px] mb-2.5">
              {s.cover}
            </div>

            {/* Badge */}
            <Badge status={s.status} />

            {/* Title */}
            <div className="text-sm font-semibold mt-1.5 mb-1">{s.title}</div>

            {/* Genre / Score */}
            <div className="text-xs text-[var(--text3)] flex justify-between">
              <span>{s.genre}</span>
              <span>{s.score ? `${s.score}分` : '-'}</span>
            </div>

            {/* Like count for published */}
            {s.status === 'published' && (
              <div className="text-[11px] text-[var(--text3)] mt-1">❤️ {s.likeCount}</div>
            )}
          </div>
        ))}
      </div>

      {mySongs.length === 0 && (
        <div className={`${cardCls} text-center py-12`}>
          <div className="text-4xl mb-3">📭</div>
          <p className="text-[var(--text3)] text-sm">该分类下暂无作品</p>
        </div>
      )}
    </div>
  )
}
