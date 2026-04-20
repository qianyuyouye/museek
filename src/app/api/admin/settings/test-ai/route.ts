import { NextRequest } from 'next/server'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { pingAi } from '@/lib/ai-analysis'
import { getSetting, SETTING_KEYS } from '@/lib/system-settings'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const body = await request.json()
  let { baseUrl, apiKey, model, timeoutMs } = body as {
    baseUrl?: string
    apiKey?: string
    model?: string
    timeoutMs?: number
  }

  if (apiKey === '__use_saved__') {
    const saved = await getSetting<{ apiKey?: string; baseUrl?: string; model?: string }>(
      SETTING_KEYS.AI_CONFIG,
      {},
    )
    apiKey = saved.apiKey
    baseUrl = baseUrl || saved.baseUrl
    model = model || saved.model
  }
  if (!apiKey) return err('apiKey 不能为空（请先保存配置或输入新 key）')

  const result = await pingAi({
    baseUrl: baseUrl || 'https://api.openai.com/v1',
    apiKey,
    model: model || 'gpt-4o-mini',
    timeoutMs: timeoutMs ?? 5000,
  })
  return ok(result)
})
