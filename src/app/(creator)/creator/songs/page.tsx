'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useApi } from '@/lib/use-api'
import { SONG_STATUS_MAP } from '@/lib/constants'
import { pageWrap, textPageTitle, cardCls, btnPrimary, btnGhost } from '@/lib/ui-tokens'
import { formatDateTime } from '@/lib/format'
import { CheckCircle2, Hourglass, Heart, Music, Search, AlertCircle } from 'lucide-react'
import { Waveform } from '@/components/audio/waveform'

// ── Types ──────────────────────────────────────────────────────

interface Song {
  id: number
  userId: number
  title: string
  lyricist: string
  composer: string
  aiTools?: string[] | null
  genre: string
  bpm: number
  status: string
  score: number | null
  copyrightCode: string
  likeCount: number
  createdAt: string
  audioUrl?: string | null
  coverUrl?: string | null
}

interface ReviewData {
  id: number
  lyricsScore: number
  melody: number
  arrangement: number
  styleCreativity: number
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

interface ReviewMark {
  t: number
  note: string
}

function WaveformPlayer({
  audioUrl,
  title,
  marks,
}: {
  audioUrl?: string | null
  title?: string
  marks?: ReviewMark[]
}) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0~1
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => {
      setProgress(el.duration > 0 ? el.currentTime / el.duration : 0)
      setCurrentTime(el.currentTime)
    }
    const onLoaded = () => setDuration(el.duration || 0)
    const onEnd = () => { setPlaying(false); setProgress(0) }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('ended', onEnd)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('ended', onEnd)
    }
  }, [])

  const toggle = () => {
    const el = audioRef.current
    if (!el) { setPlaying(!playing); return }
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

  const seekTo = (sec: number) => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = Math.max(0, Math.min(el.duration || 0, sec))
    setCurrentTime(el.currentTime)
  }

  const validMarks = (marks || []).filter((m) => typeof m?.t === 'number' && typeof m?.note === 'string')

  return (
    <div className={`${cardCls} !p-4`}>
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={toggle}
          className="w-10 h-10 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white flex items-center justify-center text-lg border-0 cursor-pointer shadow-[0_2px_8px_rgba(99,102,241,0.3)]"
        >
          {playing ? '⏸' : '▶'}
        </button>
        <div className="flex-1">
          <div className="text-sm font-medium text-[var(--text)]">{title || 'audio.mp3'}</div>
          <div className="text-xs text-[var(--text3)]">{audioUrl ? 'Web Audio 解码' : '无音频文件'}</div>
        </div>
      </div>
      <div className="relative">
        <Waveform src={audioUrl} progress={progress} animate={playing} />
        {/* 评审时间轴标记（只读） */}
        {validMarks.length > 0 && duration > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {validMarks.map((m, i) => (
              <div
                key={`mark-${i}`}
                className="absolute top-0 bottom-0 w-[2px] bg-[var(--orange)]"
                style={{ left: `${(m.t / duration) * 100}%` }}
                title={`${formatTime(m.t)} ${m.note}`}
              />
            ))}
          </div>
        )}
      </div>
      {audioUrl ? <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" /> : null}
      <div className="flex justify-between text-[11px] text-[var(--text3)] mt-1">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {validMarks.length > 0 && (
        <div className="mt-3 border-t border-[var(--border)] pt-2">
          <div className="text-xs text-[var(--text3)] mb-1.5">
            🕘 评审时间轴 ({validMarks.length})
          </div>
          <div className="flex flex-col gap-1 max-h-[140px] overflow-auto">
            {validMarks.map((m, i) => (
              <button
                type="button"
                key={`mark-row-${i}`}
                onClick={() => seekTo(m.t)}
                className="flex items-center gap-2 text-xs bg-[var(--bg3)] rounded px-2 py-1 border border-[var(--border)] hover:border-[var(--accent)] text-left cursor-pointer"
              >
                <span className="text-[var(--accent2)] font-mono shrink-0">{formatTime(m.t)}</span>
                <span className="flex-1 text-[var(--text2)] break-words">{m.note}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Badge ───────────────────────────────────────────────────────

function Badge({ status }: { status: string }) {
  const st = SONG_STATUS_MAP[status] || { label: status, color: 'var(--text2)', bg: '#f1f5f9' }
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
  const [tabCounts, setTabCounts] = useState<Record<TabKey, number | null>>({
    all: null, pending_review: null, needs_revision: null, in_library: null, published: null,
  })

  // 首次加载时拉取各状态歌曲数量
  useEffect(() => {
    Promise.allSettled(
      ['all', 'pending_review', 'needs_revision', 'in_library', 'published'].map(async (s) => {
        const r = await fetch(`/api/creator/songs?status=${s}&pageSize=1`, { credentials: 'include' })
        const j = await r.json()
        return { key: s as TabKey, count: j.code === 200 ? j.data.total : 0 }
      }),
    ).then(results => {
      const counts: Record<TabKey, number> = {
        all: 0, pending_review: 0, needs_revision: 0, in_library: 0, published: 0,
      }
      for (const r of results) {
        if (r.status === 'fulfilled') counts[r.value.key] = r.value.count
      }
      setTabCounts(counts)
    })
  }, [])

  const statusParam = tab === 'all' ? '' : tab
  const { data, loading } = useApi<{ list: Song[]; total: number }>(`/api/creator/songs?status=${statusParam}`, [tab])

  const mySongs = data?.list ?? []

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
              作品编号：{song.copyrightCode}
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
              <div className="w-20 h-20 bg-[var(--bg4)] rounded-xl flex items-center justify-center">
                <Music size={36} className="text-[var(--text3)]" />
              </div>
              <div>
                <Badge status={song.status} />
                <div className="text-lg font-semibold mt-1.5">{song.title}</div>
                <div className="text-[13px] text-[var(--text3)]">上传于 {formatDateTime(song.createdAt)}</div>
              </div>
            </div>

            {/* Waveform + 评审时间轴 marks */}
            <WaveformPlayer
              audioUrl={song.audioUrl}
              title={song.title}
              marks={
                review && review.tags && typeof review.tags === 'object' && 'marks' in review.tags
                  ? ((review.tags as { marks?: ReviewMark[] }).marks ?? [])
                  : []
              }
            />

            {/* Meta info 2-column */}
            <div className="grid grid-cols-2 gap-2 mt-3 text-[13px]">
              {(
                [
                  ['作词', song.lyricist],
                  ['作曲', song.composer],
                  ['AI工具', (song.aiTools ?? []).join(', ') || '—'],
                  ['流派', song.genre],
                  ['BPM', String(song.bpm)],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="px-2 py-2 bg-[var(--bg4)] rounded-md">
                  <span className="text-[var(--text3)]">{k}：</span>
                  {v}
                </div>
              ))}
            </div>

            {/* Revision button */}
            {song.status === 'needs_revision' && (
              <div className="mt-4">
                <Link href={`/creator/upload?songId=${song.id}`}>
                  <button className={btnPrimary}><AlertCircle size={14} className="inline mr-1 -mt-0.5" />修改并重新提交</button>
                </Link>
              </div>
            )}
          </div>

          {/* Right: Review + Distribution */}
          <div>
            {review && (
              <div className={`${cardCls} mb-4`}>
                <h3 className="text-[15px] font-semibold mb-3.5">📊 评分成绩单</h3>

                {/* 5 dimension scores */}
                <div className="grid grid-cols-5 gap-3 mb-4">
                  {(
                    [
                      ['词', review.lyricsScore, '15%'],
                      ['曲', review.melody, '15%'],
                      ['编曲', review.arrangement, '20%'],
                      ['风格创意', review.styleCreativity, '20%'],
                      ['商业潜力', review.commercial, '30%'],
                    ] as [string, number, string][]
                  ).map(([label, value, weight]) => (
                    <div
                      key={label}
                      className="text-center p-3 bg-[var(--bg4)] rounded-lg"
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
                <div className="text-[13px] text-[var(--text2)] leading-relaxed p-3 bg-[var(--bg4)] rounded-lg">
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
                      {d.status === 'live' ? (<> <CheckCircle2 size={12} className="inline mr-1" />已上架</>) : (<><Hourglass size={12} className="inline mr-1" />{d.status}</>)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!review && (
              <div className={cardCls}>
                <div className="text-center py-5">
                  <div className="text-[40px] text-[var(--text3)]"><Hourglass size={40} className="mx-auto" /></div>
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
      <div className="flex gap-1 bg-[var(--bg4)] rounded-lg p-1 w-fit">
        {TAB_DEFS.map((t) => {
          const count = tabCounts[t.key]
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setDetail(null) }}
              className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium border-0 cursor-pointer transition-all ${
                active
                  ? 'bg-[var(--bg3)] text-[var(--accent2)] shadow-sm'
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
            <div className="w-full aspect-square bg-[var(--bg4)] rounded-[10px] mb-2.5 overflow-hidden">
              {s.coverUrl ? (
                <img src={s.coverUrl} alt={s.title} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Music size={32} className="text-[var(--text3)]" />
                </div>
              )}
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
              <div className="text-[11px] text-[var(--text3)] mt-1"><Heart size={12} className="inline text-[var(--red)] fill-[var(--red)]" /> {s.likeCount}</div>
            )}
          </div>
        ))}
      </div>

      {mySongs.length === 0 && (
        <div className={`${cardCls} text-center py-12`}>
          <div className="w-16 h-16 rounded-full bg-[var(--bg4)] border border-[var(--border)] flex items-center justify-center mx-auto mb-3">
            <Search size={28} className="text-[var(--text3)]" />
          </div>
          <p className="text-[var(--text3)] text-sm">该分类下暂无作品</p>
        </div>
      )}
    </div>
  )
}
