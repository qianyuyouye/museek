'use client'

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { X, Play, Pause } from 'lucide-react'
import { PromptModal } from '@/components/ui/confirm-modal'

export interface AudioMark {
  t: number
  note: string
}

export interface AudioPlayerHandle {
  pause: () => void
}

interface AudioPlayerProps {
  src: string
  marks: AudioMark[]
  onMarksChange: (next: AudioMark[]) => void
}

const SPEED_OPTIONS = ['0.5', '0.75', '1.0', '1.25', '1.5'] as const
const BAR_COUNT = 48

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(function AudioPlayer(
  { src, marks, onMarksChange },
  ref,
) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const waveformRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState('1.0')
  const [abStart, setAbStart] = useState<number | null>(null)
  const [abEnd, setAbEnd] = useState<number | null>(null)
  const [abLoopOn, setAbLoopOn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const [pendingMark, setPendingMark] = useState<{ t: number } | null>(null)

  const bars = useMemo(
    () => Array.from({ length: BAR_COUNT }, () => 0.2 + Math.random() * 0.8),
    [src],
  )

  const barDelays = useMemo(
    () => Array.from({ length: BAR_COUNT }, () => Math.random() * 2),
    [src],
  )

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = parseFloat(speed)
  }, [speed])

  useImperativeHandle(ref, () => ({
    pause: () => {
      const audio = audioRef.current
      if (audio && !audio.paused) {
        audio.pause()
        setIsPlaying(false)
      }
    },
  }))

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoaded = () => setDuration(audio.duration || 0)
    const onTime = () => {
      const t = audio.currentTime
      if (abLoopOn && abStart != null && abEnd != null && abEnd > abStart) {
        if (t >= abEnd) {
          audio.currentTime = abStart
          setCurrentTime(abStart)
          return
        }
        if (t < abStart) {
          audio.currentTime = abStart
          setCurrentTime(abStart)
          return
        }
      }
      setCurrentTime(t)
    }
    const onEnd = () => setIsPlaying(false)
    const onErr = () => setError('音频加载失败')

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('error', onErr)
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('error', onErr)
    }
  }, [abLoopOn, abStart, abEnd])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => setError('无法播放'))
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  const seekByRatio = (ratio: number) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const t = Math.max(0, Math.min(duration, ratio * duration))
    audio.currentTime = t
    setCurrentTime(t)
  }

  const handleWaveClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = waveformRef.current
    if (!el || !duration) return
    const rect = el.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const t = Math.max(0, Math.min(duration, ratio * duration))
    if (e.shiftKey) {
      setPendingMark({ t })
      setPromptOpen(true)
      return
    }
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = t
      setCurrentTime(t)
    }
  }

  const setAFromCurrent = () => setAbStart(currentTime)
  const setBFromCurrent = () => setAbEnd(currentTime)
  const clearAB = () => {
    setAbStart(null)
    setAbEnd(null)
    setAbLoopOn(false)
  }

  const progressRatio = duration > 0 ? currentTime / duration : 0

  return (
    <div className="p-4 bg-[var(--bg4)] rounded-[10px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      <style>{`@keyframes spectrumBar { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }`}</style>

      <div className="flex justify-between items-center mb-3">
        <div className="flex gap-2 items-center">
          <button
            type="button"
            aria-label={isPlaying ? '暂停' : '播放'}
            className={`border-none rounded-full w-9 h-9 text-white text-base cursor-pointer flex items-center justify-center transition-all duration-200 ${
              isPlaying
                ? 'bg-[var(--green2)] shadow-[0_0_8px_rgba(22,163,74,0.4)]'
                : 'bg-[var(--accent)]'
            }`}
            onClick={togglePlay}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            className="border border-[var(--border)] rounded-md px-2 py-1 text-xs cursor-pointer bg-white text-[var(--text2)] hover:border-[var(--accent)]"
            onClick={setAFromCurrent}
            title="以当前时间设为 A 点"
          >
            设 A {abStart != null ? `(${formatTime(abStart)})` : ''}
          </button>
          <button
            type="button"
            className="border border-[var(--border)] rounded-md px-2 py-1 text-xs cursor-pointer bg-white text-[var(--text2)] hover:border-[var(--accent)]"
            onClick={setBFromCurrent}
            title="以当前时间设为 B 点"
          >
            设 B {abEnd != null ? `(${formatTime(abEnd)})` : ''}
          </button>
          <button
            type="button"
            className={`border-none rounded-md px-3 py-1 text-xs cursor-pointer transition-all duration-200 ${
              abLoopOn
                ? 'bg-[var(--accent)] text-white shadow-[0_0_6px_rgba(99,102,241,0.3)]'
                : 'bg-[var(--bg4)] text-[var(--text2)]'
            } ${abStart == null || abEnd == null || abEnd <= abStart ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => {
              if (abStart != null && abEnd != null && abEnd > abStart) {
                setAbLoopOn((p) => !p)
              }
            }}
            disabled={abStart == null || abEnd == null || abEnd <= abStart}
          >
            A-B循环
          </button>
          {(abStart != null || abEnd != null) && (
            <button
              type="button"
              className="text-xs text-[var(--text3)] hover:text-[var(--red)] cursor-pointer"
              onClick={clearAB}
            >
              清除
            </button>
          )}
        </div>
        <select
          className="border-none rounded-md px-2 py-1 text-xs cursor-pointer font-medium"
          style={{
            background: speed !== '1.0' ? 'var(--accent-glow)' : 'var(--bg4)',
            color: speed !== '1.0' ? 'var(--accent2)' : 'var(--text2)',
          }}
          value={speed}
          onChange={(e) => setSpeed(e.target.value)}
        >
          {SPEED_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}x
            </option>
          ))}
        </select>
      </div>

      <div
        ref={waveformRef}
        className="relative h-[56px] cursor-pointer select-none"
        onClick={handleWaveClick}
        title="点击跳转；Shift+点击添加注记"
      >
        <div className="absolute inset-0 flex items-end gap-[3px]">
          {bars.map((h, i) => {
            const barRatio = i / BAR_COUNT
            const played = barRatio <= progressRatio
            const inLoop =
              abStart != null &&
              abEnd != null &&
              duration > 0 &&
              barRatio * duration >= abStart &&
              barRatio * duration <= abEnd
            return (
              <div
                key={i}
                className="flex-1 rounded-sm transition-colors"
                style={{
                  height: `${h * 100}%`,
                  background: played
                    ? 'linear-gradient(to top, var(--accent), #818cf8)'
                    : inLoop && abLoopOn
                    ? 'rgba(99,102,241,0.35)'
                    : 'rgba(148,163,184,0.45)',
                  animation: isPlaying ? `spectrumBar 0.8s ease-in-out ${barDelays[i]}s infinite` : 'none',
                  transformOrigin: 'bottom',
                }}
              />
            )
          })}
        </div>
        {marks.map((m, i) => (
          <div
            key={`${m.t}-${i}`}
            className="absolute top-0 bottom-0 w-[2px] bg-[var(--orange)]"
            style={{ left: `${duration > 0 ? (m.t / duration) * 100 : 0}%` }}
            title={`${formatTime(m.t)} ${m.note}`}
          />
        ))}
        {abStart != null && duration > 0 && (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-[var(--green2)]"
            style={{ left: `${(abStart / duration) * 100}%` }}
          />
        )}
        {abEnd != null && duration > 0 && (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-[var(--red)]"
            style={{ left: `${(abEnd / duration) * 100}%` }}
          />
        )}
      </div>

      <div className="flex justify-between items-center mt-2 text-xs text-[var(--text3)]">
        <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
        <span>{error ? <span className="text-[var(--red)]">{error}</span> : '点击波形跳转 · Shift+点击打标'}</span>
      </div>

      {marks.length > 0 && (
        <div className="mt-3 border-t border-[var(--border)] pt-2">
          <div className="text-xs text-[var(--text3)] mb-1.5">时间轴标记 ({marks.length})</div>
          <div className="flex flex-col gap-1 max-h-[120px] overflow-auto">
            {marks.map((m, i) => (
              <div
                key={`mark-${m.t}-${i}`}
                className="flex items-center gap-2 text-xs bg-[var(--bg4)] rounded px-2 py-1"
              >
                <button
                  type="button"
                  className="text-[var(--accent2)] font-mono cursor-pointer hover:underline"
                  onClick={() => seekByRatio(duration > 0 ? m.t / duration : 0)}
                >
                  {formatTime(m.t)}
                </button>
                <span className="flex-1 text-[var(--text2)] truncate">{m.note}</span>
                <button
                  type="button"
                  aria-label="删除"
                  className="text-[var(--text3)] hover:text-[var(--red)] hover:bg-red-50 cursor-pointer px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                  onClick={() =>
                    onMarksChange(marks.filter((_, idx) => idx !== i))
                  }
                >
                  <X className="w-3 h-3" />
                  <span className="text-[11px]">删除</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <PromptModal
        open={promptOpen}
        title="添加注记"
        message={pendingMark ? `为 ${formatTime(pendingMark.t)} 添加注记：` : ''}
        placeholder="请输入注记内容"
        onConfirm={(value) => {
          if (pendingMark && value.trim()) {
            onMarksChange([...marks, { t: pendingMark.t, note: value.trim() }].sort((a, b) => a.t - b.t))
          }
          setPromptOpen(false)
          setPendingMark(null)
        }}
        onCancel={() => {
          setPromptOpen(false)
          setPendingMark(null)
        }}
      />
    </div>
  )
})

export default AudioPlayer
