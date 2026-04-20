'use client'

import { useState, useEffect } from 'react'
import { apiCall } from '@/lib/use-api'
import { cardCls, btnPrimary, inputCls, labelCls } from '@/lib/ui-tokens'

interface Template {
  type: 'work' | 'revenue' | 'system' | 'assignment'
  title: string
  content: string
  linkUrl: string
}
type TemplateMap = Record<string, Template>

const TEMPLATE_LABELS: Record<string, string> = {
  'tpl.review_done': '评审完成',
  'tpl.song_published': '作品发行',
  'tpl.song_needs_revision': '作品需修改',
  'tpl.song_archived': '作品归档',
  'tpl.settlement_created': '结算生成',
  'tpl.settlement_paid': '打款到账',
  'tpl.realname_approved': '实名通过',
  'tpl.realname_rejected': '实名驳回',
  'tpl.assignment_created': '新作业',
  'tpl.assignment_due_soon': '作业截止提醒',
  'tpl.welcome': '注册欢迎',
}

interface Props {
  initial: TemplateMap | null
  onSaved: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}

export function SettingsNotificationTab({ initial, onSaved, showToast }: Props) {
  const [templates, setTemplates] = useState<TemplateMap>(initial ?? {})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initial) setTemplates(initial)
  }, [initial])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await apiCall('/api/admin/settings', 'PUT', {
        settings: [{ key: 'notification_templates', value: templates }],
      })
      if (res.ok) {
        showToast('保存成功', 'success')
        onSaved()
      } else {
        showToast(res.message || '保存失败', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  function updateField(key: string, field: keyof Template, value: string) {
    setTemplates(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? { type: 'system' as const, title: '', content: '', linkUrl: '' }),
        [field]: value,
      } as Template,
    }))
  }

  return (
    <div className={cardCls}>
      <h3 className="text-lg font-semibold mb-2">📬 通知模板管理</h3>
      <p className="text-sm text-gray-500 mb-4">
        模板中 <code>{'{var}'}</code> 为变量占位（如 <code>{'{songTitle}'}</code>、<code>{'{score}'}</code>）。未修改则使用内置默认模板。
      </p>

      <div className="space-y-6">
        {Object.entries(TEMPLATE_LABELS).map(([key, label]) => {
          const tpl = templates[key]
          return (
            <fieldset key={key} className="border rounded p-3">
              <legend className="text-sm font-medium px-2">
                {label}
                <code className="text-xs text-gray-400 ml-2">{key}</code>
              </legend>
              <div className="space-y-2">
                <div>
                  <label className={labelCls}>标题</label>
                  <input
                    className={inputCls}
                    value={tpl?.title ?? ''}
                    onChange={e => updateField(key, 'title', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>正文</label>
                  <textarea
                    className={inputCls + ' min-h-16'}
                    value={tpl?.content ?? ''}
                    onChange={e => updateField(key, 'content', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>跳转链接</label>
                  <input
                    className={inputCls}
                    value={tpl?.linkUrl ?? ''}
                    onChange={e => updateField(key, 'linkUrl', e.target.value)}
                    placeholder="/creator/songs?id={songId}"
                  />
                </div>
              </div>
            </fieldset>
          )
        })}

        <button className={btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '保存所有模板'}
        </button>
      </div>
    </div>
  )
}
