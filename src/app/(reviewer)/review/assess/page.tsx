'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, textPageTitle, textSectionTitle, cardCls, btnPrimary, labelCls } from '@/lib/ui-tokens'
import AudioPlayer, { type AudioMark, type AudioPlayerHandle } from '@/components/review/AudioPlayer'
import { Bot, CheckCircle2, Music, ClipboardList, Search } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────

interface SongDetail {
  id: number
  title: string
  userId: number
  coverUrl?: string | null
  audioUrl?: string | null
  genre: string
  bpm: number
  aiTools: string[]
  performer?: string | null
  lyricist?: string | null
  composer?: string | null
  albumName?: string | null
  albumArtist?: string | null
  lyrics?: string | null
  styleDesc?: string | null
  creationDesc?: string | null
  contribution?: string
  status: string
  studentName?: string
}

interface ReviewDraftData {
  id: number
  songId: number
  lyrics: number | null
  melody: number | null
  arrangement: number | null
  styleCreativity: number | null
  commercial: number | null
  comment: string | null
  tags: { quick?: string[]; marks?: AudioMark[] } | null
  recommendation: string | null
  updatedAt: string
}

// ── AI Analysis Panel ──────────────────────────────────────────
function AIAnalysisPanel({ songId, bpm }: { songId: number; bpm?: number }) {
  const { data, loading, error } = useApi<{
    detectedBpm: string; key: string; loudness: string;
    spectrum: string; structure: string; productionQuality: string; summary: string
  }>(`/api/review/songs/${songId}/analysis`, [songId])
  const detailsRef = useRef<HTMLDetailsElement>(null)

  // 分析中自动展开，完成后由用户自行折叠
  useEffect(() => {
    if (loading && detailsRef.current && !detailsRef.current.open) {
      detailsRef.current.open = true
    }
  }, [loading])

  const items = data ? [
    ['检测BPM', data.detectedBpm || String(bpm || '-')],
    ['调性', data.key],
    ['响度', data.loudness],
    ['频谱', data.spectrum],
    ['段落', data.structure],
    ['制作度', data.productionQuality],
  ] : [
    ['检测BPM', String(bpm || '-')],
    ['调性', '-'], ['响度', '-'], ['频谱', '-'], ['段落', '-'], ['制作度', '-'],
  ]

  if (loading) {
    return (
      <details ref={detailsRef} className="mt-4" open>
        <summary className="cursor-pointer text-sm text-[var(--accent2)] py-2">
          <Bot className="w-4 h-4 inline mr-1 -mt-0.5" />AI预分析报告（仅供参考） 分析中...
        </summary>
        <div className="p-6 bg-[var(--bg4)] rounded-lg mt-2 text-center text-xs text-[var(--text3)]">
          <div className="inline-block w-5 h-5 border-2 border-[var(--accent2)] border-t-transparent rounded-full animate-spin mr-2" />
          AI 正在分析歌曲，请稍候...
        </div>
      </details>
    )
  }

  return (
    <details ref={detailsRef} className="mt-4">
      <summary className="cursor-pointer text-sm text-[var(--accent2)] py-2">
        <Bot className="w-4 h-4 inline mr-1 -mt-0.5" />AI预分析报告（仅供参考）{data?.summary ? ` · ${data.summary}` : ''}
      </summary>
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mt-2 text-xs text-red-400">
          ⚠ {error}
        </div>
      )}
      {!error && (
        <div className="p-3 bg-[var(--bg4)] rounded-lg mt-2 text-xs grid grid-cols-2 gap-2">
          {items.map(([k, v]) => (
            <div key={k} className="p-1.5 bg-[var(--bg3)] rounded">
              <span className="text-[var(--text3)]">{k}：</span>{v}
            </div>
          ))}
        </div>
      )}
    </details>
  )
}

function scoreColor(v: number) {
  if (v >= 80) return 'var(--green2)'
  if (v >= 60) return 'var(--orange)'
  return 'var(--red)'
}

const QUICK_TAGS = [
  '编曲结构完整',
  '旋律记忆点强',
  '人声融合度高',
  '歌词有深度',
  '建议优化混音',
  '建议调整BPM',
  'Prompt技巧有进步',
  '建议丰富流派元素',
]

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-[var(--text3)]">
      <div className="w-16 h-16 rounded-full bg-[var(--bg4)] border border-[var(--border)] flex items-center justify-center mb-4">
        <Search size={28} className="text-[var(--text3)]" />
      </div>
      <div className="text-sm">{text}</div>
    </div>
  )
}

function useToast() {
  const [msg, setMsg] = useState('')
  const show = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 3000)
  }
  const Toast = msg ? (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 text-white px-5 py-3 rounded-xl text-sm shadow-lg animate-[fadeIn_0.2s]">
      {msg}
    </div>
  ) : null
  return { show, Toast }
}

// ═══════════════════════════════════════════════════════════════

export default function ReviewAssessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { show: showToast, Toast } = useToast()

  const [songId, setSongId] = useState<string | null>(null)

  useEffect(() => {
    // 优先从 URL 参数读取，fallback localStorage（向后兼容）
    const urlId = searchParams.get('songId')
    if (urlId) {
      setSongId(urlId)
    } else {
      try {
        const stored = localStorage.getItem('currentReviewSongId')
        if (stored) setSongId(stored)
      } catch { /* ignore */ }
    }
  }, [searchParams])

  const { data: song, loading } = useApi<SongDetail>(
    songId ? `/api/review/songs/${songId}` : null,
    [songId],
  )

  // 评分 / 评语 / 标签 / marks / 推荐
  const [scores, setScores] = useState({ lyrics: 75, melody: 75, arrangement: 75, styleCreativity: 75, commercial: 75 })
  const [comment, setComment] = useState('')
  const [quickTags, setQuickTags] = useState<string[]>([])
  const [marks, setMarks] = useState<AudioMark[]>([])
  const [recommendation, setRecommendation] = useState('strongly_recommend')
  const [submitting, setSubmitting] = useState(false)
  const [draftSaved, setDraftSaved] = useState<string>('')
  const playerRef = useRef<AudioPlayerHandle>(null)
  const startAtRef = useRef<number | null>(null)
  const draftLoadedRef = useRef(false)
  const savingRef = useRef(false)

  const total = Math.round(
    scores.lyrics * 0.15 + scores.melody * 0.15 + scores.arrangement * 0.20 + scores.styleCreativity * 0.20 + scores.commercial * 0.30,
  )

  // 歌曲加载后启动计时
  useEffect(() => {
    if (song?.id && startAtRef.current === null) startAtRef.current = Date.now()
  }, [song?.id])

  // 加载草稿
  useEffect(() => {
    if (!song?.id || draftLoadedRef.current) return
    draftLoadedRef.current = true
    ;(async () => {
      try {
        const res = await fetch(`/api/review/drafts?songId=${song.id}`)
        const json = await res.json()
        if (json.code !== 200 || !json.data) return
        const d = json.data as ReviewDraftData
        if (d.lyrics != null) setScores((s) => ({ ...s, lyrics: d.lyrics! }))
        if (d.melody != null) setScores((s) => ({ ...s, melody: d.melody! }))
        if (d.arrangement != null) setScores((s) => ({ ...s, arrangement: d.arrangement! }))
        if (d.styleCreativity != null) setScores((s) => ({ ...s, styleCreativity: d.styleCreativity! }))
        if (d.commercial != null) setScores((s) => ({ ...s, commercial: d.commercial! }))
        if (d.comment) setComment(d.comment)
        if (d.recommendation) setRecommendation(d.recommendation)
        if (d.tags) {
          if (Array.isArray(d.tags.quick)) setQuickTags(d.tags.quick)
          if (Array.isArray(d.tags.marks)) setMarks(d.tags.marks)
        }
        if (d.comment || (d.tags && (d.tags.quick?.length || d.tags.marks?.length))) {
          showToast('已恢复上次草稿')
        }
      } catch { /* ignore */ }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id])

  // 自动保存草稿（500ms 防抖）
  const saveDraft = useCallback(async () => {
    if (!song?.id || submitting || savingRef.current) return
    savingRef.current = true
    try {
      const res = await apiCall('/api/review/drafts', 'POST', {
        songId: song.id,
        lyrics: scores.lyrics,
        melody: scores.melody,
        arrangement: scores.arrangement,
        styleCreativity: scores.styleCreativity,
        commercial: scores.commercial,
        comment,
        tags: { quick: quickTags, marks },
        recommendation,
      })
      if (res.ok) {
        const ts = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        setDraftSaved(ts)
      }
    } finally {
      savingRef.current = false
    }
  }, [song?.id, submitting, scores, comment, quickTags, marks, recommendation])

  useEffect(() => {
    if (!song?.id || !draftLoadedRef.current) return
    const timer = setTimeout(() => {
      saveDraft()
    }, 500)
    return () => clearTimeout(timer)
  }, [song?.id, scores, comment, quickTags, marks, recommendation, saveDraft])

  // 页面切走前最后再存一次（关闭标签/刷新/路由跳转）
  useEffect(() => {
    function beforeUnload() {
      if (!song?.id || submitting) return
      const payload = JSON.stringify({
        songId: song.id,
        lyrics: scores.lyrics,
        melody: scores.melody,
        arrangement: scores.arrangement,
        styleCreativity: scores.styleCreativity,
        commercial: scores.commercial,
        comment,
        tags: { quick: quickTags, marks },
        recommendation,
      })
      // 使用 sendBeacon 可在页面 unload 时保证送达
      try {
        navigator.sendBeacon?.(
          '/api/review/drafts',
          new Blob([payload], { type: 'application/json' }),
        )
      } catch { /* ignore */ }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [song?.id, scores, comment, quickTags, marks, recommendation, submitting])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-[var(--text3)]">加载中...</div>
      </div>
    )
  }

  if (!song) {
    return (
      <div className={pageWrap}>
        <div className="flex items-center justify-between">
          <h1 className={textPageTitle}>评审页面</h1>
          <button
            className="text-sm text-[var(--text2)] hover:text-[var(--accent)] cursor-pointer"
            onClick={() => router.push('/review/queue')}
          >
            ← 返回列表
          </button>
        </div>
        <div className={cardCls}>
          <Empty text="暂无待评审歌曲，请从待评审列表选择" />
          <div className="flex justify-center mt-4">
            <button className={btnPrimary} onClick={() => router.push('/review/queue')}>返回列表</button>
          </div>
        </div>
      </div>
    )
  }

  const studentName = song.studentName ?? '未知学生'

  const toggleTag = (t: string) => {
    if (quickTags.includes(t)) {
      setQuickTags((p) => p.filter((x) => x !== t))
      setComment((c) => c.split('；').filter((x) => x.trim() !== t).join('；'))
    } else {
      setQuickTags((p) => [...p, t])
      setComment((c) => (c ? c + '；' + t : t))
    }
  }

  const handleSubmit = async () => {
    if (comment.length < 20) { showToast('评语至少20字'); return }

    const tagsPayload = quickTags.length > 0 || marks.length > 0
      ? { quick: quickTags, marks }
      : undefined
    const durationSeconds = startAtRef.current
      ? Math.max(0, Math.floor((Date.now() - startAtRef.current) / 1000))
      : undefined

    setSubmitting(true)
    const res = await apiCall('/api/review/submit', 'POST', {
      songId: song.id,
      lyrics: scores.lyrics,
      melody: scores.melody,
      arrangement: scores.arrangement,
      styleCreativity: scores.styleCreativity,
      commercial: scores.commercial,
      tags: tagsPayload,
      comment,
      recommendation,
      durationSeconds,
    })
    setSubmitting(false)

    if (res.ok) {
      playerRef.current?.pause()
      try {
        localStorage.removeItem('currentReviewSongId')
        localStorage.removeItem('reviewSong')
      } catch { /* ignore */ }
      showToast(`评审完成！总分 ${total}`)
      setTimeout(() => router.push('/review/queue'), 1200)
    } else {
      showToast(`${res.message || '提交失败'}`)
    }
  }

  return (
    <div className={pageWrap}>
      {Toast}

      <div className="flex items-center justify-between">
        <div>
          <h1 className={textPageTitle}>
            歌曲评审{' '}
            <span className="text-sm font-normal text-[var(--text3)] ml-2">
              {song.title} · {studentName}
            </span>
          </h1>
          {draftSaved && (
            <p className="text-[11px] text-[var(--text3)] mt-1">💾 草稿已保存 · {draftSaved}</p>
          )}
        </div>
        <button
          className="text-sm text-[var(--text2)] hover:text-[var(--accent)] cursor-pointer bg-transparent border border-[var(--border)] px-4 py-2 rounded-lg font-medium"
          onClick={async () => {
            // 切走前立即同步保存
            await saveDraft()
            router.push('/review/queue')
          }}
        >
          ← 返回列表
        </button>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* LEFT */}
        <div>
          <div className={cardCls}>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-5xl w-[72px] h-[72px] bg-[var(--bg4)] rounded-[10px] flex items-center justify-center shrink-0 overflow-hidden">
                {song.coverUrl
                  ? <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                  : <Music className="w-8 h-8 text-[var(--text3)]" />}
              </div>
              <div>
                <div className="text-lg font-semibold text-[var(--text)]">{song.title}</div>
                <div className="text-sm text-[var(--text3)]">
                  by {studentName} · {song.genre} · {song.bpm} BPM
                </div>
              </div>
            </div>

            {/* Waveform player */}
            <div className="mb-3.5">
              {song.audioUrl ? (
                <AudioPlayer
                  ref={playerRef}
                  src={song.audioUrl}
                  marks={marks}
                  onMarksChange={setMarks}
                />
              ) : (
                <div className="p-4 bg-[var(--bg4)] rounded-[10px] text-center text-sm text-[var(--text3)]">
                  该作品暂无音频文件
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="text-sm space-y-2">
              {/* Theme 10: 补齐人员/专辑元数据 */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 p-2 bg-[var(--bg4)] rounded-md text-xs">
                {[
                  ['演唱', song.performer],
                  ['作词', song.lyricist],
                  ['作曲', song.composer],
                  ['专辑', song.albumName],
                  ['专辑艺人', song.albumArtist],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex gap-2">
                    <span className="text-[var(--text3)] w-14 shrink-0">{k}：</span>
                    <span className="text-[var(--text2)] break-all">{v || '-'}</span>
                  </div>
                ))}
              </div>

              <div>
                <span className="text-[var(--text3)]">AI工具：</span>
                {Array.isArray(song.aiTools) ? song.aiTools.join(', ') : '-'}
              </div>
              <div>
                <span className="text-[var(--text3)]">Prompt：</span>
                <div className="p-2 bg-[var(--bg4)] rounded-md mt-1 text-xs text-[var(--text2)] leading-relaxed whitespace-pre-wrap">
                  {song.styleDesc?.trim() || '创作者未填写 Prompt'}
                </div>
              </div>
              <div>
                <span className="text-[var(--text3)]">歌词：</span>
                <div className="p-2 bg-[var(--bg4)] rounded-md mt-1 text-xs text-[var(--text2)] leading-relaxed max-h-[120px] overflow-auto whitespace-pre-line">
                  {song.lyrics?.trim() || '创作者未填写歌词'}
                </div>
              </div>
              <div>
                <span className="text-[var(--text3)]">创作过程说明：</span>
                <div className="p-2 bg-[var(--bg4)] rounded-md mt-1 text-xs text-[var(--text2)] leading-relaxed whitespace-pre-wrap">
                  {song.creationDesc?.trim() || '创作者未填写'}
                </div>
              </div>
            </div>

            {/* <AIAnalysisPanel songId={song.id} bpm={song.bpm} /> */}
          </div>
        </div>

        {/* RIGHT */}
        <div>
          <div className={cardCls}>
            <h3 className={`${textSectionTitle} mb-5 flex items-center gap-2`}><ClipboardList className="w-4 h-4" /> 评分表单</h3>

            {(
              [
                { key: 'lyrics', label: '词', weight: '15%' },
                { key: 'melody', label: '曲', weight: '15%' },
                { key: 'arrangement', label: '编曲', weight: '20%' },
                { key: 'styleCreativity', label: '风格创意', weight: '20%' },
                { key: 'commercial', label: '商业传播潜力', weight: '30%' },
              ] as const
            ).map((dim) => (
              <div key={dim.key} className="mb-5">
                <div className="flex justify-between text-sm mb-1.5">
                  <span>
                    {dim.label}{' '}<span className="text-[var(--text3)]">({dim.weight})</span>
                  </span>
                  <span className="font-bold text-lg" style={{ color: scoreColor(scores[dim.key]) }}>
                    {scores[dim.key]}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={scores[dim.key]}
                  onChange={(e) =>
                    setScores((p) => ({ ...p, [dim.key]: +e.target.value }))
                  }
                  className="w-full accent-[var(--accent)]"
                />
              </div>
            ))}

            <div
              className="text-center py-4 px-4 rounded-xl mb-5"
              style={{ background: 'linear-gradient(135deg, rgba(108,92,231,0.15), rgba(0,206,201,0.1))' }}
            >
              <div className="text-xs text-[var(--text3)]">加权总分</div>
              <div className="text-[42px] font-bold" style={{ color: scoreColor(total) }}>{total}</div>
            </div>

            <div className="mb-4">
              <label className={labelCls}>快捷评语（点击插入）</label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TAGS.map((t) => {
                  const active = quickTags.includes(t)
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className="px-3 py-1 rounded-2xl text-xs cursor-pointer transition-all duration-200"
                      style={{
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? 'var(--accent-glow)' : 'transparent',
                        color: active ? 'var(--accent2)' : 'var(--text3)',
                      }}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mb-4">
              <label className={labelCls}>
                专业评语 <span className="text-[var(--text3)]">（≥20字）</span>
              </label>
              <textarea
                className="w-full px-3.5 py-2.5 bg-[var(--bg3)] border-[1.5px] border-[var(--border)] rounded-lg text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] resize-y"
                style={{ height: 100 }}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="请输入详细的专业指导评语..."
              />
            </div>

            <div className="mb-5">
              <label className={labelCls}>发行建议</label>
              {[
                { v: 'strongly_recommend', l: '强烈推荐发行', c: 'var(--green2)' },
                { v: 'recommend_after_revision', l: '建议修改后发行', c: 'var(--orange)' },
                { v: 'not_recommend', l: '暂不推荐', c: 'var(--text3)' },
              ].map((o) => (
                <label
                  key={o.v}
                  className="flex items-center gap-2 px-3 py-2 mb-1 rounded-lg cursor-pointer text-sm transition-all duration-150"
                  style={{
                    background: recommendation === o.v ? 'var(--bg2)' : 'transparent',
                    border: `1px solid ${recommendation === o.v ? 'var(--border2)' : 'transparent'}`,
                    color: o.c,
                  }}
                >
                  <input
                    type="radio"
                    name="recommendation"
                    value={o.v}
                    checked={recommendation === o.v}
                    onChange={() => setRecommendation(o.v)}
                    className="accent-[var(--accent)]"
                  />
                  {o.l}
                </label>
              ))}
            </div>

            <button
              className={`w-full justify-center py-3.5 text-base font-medium rounded-lg cursor-pointer border-0 bg-gradient-to-r from-[var(--green2)] to-[var(--green)] text-white shadow-[0_2px_8px_rgba(22,163,74,0.25)] ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={submitting}
              onClick={handleSubmit}
            >
              <CheckCircle2 className="w-5 h-5 inline mr-2" />提交评审
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
