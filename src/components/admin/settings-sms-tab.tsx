'use client'

import { useState, useEffect } from 'react'
import { apiCall } from '@/lib/use-api'
import { cardCls, btnPrimary, btnGhost, inputCls, labelCls } from '@/lib/ui-tokens'

interface SmsConfig {
  enabled: boolean
  accessKeyId: string
  accessKeySecret: string
  signName: string
  templateCode: { register: string; resetPassword: string; changePhone: string }
  perPhoneDailyLimit: number
  verifyMaxAttempts: number
}

const DEFAULT: SmsConfig = {
  enabled: false,
  accessKeyId: '',
  accessKeySecret: '',
  signName: '',
  templateCode: { register: '', resetPassword: '', changePhone: '' },
  perPhoneDailyLimit: 10,
  verifyMaxAttempts: 5,
}

interface Props {
  initial: SmsConfig | null
  onSaved: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}

export function SettingsSmsTab({ initial, onSaved, showToast }: Props) {
  const [form, setForm] = useState<SmsConfig>(initial ?? DEFAULT)
  const [newAccessKeyId, setNewAccessKeyId] = useState('')
  const [newAccessKeySecret, setNewAccessKeySecret] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (initial) setForm(initial)
  }, [initial])

  async function handleSave() {
    setSaving(true)
    try {
      const payload: Partial<SmsConfig> = {
        enabled: form.enabled,
        signName: form.signName,
        templateCode: form.templateCode,
        perPhoneDailyLimit: form.perPhoneDailyLimit,
        verifyMaxAttempts: form.verifyMaxAttempts,
      }
      if (newAccessKeyId.trim()) payload.accessKeyId = newAccessKeyId.trim()
      if (newAccessKeySecret.trim()) payload.accessKeySecret = newAccessKeySecret.trim()

      const res = await apiCall('/api/admin/settings', 'PUT', {
        settings: [{ key: 'sms_config', value: payload }],
      })
      if (res.ok) {
        showToast('保存成功', 'success')
        setNewAccessKeyId('')
        setNewAccessKeySecret('')
        onSaved()
      } else {
        showToast(res.message || '保存失败', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!/^1[3-9]\d{9}$/.test(testPhone)) {
      showToast('请输入合法手机号', 'error')
      return
    }
    setTesting(true)
    try {
      const res = await apiCall<{ success: boolean; message: string }>(
        '/api/admin/settings/test-sms',
        'POST',
        { phone: testPhone },
      )
      if (res.ok && res.data) {
        showToast(res.data.message, res.data.success ? 'success' : 'error')
      } else {
        showToast(res.message || '测试失败', 'error')
      }
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className={cardCls}>
      <h3 className="text-lg font-semibold mb-2">📱 阿里云短信配置</h3>
      <p className="text-sm text-gray-500 mb-4">
        未启用时开发环境使用固定验证码 <code>123456</code>，生产环境发送会返回“短信服务未配置”。
      </p>

      <div className="space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
          />
          <span>启用短信服务</span>
        </label>

        <div>
          <label className={labelCls}>
            AccessKey ID
            {form.accessKeyId && (
              <span className="text-xs text-gray-400 ml-2">当前：{form.accessKeyId}</span>
            )}
          </label>
          <input
            className={inputCls}
            type="password"
            value={newAccessKeyId}
            onChange={e => setNewAccessKeyId(e.target.value)}
            placeholder="留空保留"
          />
        </div>
        <div>
          <label className={labelCls}>AccessKey Secret</label>
          <input
            className={inputCls}
            type="password"
            value={newAccessKeySecret}
            onChange={e => setNewAccessKeySecret(e.target.value)}
            placeholder="留空保留"
          />
        </div>
        <div>
          <label className={labelCls}>签名 (SignName)</label>
          <input
            className={inputCls}
            value={form.signName}
            onChange={e => setForm(f => ({ ...f, signName: e.target.value }))}
            placeholder="如：Museek"
          />
        </div>

        <fieldset className="border rounded p-3">
          <legend className="text-sm text-gray-500 px-2">模板码</legend>
          <div className="space-y-2">
            <div>
              <label className={labelCls}>注册 (register)</label>
              <input
                className={inputCls}
                value={form.templateCode.register}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    templateCode: { ...f.templateCode, register: e.target.value },
                  }))
                }
                placeholder="SMS_XXXXXXXXX"
              />
            </div>
            <div>
              <label className={labelCls}>密码重置 (resetPassword)</label>
              <input
                className={inputCls}
                value={form.templateCode.resetPassword}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    templateCode: { ...f.templateCode, resetPassword: e.target.value },
                  }))
                }
              />
            </div>
            <div>
              <label className={labelCls}>修改手机号 (changePhone)</label>
              <input
                className={inputCls}
                value={form.templateCode.changePhone}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    templateCode: { ...f.templateCode, changePhone: e.target.value },
                  }))
                }
              />
            </div>
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>同手机号每日上限</label>
            <input
              className={inputCls}
              type="number"
              value={form.perPhoneDailyLimit}
              onChange={e =>
                setForm(f => ({ ...f, perPhoneDailyLimit: Number(e.target.value) || 10 }))
              }
            />
          </div>
          <div>
            <label className={labelCls}>验证码错误次数锁定阈值</label>
            <input
              className={inputCls}
              type="number"
              value={form.verifyMaxAttempts}
              onChange={e =>
                setForm(f => ({ ...f, verifyMaxAttempts: Number(e.target.value) || 5 }))
              }
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button className={btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>

        <div className="border-t pt-4">
          <label className={labelCls}>测试发送</label>
          <div className="flex gap-2">
            <input
              className={inputCls + ' flex-1'}
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="13800001234"
            />
            <button className={btnGhost} onClick={handleTest} disabled={testing}>
              {testing ? '发送中...' : '发送测试码'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            将向该手机号发送一条真实验证码（dev 模式返回 123456）
          </p>
        </div>
      </div>
    </div>
  )
}
