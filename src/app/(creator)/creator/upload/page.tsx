'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiCall, useApi } from '@/lib/use-api'
import { extractAudioFeatures, type AudioFeatures } from '@/lib/audio-extract'
import { pageWrap, textPageTitle, cardCls, btnPrimary, btnGhost, btnSuccess, inputCls, labelCls } from '@/lib/ui-tokens'
import { CheckCircle2, Bot, Music, Copy, Check } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────

interface UploadForm {
  audioUploaded: boolean
  audioUrl: string
  audioFileName: string
  audioSize: string
  coverUploaded: boolean
  coverUrl: string
  title: string
  lyricist: string
  composer: string
  aiTool: string
  genre: string
  bpm: string
  prompt: string
  lyrics: string
  contribution: string
  creationDesc: string
  originality: boolean
  audioFeatures: AudioFeatures | null
}

const INITIAL_FORM: UploadForm = {
  audioUploaded: false,
  audioUrl: '',
  audioFileName: '',
  audioSize: '',
  coverUploaded: false,
  coverUrl: '',
  title: '',
  lyricist: '',
  composer: '',
  aiTool: 'Suno',
  genre: 'Pop',
  bpm: '120',
  prompt: '',
  lyrics: '',
  contribution: 'lead',
  creationDesc: '',
  originality: false,
  audioFeatures: null,
}

const FALLBACK_AI_TOOLS = ['汽水创作实验室', 'Suno', 'Udio', '其他']
const FALLBACK_GENRES = ['Pop', 'Rock', 'R&B', 'Hip-Hop', '电子', '古典', '民谣']
const CONTRIBUTIONS = [
  { value: 'lead', label: '主导', desc: '我提供完整构思，AI辅助生成' },
  { value: 'participant', label: '参与', desc: 'AI生成初稿后，我进行实质性修改' },
]

const STEPS = [
  { n: 1, label: '上传文件' },
  { n: 2, label: '填写信息与AI声明' },
  { n: 3, label: '确认提交' },
]

// ── Waveform Player ──────────────────────────────────────────────

function WaveformPlayer() {
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
          className="w-1 rounded-sm"
          style={{
            background: 'linear-gradient(to top, var(--accent), #818cf8)',
            animation: `waveAnim ${delays[i][0]}s ease-in-out ${delays[i][1]}s infinite`,
            height: h,
          }}
        />
      ))}
      <span className="ml-2 text-xs text-[var(--text3)] whitespace-nowrap">
        未选择音频
      </span>
      <style jsx>{`
        @keyframes waveAnim {
          0% { height: 8px; }
          50% { height: 24px; }
          100% { height: 8px; }
        }
      `}</style>
    </div>
  )
}

// ── Step Indicator ───────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.n} className="contents">
          {i > 0 && (
            <div
              className={`flex-1 h-0.5 ${current >= s.n ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
            />
          )}
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                current > s.n
                  ? 'bg-[var(--accent)] text-white'
                  : current === s.n
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg4)] text-[var(--text3)]'
              }`}
            >
              {current > s.n ? <CheckCircle2 size={16} /> : s.n}
            </div>
            <span
              className={`text-[13px] ${
                current >= s.n
                  ? 'text-[var(--text)] font-semibold'
                  : 'text-[var(--text3)] font-normal'
              }`}
            >
              {s.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Toast ────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-[fadeInDown_0.3s_ease]">
      <div
        className="px-5 py-3 rounded-xl text-sm font-medium shadow-lg bg-gray-900/95 text-white"
      >
        {message}
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────

const CONTRIBUTION_BACK: Record<string, string> = { lead: 'lead', participant: 'participant' }

export default function CreatorUploadPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<UploadForm>(INITIAL_FORM)
  const [toast, setToast] = useState('')
  const [revisionSongId, setRevisionSongId] = useState<number | null>(null)
  const [prefilling, setPrefilling] = useState(false)
  const [submitted, setSubmitted] = useState<{ id: number; copyrightCode: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // 高级信息字段（GAP-CRTR-004）
  const { data: profile } = useApi<{ realName?: string | null; name?: string | null }>('/api/profile')
  // 从管理端设置动态获取 AI 工具和流派选项
  const { data: settingsOptions } = useApi<{ aiTools?: string[]; genres?: string[] }>('/api/settings/options')
  const aiTools = settingsOptions?.aiTools ?? FALLBACK_AI_TOOLS
  const genres = settingsOptions?.genres ?? FALLBACK_GENRES
  const [performer, setPerformer] = useState('')
  const [albumName, setAlbumName] = useState('')
  const [albumArtist, setAlbumArtist] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const audioRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // 从 URL 读取 songId；存在则拉取作品详情预填（修改并重新提交场景）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('songId')
    const id = raw ? Number.parseInt(raw, 10) : NaN
    if (!Number.isFinite(id)) return

    setRevisionSongId(id)
    setPrefilling(true)
    fetch(`/api/creator/songs/${id}`)
      .then((r) => r.json())
      .then((json: { code: number; data?: {
        title?: string; lyricist?: string; composer?: string; aiTools?: string[];
        genre?: string; bpm?: number | null; lyrics?: string; styleDesc?: string;
        creationDesc?: string; contribution?: string;
        audioUrl?: string | null; coverUrl?: string | null;
        audioFeatures?: AudioFeatures | null; status?: string;
      }; message?: string }) => {
        if (json.code !== 200 || !json.data) {
          setToast(`${json.message || '加载作品失败'}`)
          setTimeout(() => setToast(''), 3000)
          return
        }
        const s = json.data
        if (s.status && s.status !== 'needs_revision') {
          setToast('仅需修改状态的作品可重新提交')
          setTimeout(() => setToast(''), 3000)
          setRevisionSongId(null)
          return
        }
        setForm({
          audioUploaded: !!s.audioUrl,
          audioUrl: s.audioUrl ?? '',
          audioFileName: s.audioUrl ? s.audioUrl.split('/').pop() ?? '' : '',
          audioSize: '',
          coverUploaded: !!s.coverUrl,
          coverUrl: s.coverUrl ?? '',
          title: s.title ?? '',
          lyricist: s.lyricist ?? '',
          composer: s.composer ?? '',
          aiTool: s.aiTools?.[0] ?? 'Suno',
          genre: s.genre ?? 'Pop',
          bpm: s.bpm != null ? String(s.bpm) : '120',
          prompt: s.styleDesc ?? '',
          lyrics: s.lyrics ?? '',
          contribution: CONTRIBUTION_BACK[s.contribution ?? 'lead'] ?? '主导',
          creationDesc: s.creationDesc ?? '',
          originality: false,
          audioFeatures: s.audioFeatures ?? null,
        })
      })
      .catch(() => {
        setToast('加载作品失败')
        setTimeout(() => setToast(''), 3000)
      })
      .finally(() => {
        setPrefilling(false)
      })
  }, [])

  // 预填高级信息 + lyricist/composer（仅在未填时）
  useEffect(() => {
    if (!profile) return
    const fallback = profile.realName?.trim() || profile.name || ''
    if (!performer) setPerformer(fallback)
    if (!albumArtist) setAlbumArtist(fallback)
    if (!albumName) setAlbumName(form.title ?? '')
    if (!form.lyricist) setForm((f) => ({ ...f, lyricist: fallback }))
    if (!form.composer) setForm((f) => ({ ...f, composer: fallback }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, form.title])

  const upd = useCallback(
    <K extends keyof UploadForm>(key: K, value: UploadForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  async function handleFileUpload(file: File, type: 'audio' | 'image') {
    setUploading(true)
    try {
      // 1. 获取上传凭证
      const tokenRes = await fetch('/api/upload/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, type }),
        credentials: 'include',
      })
      const tokenJson = await tokenRes.json()
      if (tokenJson.code !== 200) {
        showToast(`${tokenJson.message || '获取上传凭证失败'}`)
        return
      }

      const { uploadUrl, key, headers: extraHeaders } = tokenJson.data

      // 2. 直接 PUT 文件到上传地址
      // 注意：必须使用 extraHeaders 中的 Content-Type（OSS 签名时绑定的值）
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: extraHeaders ? { ...extraHeaders } : { 'Content-Type': file.type },
      })

      if (!putRes.ok) {
        showToast('文件上传失败')
        return
      }

      // 3. 更新表单状态
      if (type === 'audio') {
        // 提取音频特征（Web Audio API，毫秒级，不出浏览器）
        let features: AudioFeatures | null = null
        try {
          features = await extractAudioFeatures(file)
        } catch { /* 提取失败不阻塞上传 */ }
        const sizeLabel = file.size >= 1024 * 1024
          ? (file.size / 1024 / 1024).toFixed(1) + ' MB'
          : file.size >= 1024
            ? Math.round(file.size / 1024) + ' KB'
            : file.size + ' B'
        setForm(prev => ({ ...prev, audioUploaded: true, audioUrl: key, audioFileName: file.name, audioSize: sizeLabel, audioFeatures: features }))
      } else {
        setForm(prev => ({ ...prev, coverUploaded: true, coverUrl: key }))
      }
      showToast(`${file.name} 上传成功`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast(`上传出错: ${msg}`)
    } finally {
      setUploading(false)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── Step 1 validation ──────────────────────────────────────────

  function goToStep2() {
    if (!form.audioUploaded) {
      showToast('请先上传音频文件')
      return
    }
    setStep(2)
  }

  // ── Step 2 validation ──────────────────────────────────────────

  function goToStep3() {
    const missing: string[] = []
    if (!form.title) missing.push('歌名')
    if (!form.lyricist) missing.push('作词署名')
    if (!form.composer) missing.push('作曲署名')
    if (!form.prompt) missing.push('Prompt提示词')
    if (!form.lyrics) missing.push('歌词正文')
    if (!form.creationDesc) missing.push('创作过程说明')

    if (missing.length > 0) {
      showToast(`请填写：${missing.join('、')}`)
      return
    }
    if (form.prompt.length < 10) {
      showToast('Prompt提示词至少10个字')
      return
    }
    if (form.lyrics.length < 20) {
      showToast('歌词正文至少20个字')
      return
    }
    if (form.creationDesc.length < 30) {
      showToast('创作过程说明至少30个字')
      return
    }
    if (!form.originality) {
      showToast('请勾选原创性声明')
      return
    }

    const bpmNum = Number(form.bpm)
    if (!form.bpm || isNaN(bpmNum) || bpmNum < 30 || bpmNum > 300) {
      showToast('BPM需在30-300之间')
      return
    }

    setStep(3)
  }

  // ── Submit ─────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!form.originality) {
      showToast('请先勾选原创性声明')
      setStep(2)
      return
    }
    if (!form.title || !form.lyricist || !form.composer) {
      showToast('歌曲信息不完整，请返回修改')
      setStep(2)
      return
    }

    const res = await apiCall<{ id: number; copyrightCode: string }>('/api/creator/upload', 'POST', {
      songId: revisionSongId ?? undefined,
      title: form.title,
      lyricist: form.lyricist,
      composer: form.composer,
      aiTools: [form.aiTool],
      genre: form.genre,
      bpm: parseInt(form.bpm, 10),
      lyrics: form.lyrics,
      styleDesc: form.prompt,
      contribution: form.contribution as 'lead' | 'participant',
      creationDesc: form.creationDesc,
      audioUrl: form.audioUrl || undefined,
      audioFeatures: form.audioFeatures || undefined,
      coverUrl: form.coverUrl || undefined,
      performer: performer || undefined,
      albumName: albumName || undefined,
      albumArtist: albumArtist || undefined,
    })

    if (res.ok) {
      setSubmitted({ id: res.data!.id, copyrightCode: res.data!.copyrightCode })
    } else {
      showToast(`${res.message || '提交失败'}`)
    }
  }

  // ── Preview data ───────────────────────────────────────────────

  const previewItems = [
    ['歌名', form.title || '未填写'],
    ['作词', form.lyricist || '未填写'],
    ['作曲', form.composer || '未填写'],
    ['AI工具', form.aiTool],
    ['流派', form.genre],
    ['BPM', form.bpm],
    ['创作贡献', form.contribution],
    ['原创声明', form.originality ? '已确认' : '未确认'],
  ]

  // ── Success View ─────────────────────────────────────────────
  if (submitted) {
    return (
      <div className={pageWrap}>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--green2)] to-[var(--accent)] flex items-center justify-center mb-6 shadow-lg">
            <CheckCircle2 size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text)] mb-2">
            {revisionSongId ? '作品已重新提交' : '作品提交成功'}
          </h2>
          <p className="text-sm text-[var(--text2)] mb-8">
            {revisionSongId
              ? '作品已更新并进入评审队列'
              : '您的作品已成功上传，正在等待评审'}
          </p>

          {/* Copyright Code Card */}
          <div className="w-full max-w-md p-6 rounded-xl bg-gradient-to-br from-[rgba(99,102,241,0.08)] to-[rgba(6,148,162,0.08)] border border-[var(--accent)]/20 text-center mb-6">
            <div className="text-xs text-[var(--text3)] mb-2">版权编号</div>
            <div className="text-3xl font-mono font-bold text-[var(--accent2)] mb-4 tracking-wider">
              {submitted.copyrightCode}
            </div>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[rgba(99,102,241,0.08)] transition-colors"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(submitted.copyrightCode)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                } catch {
                  setCopied(false)
                }
              }}
            >
              {copied ? (
                <>
                  <Check size={14} /> 已复制
                </>
              ) : (
                <>
                  <Copy size={14} /> 点击复制
                </>
              )}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link href="/creator/songs">
              <button className={btnGhost}>查看我的作品</button>
            </Link>
            {!revisionSongId && (
              <button
                className={btnPrimary}
                onClick={() => {
                  setSubmitted(null)
                  setForm(INITIAL_FORM)
                  setStep(1)
                }}
              >
                继续上传
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={pageWrap}>
      <Toast message={toast} />

      {/* Page header */}
      <div>
        <h1 className={textPageTitle}>
          {revisionSongId ? '修改并重新提交' : '自由上传'}
        </h1>
        <p className="mt-1 text-sm text-[var(--text2)]">
          {revisionSongId
            ? '修改后提交将更新原作品并重新进入评审队列'
            : '不属于任何作业的独立创作上传 · 三步完成提交'}
          {prefilling ? ' · 加载中...' : ''}
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Card */}
      <div className={cardCls}>
        {/* ══════ Step 1: Upload ══════ */}
        {step === 1 && (
          <div>
            <h3 className="text-base font-semibold mb-5">上传音频文件与封面</h3>

            {/* Audio upload area */}
            <input ref={audioRef} type="file" accept=".wav" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'audio') }} />
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                form.audioUploaded
                  ? 'border-[var(--green)] bg-green-50/30'
                  : 'border-[var(--border)] hover:border-[var(--accent)]'
              }`}
              onClick={() => audioRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) handleFileUpload(f, 'audio')
              }}
            >
              {uploading ? (
                <div><span className="text-[40px]">⏳</span><p className="mt-2 text-[var(--accent)] font-medium">上传中...</p></div>
              ) : form.audioUploaded ? (
                <div>
                  <CheckCircle2 size={40} className="mx-auto text-[var(--green)]" />
                  <p className="mt-2 text-[var(--green)] font-medium">
                    {form.audioFileName} 已上传 ({form.audioSize})
                  </p>
                </div>
              ) : (
                <div>
                  <Music size={40} className="mx-auto text-[var(--text3)]" />
                  <p className="mt-2 text-[var(--text2)]">
                    点击或拖拽上传音频文件
                  </p>
                  <p className="text-xs text-[var(--text3)] mt-1">
                    支持 WAV / MP3，最大 50MB
                  </p>
                </div>
              )}
            </div>

            {/* Cover upload area */}
            <input ref={coverRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'image') }} />
            <div
              className={`mt-4 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                form.coverUploaded
                  ? 'border-[var(--green)] bg-green-50/30'
                  : 'border-[var(--border)] hover:border-[var(--accent)]'
              }`}
              onClick={() => coverRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) handleFileUpload(f, 'image')
              }}
            >
              {form.coverUploaded ? (
                <div>
                  <CheckCircle2 size={32} className="mx-auto text-[var(--green)]" />
                  <p className="text-[13px] text-[var(--green)] font-medium">
                    封面已上传
                  </p>
                </div>
              ) : (
                <div>
                  <span className="text-[32px]">🖼️</span>
                  <p className="text-[13px] text-[var(--text2)]">
                    上传封面图 (JPG/PNG, ≤5MB, 1:1)
                  </p>
                </div>
              )}
            </div>

            {/* Next button */}
            <div className="mt-6 text-right">
              <button
                className={btnPrimary}
                disabled={!form.audioUploaded}
                onClick={goToStep2}
              >
                下一步 →
              </button>
            </div>
          </div>
        )}

        {/* ══════ Step 2: Info & AI Declaration ══════ */}
        {step === 2 && (
          <div>
            <h3 className="text-base font-semibold mb-5">
              歌曲元数据 & AI创作声明
            </h3>

            {/* 2-column grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* 歌名 */}
              <div>
                <label className={labelCls}>
                  歌名 <span className="text-[var(--red)]">*</span>
                </label>
                <input
                  className={inputCls}
                  value={form.title}
                  onChange={(e) => upd('title', e.target.value)}
                  placeholder="请输入歌名"
                />
              </div>
              {/* 作词 */}
              <div>
                <label className={labelCls}>
                  作词署名 <span className="text-[var(--red)]">*</span>
                </label>
                <input
                  className={inputCls}
                  value={form.lyricist}
                  onChange={(e) => upd('lyricist', e.target.value)}
                  placeholder="作词人"
                />
              </div>
              {/* 作曲 */}
              <div>
                <label className={labelCls}>
                  作曲署名 <span className="text-[var(--red)]">*</span>
                </label>
                <input
                  className={inputCls}
                  value={form.composer}
                  onChange={(e) => upd('composer', e.target.value)}
                  placeholder="作曲人"
                />
              </div>
              {/* AI工具 */}
              <div>
                <label className={labelCls}>
                  AI工具 <span className="text-[var(--red)]">*</span>
                </label>
                <select
                  className={inputCls}
                  value={form.aiTool}
                  onChange={(e) => upd('aiTool', e.target.value)}
                >
                  {aiTools.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              {/* 流派 */}
              <div>
                <label className={labelCls}>
                  流派 <span className="text-[var(--red)]">*</span>
                </label>
                <select
                  className={inputCls}
                  value={form.genre}
                  onChange={(e) => upd('genre', e.target.value)}
                >
                  {genres.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
              {/* BPM */}
              <div>
                <label className={labelCls}>
                  BPM <span className="text-[var(--red)]">*</span>
                </label>
                <input
                  className={inputCls}
                  type="number"
                  min={30}
                  max={300}
                  value={form.bpm}
                  onChange={(e) => upd('bpm', e.target.value)}
                />
              </div>
            </div>

            {/* Prompt */}
            <div className="mt-4">
              <label className={labelCls}>
                Prompt提示词 <span className="text-[var(--red)]">*</span>
              </label>
              <textarea
                className={`${inputCls} h-[70px] resize-y`}
                value={form.prompt}
                onChange={(e) => upd('prompt', e.target.value)}
                placeholder="请输入创作时使用的Prompt（≥10字）"
              />
            </div>

            {/* Lyrics */}
            <div className="mt-4">
              <label className={labelCls}>
                歌词正文 <span className="text-[var(--red)]">*</span>
              </label>
              <textarea
                className={`${inputCls} h-[90px] resize-y`}
                value={form.lyrics}
                onChange={(e) => upd('lyrics', e.target.value)}
                placeholder="请输入完整歌词（≥20字）"
              />
            </div>

            {/* Advanced metadata (collapsible) */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="text-sm text-[var(--accent)] hover:underline"
              >
                {advancedOpen ? '收起' : '展开'}高级信息（演唱者 / 专辑名 / 专辑艺人）
              </button>
              {advancedOpen && (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className={labelCls}>演唱者</label>
                    <input
                      className={inputCls}
                      value={performer}
                      onChange={(e) => setPerformer(e.target.value)}
                      placeholder="演唱者署名"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>专辑名</label>
                    <input
                      className={inputCls}
                      value={albumName}
                      onChange={(e) => setAlbumName(e.target.value)}
                      placeholder="默认同歌名"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>专辑艺人</label>
                    <input
                      className={inputCls}
                      value={albumArtist}
                      onChange={(e) => setAlbumArtist(e.target.value)}
                      placeholder="专辑艺人署名"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* AI Declaration block */}
            <div className="mt-6 p-5 bg-[var(--bg4)] rounded-xl border border-[rgba(108,92,231,0.3)]">
              <h4 className="text-sm font-semibold text-[var(--accent2)] mb-3.5 flex items-center gap-2">
                <Bot size={16} /> AI创作声明（必填）
              </h4>

              {/* Contribution radio */}
              <div className="mb-3.5">
                <label className={labelCls}>
                  人类创作贡献 <span className="text-[var(--red)]">*</span>
                </label>
                {CONTRIBUTIONS.map((c) => (
                  <label
                    key={c.value}
                    className="flex items-center gap-2 py-1.5 cursor-pointer text-[13px] text-[var(--text2)]"
                  >
                    <input
                      type="radio"
                      name="contribution"
                      checked={form.contribution === c.value}
                      onChange={() => upd('contribution', c.value)}
                    />
                    {c.label}：{c.desc}
                  </label>
                ))}
              </div>

              {/* Creation description */}
              <div className="mb-3.5">
                <label className={labelCls}>
                  创作过程说明 <span className="text-[var(--red)]">*</span>
                </label>
                <textarea
                  className={`${inputCls} h-[60px] resize-y`}
                  value={form.creationDesc}
                  onChange={(e) => upd('creationDesc', e.target.value)}
                  placeholder="描述你在创作中的具体贡献（≥30字）"
                />
              </div>

              {/* Originality checkbox */}
              <label className="flex items-start gap-2 text-[13px] text-[var(--text2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.originality}
                  onChange={(e) => upd('originality', e.target.checked)}
                  className="mt-[3px]"
                />
                <span>
                  我确认本作品不含第三方受版权保护的素材，且我对本作品拥有充分的权利进行发行授权{' '}
                  <span className="text-[var(--red)]">*必选</span>
                </span>
              </label>
            </div>

            {/* Navigation */}
            <div className="mt-6 flex justify-between">
              <button className={btnGhost} onClick={() => setStep(1)}>
                ← 上一步
              </button>
              <button className={btnPrimary} onClick={goToStep3}>
                下一步 →
              </button>
            </div>
          </div>
        )}

        {/* ══════ Step 3: Preview & Confirm ══════ */}
        {step === 3 && (
          <div>
            <h3 className="text-base font-semibold mb-5">预览确认</h3>

            {/* Key-value grid */}
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              {previewItems.map(([key, val]) => (
                <div
                  key={key}
                  className="p-3 bg-[var(--bg4)] rounded-lg"
                >
                  <span className="text-[var(--text3)]">{key}：</span>
                  <span className="font-medium">{val}</span>
                </div>
              ))}
            </div>

            {/* Prompt preview */}
            <div className="mt-4 p-3 bg-[var(--bg4)] rounded-lg text-[13px]">
              <span className="text-[var(--text3)]">Prompt提示词：</span>
              <p className="mt-1 font-medium whitespace-pre-wrap">
                {form.prompt || '未填写'}
              </p>
            </div>

            {/* Lyrics preview */}
            <div className="mt-4 p-3 bg-[var(--bg4)] rounded-lg text-[13px]">
              <span className="text-[var(--text3)]">歌词正文：</span>
              <p className="mt-1 font-medium whitespace-pre-wrap">
                {form.lyrics || '未填写'}
              </p>
            </div>

            {/* Creation description preview */}
            <div className="mt-4 p-3 bg-[var(--bg4)] rounded-lg text-[13px]">
              <span className="text-[var(--text3)]">创作过程说明：</span>
              <p className="mt-1 font-medium whitespace-pre-wrap">
                {form.creationDesc || '未填写'}
              </p>
            </div>

            {/* Audio preview */}
            <div className="mt-4 p-3 bg-[var(--bg4)] rounded-lg">
              <div className="text-[13px] text-[var(--text3)] mb-1.5">
                试听预览
              </div>
              {form.audioUrl ? (
                <audio src={`/api/files/${form.audioUrl}`} controls className="w-full h-9" />
              ) : (
                <WaveformPlayer />
              )}
            </div>

            {/* Navigation */}
            <div className="mt-6 flex justify-between">
              <button className={btnGhost} onClick={() => setStep(2)}>
                ← 修改
              </button>
              <button className={btnSuccess} onClick={handleSubmit}>
                <CheckCircle2 size={16} className="inline mr-1" /> 提交作品
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
