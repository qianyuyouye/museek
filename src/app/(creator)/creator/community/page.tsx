'use client'

import { useState, useMemo, useEffect, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, textPageTitle } from '@/lib/ui-tokens'
import { Flame, Star, Music, Play, Pause, Heart, Share2, Inbox, X } from 'lucide-react'

// ── Constants ───────────────────────────────────────────────────

const TABS = [
  { key: 'hot', label: '热门', icon: Flame },
  { key: 'featured', label: '精选', icon: Star },
  { key: 'all', label: '全部', icon: Music },
  { key: 'favorites', label: '我的收藏', icon: Heart },
] as const

type TabKey = (typeof TABS)[number]['key']

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #1a1a2e, #3a3a5e)'

// ── Types ──────────────────────────────────────────────────────

interface PublishedSong {
  id: number
  userId: number
  title: string
  genre: string
  coverUrl: string | null
  audioUrl: string | null
  score: number | null
  likeCount: number
  copyrightCode: string
  authorName?: string
}

// ── Toast Component ─────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-[fadeInDown_0.3s_ease]">
      <div className="px-5 py-3 rounded-xl text-sm font-medium shadow-lg bg-[var(--bg3)] text-[var(--accent)] border border-[var(--border)]">
        {message}
      </div>
    </div>
  )
}

// ── Mini Waveform Player ────────────────────────────────────────

function MiniWaveform({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 120 24" className="w-full h-6" preserveAspectRatio="none">
      {Array.from({ length: 30 }).map((_, i) => {
        const h = 4 + Math.random() * 16
        return (
          <rect
            key={i}
            x={i * 4}
            y={(24 - h) / 2}
            width={2.5}
            rx={1.25}
            height={h}
            fill={playing ? 'var(--accent)' : '#c7d2fe'}
            opacity={playing ? 0.6 + Math.random() * 0.4 : 0.4}
          >
            {playing && (
              <animate
                attributeName="height"
                values={`${h};${4 + Math.random() * 16};${h}`}
                dur={`${0.4 + Math.random() * 0.6}s`}
                repeatCount="indefinite"
              />
            )}
          </rect>
        )
      })}
    </svg>
  )
}

// ── Song Card ───────────────────────────────────────────────────

function SongCard({
  song,
  liked,
  likeCount,
  onToggleLike,
  onShare,
  playing,
  onTogglePlay,
}: {
  song: PublishedSong
  liked: boolean
  likeCount: number
  onToggleLike: () => void
  onShare: () => void
  playing: boolean
  onTogglePlay: () => void
}) {
  const authorName = song.authorName ?? '未知作者'

  return (
    <div className="rounded-xl overflow-hidden bg-[var(--bg3)] border border-[var(--border)] shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-all hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(99,102,241,0.15)] group">
      {/* Cover */}
      <div
        className="relative h-[140px] flex items-center justify-center overflow-hidden"
        style={song.coverUrl ? undefined : { background: DEFAULT_GRADIENT }}
      >
        {song.coverUrl ? (
          <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
        ) : (
          <Music size={56} className="text-white/40" />
        )}
        {/* Score badge */}
        {song.score != null && (
          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[10px] font-bold bg-black/30 backdrop-blur-sm text-white flex items-center gap-1">
            <Star size={10} className="inline" /> {song.score}
          </span>
        )}
        {/* Genre badge */}
        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-medium bg-black/30 backdrop-blur-sm text-white">
          {song.genre}
        </span>
      </div>

      {/* Info */}
      <div className="p-3.5">
        <h3 className="text-[13px] font-semibold text-[var(--text)] leading-snug mb-1 truncate">
          {song.title}
        </h3>
        <p className="text-[11px] text-[var(--text3)] mb-3 truncate">
          {authorName} · {song.genre}
        </p>

        {/* Mini waveform player */}
        <div
          className="flex items-center gap-2 mb-3 cursor-pointer"
          onClick={onTogglePlay}
        >
          <button className="w-7 h-7 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white flex items-center justify-center cursor-pointer border-0 shadow-sm shrink-0">
            {playing ? <Pause size={11} /> : <Play size={11} className="ml-0.5" />}
          </button>
          <div className="flex-1 min-w-0">
            <MiniWaveform playing={playing} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-1 text-[12px] border-0 bg-transparent cursor-pointer transition-colors px-0"
            style={{ color: liked ? 'var(--red)' : 'var(--text3)' }}
            onClick={onToggleLike}
          >
            <Heart size={13} fill={liked ? 'currentColor' : 'none'} /> {likeCount}
          </button>
          <button
            className="flex items-center gap-1 text-[12px] text-[var(--text3)] border-0 bg-transparent cursor-pointer hover:text-[var(--accent)] transition-colors px-0"
            onClick={onShare}
          >
            <Share2 size={13} /> 分享
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────

export default function CreatorCommunityPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="text-sm text-[var(--text3)]">加载中...</div></div>}>
      <CommunityInner />
    </Suspense>
  )
}

function CommunityInner() {
  const searchParams = useSearchParams()
  const initialViewId = (() => {
    const v = searchParams.get('view')
    return v && !isNaN(parseInt(v, 10)) ? parseInt(v, 10) : null
  })()
  return <CommunityContent initialViewId={initialViewId} />
}

function CommunityContent({ initialViewId }: { initialViewId: number | null }) {
  const [activeTab, setActiveTab] = useState<TabKey>('hot')
  const [likedSongs, setLikedSongs] = useState<Set<number>>(new Set())
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({})
  const [playingSongId, setPlayingSongId] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [viewModalId, setViewModalId] = useState<number | null>(initialViewId)

  const router = useRouter()

  // Fetch published songs from API
  const { data, loading } = useApi<{ list: PublishedSong[]; total: number }>('/api/songs/published?pageSize=50')
  const publishedSongs = data?.list ?? []

  // 初始化各歌曲的点赞数
  useEffect(() => {
    if (publishedSongs.length > 0) {
      setLikeCounts((prev) => {
        const next = { ...prev }
        for (const s of publishedSongs) next[s.id] = s.likeCount
        return next
      })
    }
  }, [publishedSongs])

  // 加载已点赞的歌曲列表
  useEffect(() => {
    fetch('/api/songs/likes', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.code === 200 && Array.isArray(j.data?.ids)) {
          setLikedSongs(new Set(j.data.ids))
        }
      })
      .catch(() => { /* ignore */ })
  }, [])

  // Filter by tab
  const filteredSongs = useMemo(() => {
    switch (activeTab) {
      case 'hot':
        return [...publishedSongs].sort((a, b) => b.likeCount - a.likeCount)
      case 'featured':
        return publishedSongs
          .filter((s) => s.score != null && s.score >= 85)
          .sort((a, b) => b.likeCount - a.likeCount)
      case 'all':
        return [...publishedSongs].sort((a, b) => b.likeCount - a.likeCount)
      case 'favorites':
        return publishedSongs
          .filter((s) => likedSongs.has(s.id))
          .sort((a, b) => b.likeCount - a.likeCount)
    }
  }, [activeTab, publishedSongs, likedSongs])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function toggleLike(songId: number) {
    const currentlyLiked = likedSongs.has(songId)
    const oldLiked = likedSongs
    const oldCount = likeCounts[songId] ?? 0

    // 乐观更新
    setLikedSongs((prev) => {
      const next = new Set(prev)
      if (next.has(songId)) next.delete(songId)
      else next.add(songId)
      return next
    })
    setLikeCounts((prev) => ({ ...prev, [songId]: currentlyLiked ? oldCount - 1 : oldCount + 1 }))

    // 调用 API 持久化
    const res = await apiCall(`/api/songs/${songId}/like`, 'POST', { liked: currentlyLiked })
    if (!res.ok) {
      // 回滚
      setLikedSongs(oldLiked)
      setLikeCounts((prev) => ({ ...prev, [songId]: oldCount }))
    }
  }

  function handleShare(song: PublishedSong) {
    const url = `${window.location.origin}/creator/community?view=${song.id}`
    navigator.clipboard?.writeText(url).then(() => {
      showToast('分享链接已复制')
    }).catch(() => {
      showToast(`分享链接：${url}`)
    })
  }

  function togglePlay(songId: number) {
    setPlayingSongId((prev) => (prev === songId ? null : songId))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-[var(--text3)]">加载中...</div>
      </div>
    )
  }

  return (
    <div className={pageWrap}>
      <Toast message={toast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={textPageTitle}>作品广场</h1>
          <p className="text-xs text-[var(--text3)] mt-1">发现优秀的 AI 音乐作品</p>
        </div>
        <span className="text-xs text-[var(--text3)]">
          共 {filteredSongs.length} 首作品
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {TABS.map((tab) => {
          const IconComp = tab.icon
          return (
            <button
              key={tab.key}
              className={`px-4 py-[7px] rounded-full text-[13px] font-medium border-0 cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white shadow-[0_2px_8px_rgba(99,102,241,0.3)]'
                  : 'bg-[var(--bg4)] text-[var(--text2)] hover:bg-[var(--border)]'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              <IconComp size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Song Grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5">
        {filteredSongs.map((song) => (
          <SongCard
            key={song.id}
            song={song}
            liked={likedSongs.has(song.id)}
            likeCount={likeCounts[song.id] ?? song.likeCount}
            onToggleLike={() => toggleLike(song.id)}
            onShare={() => handleShare(song)}
            playing={playingSongId === song.id}
            onTogglePlay={() => togglePlay(song.id)}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredSongs.length === 0 && (
        <div className="text-center py-20 text-[var(--text3)]">
          <Inbox size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">暂无作品</p>
        </div>
      )}

      {/* 作品详情弹窗 */}
      {viewModalId !== null && <ViewModal songId={viewModalId} onClose={() => { setViewModalId(null); router.replace('/creator/community') }} />}
    </div>
  )
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── 作品详情 Modal ────────────────────────────────────────────────

function ViewModal({ songId, onClose }: { songId: number; onClose: () => void }) {
  const { data, loading } = useApi<{ list: PublishedSong[]; total: number }>(`/api/songs/published?pageSize=50`)
  const song = data?.list?.find((s) => s.id === songId) ?? null
  const authorName = song?.authorName ?? '未知作者'
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => { setProgress(el.currentTime / el.duration); setCurrentTime(el.currentTime) }
    const onMeta = () => setDuration(el.duration)
    const onEnd = () => { setPlaying(false); setProgress(0) }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('ended', onEnd)
    return () => { el.removeEventListener('timeupdate', onTime); el.removeEventListener('loadedmetadata', onMeta); el.removeEventListener('ended', onEnd) }
  }, [])

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (playing) { el.pause(); setPlaying(false) }
    else { el.play().then(() => setPlaying(true)).catch(() => setPlaying(false)) }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current
    if (!el || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    el.currentTime = ratio * duration
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="text-base font-semibold">{loading ? '加载中...' : song?.title || '作品详情'}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg4)] cursor-pointer border-0 bg-transparent">
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="py-12 text-center text-sm text-[var(--text3)]">加载中...</div>
        )}

        {!loading && song && (
          <div className="p-4 space-y-4">
            {/* Cover */}
            <div className="w-full aspect-square bg-[var(--bg4)] rounded-xl overflow-hidden">
              {song.coverUrl ? (
                <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Music size={48} className="text-[var(--text3)]" />
                </div>
              )}
            </div>

            {/* Title + Author */}
            <div>
              <h4 className="text-lg font-bold">{song.title}</h4>
              <p className="text-sm text-[var(--text3)] mt-1">{authorName} · {song.genre}</p>
            </div>

            {/* Audio Player */}
            {song.audioUrl && (
              <div className="p-3 bg-[var(--bg4)] rounded-xl">
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="w-10 h-10 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white flex items-center justify-center cursor-pointer border-0 shadow-sm shrink-0"
                  >
                    {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </button>
                  <div
                    className="flex-1 h-2 bg-[var(--bg3)] rounded-full cursor-pointer overflow-hidden"
                    onClick={seek}
                  >
                    <div
                      className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] rounded-full transition-all"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-[var(--text3)] font-mono w-16 text-right">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <audio ref={audioRef} src={song.audioUrl} preload="metadata" className="hidden" />
              </div>
            )}

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-[var(--bg4)] rounded-md">
                <span className="text-[var(--text3)]">流派：</span>{song.genre || '—'}
              </div>
              <div className="p-2 bg-[var(--bg4)] rounded-md">
                <span className="text-[var(--text3)]">评分：</span>{song.score != null ? `${song.score}分` : '—'}
              </div>
              <div className="p-2 bg-[var(--bg4)] rounded-md">
                <span className="text-[var(--text3)]">点赞：</span>{song.likeCount}
              </div>
              <div className="p-2 bg-[var(--bg4)] rounded-md">
                <span className="text-[var(--text3)]">作品编号：</span>{song.copyrightCode}
              </div>
            </div>
          </div>
        )}

        {!loading && !song && (
          <div className="py-12 text-center text-sm text-[var(--text3)]">该作品已下架或不存在</div>
        )}
      </div>
    </div>
  )
}
