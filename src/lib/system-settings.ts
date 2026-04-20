import { prisma } from './prisma'
import { encryptIdCard, decryptIdCard } from './encrypt'
import type { Prisma } from '@prisma/client'

/** 所有 SystemSetting key 常量（防拼写错） */
export const SETTING_KEYS = {
  // 原有（保留）
  SCORING_WEIGHTS: 'scoring_weights',
  AUTO_ARCHIVE_THRESHOLD: 'auto_archive_threshold',
  REVENUE_RULES: 'revenue_rules',
  REVIEW_TEMPLATES: 'review_templates',
  PLATFORM_CONFIGS: 'platform_configs',
  AI_TOOLS: 'ai_tools',
  GENRES: 'genres',
  // 新增（Batch 1A）
  AI_CONFIG: 'ai_config',
  STORAGE_CONFIG: 'storage_config',
  SMS_CONFIG: 'sms_config',
  NOTIFICATION_TEMPLATES: 'notification_templates',
  AGENCY_TERMS: 'agency_terms',
  INVITE_LINK_DOMAIN: 'invite_link_domain',
} as const

export type SettingKey = typeof SETTING_KEYS[keyof typeof SETTING_KEYS]

/**
 * 指定哪些 JSON 路径需要加密存储。
 * 路径使用点分法（嵌套字段）。
 */
const ENCRYPTED_PATHS: Record<string, string[]> = {
  [SETTING_KEYS.AI_CONFIG]: ['apiKey'],
  [SETTING_KEYS.STORAGE_CONFIG]: ['oss.accessKeyId', 'oss.accessKeySecret'],
  [SETTING_KEYS.SMS_CONFIG]: ['accessKeyId', 'accessKeySecret'],
}

function getEncPaths(key: string): string[] {
  return ENCRYPTED_PATHS[key] ?? []
}

function getAtPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, seg) => {
    if (acc && typeof acc === 'object' && seg in acc) return (acc as Record<string, unknown>)[seg]
    return undefined
  }, obj)
}

function setAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const segs = path.split('.')
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i]
    if (typeof cur[s] !== 'object' || cur[s] === null) cur[s] = {}
    cur = cur[s] as Record<string, unknown>
  }
  cur[segs[segs.length - 1]] = value
}

function deleteAtPath(obj: Record<string, unknown>, path: string): void {
  const segs = path.split('.')
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i]
    if (typeof cur[s] !== 'object' || cur[s] === null) return
    cur = cur[s] as Record<string, unknown>
  }
  delete cur[segs[segs.length - 1]]
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/** 读 setting（敏感字段自动解密）。未配置返回 defaultValue。 */
export async function getSetting<T = unknown>(key: string, defaultValue: T): Promise<T> {
  const row = await prisma.systemSetting.findUnique({ where: { key } })
  if (!row) return defaultValue
  const encPaths = getEncPaths(key)
  if (encPaths.length === 0) return row.value as T

  const cloned = deepClone(row.value) as Record<string, unknown>
  for (const p of encPaths) {
    const v = getAtPath(cloned, p)
    if (typeof v === 'string' && v.length > 0) {
      try {
        setAtPath(cloned, p, decryptIdCard(v))
      } catch {
        // 历史未加密数据直接保留
      }
    }
  }
  return cloned as T
}

/** 写 setting（敏感字段自动加密）；合并补丁式写入（不会覆盖未传的字段）。 */
export async function setSetting(key: string, patch: Record<string, unknown>): Promise<void> {
  const existing = await prisma.systemSetting.findUnique({ where: { key } })
  const existingDecrypted = existing ? await getSetting<Record<string, unknown>>(key, {}) : {}

  // 合并：新值覆盖旧值
  const merged: Record<string, unknown> = { ...existingDecrypted, ...patch }

  // 加密敏感字段
  const encPaths = getEncPaths(key)
  const toStore = deepClone(merged)
  for (const p of encPaths) {
    const v = getAtPath(toStore, p)
    if (typeof v === 'string' && v.length > 0) {
      setAtPath(toStore as Record<string, unknown>, p, encryptIdCard(v))
    }
  }

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: toStore as Prisma.InputJsonValue },
    create: { key, value: toStore as Prisma.InputJsonValue },
  })
}

/** 读 setting 给前端展示用——敏感字段脱敏 `sk-****abcd` */
export async function getSettingMasked<T = unknown>(key: string): Promise<T | null> {
  const plain = await getSetting<Record<string, unknown> | null>(key, null)
  if (!plain) return null
  const encPaths = getEncPaths(key)
  if (encPaths.length === 0) return plain as T

  const cloned = deepClone(plain) as Record<string, unknown>
  for (const p of encPaths) {
    const v = getAtPath(cloned, p)
    if (typeof v === 'string' && v.length > 0) {
      const masked = v.length <= 6 ? '****' : `${v.slice(0, 3)}****${v.slice(-4)}`
      setAtPath(cloned, p, masked)
    }
  }
  return cloned as T
}

/** 清空某 key 的敏感字段（用于前端"清除密钥"按钮） */
export async function clearSensitive(key: string): Promise<void> {
  const encPaths = getEncPaths(key)
  if (encPaths.length === 0) return
  const plain = await getSetting<Record<string, unknown>>(key, {})
  const next = deepClone(plain)
  for (const p of encPaths) deleteAtPath(next, p)
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: next as Prisma.InputJsonValue },
    create: { key, value: next as Prisma.InputJsonValue },
  })
}
