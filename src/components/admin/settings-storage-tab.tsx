'use client'

import { useState, useEffect } from 'react'
import { apiCall } from '@/lib/use-api'
import { cardCls, btnPrimary, inputCls, labelCls } from '@/lib/ui-tokens'
import { AlertTriangle } from 'lucide-react'

interface OssConfig {
  accessKeyId: string
  accessKeySecret: string
  region: string
  bucket: string
  domain: string
}
interface StorageConfig {
  mode: 'local' | 'oss'
  oss: OssConfig
  signedUrlTtlSec: number
  uploadTokenTtlSec: number
  zipRetainHours: number
}
const DEFAULT: StorageConfig = {
  mode: 'local',
  oss: { accessKeyId: '', accessKeySecret: '', region: 'oss-cn-hangzhou', bucket: '', domain: '' },
  signedUrlTtlSec: 3600,
  uploadTokenTtlSec: 300,
  zipRetainHours: 24,
}

interface Props {
  initial: StorageConfig | null
  onSaved: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}

export function SettingsStorageTab({ initial, onSaved, showToast }: Props) {
  const [form, setForm] = useState<StorageConfig>(initial ?? DEFAULT)
  const [newAccessKeyId, setNewAccessKeyId] = useState('')
  const [newAccessKeySecret, setNewAccessKeySecret] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initial) setForm(initial)
  }, [initial])

  async function handleSave() {
    setSaving(true)
    try {
      const oss: Partial<OssConfig> = {
        region: form.oss.region,
        bucket: form.oss.bucket,
        domain: form.oss.domain,
      }
      if (newAccessKeyId.trim()) oss.accessKeyId = newAccessKeyId.trim()
      if (newAccessKeySecret.trim()) oss.accessKeySecret = newAccessKeySecret.trim()

      const res = await apiCall<Record<string, any>>('/api/admin/settings', 'PUT', {
        settings: [
          {
            key: 'storage_config',
            value: {
              mode: form.mode,
              oss,
              signedUrlTtlSec: form.signedUrlTtlSec,
              uploadTokenTtlSec: form.uploadTokenTtlSec,
              zipRetainHours: form.zipRetainHours,
            },
          },
        ],
      })
      if (res.ok) {
        showToast('保存成功', 'success')
        setNewAccessKeyId('')
        setNewAccessKeySecret('')
        // 立即更新表单为服务器返回的脱敏值
        if (res.data?.storage_config) {
          setForm({ ...res.data.storage_config })
        }
        onSaved()
      } else {
        showToast(res.message || '保存失败', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cardCls}>
      <h3 className="text-lg font-semibold mb-2">📦 文件存储配置</h3>
      <p className="text-sm text-gray-500 mb-4">
        切换到 OSS 模式前请先完整填入阿里云 OSS 四项配置，否则上传会失败。
      </p>

      <div className="space-y-4">
        <div>
          <label className={labelCls}>存储模式</label>
          <select
            className={inputCls}
            value={form.mode}
            onChange={e => setForm(f => ({ ...f, mode: e.target.value as 'local' | 'oss' }))}
          >
            <option value="local">本地（public/uploads，仅开发）</option>
            <option value="oss">阿里云 OSS</option>
          </select>
        </div>

        {form.mode === 'oss' && (
          <>
            <div>
              <label className={labelCls}>
                AccessKey ID
                {form.oss.accessKeyId && (
                  <span className="text-xs text-gray-400 ml-2">当前：{form.oss.accessKeyId}</span>
                )}
              </label>
              <input
                className={inputCls}
                type="password"
                value={newAccessKeyId}
                onChange={e => setNewAccessKeyId(e.target.value)}
                placeholder={form.oss.accessKeyId ? '留空保留原值' : 'LTAI...'}
              />
            </div>
            <div>
              <label className={labelCls}>
                AccessKey Secret
                {form.oss.accessKeySecret && (
                  <span className="text-xs text-gray-400 ml-2">当前：已配置</span>
                )}
              </label>
              <input
                className={inputCls}
                type="password"
                value={newAccessKeySecret}
                onChange={e => setNewAccessKeySecret(e.target.value)}
                placeholder={form.oss.accessKeySecret ? '留空保留原值' : ''}
              />
            </div>
            <div>
              <label className={labelCls}>Region</label>
              <input
                className={inputCls}
                value={form.oss.region}
                onChange={e => setForm(f => ({ ...f, oss: { ...f.oss, region: e.target.value } }))}
                placeholder="oss-cn-hangzhou"
              />
            </div>
            <div>
              <label className={labelCls}>Bucket</label>
              <input
                className={inputCls}
                value={form.oss.bucket}
                onChange={e => setForm(f => ({ ...f, oss: { ...f.oss, bucket: e.target.value } }))}
              />
            </div>
            <div>
              <label className={labelCls}>自定义域名 (CDN)，可空</label>
              <input
                className={inputCls}
                value={form.oss.domain}
                onChange={e => setForm(f => ({ ...f, oss: { ...f.oss, domain: e.target.value } }))}
                placeholder="https://cdn.example.com"
              />
            </div>
          </>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>签名 URL 有效期 (秒)</label>
            <input
              className={inputCls}
              type="number"
              value={form.signedUrlTtlSec}
              onChange={e =>
                setForm(f => ({ ...f, signedUrlTtlSec: Number(e.target.value) || 3600 }))
              }
            />
          </div>
          <div>
            <label className={labelCls}>上传 Token 有效期 (秒)</label>
            <input
              className={inputCls}
              type="number"
              value={form.uploadTokenTtlSec}
              onChange={e =>
                setForm(f => ({ ...f, uploadTokenTtlSec: Number(e.target.value) || 300 }))
              }
            />
          </div>
          <div>
            <label className={labelCls}>批量下载 ZIP 保留 (小时)</label>
            <input
              className={inputCls}
              type="number"
              value={form.zipRetainHours}
              onChange={e =>
                setForm(f => ({ ...f, zipRetainHours: Number(e.target.value) || 24 }))
              }
            />
          </div>
        </div>

        <button className={btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </button>

        <div className="text-xs text-orange-600 bg-orange-50 p-3 rounded flex items-start gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Batch 1A 只保存配置，OSS 签名 URL 真实接入将在 Batch 1B 完成。切换到 OSS 模式后上传会失败，请等待 1B 发布。</span>
        </div>
      </div>
    </div>
  )
}
