'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, textPageTitle, textSectionTitle, cardCls, btnPrimary, labelCls } from '@/lib/ui-tokens'

// ── Types ──────────────────────────────────────────────────────

interface SongDetail {
  id: number
  title: string
  userId: number
  cover: string
  genre: string
  bpm: number
  aiTool: string
  status: string
  studentName?: string
}

// ── Waveform bars (static SVG-like) ─────────────────────────────
function WaveformPlayer({ isPlaying = false }: { isPlaying?: boolean }) {
  const bars = 40
  const heights = useMemo(
    () => Array.from({ length: bars }, () => 8 + Math.random() * 42),
    [],
  )
  const delays = useMemo(
    () =>
      Array.from({ length: bars }, () => [
        0.5 + Math.random() * 0.8,
        Math.random() * 0.5,
      ]),
    [],
  )

  return (
    <div className="flex items-end gap-[3px] h-[50px] py-2">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-sm bg-gradient-to-t from-[var(--accent)] to-[#818cf8]"
          style={{
            animation: isPlaying ? `waveAnim ${delays[i][0]}s ease-in-out ${delays[i][1]}s infinite` : 'none',
            height: isPlaying ? h : 8 + (h - 8) * 0.3,
            transition: 'height 0.3s ease',
          }}
        />
      ))}
      <span className="ml-2 text-xs text-[var(--text2)] whitespace-nowrap">
        3:24 / 3:24
      </span>
      <style>{`
        @keyframes waveAnim {
          0% { height: 8px; }
          50% { height: 24px; }
          100% { height: 8px; }
        }
      `}</style>
    </div>
  )
}

// ── AI Analysis Panel ──────────────────────────────────────────
function AIAnalysisPanel({ songId, bpm }: { songId: number; bpm?: number }) {
  const { data, loading } = useApi<{
    detectedBpm: string; key: string; loudness: string;
    spectrum: string; structure: string; productionQuality: string; summary: string
  }>(`/api/review/songs/${songId}/analysis`, [songId])

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

  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm text-[var(--accent2)] py-2">
        🤖 AI预分析报告（仅供参考）{loading ? ' 分析中...' : data?.summary ? ` · ${data.summary}` : ''}
      </summary>
      <div className="p-3 bg-[var(--bg4)] rounded-lg mt-2 text-xs grid grid-cols-2 gap-2">
        {items.map(([k, v]) => (
          <div key={k} className="p-1.5 bg-white rounded">
            <span className="text-[var(--text3)]">{k}：</span>{v}
          </div>
        ))}
      </div>
    </details>
  )
}

// ── Score color helper ──────────────────────────────────────────
function scoreColor(v: number) {
  if (v >= 80) return 'var(--green2)'
  if (v >= 60) return 'var(--orange)'
  return 'var(--red)'
}

// ── Quick tags ──────────────────────────────────────────────────
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

// ── Empty state ─────────────────────────────────────────────────
function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-[var(--text3)]">
      <div className="text-5xl mb-4">📭</div>
      <div className="text-sm">{text}</div>
    </div>
  )
}

// ── Toast ───────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState('')
  const show = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 3000)
  }
  const Toast = msg ? (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--text)] text-white px-5 py-3 rounded-xl text-sm shadow-lg animate-[fadeIn_0.2s]">
      {msg}
    </div>
  ) : null
  return { show, Toast }
}

// ═══════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════

export default function ReviewAssessPage() {
  const router = useRouter()
  const { show: showToast, Toast } = useToast()

  // ── Resolve song ID from localStorage ──────────────────────
  const [songId, setSongId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('currentReviewSongId')
      if (stored) {
        setSongId(stored)
      }
    } catch {
      /* ignore */
    }
  }, [])

  // Fetch song detail from API
  const { data: song, loading } = useApi<SongDetail>(
    songId ? `/api/review/songs/${songId}` : null,
    [songId],
  )

  // ── Scoring state ─────────────────────────────────────────
  const [scores, setScores] = useState({
    technique: 75,
    creativity: 80,
    commercial: 70,
  })
  const total = +(
    scores.technique * 0.3 +
    scores.creativity * 0.4 +
    scores.commercial * 0.3
  ).toFixed(1)

  const [comment, setComment] = useState('')
  const [quickTags, setQuickTags] = useState<string[]>([])
  const [recommendation, setRecommendation] = useState('strongly_recommend')
  const [playSpeed, setPlaySpeed] = useState('1.0x')
  const [isPlaying, setIsPlaying] = useState(false)
  const [abLoop, setAbLoop] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-[var(--text3)]">加载中...</div>
      </div>
    )
  }

  // ── Empty ─────────────────────────────────────────────────
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
            <button
              className={btnPrimary}
              onClick={() => router.push('/review/queue')}
            >
              返回列表
            </button>
          </div>
        </div>
      </div>
    )
  }

  const studentName = song.studentName ?? '未知学生'

  // ── Tag toggle handler ────────────────────────────────────
  const toggleTag = (t: string) => {
    if (quickTags.includes(t)) {
      setQuickTags((p) => p.filter((x) => x !== t))
      // Remove from comment
      setComment((c) => {
        const parts = c.split('；').filter((x) => x.trim() !== t)
        return parts.join('；')
      })
    } else {
      setQuickTags((p) => [...p, t])
      setComment((c) => (c ? c + '；' + t : t))
    }
  }

  // ── Submit handler ────────────────────────────────────────
  const handleSubmit = async () => {
    if (comment.length < 20) {
      showToast('❌ 评语至少20字')
      return
    }

    setSubmitting(true)
    const res = await apiCall('/api/review/submit', 'POST', {
      songId: song.id,
      technique: scores.technique,
      creativity: scores.creativity,
      commercial: scores.commercial,
      tags: quickTags.length > 0 ? quickTags : undefined,
      comment,
      recommendation,
    })
    setSubmitting(false)

    if (res.ok) {
      // Clear localStorage
      try {
        localStorage.removeItem('currentReviewSongId')
        localStorage.removeItem('reviewSong')
      } catch {
        /* ignore */
      }

      showToast(`✅ 评审完成！总分 ${total}`)
      setTimeout(() => router.push('/review/queue'), 1200)
    } else {
      showToast(`❌ ${res.message || '提交失败'}`)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className={pageWrap}>
      {Toast}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={textPageTitle}>
            歌曲评审{' '}
            <span className="text-sm font-normal text-[var(--text3)] ml-2">
              {song.title} · {studentName}
            </span>
          </h1>
        </div>
        <button
          className="text-sm text-[var(--text2)] hover:text-[var(--accent)] cursor-pointer bg-transparent border border-[var(--border)] px-4 py-2 rounded-lg font-medium"
          onClick={() => router.push('/review/queue')}
        >
          ← 返回列表
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-5">
        {/* ──────────── LEFT COLUMN ──────────── */}
        <div>
          <div className={cardCls}>
            {/* Song info header */}
            <div className="flex items-center gap-4 mb-4">
              <div className="text-5xl w-[72px] h-[72px] bg-[var(--bg4)] rounded-[10px] flex items-center justify-center shrink-0">
                {song.cover}
              </div>
              <div>
                <div className="text-lg font-semibold text-[var(--text)]">
                  {song.title}
                </div>
                <div className="text-sm text-[var(--text3)]">
                  by {studentName} · {song.genre} · {song.bpm} BPM
                </div>
              </div>
            </div>

            {/* Waveform player area */}
            <div className="p-4 bg-[var(--bg4)] rounded-[10px] mb-3.5">
              <div className="flex justify-between items-center mb-2">
                <div className="flex gap-2">
                  <button
                    className={`border-none rounded-full w-9 h-9 text-white text-base cursor-pointer flex items-center justify-center transition-all duration-200 ${isPlaying ? 'bg-[var(--green2)] shadow-[0_0_8px_rgba(22,163,74,0.4)]' : 'bg-[var(--accent)]'}`}
                    onClick={() => setIsPlaying((p) => !p)}
                  >
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <button
                    className={`border-none rounded-md px-3 text-xs cursor-pointer transition-all duration-200 ${abLoop ? 'bg-[var(--accent)] text-white shadow-[0_0_6px_rgba(99,102,241,0.3)]' : 'bg-[#f8faff] text-[var(--text2)]'}`}
                    onClick={() => setAbLoop((p) => !p)}
                  >
                    A-B循环
                  </button>
                </div>
                <select
                  className="border-none rounded-md px-2 py-1 text-xs cursor-pointer font-medium"
                  style={{
                    background: playSpeed !== '1.0x' ? 'var(--accent-glow)' : '#f8faff',
                    color: playSpeed !== '1.0x' ? 'var(--accent2)' : 'var(--text2)',
                  }}
                  value={playSpeed}
                  onChange={(e) => setPlaySpeed(e.target.value)}
                >
                  <option>0.5x</option>
                  <option>0.75x</option>
                  <option>1.0x</option>
                  <option>1.25x</option>
                  <option>1.5x</option>
                </select>
              </div>
              <WaveformPlayer isPlaying={isPlaying} />
            </div>

            {/* Metadata */}
            <div className="text-sm">
              <div className="mb-2.5">
                <span className="text-[var(--text3)]">AI工具：</span>
                {song.aiTool}
              </div>
              <div className="mb-2.5">
                <span className="text-[var(--text3)]">Prompt：</span>
                <div className="p-2 bg-[var(--bg4)] rounded-md mt-1 text-xs text-[var(--text2)] leading-relaxed">
                  使用{song.aiTool}生成，风格为{song.genre}，BPM {song.bpm}
                </div>
              </div>
              <div>
                <span className="text-[var(--text3)]">歌词：</span>
                <div className="p-2 bg-[var(--bg4)] rounded-md mt-1 text-xs text-[var(--text2)] leading-relaxed max-h-[120px] overflow-auto whitespace-pre-line">
                  {`这里是歌词内容预览区域...
每一句歌词都会在这里显示
方便老师边听边看歌词
编造人生是你的骗局
落下的内心个偶尔
拥抱真实的自己
梦想在远方等待
每一步都算数`}
                </div>
              </div>
            </div>

            {/* AI Analysis Panel */}
            <AIAnalysisPanel songId={song.id} bpm={song.bpm} />
          </div>
        </div>

        {/* ──────────── RIGHT COLUMN ──────────── */}
        <div>
          <div className={cardCls}>
            <h3 className={`${textSectionTitle} mb-5`}>📝 评分表单</h3>

            {/* Score sliders */}
            {(
              [
                { key: 'technique', label: '技术熟练度', weight: '30%' },
                { key: 'creativity', label: '创意立意', weight: '40%' },
                { key: 'commercial', label: '商业传播潜力', weight: '30%' },
              ] as const
            ).map((dim) => (
              <div key={dim.key} className="mb-5">
                <div className="flex justify-between text-sm mb-1.5">
                  <span>
                    {dim.label}{' '}
                    <span className="text-[var(--text3)]">({dim.weight})</span>
                  </span>
                  <span
                    className="font-bold text-lg"
                    style={{ color: scoreColor(scores[dim.key]) }}
                  >
                    {scores[dim.key]}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={scores[dim.key]}
                  onChange={(e) =>
                    setScores((p) => ({
                      ...p,
                      [dim.key]: +e.target.value,
                    }))
                  }
                  className="w-full accent-[var(--accent)]"
                />
              </div>
            ))}

            {/* Weighted total */}
            <div
              className="text-center py-4 px-4 rounded-xl mb-5"
              style={{
                background:
                  'linear-gradient(135deg, rgba(108,92,231,0.15), rgba(0,206,201,0.1))',
              }}
            >
              <div className="text-xs text-[var(--text3)]">加权总分</div>
              <div
                className="text-[42px] font-bold"
                style={{ color: scoreColor(total) }}
              >
                {total}
              </div>
            </div>

            {/* Quick tags */}
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

            {/* Comment textarea */}
            <div className="mb-4">
              <label className={labelCls}>
                专业评语{' '}
                <span className="text-[var(--text3)]">（≥20字）</span>
              </label>
              <textarea
                className="w-full px-3.5 py-2.5 bg-white border-[1.5px] border-[var(--border)] rounded-lg text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] resize-y"
                style={{ height: 100 }}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="请输入详细的专业指导评语..."
              />
            </div>

            {/* Recommendation radio */}
            <div className="mb-5">
              <label className={labelCls}>发行建议</label>
              {[
                {
                  v: 'strongly_recommend',
                  l: '🌟 强烈推荐发行',
                  c: 'var(--green2)',
                },
                {
                  v: 'recommend_after_revision',
                  l: '📝 建议修改后发行',
                  c: 'var(--orange)',
                },
                {
                  v: 'not_recommend',
                  l: '⏸ 暂不推荐',
                  c: 'var(--text3)',
                },
              ].map((o) => (
                <label
                  key={o.v}
                  className="flex items-center gap-2 px-3 py-2 mb-1 rounded-lg cursor-pointer text-sm transition-all duration-150"
                  style={{
                    background:
                      recommendation === o.v ? 'var(--bg2)' : 'transparent',
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

            {/* Submit button */}
            <button
              className={`w-full justify-center py-3.5 text-base font-medium rounded-lg cursor-pointer border-0 bg-gradient-to-r from-[var(--green2)] to-[var(--green)] text-white shadow-[0_2px_8px_rgba(22,163,74,0.25)] ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={submitting}
              onClick={handleSubmit}
            >
              ✅ 提交评审
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
