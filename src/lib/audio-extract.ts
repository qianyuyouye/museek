'use client'

/**
 * 前端音频特征提取 - 使用 Web Audio API
 * 在浏览器中分析音频文件，不上传到服务器
 * 100M 文件也能处理，只在内存中操作
 */

export interface AudioFeatures {
  duration: number
  sampleRate: number
  channels: number
  peakFrequency: string
  energyProfile: string
  rhythmDensity: string
}

/** 分析频率分布，返回主频段描述 */
function analyzePeakFrequency(frequencyData: Float32Array, sampleRate: number): string {
  const binCount = frequencyData.length
  const freqPerBin = sampleRate / (binCount * 2)

  let lowEnergy = 0   // 0-300 Hz
  let midEnergy = 0   // 300-3000 Hz
  let highEnergy = 0  // 3000+ Hz

  for (let i = 0; i < binCount; i++) {
    const freq = i * freqPerBin
    const power = frequencyData[i] * frequencyData[i]
    if (freq < 300) lowEnergy += power
    else if (freq < 3000) midEnergy += power
    else highEnergy += power
  }

  const total = lowEnergy + midEnergy + highEnergy || 1
  const lowPct = Math.round((lowEnergy / total) * 100)
  const midPct = Math.round((midEnergy / total) * 100)
  const highPct = Math.round((highEnergy / total) * 100)

  const parts: string[] = []
  if (lowPct > 40) parts.push('低频饱满')
  else if (lowPct < 20) parts.push('低频偏弱')
  if (midPct > 50) parts.push('中频突出')
  if (highPct > 30) parts.push('高频明亮')
  else if (highPct < 10) parts.push('高频偏暗')

  return parts.length > 0 ? parts.join('，') : '频率分布均衡'
}

/** 分析能量分布 */
function analyzeEnergy(channelData: Float32Array): string {
  const blockSize = Math.floor(channelData.length / 10)
  const energies: number[] = []

  for (let i = 0; i < 10; i++) {
    let sum = 0
    const start = i * blockSize
    for (let j = start; j < start + blockSize && j < channelData.length; j++) {
      sum += channelData[j] * channelData[j]
    }
    energies.push(Math.sqrt(sum / blockSize))
  }

  const avg = energies.reduce((a, b) => a + b, 0) / energies.length
  const variance = energies.reduce((a, b) => a + (b - avg) ** 2, 0) / energies.length

  if (variance < avg * 0.1) return '能量平稳，动态范围小'
  if (variance > avg * 0.5) return '能量起伏大，动态范围宽'
  return '能量适中，有自然起伏'
}

/** 分析节奏密度 */
function analyzeRhythm(channelData: Float32Array, sampleRate: number): string {
  // 简单的过零率分析估算节奏密度
  let zeroCrossings = 0
  const blockSize = Math.floor(sampleRate * 0.1) // 100ms 块
  const blocks = Math.floor(channelData.length / blockSize)

  for (let b = 0; b < Math.min(blocks, 50); b++) {
    const start = b * blockSize
    for (let i = start + 1; i < start + blockSize && i < channelData.length; i++) {
      if ((channelData[i] >= 0) !== (channelData[i - 1] >= 0)) {
        zeroCrossings++
      }
    }
  }

  const avgCrossingsPerBlock = zeroCrossings / Math.min(blocks, 50)
  if (avgCrossingsPerBlock > 5000) return '节奏密集，细节丰富'
  if (avgCrossingsPerBlock > 2000) return '节奏适中'
  return '节奏舒缓，空间感强'
}

/** 从音频文件提取特征（浏览器端，毫秒级） */
/** 简化 DFT：对 N 个采样点计算 N/2 个频率 bin 的幅度 */
function computeDFTMagnitudes(segment: Float32Array): Float32Array {
  const N = segment.length
  const half = N >> 1
  const out = new Float32Array(half)
  const TWO_PI_N = (2 * Math.PI) / N
  for (let k = 0; k < half; k++) {
    let re = 0
    let im = 0
    const angle = TWO_PI_N * k
    for (let n = 0; n < N; n++) {
      re += segment[n] * Math.cos(angle * n)
      im -= segment[n] * Math.sin(angle * n)
    }
    out[k] = Math.sqrt(re * re + im * im) / N
  }
  return out
}

export async function extractAudioFeatures(file: File): Promise<AudioFeatures> {
  const arrayBuffer = await file.arrayBuffer()
  const audioContext = new AudioContext()

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    const channelData = audioBuffer.getChannelData(0)

    // 频谱分析：取音频中段 2048 采样做 DFT
    const N = 2048
    const midOffset = Math.max(0, Math.floor(channelData.length / 2) - N / 2)
    const segment = channelData.slice(midOffset, midOffset + N)
    const freqBins = computeDFTMagnitudes(segment)
    const peakFrequency = analyzePeakFrequency(freqBins, audioBuffer.sampleRate)

    return {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      peakFrequency,
      energyProfile: analyzeEnergy(channelData),
      rhythmDensity: analyzeRhythm(channelData, audioBuffer.sampleRate),
    }
  } finally {
    await audioContext.close()
  }
}
