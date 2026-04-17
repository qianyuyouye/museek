/**
 * AI 音频预分析
 *
 * 流程：前端 Web Audio API 提取音频特征 → 特征数据存数据库 → AI 基于特征分析
 *
 * 环境变量：
 *   AI_API_BASE_URL - API 地址（默认 https://api.openai.com/v1）
 *   AI_API_KEY - API 密钥
 *   AI_MODEL - 模型名称（默认 gpt-4o-mini）
 */

export interface AudioFeatures {
  duration: number       // 秒
  sampleRate: number     // Hz
  channels: number       // 声道数
  peakFrequency: string  // 主频段描述
  energyProfile: string  // 能量分布描述
  rhythmDensity: string  // 节奏密度描述
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

export async function analyzeSong(input: AnalysisInput): Promise<AIAnalysisResult> {
  const baseUrl = process.env.AI_API_BASE_URL || 'https://api.openai.com/v1'
  const apiKey = process.env.AI_API_KEY
  const model = process.env.AI_MODEL || 'gpt-4o-mini'

  if (!apiKey) {
    console.warn('[AI Analysis] AI_API_KEY 未配置，返回默认值')
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
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!res.ok) {
      console.error('[AI Analysis] API 请求失败:', res.status, await res.text())
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
    return DEFAULT_RESULT
  }
}
