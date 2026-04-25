'use client'

import { useEffect, useRef, useState } from 'react'

interface WaveformProps {
  src: string | null | undefined
  bars?: number
  height?: number
  barColor?: string
  playedColor?: string
  progress?: number // 0~1
  animate?: boolean // 播放时动态跳动
}

/**
 * 真实音频波形：用 Web Audio API 解码 src，下采样为 N 柱振幅。
 * 解码失败或 src 缺失时回落到 Math.sin 随机装饰。
 */
export function Waveform({
  src,
  bars = 60,
  height = 60,
  barColor = 'var(--border2)',
  playedColor = 'var(--accent, #6366f1)',
  progress = 0,
  animate = false,
}: WaveformProps) {
  const [heights, setHeights] = useState<number[]>(() =>
    // 初始占位（装饰），解码完成后替换
    Array.from({ length: bars }, (_, i) => Math.max(2, 18 + Math.sin(i * 0.5) * 12 + Math.random() * 14)),
  )
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    if (!src) return

    const run = async () => {
      try {
        const res = await fetch(src, { credentials: 'include' })
        if (!res.ok) return
        const buf = await res.arrayBuffer()
        if (cancelledRef.current) return
        // @ts-expect-error prefixed fallback for older Safari
        const Ctx = (window.AudioContext || window.webkitAudioContext) as typeof AudioContext
        const ctx = new Ctx()
        const audioBuffer = await ctx.decodeAudioData(buf)
        if (cancelledRef.current) return

        const channelData = audioBuffer.getChannelData(0)
        const samplesPerBar = Math.max(1, Math.floor(channelData.length / bars))
        const peaks: number[] = []
        for (let i = 0; i < bars; i++) {
          let max = 0
          const base = i * samplesPerBar
          for (let j = 0; j < samplesPerBar; j++) {
            const v = Math.abs(channelData[base + j] ?? 0)
            if (v > max) max = v
          }
          peaks.push(max)
        }
        // 归一化到 [2, height]，避免 0 高度不可见
        const peakMax = Math.max(...peaks, 0.01)
        const halfH = height / 2
        const normalized = peaks.map((p) => Math.max(2, (p / peakMax) * halfH * 2 * 0.9))
        setHeights(normalized)
        ctx.close?.()
      } catch {
        // 解码失败保留装饰
      }
    }
    run()

    return () => { cancelledRef.current = true }
  }, [src, bars, height])

  const playedIdx = Math.max(0, Math.min(bars, Math.floor(progress * bars)))

  return (
    <svg viewBox={`0 0 ${bars * 10} ${height}`} className="w-full" style={{ height }}>
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 10}
          y={height / 2 - h / 2}
          width={6}
          height={h}
          rx={3}
          fill={i < playedIdx ? playedColor : barColor}
        >
          {animate && (
            <animate
              attributeName="height"
              values={`${h};${Math.max(2, h * (0.3 + Math.random() * 0.7))};${h}`}
              dur={`${0.3 + Math.random() * 0.5}s`}
              repeatCount="indefinite"
            />
          )}
        </rect>
      ))}
    </svg>
  )
}
