import { prisma } from './prisma'
import { getSetting, SETTING_KEYS } from './system-settings'

export interface AudioFeatures {
  duration: number
  sampleRate: number
  channels: number
  peakFrequency: string
  energyProfile: string
  rhythmDensity: string
}

export interface AIAnalysisResult {
  detectedBpm: string
  key: string
  loudness: string
  spectrum: string
  structure: string
  productionQuality: string
  summary: string
}

const DEFAULT_RESULT: AIAnalysisResult = {
  detectedBpm: '-',
  key: '-',
  loudness: '-',
  spectrum: '-',
  structure: '-',
  productionQuality: '-',
  summary: '暂无分析数据',
}

interface AnalysisInput {
  title: string
  genre: string | null
  bpm: number | null
  aiTools: unknown
  styleDesc: string | null
  audioFeatures: AudioFeatures | null
}

interface AiConfig {
  enabled: boolean
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs: number
}

let lastAlertAt = 0

async function logUnavailable(reason: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return
  // 去抖：1 小时内最多一条日志
  if (Date.now() - lastAlertAt < 3600_000) return
  lastAlertAt = Date.now()
  try {
    await prisma.operationLog.create({
      data: {
        operatorId: 0,
        operatorName: 'system',
        action: 'ai_analysis_unavailable',
        targetType: 'system',
        detail: { reason },
      },
    })
  } catch (err) {
    console.error('[AI Analysis] 写入告警失败:', err)
  }
}

async function loadConfig(): Promise<AiConfig> {
  const fromDb = await getSetting<Partial<AiConfig>>(SETTING_KEYS.AI_CONFIG, {})
  return {
    enabled: fromDb.enabled ?? !!process.env.AI_API_KEY,
    baseUrl: fromDb.baseUrl || process.env.AI_API_BASE_URL || 'https://api.openai.com/v1',
    apiKey: fromDb.apiKey || process.env.AI_API_KEY || '',
    model: fromDb.model || process.env.AI_MODEL || 'gpt-4o-mini',
    timeoutMs: fromDb.timeoutMs ?? 10000,
  }
}

export async function analyzeSong(input: AnalysisInput): Promise<AIAnalysisResult> {
  const config = await loadConfig()

  if (!config.enabled) {
    return DEFAULT_RESULT
  }
  if (!config.apiKey) {
    console.error('[AI Analysis] ⚠️ AI_API_KEY 未配置，预分析功能已禁用')
    await logUnavailable('AI_API_KEY 未配置')
    return DEFAULT_RESULT
  }

  const af = input.audioFeatures
  const audioSection = af
    ? `
音频特征（前端 Web Audio API 提取，真实数据）：
- 时长：${Math.floor(af.duration / 60)}:${String(Math.floor(af.duration % 60)).padStart(2, '0')}
- 采样率：${af.sampleRate} Hz
- 声道数：${af.channels}
- 主频段：${af.peakFrequency}
- 能量分布：${af.energyProfile}
- 节奏密度：${af.rhythmDensity}`
    : '（无音频特征数据）'

  const prompt = `你是一个专业的音乐制作分析师。根据以下歌曲信息和音频特征数据，给出技术层面的预分析报告。

歌曲元数据：
- 标题：${input.title}
- 风格：${input.genre || '未知'}
- 用户标注 BPM：${input.bpm || '未知'}
- AI工具：${JSON.stringify(input.aiTools) || '未知'}
- 风格描述：${input.styleDesc || '无'}
${audioSection}

请基于以上技术数据，以 JSON 格式返回分析结果：
{
  "detectedBpm": "确认或修正后的 BPM",
  "key": "推断调性（如 C Major, A Minor）",
  "loudness": "推断响度（如 -8.5 LUFS）",
  "spectrum": "频谱特征（如 中频突出、低频饱满）",
  "structure": "推断段落结构（如 Intro→Verse→Chorus→...）",
  "productionQuality": "制作度评分（X/10）",
  "summary": "一句话技术总结（20字以内）"
}

只返回 JSON。`

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    })

    if (!res.ok) {
      console.error('[AI Analysis] API 请求失败:', res.status, await res.text())
      await logUnavailable(`API 返回 ${res.status}`)
      return DEFAULT_RESULT
    }

    const data = await res.json()
    const responseText = data.choices?.[0]?.message?.content?.trim()
    if (!responseText) return DEFAULT_RESULT

    const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(jsonStr)

    return {
      detectedBpm: parsed.detectedBpm || String(input.bpm || '-'),
      key: parsed.key || '-',
      loudness: parsed.loudness || '-',
      spectrum: parsed.spectrum || '-',
      structure: parsed.structure || '-',
      productionQuality: parsed.productionQuality || '-',
      summary: parsed.summary || '-',
    }
  } catch (err) {
    console.error('[AI Analysis] 分析失败:', err)
    await logUnavailable(err instanceof Error ? err.message : 'unknown')
    return DEFAULT_RESULT
  }
}

/** 由 test-ai API 调用，用最小 prompt 测试连接性 */
export async function pingAi(config: Pick<AiConfig, 'baseUrl' | 'apiKey' | 'model' | 'timeoutMs'>): Promise<{ ok: boolean; message: string }> {
  if (!config.apiKey) return { ok: false, message: 'apiKey 不能为空' }
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(config.timeoutMs ?? 10000),
    })
    if (res.ok) return { ok: true, message: '连接成功' }
    const body = await res.text().catch(() => '')
    return { ok: false, message: `HTTP ${res.status}: ${body.slice(0, 100)}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : '连接失败' }
  }
}
