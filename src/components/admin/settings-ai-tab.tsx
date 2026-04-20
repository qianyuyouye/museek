'use client'

import { useState, useEffect } from 'react'
import { apiCall } from '@/lib/use-api'
import { cardCls, btnPrimary, btnGhost, inputCls, labelCls } from '@/lib/ui-tokens'

interface AiConfig {
  enabled: boolean
  baseUrl: string
  apiKey: string // 从 API 收到时是脱敏形式 sk-****xxxx
  model: string
  timeoutMs: number
}

const DEFAULT: AiConfig = {
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  timeoutMs: 10000,
}

interface Props {
  initial: AiConfig | null
  onSaved: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}

export function SettingsAiTab({ initial, onSaved, showToast }: Props) {
  const [form, setForm] = useState<AiConfig>(initial ?? DEFAULT)
  const [newApiKey, setNewApiKey] = useState('') // 新 apiKey 输入（空则保留原值）
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (initial) setForm(initial)
  }, [initial])

  const maskedApiKey = form.apiKey // 来自 API 已脱敏

  async function handleSave() {
    setSaving(true)
    try {
      const payload: Partial<AiConfig> = {
        enabled: form.enabled,
        baseUrl: form.baseUrl,
        model: form.model,
        timeoutMs: form.timeoutMs,
      }
      if (newApiKey.trim()) payload.apiKey = newApiKey.trim()
      const res = await apiCall('/api/admin/settings', 'PUT', {
        settings: [{ key: 'ai_config', value: payload }],
      })
      if (res.ok) {
        showToast('保存成功', 'success')
        setNewApiKey('')
        onSaved()
      } else {
        showToast(res.message || '保存失败', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const apiKeyToUse = newApiKey.trim() || undefined
      const res = await apiCall<{ ok: boolean; message: string }>(
        '/api/admin/settings/test-ai',
        'POST',
        {
          baseUrl: form.baseUrl,
          apiKey: apiKeyToUse ?? '__use_saved__',
          model: form.model,
          timeoutMs: 5000,
        },
      )
      if (res.ok && res.data) {
        const data = res.data
        showToast(
          data.ok ? `✅ ${data.message}` : `❌ ${data.message}`,
          data.ok ? 'success' : 'error',
        )
      } else {
        showToast(res.message || '测试失败', 'error')
      }
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className={cardCls}>
      <h3 className="text-lg font-semibold mb-2">🤖 AI 预分析配置</h3>
      <p className="text-sm text-gray-500 mb-4">
        配置 OpenAI 兼容 API。未启用或未配置时，评审页 AI 报告将显示占位「暂无分析数据」。
      </p>

      <div className="space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
          />
          <span>启用 AI 预分析</span>
        </label>

        <div>
          <label className={labelCls}>API Base URL</label>
          <input
            className={inputCls}
            value={form.baseUrl}
            onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
            placeholder="https://api.openai.com/v1"
          />
        </div>

        <div>
          <label className={labelCls}>
            API Key
            {maskedApiKey && (
              <span className="text-xs text-gray-400 ml-2">当前：{maskedApiKey}</span>
            )}
          </label>
          <input
            className={inputCls}
            type="password"
            value={newApiKey}
            onChange={e => setNewApiKey(e.target.value)}
            placeholder={maskedApiKey ? '留空保留原值' : 'sk-...'}
          />
        </div>

        <div>
          <label className={labelCls}>Model</label>
          <input
            className={inputCls}
            value={form.model}
            onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
            placeholder="gpt-4o-mini"
          />
        </div>

        <div>
          <label className={labelCls}>超时（ms）</label>
          <input
            className={inputCls}
            type="number"
            value={form.timeoutMs}
            onChange={e =>
              setForm(f => ({ ...f, timeoutMs: Number(e.target.value) || 10000 }))
            }
          />
        </div>

        <div className="flex gap-2">
          <button className={btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
          <button className={btnGhost} onClick={handleTest} disabled={testing}>
            {testing ? '测试中...' : '测试连接'}
          </button>
        </div>
      </div>
    </div>
  )
}
