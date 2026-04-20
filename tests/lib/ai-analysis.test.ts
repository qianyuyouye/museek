import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { analyzeSong } from '@/lib/ai-analysis'
import { SETTING_KEYS, setSetting } from '@/lib/system-settings'

describe('ai-analysis DB 优先读', () => {
  beforeEach(async () => {
    await prisma.systemSetting.deleteMany({ where: { key: SETTING_KEYS.AI_CONFIG } })
    await prisma.operationLog.deleteMany({ where: { action: 'ai_analysis_unavailable' } })
  })

  it('AI 未启用时返回 DEFAULT_RESULT', async () => {
    await setSetting(SETTING_KEYS.AI_CONFIG, { enabled: false })
    const r = await analyzeSong({ title: 't', genre: null, bpm: null, aiTools: null, styleDesc: null, audioFeatures: null })
    expect(r.summary).toBe('暂无分析数据')
  })

  it('DB 启用但 apiKey 为空时，生产环境写 operation_logs 告警', async () => {
    const orig = process.env.NODE_ENV
    // @ts-expect-error vitest allows direct assign
    process.env.NODE_ENV = 'production'
    try {
      await setSetting(SETTING_KEYS.AI_CONFIG, { enabled: true, apiKey: '' })
      await analyzeSong({ title: 't', genre: null, bpm: null, aiTools: null, styleDesc: null, audioFeatures: null })
      const logs = await prisma.operationLog.findMany({ where: { action: 'ai_analysis_unavailable' } })
      expect(logs.length).toBeGreaterThan(0)
    } finally {
      // @ts-expect-error vitest allows direct assign
      process.env.NODE_ENV = orig
    }
  })

  it('fetch 超时（AbortSignal）触发降级', async () => {
    await setSetting(SETTING_KEYS.AI_CONFIG, {
      enabled: true, baseUrl: 'http://127.0.0.1:1', apiKey: 'sk-x', model: 'm', timeoutMs: 500,
    })
    const start = Date.now()
    const r = await analyzeSong({ title: 't', genre: null, bpm: null, aiTools: null, styleDesc: null, audioFeatures: null })
    const elapsed = Date.now() - start
    expect(r.summary).toBe('暂无分析数据')
    expect(elapsed).toBeLessThan(2000)
  })
})
