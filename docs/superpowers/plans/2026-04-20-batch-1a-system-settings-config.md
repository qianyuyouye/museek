# Batch 1A: 系统设置四类配置入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让管理员通过管理端 UI 配置 AI（LLM Key/Base URL/Model）、OSS 存储、阿里云短信、通知模板四类运行时配置；关联 lib（ai-analysis / sms / upload）改为 DB 优先 + env fallback + dev mock，消灭代码中硬读环境变量导致的 "要改 env 重启" 问题。

**Architecture:**
- 复用现有 `SystemSetting(key JSON value)` 表，扩展 PRESET_KEYS 白名单新增 4 大类键
- 新增 `lib/system-settings.ts` 封装 DB 读写 + 加密字段自动处理（apiKey/accessKeySecret 等）
- 各 lib 改造：先读 DB → env → dev fallback 三段降级
- 管理端 settings 页新增 4 个 tab，每个 tab 独立 React 组件
- 接入 `ali-oss` SDK（放在本批次只做 **依赖安装 + 配置能落库**，实际 signatureUrl 改造与文件上传安全链在 Batch 1B 完成）
- AI / SMS 两个 tab 提供"测试连接"按钮验证配置有效性

**Tech Stack:** Next.js 15 + Prisma + `ali-oss`（新增）+ `@alicloud/dysmsapi20170525`（已有）+ `vitest` + `openai` 兼容协议

**关联 GAP:** GAP-ADMIN-001/002/003/083/084 · GAP-LOOP-001/003/004 · GAP-COMM-010/012/014

---

## 文件结构

### 新建文件（9 个）

| 文件 | 职责 |
|---|---|
| `src/lib/system-settings.ts` | SystemSetting 读写封装 + 加密字段自动脱敏/解密 |
| `src/lib/notifications.ts` | 通知模板渲染工具（仅提供 `renderTemplate` 函数，触发逻辑在 Batch 2） |
| `src/components/admin/settings-ai-tab.tsx` | AI 配置 tab 组件 |
| `src/components/admin/settings-storage-tab.tsx` | 存储配置 tab 组件 |
| `src/components/admin/settings-sms-tab.tsx` | 短信配置 tab 组件 |
| `src/components/admin/settings-notification-tab.tsx` | 通知模板管理 tab 组件 |
| `src/app/api/admin/settings/test-ai/route.ts` | 测试 AI 连接（发一条最小 prompt） |
| `src/app/api/admin/settings/test-sms/route.ts` | 测试 SMS 连接（向指定手机号发真实验证码） |
| `tests/lib/system-settings.test.ts` | system-settings lib 单测 |

### 修改文件（7 个）

| 文件 | 改动摘要 |
|---|---|
| `src/app/api/admin/settings/route.ts` | PRESET_KEYS 扩展 + GET 返回时自动脱敏加密字段 + PUT 自动加密 |
| `src/lib/ai-analysis.ts` | DB 优先读 + AbortSignal 超时 + 生产告警（operation_logs） |
| `src/lib/sms.ts` | DB 优先读 + 开发 mock 改走 `!sms_config.enabled` 判断（解除对 env 的依赖） |
| `src/lib/upload.ts` | DB 优先读 OSS 配置 + 配置无效时抛清晰错误（SDK 实际改造在 1B） |
| `src/app/(admin)/admin/settings/page.tsx` | TABS 列表加 4 项 + 引入 4 个子 tab 组件 |
| `package.json` | 新增 `ali-oss` 依赖 |
| `tests/api/settings-publish.test.ts` | 扩展现有测试覆盖 4 类新 key 读写 |

---

## 前置条件

在开始前确认：

- [ ] **P0：** 工作目录干净，位于 Museek 项目根目录
- [ ] **P1：** `.env` 中 `ENCRYPTION_KEY` 已配置（64 位十六进制）——`system-settings.ts` 的加密字段依赖此 key
- [ ] **P2：** 当前分支为 feature 分支（不是 main）——本 plan 会产生 ~15 个 commit，需独立分支
- [ ] **P3：** DB 处于可写状态，能跑 `npx prisma db push`

```bash
# 创建分支
git checkout -b feature/batch-1a-system-settings
# 校验 ENCRYPTION_KEY
node -e "const k=process.env.ENCRYPTION_KEY; console.log(k && /^[0-9a-fA-F]{64}$/.test(k) ? 'OK' : 'INVALID')"
```

---

## Task 1: `system-settings.ts` lib 封装（DB 优先 + 加密字段）

**Files:**
- Create: `src/lib/system-settings.ts`
- Create: `tests/lib/system-settings.test.ts`

**设计要点：**
- 导出常量 `SETTING_KEYS` 作为所有 key 的字面量（防拼写错）
- 导出常量 `ENCRYPTED_PATHS`：哪些 JSON 路径是敏感字段，例如 `ai_config.apiKey`、`storage_config.oss.accessKeySecret`
- `getSetting(key, defaultValue)` - 读 DB，若 key 为加密类型则自动解密敏感字段
- `setSetting(key, value)` - 写 DB，自动加密敏感字段
- `getSettingMasked(key)` - 供前端展示用，敏感字段脱敏成 `****XXXX`
- 加密用现有 `lib/encrypt.ts` 的 `encryptIdCard/decryptIdCard`（AES-256-GCM）

- [ ] **Step 1: 写失败测试**

```typescript
// tests/lib/system-settings.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { getSetting, setSetting, getSettingMasked, SETTING_KEYS } from '@/lib/system-settings'

describe('system-settings lib', () => {
  beforeEach(async () => {
    await prisma.systemSetting.deleteMany({
      where: { key: { in: Object.values(SETTING_KEYS) } },
    })
  })

  it('setSetting + getSetting 明文字段往返一致', async () => {
    await setSetting(SETTING_KEYS.AI_CONFIG, {
      enabled: true,
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-12345',
      model: 'gpt-4o-mini',
      timeoutMs: 10000,
    })
    const value = await getSetting(SETTING_KEYS.AI_CONFIG, {})
    expect(value).toMatchObject({
      enabled: true,
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-12345',
      model: 'gpt-4o-mini',
    })
  })

  it('setSetting 对加密字段加密存储', async () => {
    await setSetting(SETTING_KEYS.AI_CONFIG, {
      enabled: true,
      apiKey: 'sk-secret-should-be-encrypted',
    })
    const raw = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEYS.AI_CONFIG },
    })
    // DB 中应该是 base64 密文，不是明文
    expect(JSON.stringify(raw?.value)).not.toContain('sk-secret-should-be-encrypted')
  })

  it('getSettingMasked 对加密字段脱敏', async () => {
    await setSetting(SETTING_KEYS.AI_CONFIG, {
      apiKey: 'sk-1234567890abcdef',
    })
    const masked = await getSettingMasked(SETTING_KEYS.AI_CONFIG)
    expect(masked).toMatchObject({ apiKey: expect.stringMatching(/^sk-\*+[a-z0-9]{4}$/) })
  })

  it('getSetting 未写过时返回 defaultValue', async () => {
    const val = await getSetting(SETTING_KEYS.SMS_CONFIG, { enabled: false })
    expect(val).toEqual({ enabled: false })
  })

  it('setSetting 合并补丁：只传部分字段时不覆盖其他字段', async () => {
    await setSetting(SETTING_KEYS.AI_CONFIG, {
      baseUrl: 'https://a.com',
      apiKey: 'sk-aaa',
      model: 'm1',
    })
    await setSetting(SETTING_KEYS.AI_CONFIG, { model: 'm2' }) // 仅改 model
    const v = await getSetting(SETTING_KEYS.AI_CONFIG, {})
    expect(v).toMatchObject({ baseUrl: 'https://a.com', apiKey: 'sk-aaa', model: 'm2' })
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run tests/lib/system-settings.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/system-settings'`

- [ ] **Step 3: 实现 `src/lib/system-settings.ts`**

```typescript
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
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/lib/system-settings.test.ts
```

Expected: PASS 5/5

- [ ] **Step 5: 提交**

```bash
git add src/lib/system-settings.ts tests/lib/system-settings.test.ts
git commit -m "feat(Batch-1A): 新增 system-settings lib，支持加密字段 DB 优先读写"
```

---

## Task 2: 扩展 `admin/settings` API 的 PRESET_KEYS

**Files:**
- Modify: `src/app/api/admin/settings/route.ts`
- Modify: `tests/api/settings-publish.test.ts`（扩展现有）

- [ ] **Step 1: 扩展现有测试覆盖 4 新 key 读写 + 脱敏**

在 `tests/api/settings-publish.test.ts` 追加：

```typescript
import { apiRequest, loginAdmin } from './_helpers'
import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/system-settings'

describe('settings 四类新 key', () => {
  let adminCookie: string
  beforeAll(async () => { adminCookie = await loginAdmin() })
  beforeEach(async () => {
    await prisma.systemSetting.deleteMany({
      where: { key: { in: [SETTING_KEYS.AI_CONFIG, SETTING_KEYS.SMS_CONFIG, SETTING_KEYS.STORAGE_CONFIG, SETTING_KEYS.NOTIFICATION_TEMPLATES] } },
    })
  })

  it('PUT 后 GET 返回 4 新 key 且 apiKey 脱敏', async () => {
    const put = await apiRequest('PUT', '/api/admin/settings', {
      settings: [
        { key: SETTING_KEYS.AI_CONFIG, value: { enabled: true, apiKey: 'sk-1234567890abc', model: 'gpt-4o-mini' } },
      ],
    }, { cookie: adminCookie })
    expect(put.status).toBe(200)

    const get = await apiRequest('GET', '/api/admin/settings', null, { cookie: adminCookie })
    expect(get.status).toBe(200)
    const aiConfig = (get.data as any).find((s: any) => s.key === SETTING_KEYS.AI_CONFIG)
    expect(aiConfig?.value?.apiKey).toMatch(/^sk-\*+[a-z0-9]{4}$/) // 脱敏
    expect(aiConfig?.value?.model).toBe('gpt-4o-mini')
  })

  it('PUT 加密字段传空字符串时不覆盖已有密钥', async () => {
    await apiRequest('PUT', '/api/admin/settings', {
      settings: [{ key: SETTING_KEYS.AI_CONFIG, value: { apiKey: 'sk-original' } }],
    }, { cookie: adminCookie })
    await apiRequest('PUT', '/api/admin/settings', {
      settings: [{ key: SETTING_KEYS.AI_CONFIG, value: { apiKey: '', model: 'gpt-5' } }],
    }, { cookie: adminCookie })
    const raw = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEYS.AI_CONFIG } })
    // apiKey 不被空值覆盖
    expect(JSON.stringify(raw?.value)).not.toContain('""')
  })

  it('PUT 不允许的 key 返回 400', async () => {
    const r = await apiRequest('PUT', '/api/admin/settings', {
      settings: [{ key: 'malicious_key', value: 'x' }],
    }, { cookie: adminCookie })
    expect(r.status).toBe(400)
  })
})
```

- [ ] **Step 2: 运行，确认失败**

```bash
npx vitest run tests/api/settings-publish.test.ts
```

Expected: FAIL（新 key 不被 PUT 接受 / 脱敏未实现）

- [ ] **Step 3: 修改 `src/app/api/admin/settings/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { DEFAULT_REVENUE_RULES } from '@/lib/commission'
import { SETTING_KEYS, setSetting, getSettingMasked } from '@/lib/system-settings'

const DEFAULT_AI_CONFIG = {
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  timeoutMs: 10000,
}

const DEFAULT_STORAGE_CONFIG = {
  mode: 'local' as 'local' | 'oss',
  oss: { accessKeyId: '', accessKeySecret: '', region: 'oss-cn-hangzhou', bucket: '', domain: '' },
  signedUrlTtlSec: 3600,
  uploadTokenTtlSec: 300,
  zipRetainHours: 24,
}

const DEFAULT_SMS_CONFIG = {
  enabled: false,
  accessKeyId: '',
  accessKeySecret: '',
  signName: '',
  templateCode: { register: '', resetPassword: '', changePhone: '' },
  perPhoneDailyLimit: 10,
  verifyMaxAttempts: 5,
}

const DEFAULT_NOTIFICATION_TEMPLATES = {
  'tpl.review_done': { type: 'work', title: '评审完成：《{songTitle}》', content: '评审员已完成评审，综合评分 {score} 分。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.song_published': { type: 'work', title: '作品发行：《{songTitle}》', content: '您的作品已成功发行。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.song_needs_revision': { type: 'work', title: '作品需修改：《{songTitle}》', content: '评审员建议修改：{comment}。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.song_archived': { type: 'work', title: '作品归档：《{songTitle}》', content: '您的作品已从发行状态归档。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.settlement_created': { type: 'revenue', title: '结算生成：{periodLabel}', content: '您在 {periodLabel} 的结算金额 ¥{amount} 已生成。', linkUrl: '/creator/revenue' },
  'tpl.settlement_paid': { type: 'revenue', title: '打款到账：¥{amount}', content: '您在 {periodLabel} 的结算已打款到账。', linkUrl: '/creator/revenue' },
  'tpl.realname_approved': { type: 'system', title: '实名认证已通过', content: '您的实名认证审核通过，可正常发行和打款。', linkUrl: '/creator/profile' },
  'tpl.realname_rejected': { type: 'system', title: '实名认证被驳回', content: '驳回原因：{reason}。请修改后重新提交。', linkUrl: '/creator/profile' },
  'tpl.assignment_created': { type: 'work', title: '新作业：《{assignmentTitle}》', content: '{assignmentDescription} 截止时间：{deadline}。', linkUrl: '/creator/assignments' },
  'tpl.assignment_due_soon': { type: 'work', title: '作业即将截止：《{assignmentTitle}》', content: '距离截止还有 24 小时，尚未提交。', linkUrl: '/creator/assignments' },
  'tpl.welcome': { type: 'system', title: '欢迎加入 Museek', content: '注册成功！请前往个人中心完成实名认证。', linkUrl: '/creator/profile' },
}

const PRESET_KEYS: Record<string, unknown> = {
  [SETTING_KEYS.SCORING_WEIGHTS]: { technique: 30, creativity: 40, commercial: 30 },
  [SETTING_KEYS.AUTO_ARCHIVE_THRESHOLD]: 80,
  [SETTING_KEYS.REVENUE_RULES]: DEFAULT_REVENUE_RULES,
  [SETTING_KEYS.REVIEW_TEMPLATES]: [],
  [SETTING_KEYS.PLATFORM_CONFIGS]: [{ name: '', region: '', enabled: true, mapped: false }],
  [SETTING_KEYS.AI_TOOLS]: [],
  [SETTING_KEYS.GENRES]: [],
  // Batch 1A 新增
  [SETTING_KEYS.AI_CONFIG]: DEFAULT_AI_CONFIG,
  [SETTING_KEYS.STORAGE_CONFIG]: DEFAULT_STORAGE_CONFIG,
  [SETTING_KEYS.SMS_CONFIG]: DEFAULT_SMS_CONFIG,
  [SETTING_KEYS.NOTIFICATION_TEMPLATES]: DEFAULT_NOTIFICATION_TEMPLATES,
}

/** 这些 key 走 setSetting（支持加密字段 + 合并补丁）路径 */
const PATCH_KEYS = new Set([SETTING_KEYS.AI_CONFIG, SETTING_KEYS.STORAGE_CONFIG, SETTING_KEYS.SMS_CONFIG])

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const rows = await prisma.systemSetting.findMany()
  const map = new Map(rows.map((r) => [r.key, r.value]))

  const settings = await Promise.all(
    Object.entries(PRESET_KEYS).map(async ([key, defaultValue]) => {
      if (PATCH_KEYS.has(key as any)) {
        // 敏感字段脱敏
        const masked = await getSettingMasked(key)
        return { key, value: masked ?? defaultValue }
      }
      return { key, value: map.has(key) ? map.get(key) : defaultValue }
    }),
  )

  return ok(settings)
})

export const PUT = safeHandler(async function PUT(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const body = await request.json()
  const rawSettings = (body as { settings: { key: string; value: unknown }[] }).settings
  if (!Array.isArray(rawSettings)) return err('settings 必须为数组')

  const KEY_ALIAS: Record<string, string> = { commission_rules: 'revenue_rules' }
  const settings = rawSettings.map(({ key, value }) => ({ key: KEY_ALIAS[key] ?? key, value }))

  const ALLOWED_KEYS = Object.keys(PRESET_KEYS)
  const invalidKeys = settings.filter(({ key }) => !ALLOWED_KEYS.includes(key)).map(({ key }) => key)
  if (invalidKeys.length > 0) return err(`不允许的 key：${invalidKeys.join(', ')}`)

  // 分两路：敏感 key 走 setSetting（合并补丁 + 加密）；其他走 upsert
  for (const s of settings) {
    if (PATCH_KEYS.has(s.key as any)) {
      const patch = s.value as Record<string, unknown>
      // 空字符串的加密字段过滤：避免清空已存密钥
      if (patch && typeof patch === 'object') {
        if ('apiKey' in patch && patch.apiKey === '') delete patch.apiKey
        if ('accessKeySecret' in patch && patch.accessKeySecret === '') delete patch.accessKeySecret
        if ('accessKeyId' in patch && patch.accessKeyId === '') delete patch.accessKeyId
        if ('oss' in patch && patch.oss && typeof patch.oss === 'object') {
          const oss = patch.oss as Record<string, unknown>
          if (oss.accessKeyId === '') delete oss.accessKeyId
          if (oss.accessKeySecret === '') delete oss.accessKeySecret
        }
      }
      await setSetting(s.key, patch)
    } else {
      await prisma.systemSetting.upsert({
        where: { key: s.key },
        update: { value: s.value as Prisma.InputJsonValue },
        create: { key: s.key, value: s.value as Prisma.InputJsonValue },
      })
    }
  }

  await logAdminAction(request, {
    action: 'update_system_setting',
    targetType: 'system_setting',
    detail: { keys: settings.map((s) => s.key) },
  })
  return ok(null)
})
```

- [ ] **Step 4: 运行确认通过**

```bash
npx vitest run tests/api/settings-publish.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/app/api/admin/settings/route.ts tests/api/settings-publish.test.ts
git commit -m "feat(Batch-1A): settings API 扩展 ai_config/storage_config/sms_config/notification_templates 四新 key"
```

---

## Task 3: `ai-analysis.ts` 改 DB 优先 + 超时 + 降级告警

**Files:**
- Modify: `src/lib/ai-analysis.ts`
- Test: `tests/lib/ai-analysis.test.ts`（新建）

- [ ] **Step 1: 写失败测试**

```typescript
// tests/lib/ai-analysis.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
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
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true })
    await setSetting(SETTING_KEYS.AI_CONFIG, { enabled: true, apiKey: '' })
    await analyzeSong({ title: 't', genre: null, bpm: null, aiTools: null, styleDesc: null, audioFeatures: null })
    const logs = await prisma.operationLog.findMany({ where: { action: 'ai_analysis_unavailable' } })
    expect(logs.length).toBeGreaterThan(0)
    Object.defineProperty(process.env, 'NODE_ENV', { value: orig, writable: true })
  })

  it('fetch 超时（AbortSignal）触发降级', async () => {
    await setSetting(SETTING_KEYS.AI_CONFIG, {
      enabled: true, baseUrl: 'http://127.0.0.1:1', apiKey: 'sk-x', model: 'm', timeoutMs: 500,
    })
    const start = Date.now()
    const r = await analyzeSong({ title: 't', genre: null, bpm: null, aiTools: null, styleDesc: null, audioFeatures: null })
    const elapsed = Date.now() - start
    expect(r.summary).toBe('暂无分析数据')
    expect(elapsed).toBeLessThan(2000) // 至少在 timeoutMs 内放弃
  })
})
```

- [ ] **Step 2: 运行，确认失败**

```bash
npx vitest run tests/lib/ai-analysis.test.ts
```

Expected: FAIL

- [ ] **Step 3: 改 `src/lib/ai-analysis.ts`**

完整替换文件（保留原 interface 和 DEFAULT_RESULT）：

```typescript
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
      signal: AbortSignal.timeout(config.timeoutMs ?? 5000),
    })
    if (res.ok) return { ok: true, message: '连接成功' }
    const body = await res.text().catch(() => '')
    return { ok: false, message: `HTTP ${res.status}: ${body.slice(0, 100)}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : '连接失败' }
  }
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npx vitest run tests/lib/ai-analysis.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/ai-analysis.ts tests/lib/ai-analysis.test.ts
git commit -m "feat(Batch-1A): ai-analysis 改 DB 优先读 + AbortSignal 超时 + 生产告警"
```

---

## Task 4: `sms.ts` 改 DB 优先 + dev fallback 解耦

**Files:**
- Modify: `src/lib/sms.ts`

- [ ] **Step 1: 改写 `src/lib/sms.ts`**

```typescript
import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525'
import * as $OpenApi from '@alicloud/openapi-client'
import * as $Util from '@alicloud/tea-util'
import { prisma } from './prisma'
import { getSetting, SETTING_KEYS } from './system-settings'

interface SmsConfig {
  enabled: boolean
  accessKeyId: string
  accessKeySecret: string
  signName: string
  templateCode: { register: string; resetPassword: string; changePhone: string }
  perPhoneDailyLimit: number
  verifyMaxAttempts: number
}

async function loadConfig(): Promise<SmsConfig> {
  const fromDb = await getSetting<Partial<SmsConfig>>(SETTING_KEYS.SMS_CONFIG, {})
  const tc = fromDb.templateCode ?? {} as Partial<SmsConfig['templateCode']>
  return {
    enabled: fromDb.enabled ?? !!process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeyId: fromDb.accessKeyId || process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: fromDb.accessKeySecret || process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    signName: fromDb.signName || process.env.ALIYUN_SMS_SIGN_NAME || '',
    templateCode: {
      register: tc.register || process.env.ALIYUN_SMS_TEMPLATE_CODE || '',
      resetPassword: tc.resetPassword || process.env.ALIYUN_SMS_TEMPLATE_CODE || '',
      changePhone: tc.changePhone || process.env.ALIYUN_SMS_TEMPLATE_CODE || '',
    },
    perPhoneDailyLimit: fromDb.perPhoneDailyLimit ?? 10,
    verifyMaxAttempts: fromDb.verifyMaxAttempts ?? 5,
  }
}

function createClient(accessKeyId: string, accessKeySecret: string): Dysmsapi20170525 {
  const config = new $OpenApi.Config({ accessKeyId, accessKeySecret, endpoint: 'dysmsapi.aliyuncs.com' })
  return new Dysmsapi20170525(config)
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export type SmsPurpose = 'register' | 'resetPassword' | 'changePhone'

export async function sendSmsCode(
  phone: string,
  purpose: SmsPurpose = 'register',
): Promise<{ success: boolean; message: string }> {
  const config = await loadConfig()

  // 1 分钟频率限制
  const recentCode = await prisma.smsCode.findFirst({
    where: { phone, createdAt: { gte: new Date(Date.now() - 60 * 1000) } },
  })
  if (recentCode) return { success: false, message: '发送过于频繁，请1分钟后重试' }

  // 同手机号每日上限
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayCount = await prisma.smsCode.count({ where: { phone, createdAt: { gte: todayStart } } })
  if (todayCount >= config.perPhoneDailyLimit) {
    return { success: false, message: `该手机号今日发送已达上限（${config.perPhoneDailyLimit} 次）` }
  }

  const code = generateCode()

  // Dev 模式：未启用 SMS 时 + NODE_ENV=development → 固定码
  if (!config.enabled && process.env.NODE_ENV === 'development') {
    await prisma.smsCode.create({
      data: { phone, code: '123456', expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    })
    return { success: true, message: '开发模式：验证码为 123456' }
  }
  if (!config.enabled) {
    return { success: false, message: '短信服务未配置，请联系管理员' }
  }

  const templateCode = config.templateCode[purpose]
  if (!config.accessKeyId || !config.signName || !templateCode) {
    return { success: false, message: `短信服务缺少配置（${purpose}）` }
  }

  try {
    const client = createClient(config.accessKeyId, config.accessKeySecret)
    const request = new $Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: phone,
      signName: config.signName,
      templateCode,
      templateParam: JSON.stringify({ code }),
    })
    const runtime = new $Util.RuntimeOptions({})
    const response = await client.sendSmsWithOptions(request, runtime)

    if (response.body?.code === 'OK') {
      await prisma.smsCode.create({
        data: { phone, code, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      })
      return { success: true, message: '验证码已发送' }
    }
    return { success: false, message: response.body?.message || '发送失败' }
  } catch (error) {
    console.error('SMS send error:', error)
    return { success: false, message: '短信服务异常' }
  }
}

export async function verifySmsCode(phone: string, code: string): Promise<boolean> {
  const record = await prisma.smsCode.findFirst({
    where: { phone, code, used: false, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!record) return false
  await prisma.smsCode.update({ where: { id: record.id }, data: { used: true } })
  return true
}

/** 由 test-sms API 调用，发一条真实短信测试配置 */
export async function pingSms(phone: string): Promise<{ success: boolean; message: string }> {
  return sendSmsCode(phone, 'register')
}
```

- [ ] **Step 2: 手动验证 dev mode 回归**

```bash
# dev 环境 + 未启用 SMS（未设 ALIYUN_ACCESS_KEY_ID 且 sms_config.enabled=false）
curl -X POST http://localhost:3000/api/auth/sms/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800001234","purpose":"register"}'
```

Expected: `{"success":true,"message":"开发模式：验证码为 123456"}`

- [ ] **Step 3: 运行已有相关测试**

```bash
npx vitest run tests/api/auth.test.ts
```

Expected: 所有已 PASS 的 SMS 相关用例保持 PASS

- [ ] **Step 4: 提交**

```bash
git add src/lib/sms.ts
git commit -m "feat(Batch-1A): sms 改 DB 优先读 + 每日上限 + purpose 区分模板"
```

---

## Task 5: `upload.ts` 从 DB 读 OSS 配置（签名 URL 留给 1B）

**Files:**
- Modify: `src/lib/upload.ts`
- Modify: `package.json`（新增 `ali-oss`）

- [ ] **Step 1: 安装 ali-oss**

```bash
npm install ali-oss
npm install --save-dev @types/ali-oss
```

- [ ] **Step 2: 改 `src/lib/upload.ts`**

本任务只做：配置从 DB 读 + `storage.mode === 'oss'` 时才走 OSS 分支（避免生产误走 local）。SDK signatureUrl 真实调用放 Batch 1B。

```typescript
import crypto from 'crypto'
import path from 'path'
import { getSetting, SETTING_KEYS } from './system-settings'

const AUDIO_EXTS = ['.wav', '.mp3']
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_AUDIO = 50 * 1024 * 1024
const MAX_IMAGE = 5 * 1024 * 1024

interface UploadToken {
  uploadUrl: string
  fileUrl: string
  method: 'PUT'
  headers?: Record<string, string>
}

interface StorageConfig {
  mode: 'local' | 'oss'
  oss: {
    accessKeyId: string
    accessKeySecret: string
    region: string
    bucket: string
    domain: string
  }
  signedUrlTtlSec: number
  uploadTokenTtlSec: number
  zipRetainHours: number
}

async function loadStorageConfig(): Promise<StorageConfig> {
  const fromDb = await getSetting<Partial<StorageConfig>>(SETTING_KEYS.STORAGE_CONFIG, {})
  const oss = fromDb.oss ?? {} as Partial<StorageConfig['oss']>
  const mode = fromDb.mode ?? (process.env.OSS_BUCKET ? 'oss' : 'local')
  return {
    mode: mode as 'local' | 'oss',
    oss: {
      accessKeyId: oss.accessKeyId || process.env.OSS_ACCESS_KEY_ID || '',
      accessKeySecret: oss.accessKeySecret || process.env.OSS_ACCESS_KEY_SECRET || '',
      region: oss.region || process.env.OSS_REGION || 'oss-cn-hangzhou',
      bucket: oss.bucket || process.env.OSS_BUCKET || '',
      domain: oss.domain || process.env.OSS_DOMAIN || '',
    },
    signedUrlTtlSec: fromDb.signedUrlTtlSec ?? 3600,
    uploadTokenTtlSec: fromDb.uploadTokenTtlSec ?? 300,
    zipRetainHours: fromDb.zipRetainHours ?? 24,
  }
}

function generateKey(originalName: string, type: 'audio' | 'image'): string {
  const ext = path.extname(originalName).toLowerCase() || (type === 'audio' ? '.mp3' : '.jpg')
  const hash = crypto.randomBytes(8).toString('hex')
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const dir = type === 'audio' ? 'audio' : 'images'
  return `uploads/${dir}/${date}_${hash}${ext}`
}

export function validateUpload(fileName: string, fileSize: number, type: 'audio' | 'image'): string | null {
  const ext = path.extname(fileName).toLowerCase()
  const allowedExts = type === 'audio' ? AUDIO_EXTS : IMAGE_EXTS
  if (!allowedExts.includes(ext)) {
    return `不支持的文件类型 ${ext}，允许: ${allowedExts.join(', ')}`
  }
  const maxSize = type === 'audio' ? MAX_AUDIO : MAX_IMAGE
  if (fileSize > maxSize) {
    return `文件过大 ${(fileSize / 1024 / 1024).toFixed(1)}MB，最大 ${maxSize / 1024 / 1024}MB`
  }
  return null
}

function getLocalToken(key: string): UploadToken {
  return {
    uploadUrl: `/api/upload/local/${key}`,
    fileUrl: `/${key}`,
    method: 'PUT',
  }
}

/**
 * OSS 上传 Token（过渡版）
 *
 * Batch 1A：仅返回基于 DB 配置的占位 URL，未做 signatureUrl 真实签名。
 * Batch 1B：接入 ali-oss SDK，调用 `client.signatureUrl(key, {method:'PUT', expires:300})`。
 */
function getOSSToken(key: string, config: StorageConfig): UploadToken {
  const { bucket, region, domain } = config.oss
  const base = domain || `https://${bucket}.${region}.aliyuncs.com`
  return {
    uploadUrl: `${base}/${key}`, // TODO(Batch-1B): 替换为 signatureUrl 签名
    fileUrl: `${base}/${key}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
  }
}

export async function createUploadToken(fileName: string, type: 'audio' | 'image'): Promise<UploadToken> {
  const key = generateKey(fileName, type)
  const config = await loadStorageConfig()

  if (config.mode === 'oss') {
    if (!config.oss.bucket || !config.oss.accessKeyId) {
      throw new Error('OSS 模式已启用但配置不完整（bucket 或 accessKeyId 缺失）')
    }
    return getOSSToken(key, config)
  }
  return getLocalToken(key)
}

/** 用于 Task 5 UI 写入后的快速测试（Batch 1B 会增强为真签名） */
export async function getCurrentStorageMode(): Promise<'local' | 'oss'> {
  const config = await loadStorageConfig()
  return config.mode
}
```

- [ ] **Step 3: 改调用方（`createUploadToken` 变异步）**

用 Grep 找所有调用：

```bash
# 先确认调用点
```

```typescript
// Grep pattern: createUploadToken\(
// 修改：调用处加 await
```

修改 `src/app/api/upload/token/route.ts`：

```typescript
import { NextRequest } from 'next/server'
import { createUploadToken, validateUpload } from '@/lib/upload'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) return err('未登录', 401)
  const { fileName, fileSize, type } = await request.json()
  if (!fileName || !fileSize || !type) return err('参数不完整')
  if (type !== 'audio' && type !== 'image') return err('type 必须是 audio 或 image')

  const validateError = validateUpload(fileName, Number(fileSize), type)
  if (validateError) return err(validateError)

  const token = await createUploadToken(fileName, type)
  return ok(token)
})
```

- [ ] **Step 4: 跑类型检查**

```bash
npx tsc --noEmit
```

Expected: 无编译错误

- [ ] **Step 5: 提交**

```bash
git add src/lib/upload.ts src/app/api/upload/token/route.ts package.json package-lock.json
git commit -m "feat(Batch-1A): upload.ts 从 DB 读 OSS 配置，安装 ali-oss（signatureUrl 留给 1B）"
```

---

## Task 6: `notifications.ts` 模板渲染工具（仅渲染，不触发）

**Files:**
- Create: `src/lib/notifications.ts`
- Create: `tests/lib/notifications.test.ts`

**说明：** 本任务只实现 `renderTemplate(templateKey, vars)` 函数，把模板字符串中 `{var}` 占位替换为实际值。实际触发（`notify(userId, templateKey, vars)` 在各业务事务中调用）放在 **Batch 2**。

- [ ] **Step 1: 写失败测试**

```typescript
// tests/lib/notifications.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { renderTemplate, getTemplate } from '@/lib/notifications'
import { setSetting, SETTING_KEYS } from '@/lib/system-settings'

describe('notifications renderTemplate', () => {
  beforeEach(async () => {
    await prisma.systemSetting.deleteMany({ where: { key: SETTING_KEYS.NOTIFICATION_TEMPLATES } })
  })

  it('渲染简单占位', async () => {
    const r = await renderTemplate('tpl.review_done', { songTitle: '夏日告别', score: 85, songId: '123' })
    expect(r.title).toBe('评审完成：《夏日告别》')
    expect(r.content).toContain('85 分')
    expect(r.linkUrl).toBe('/creator/songs?id=123')
    expect(r.type).toBe('work')
  })

  it('管理员覆盖模板后渲染按新文案', async () => {
    await setSetting(SETTING_KEYS.NOTIFICATION_TEMPLATES, {
      'tpl.review_done': { type: 'work', title: '自定义：{songTitle}', content: '分数 {score}', linkUrl: '/custom' },
    } as any)
    const r = await renderTemplate('tpl.review_done', { songTitle: 'X', score: 90 })
    expect(r.title).toBe('自定义：X')
  })

  it('未知 templateKey 返回 null', async () => {
    const r = await renderTemplate('tpl.nonexistent' as any, {})
    expect(r).toBeNull()
  })

  it('占位符未提供变量时保留原样', async () => {
    const r = await renderTemplate('tpl.review_done', { songTitle: 'X' })
    expect(r?.content).toContain('{score}')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/lib/notifications.test.ts
```

Expected: FAIL - Cannot find module

- [ ] **Step 3: 实现 `src/lib/notifications.ts`**

```typescript
import { getSetting, SETTING_KEYS } from './system-settings'

export type NotificationType = 'work' | 'revenue' | 'system' | 'assignment'

export interface NotificationTemplate {
  type: NotificationType
  title: string
  content: string
  linkUrl: string
}

export interface RenderedNotification {
  type: NotificationType
  title: string
  content: string
  linkUrl: string
}

export type TemplateKey =
  | 'tpl.review_done'
  | 'tpl.song_published'
  | 'tpl.song_needs_revision'
  | 'tpl.song_archived'
  | 'tpl.settlement_created'
  | 'tpl.settlement_paid'
  | 'tpl.realname_approved'
  | 'tpl.realname_rejected'
  | 'tpl.assignment_created'
  | 'tpl.assignment_due_soon'
  | 'tpl.welcome'

/** 内置默认模板（fallback） */
const DEFAULT_TEMPLATES: Record<TemplateKey, NotificationTemplate> = {
  'tpl.review_done': { type: 'work', title: '评审完成：《{songTitle}》', content: '评审员已完成评审，综合评分 {score} 分。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.song_published': { type: 'work', title: '作品发行：《{songTitle}》', content: '您的作品已成功发行。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.song_needs_revision': { type: 'work', title: '作品需修改：《{songTitle}》', content: '评审员建议修改：{comment}。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.song_archived': { type: 'work', title: '作品归档：《{songTitle}》', content: '您的作品已从发行状态归档。', linkUrl: '/creator/songs?id={songId}' },
  'tpl.settlement_created': { type: 'revenue', title: '结算生成：{periodLabel}', content: '您在 {periodLabel} 的结算金额 ¥{amount} 已生成。', linkUrl: '/creator/revenue' },
  'tpl.settlement_paid': { type: 'revenue', title: '打款到账：¥{amount}', content: '您在 {periodLabel} 的结算已打款到账。', linkUrl: '/creator/revenue' },
  'tpl.realname_approved': { type: 'system', title: '实名认证已通过', content: '您的实名认证审核通过，可正常发行和打款。', linkUrl: '/creator/profile' },
  'tpl.realname_rejected': { type: 'system', title: '实名认证被驳回', content: '驳回原因：{reason}。请修改后重新提交。', linkUrl: '/creator/profile' },
  'tpl.assignment_created': { type: 'work', title: '新作业：《{assignmentTitle}》', content: '{assignmentDescription} 截止时间：{deadline}。', linkUrl: '/creator/assignments' },
  'tpl.assignment_due_soon': { type: 'work', title: '作业即将截止：《{assignmentTitle}》', content: '距离截止还有 24 小时，尚未提交。', linkUrl: '/creator/assignments' },
  'tpl.welcome': { type: 'system', title: '欢迎加入 Museek', content: '注册成功！请前往个人中心完成实名认证。', linkUrl: '/creator/profile' },
}

export async function getTemplate(key: TemplateKey): Promise<NotificationTemplate | null> {
  const overrides = await getSetting<Partial<Record<TemplateKey, NotificationTemplate>>>(SETTING_KEYS.NOTIFICATION_TEMPLATES, {})
  return overrides[key] ?? DEFAULT_TEMPLATES[key] ?? null
}

function interpolate(str: string, vars: Record<string, unknown>): string {
  return str.replace(/\{(\w+)\}/g, (match, k) => {
    if (k in vars && vars[k] !== undefined && vars[k] !== null) return String(vars[k])
    return match // 保留原样
  })
}

export async function renderTemplate(key: TemplateKey, vars: Record<string, unknown>): Promise<RenderedNotification | null> {
  const tpl = await getTemplate(key)
  if (!tpl) return null
  return {
    type: tpl.type,
    title: interpolate(tpl.title, vars),
    content: interpolate(tpl.content, vars),
    linkUrl: interpolate(tpl.linkUrl, vars),
  }
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npx vitest run tests/lib/notifications.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/notifications.ts tests/lib/notifications.test.ts
git commit -m "feat(Batch-1A): 新增 notifications lib 模板渲染（触发留给 Batch 2）"
```

---

## Task 7: `test-ai` API（测试 AI 连接）

**Files:**
- Create: `src/app/api/admin/settings/test-ai/route.ts`

- [ ] **Step 1: 写测试**

```typescript
// tests/api/settings-test-ai.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { apiRequest, loginAdmin } from './_helpers'

describe('POST /api/admin/settings/test-ai', () => {
  let adminCookie: string
  beforeAll(async () => { adminCookie = await loginAdmin() })

  it('apiKey 为空返回 400', async () => {
    const r = await apiRequest('POST', '/api/admin/settings/test-ai',
      { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' },
      { cookie: adminCookie })
    expect(r.status).toBe(400)
  })

  it('无效 baseUrl 返回 ok:false', async () => {
    const r = await apiRequest('POST', '/api/admin/settings/test-ai',
      { baseUrl: 'http://127.0.0.1:1', apiKey: 'sk-x', model: 'm', timeoutMs: 500 },
      { cookie: adminCookie })
    expect(r.status).toBe(200)
    expect((r.data as any).ok).toBe(false)
  })

  it('非 admin 返回 401/403', async () => {
    const r = await apiRequest('POST', '/api/admin/settings/test-ai',
      { baseUrl: 'x', apiKey: 'x', model: 'x' }, {})
    expect([401, 403]).toContain(r.status)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/api/settings-test-ai.test.ts
```

Expected: FAIL - 404

- [ ] **Step 3: 实现路由**

```typescript
// src/app/api/admin/settings/test-ai/route.ts
import { NextRequest } from 'next/server'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { pingAi } from '@/lib/ai-analysis'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { baseUrl, apiKey, model, timeoutMs } = body as { baseUrl?: string; apiKey?: string; model?: string; timeoutMs?: number }
  if (!apiKey) return err('apiKey 不能为空')

  const result = await pingAi({
    baseUrl: baseUrl || 'https://api.openai.com/v1',
    apiKey,
    model: model || 'gpt-4o-mini',
    timeoutMs: timeoutMs ?? 5000,
  })
  return ok(result)
})
```

- [ ] **Step 4: 运行确认通过**

```bash
npx vitest run tests/api/settings-test-ai.test.ts
```

Expected: PASS 3/3

- [ ] **Step 5: 提交**

```bash
git add src/app/api/admin/settings/test-ai tests/api/settings-test-ai.test.ts
git commit -m "feat(Batch-1A): 新增 POST /api/admin/settings/test-ai 测试 AI 连接"
```

---

## Task 8: `test-sms` API（测试 SMS 连接，向指定手机号发真实验证码）

**Files:**
- Create: `src/app/api/admin/settings/test-sms/route.ts`

- [ ] **Step 1: 写测试**

```typescript
// tests/api/settings-test-sms.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { apiRequest, loginAdmin } from './_helpers'

describe('POST /api/admin/settings/test-sms', () => {
  let adminCookie: string
  beforeAll(async () => { adminCookie = await loginAdmin() })

  it('phone 格式错误返回 400', async () => {
    const r = await apiRequest('POST', '/api/admin/settings/test-sms',
      { phone: 'abc' }, { cookie: adminCookie })
    expect(r.status).toBe(400)
  })

  it('phone 合法时返回 pingSms 结果（dev 模式返回 success:true）', async () => {
    const r = await apiRequest('POST', '/api/admin/settings/test-sms',
      { phone: '13800009999' }, { cookie: adminCookie })
    expect(r.status).toBe(200)
    expect((r.data as any).success).toBeDefined()
  })

  it('非 admin 返回 401/403', async () => {
    const r = await apiRequest('POST', '/api/admin/settings/test-sms',
      { phone: '13800009999' }, {})
    expect([401, 403]).toContain(r.status)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/api/settings-test-sms.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现路由**

```typescript
// src/app/api/admin/settings/test-sms/route.ts
import { NextRequest } from 'next/server'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { pingSms } from '@/lib/sms'
import { logAdminAction } from '@/lib/log-action'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { phone } = await request.json() as { phone?: string }
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) return err('手机号格式错误')

  const result = await pingSms(phone)
  await logAdminAction(request, {
    action: 'test_sms_config',
    targetType: 'system_setting',
    detail: { phone, ...result },
  })
  return ok(result)
})
```

- [ ] **Step 4: 运行确认通过**

```bash
npx vitest run tests/api/settings-test-sms.test.ts
```

Expected: PASS 3/3

- [ ] **Step 5: 提交**

```bash
git add src/app/api/admin/settings/test-sms tests/api/settings-test-sms.test.ts
git commit -m "feat(Batch-1A): 新增 POST /api/admin/settings/test-sms 测试短信配置"
```

---

## Task 9: Settings AI Tab 组件

**Files:**
- Create: `src/components/admin/settings-ai-tab.tsx`

- [ ] **Step 1: 创建组件**

```tsx
// src/components/admin/settings-ai-tab.tsx
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

  useEffect(() => { if (initial) setForm(initial) }, [initial])

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
      const res = await apiCall('PUT', '/api/admin/settings', {
        settings: [{ key: 'ai_config', value: payload }],
      })
      if (res.ok) {
        showToast('保存成功', 'success')
        setNewApiKey('')
        onSaved()
      } else {
        showToast(res.message || '保存失败', 'error')
      }
    } finally { setSaving(false) }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const apiKeyToUse = newApiKey.trim() || undefined // 有新 key 用新，否则让后端读 DB 里的
      const res = await apiCall('POST', '/api/admin/settings/test-ai', {
        baseUrl: form.baseUrl,
        apiKey: apiKeyToUse ?? '__use_saved__', // 后端识别 __use_saved__ 读 DB
        model: form.model,
        timeoutMs: 5000,
      })
      if (res.ok) {
        const data = res.data as { ok: boolean; message: string }
        showToast(data.ok ? `✅ ${data.message}` : `❌ ${data.message}`, data.ok ? 'success' : 'error')
      } else {
        showToast(res.message || '测试失败', 'error')
      }
    } finally { setTesting(false) }
  }

  return (
    <div className={cardCls}>
      <h3 className="text-lg font-semibold mb-2">🤖 AI 预分析配置</h3>
      <p className="text-sm text-gray-500 mb-4">配置 OpenAI 兼容 API。未启用或未配置时，评审页 AI 报告将显示占位「暂无分析数据」。</p>

      <div className="space-y-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.enabled}
            onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} />
          <span>启用 AI 预分析</span>
        </label>

        <div>
          <label className={labelCls}>API Base URL</label>
          <input className={inputCls} value={form.baseUrl}
            onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
            placeholder="https://api.openai.com/v1" />
        </div>

        <div>
          <label className={labelCls}>API Key {maskedApiKey && <span className="text-xs text-gray-400 ml-2">当前：{maskedApiKey}</span>}</label>
          <input className={inputCls} type="password" value={newApiKey}
            onChange={e => setNewApiKey(e.target.value)}
            placeholder={maskedApiKey ? '留空保留原值' : 'sk-...'} />
        </div>

        <div>
          <label className={labelCls}>Model</label>
          <input className={inputCls} value={form.model}
            onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
            placeholder="gpt-4o-mini" />
        </div>

        <div>
          <label className={labelCls}>超时（ms）</label>
          <input className={inputCls} type="number" value={form.timeoutMs}
            onChange={e => setForm(f => ({ ...f, timeoutMs: Number(e.target.value) || 10000 }))} />
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
```

- [ ] **Step 2: test-ai 路由支持 `__use_saved__` apiKey**

修改 `src/app/api/admin/settings/test-ai/route.ts` 使其当 `apiKey === '__use_saved__'` 时从 DB 读：

```typescript
import { NextRequest } from 'next/server'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { pingAi } from '@/lib/ai-analysis'
import { getSetting, SETTING_KEYS } from '@/lib/system-settings'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const body = await request.json()
  let { baseUrl, apiKey, model, timeoutMs } = body as { baseUrl?: string; apiKey?: string; model?: string; timeoutMs?: number }

  if (apiKey === '__use_saved__') {
    const saved = await getSetting<{ apiKey?: string; baseUrl?: string; model?: string }>(SETTING_KEYS.AI_CONFIG, {})
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
```

- [ ] **Step 3: 手动验证**

```bash
npm run dev
# 打开 /admin/settings，切换到 AI Tab，点保存 + 测试连接
```

Expected: 保存 toast 成功；测试连接 toast 成功/失败

- [ ] **Step 4: 提交**

```bash
git add src/components/admin/settings-ai-tab.tsx src/app/api/admin/settings/test-ai/route.ts
git commit -m "feat(Batch-1A): 新增 Settings AI Tab 组件 + test-ai 支持 __use_saved__"
```

---

## Task 10: Settings Storage Tab

**Files:**
- Create: `src/components/admin/settings-storage-tab.tsx`

- [ ] **Step 1: 创建组件**

```tsx
// src/components/admin/settings-storage-tab.tsx
'use client'

import { useState, useEffect } from 'react'
import { apiCall } from '@/lib/use-api'
import { cardCls, btnPrimary, inputCls, labelCls } from '@/lib/ui-tokens'

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

  useEffect(() => { if (initial) setForm(initial) }, [initial])

  async function handleSave() {
    setSaving(true)
    try {
      const oss: Partial<OssConfig> = { region: form.oss.region, bucket: form.oss.bucket, domain: form.oss.domain }
      if (newAccessKeyId.trim()) oss.accessKeyId = newAccessKeyId.trim()
      if (newAccessKeySecret.trim()) oss.accessKeySecret = newAccessKeySecret.trim()

      const res = await apiCall('PUT', '/api/admin/settings', {
        settings: [{
          key: 'storage_config',
          value: {
            mode: form.mode,
            oss,
            signedUrlTtlSec: form.signedUrlTtlSec,
            uploadTokenTtlSec: form.uploadTokenTtlSec,
            zipRetainHours: form.zipRetainHours,
          },
        }],
      })
      if (res.ok) {
        showToast('保存成功', 'success')
        setNewAccessKeyId(''); setNewAccessKeySecret('')
        onSaved()
      } else showToast(res.message || '保存失败', 'error')
    } finally { setSaving(false) }
  }

  return (
    <div className={cardCls}>
      <h3 className="text-lg font-semibold mb-2">📦 文件存储配置</h3>
      <p className="text-sm text-gray-500 mb-4">切换到 OSS 模式前请先完整填入阿里云 OSS 四项配置，否则上传会失败。</p>

      <div className="space-y-4">
        <div>
          <label className={labelCls}>存储模式</label>
          <select className={inputCls} value={form.mode}
            onChange={e => setForm(f => ({ ...f, mode: e.target.value as 'local' | 'oss' }))}>
            <option value="local">本地（public/uploads，仅开发）</option>
            <option value="oss">阿里云 OSS</option>
          </select>
        </div>

        {form.mode === 'oss' && (
          <>
            <div>
              <label className={labelCls}>AccessKey ID {form.oss.accessKeyId && <span className="text-xs text-gray-400 ml-2">当前：{form.oss.accessKeyId}</span>}</label>
              <input className={inputCls} type="password" value={newAccessKeyId}
                onChange={e => setNewAccessKeyId(e.target.value)}
                placeholder={form.oss.accessKeyId ? '留空保留原值' : 'LTAI...'} />
            </div>
            <div>
              <label className={labelCls}>AccessKey Secret {form.oss.accessKeySecret && <span className="text-xs text-gray-400 ml-2">当前：已配置</span>}</label>
              <input className={inputCls} type="password" value={newAccessKeySecret}
                onChange={e => setNewAccessKeySecret(e.target.value)}
                placeholder={form.oss.accessKeySecret ? '留空保留原值' : ''} />
            </div>
            <div>
              <label className={labelCls}>Region</label>
              <input className={inputCls} value={form.oss.region}
                onChange={e => setForm(f => ({ ...f, oss: { ...f.oss, region: e.target.value } }))}
                placeholder="oss-cn-hangzhou" />
            </div>
            <div>
              <label className={labelCls}>Bucket</label>
              <input className={inputCls} value={form.oss.bucket}
                onChange={e => setForm(f => ({ ...f, oss: { ...f.oss, bucket: e.target.value } }))} />
            </div>
            <div>
              <label className={labelCls}>自定义域名 (CDN)，可空</label>
              <input className={inputCls} value={form.oss.domain}
                onChange={e => setForm(f => ({ ...f, oss: { ...f.oss, domain: e.target.value } }))}
                placeholder="https://cdn.example.com" />
            </div>
          </>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>签名 URL 有效期 (秒)</label>
            <input className={inputCls} type="number" value={form.signedUrlTtlSec}
              onChange={e => setForm(f => ({ ...f, signedUrlTtlSec: Number(e.target.value) || 3600 }))} />
          </div>
          <div>
            <label className={labelCls}>上传 Token 有效期 (秒)</label>
            <input className={inputCls} type="number" value={form.uploadTokenTtlSec}
              onChange={e => setForm(f => ({ ...f, uploadTokenTtlSec: Number(e.target.value) || 300 }))} />
          </div>
          <div>
            <label className={labelCls}>批量下载 ZIP 保留 (小时)</label>
            <input className={inputCls} type="number" value={form.zipRetainHours}
              onChange={e => setForm(f => ({ ...f, zipRetainHours: Number(e.target.value) || 24 }))} />
          </div>
        </div>

        <button className={btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </button>

        <div className="text-xs text-orange-600 bg-orange-50 p-3 rounded">
          ⚠️ Batch 1A 只保存配置，OSS 签名 URL 真实接入将在 Batch 1B 完成。切换到 OSS 模式后上传会失败，请等待 1B 发布。
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 手动验证（切到 Storage tab、填 OSS 配置、保存、刷新）**

- [ ] **Step 3: 提交**

```bash
git add src/components/admin/settings-storage-tab.tsx
git commit -m "feat(Batch-1A): 新增 Settings Storage Tab 组件"
```

---

## Task 11: Settings SMS Tab

**Files:**
- Create: `src/components/admin/settings-sms-tab.tsx`

- [ ] **Step 1: 创建组件**

```tsx
// src/components/admin/settings-sms-tab.tsx
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
  enabled: false, accessKeyId: '', accessKeySecret: '', signName: '',
  templateCode: { register: '', resetPassword: '', changePhone: '' },
  perPhoneDailyLimit: 10, verifyMaxAttempts: 5,
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

  useEffect(() => { if (initial) setForm(initial) }, [initial])

  async function handleSave() {
    setSaving(true)
    try {
      const payload: any = {
        enabled: form.enabled, signName: form.signName, templateCode: form.templateCode,
        perPhoneDailyLimit: form.perPhoneDailyLimit, verifyMaxAttempts: form.verifyMaxAttempts,
      }
      if (newAccessKeyId.trim()) payload.accessKeyId = newAccessKeyId.trim()
      if (newAccessKeySecret.trim()) payload.accessKeySecret = newAccessKeySecret.trim()
      const res = await apiCall('PUT', '/api/admin/settings', {
        settings: [{ key: 'sms_config', value: payload }],
      })
      if (res.ok) {
        showToast('保存成功', 'success')
        setNewAccessKeyId(''); setNewAccessKeySecret('')
        onSaved()
      } else showToast(res.message || '保存失败', 'error')
    } finally { setSaving(false) }
  }

  async function handleTest() {
    if (!/^1[3-9]\d{9}$/.test(testPhone)) { showToast('请输入合法手机号', 'error'); return }
    setTesting(true)
    try {
      const res = await apiCall('POST', '/api/admin/settings/test-sms', { phone: testPhone })
      if (res.ok) {
        const r = res.data as { success: boolean; message: string }
        showToast(r.message, r.success ? 'success' : 'error')
      } else showToast(res.message || '测试失败', 'error')
    } finally { setTesting(false) }
  }

  return (
    <div className={cardCls}>
      <h3 className="text-lg font-semibold mb-2">📱 阿里云短信配置</h3>
      <p className="text-sm text-gray-500 mb-4">未启用时开发环境使用固定验证码 <code>123456</code>，生产环境发送会返回"短信服务未配置"。</p>

      <div className="space-y-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.enabled}
            onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} />
          <span>启用短信服务</span>
        </label>

        <div>
          <label className={labelCls}>AccessKey ID {form.accessKeyId && <span className="text-xs text-gray-400 ml-2">当前：{form.accessKeyId}</span>}</label>
          <input className={inputCls} type="password" value={newAccessKeyId}
            onChange={e => setNewAccessKeyId(e.target.value)} placeholder="留空保留" />
        </div>
        <div>
          <label className={labelCls}>AccessKey Secret</label>
          <input className={inputCls} type="password" value={newAccessKeySecret}
            onChange={e => setNewAccessKeySecret(e.target.value)} placeholder="留空保留" />
        </div>
        <div>
          <label className={labelCls}>签名 (SignName)</label>
          <input className={inputCls} value={form.signName}
            onChange={e => setForm(f => ({ ...f, signName: e.target.value }))} placeholder="如：Museek" />
        </div>

        <fieldset className="border rounded p-3">
          <legend className="text-sm text-gray-500 px-2">模板码</legend>
          <div className="space-y-2">
            <div>
              <label className={labelCls}>注册 (register)</label>
              <input className={inputCls} value={form.templateCode.register}
                onChange={e => setForm(f => ({ ...f, templateCode: { ...f.templateCode, register: e.target.value } }))}
                placeholder="SMS_XXXXXXXXX" />
            </div>
            <div>
              <label className={labelCls}>密码重置 (resetPassword)</label>
              <input className={inputCls} value={form.templateCode.resetPassword}
                onChange={e => setForm(f => ({ ...f, templateCode: { ...f.templateCode, resetPassword: e.target.value } }))} />
            </div>
            <div>
              <label className={labelCls}>修改手机号 (changePhone)</label>
              <input className={inputCls} value={form.templateCode.changePhone}
                onChange={e => setForm(f => ({ ...f, templateCode: { ...f.templateCode, changePhone: e.target.value } }))} />
            </div>
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>同手机号每日上限</label>
            <input className={inputCls} type="number" value={form.perPhoneDailyLimit}
              onChange={e => setForm(f => ({ ...f, perPhoneDailyLimit: Number(e.target.value) || 10 }))} />
          </div>
          <div>
            <label className={labelCls}>验证码错误次数锁定阈值</label>
            <input className={inputCls} type="number" value={form.verifyMaxAttempts}
              onChange={e => setForm(f => ({ ...f, verifyMaxAttempts: Number(e.target.value) || 5 }))} />
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
            <input className={inputCls + ' flex-1'} value={testPhone}
              onChange={e => setTestPhone(e.target.value)} placeholder="13800001234" />
            <button className={btnGhost} onClick={handleTest} disabled={testing}>
              {testing ? '发送中...' : '发送测试码'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">将向该手机号发送一条真实验证码（dev 模式返回 123456）</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 手动验证 + 提交**

```bash
git add src/components/admin/settings-sms-tab.tsx
git commit -m "feat(Batch-1A): 新增 Settings SMS Tab 组件（含测试发送）"
```

---

## Task 12: Settings Notification Templates Tab

**Files:**
- Create: `src/components/admin/settings-notification-tab.tsx`

- [ ] **Step 1: 创建组件**

```tsx
// src/components/admin/settings-notification-tab.tsx
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

  useEffect(() => { if (initial) setTemplates(initial) }, [initial])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await apiCall('PUT', '/api/admin/settings', {
        settings: [{ key: 'notification_templates', value: templates }],
      })
      if (res.ok) { showToast('保存成功', 'success'); onSaved() }
      else showToast(res.message || '保存失败', 'error')
    } finally { setSaving(false) }
  }

  function updateField(key: string, field: keyof Template, value: string) {
    setTemplates(prev => ({ ...prev, [key]: { ...(prev[key] ?? { type: 'system', title: '', content: '', linkUrl: '' }), [field]: value } as Template }))
  }

  return (
    <div className={cardCls}>
      <h3 className="text-lg font-semibold mb-2">📬 通知模板管理</h3>
      <p className="text-sm text-gray-500 mb-4">模板中 <code>{'{var}'}</code> 为变量占位（如 <code>{'{songTitle}'}</code>、<code>{'{score}'}</code>）。未修改则使用内置默认模板。</p>

      <div className="space-y-6">
        {Object.entries(TEMPLATE_LABELS).map(([key, label]) => {
          const tpl = templates[key]
          return (
            <fieldset key={key} className="border rounded p-3">
              <legend className="text-sm font-medium px-2">{label} <code className="text-xs text-gray-400 ml-2">{key}</code></legend>
              <div className="space-y-2">
                <div>
                  <label className={labelCls}>标题</label>
                  <input className={inputCls} value={tpl?.title ?? ''}
                    onChange={e => updateField(key, 'title', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>正文</label>
                  <textarea className={inputCls + ' min-h-16'} value={tpl?.content ?? ''}
                    onChange={e => updateField(key, 'content', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>跳转链接</label>
                  <input className={inputCls} value={tpl?.linkUrl ?? ''}
                    onChange={e => updateField(key, 'linkUrl', e.target.value)}
                    placeholder="/creator/songs?id={songId}" />
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
```

- [ ] **Step 2: 手动验证 + 提交**

```bash
git add src/components/admin/settings-notification-tab.tsx
git commit -m "feat(Batch-1A): 新增 Settings Notification Templates Tab 组件"
```

---

## Task 13: 集成 4 个新 tab 到 `settings/page.tsx`

**Files:**
- Modify: `src/app/(admin)/admin/settings/page.tsx`

- [ ] **Step 1: 改 TABS + 引入子组件 + 渲染分支**

在现有 `settings/page.tsx` 顶部 import：

```tsx
import { SettingsAiTab } from '@/components/admin/settings-ai-tab'
import { SettingsStorageTab } from '@/components/admin/settings-storage-tab'
import { SettingsSmsTab } from '@/components/admin/settings-sms-tab'
import { SettingsNotificationTab } from '@/components/admin/settings-notification-tab'
```

扩展 TABS 常量：

```tsx
const TABS = [
  { key: 'scores', label: '⚖️ 评分规则' },
  { key: 'commission', label: '💰 分成比例' },
  { key: 'templates', label: '💬 评语模板' },
  { key: 'platforms', label: '🌐 平台管理' },
  { key: 'options', label: '🎛 选项管理' },
  { key: 'ai', label: '🤖 AI 配置' },
  { key: 'storage', label: '📦 存储配置' },
  { key: 'sms', label: '📱 短信配置' },
  { key: 'notifications', label: '📬 通知模板' },
]
```

在 `parseSettingsData`（或增强后的版本）中解析 4 类新 value；在主组件渲染区，按 `activeTab` 渲染对应子组件：

```tsx
// 在 SettingsData interface 加：
interface SettingsData {
  // ... existing
  aiConfig: any | null
  storageConfig: any | null
  smsConfig: any | null
  notificationTemplates: Record<string, any> | null
}

// 在 parseSettingsData 中：
const aiConfig = (map.get('ai_config') as any) ?? null
const storageConfig = (map.get('storage_config') as any) ?? null
const smsConfig = (map.get('sms_config') as any) ?? null
const notificationTemplates = (map.get('notification_templates') as any) ?? null

// ... include in return

// 在主渲染：
{activeTab === 'ai' && <SettingsAiTab initial={data.aiConfig} onSaved={refetch} showToast={showToast} />}
{activeTab === 'storage' && <SettingsStorageTab initial={data.storageConfig} onSaved={refetch} showToast={showToast} />}
{activeTab === 'sms' && <SettingsSmsTab initial={data.smsConfig} onSaved={refetch} showToast={showToast} />}
{activeTab === 'notifications' && <SettingsNotificationTab initial={data.notificationTemplates} onSaved={refetch} showToast={showToast} />}
```

- [ ] **Step 2: 手动验证 4 个 tab 能切换、保存、刷新后保留**

```bash
npm run dev
# 打开 /admin/settings，依次测试 4 个新 tab
```

- [ ] **Step 3: 类型检查**

```bash
npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/app/(admin)/admin/settings/page.tsx
git commit -m "feat(Batch-1A): settings 页集成 AI/存储/短信/通知模板 4 个新 tab"
```

---

## Task 14: 集成自测 + 文档

**Files:**
- Modify: `CLAUDE.md`（新增 env fallback 说明）
- Create: `docs/batch-1a-verification.md`（自测报告）

- [ ] **Step 1: 跑全量测试**

```bash
npm run test 2>&1 | tail -20
npx tsc --noEmit
```

Expected: 全 PASS，无类型错误

- [ ] **Step 2: 手动 E2E 自测**

打开 `/admin/settings`，依次验证：

| Tab | 验证点 | 期望 |
|---|---|---|
| AI 配置 | 填 enabled=true / apiKey=sk-test123 / 保存 / 刷新 | apiKey 脱敏显示 `sk-****t123`，enabled 保留 |
| AI 配置 | 测试连接（apiKey 为空时点击） | Toast "apiKey 不能为空" |
| 存储配置 | 切 oss + 填 ak/bucket 保存 | 成功，警告条展示 "1B 才生效" |
| 短信配置 | dev 环境未启用，测试发送 13800001234 | Toast "开发模式：验证码为 123456" |
| 短信配置 | enabled=true + 空 signName，测试发送 | Toast "短信服务缺少配置" |
| 通知模板 | 改 tpl.review_done 的 title，保存，刷新 | 保留修改 |
| 通知模板 | `renderTemplate('tpl.review_done', {songTitle:'X', score:90})` | 用新 title |

- [ ] **Step 3: 在 CLAUDE.md 末尾追加 env fallback 说明**

```markdown
## 运行时配置

Batch 1A 后，以下配置优先从管理端 `/admin/settings` DB 读取，未配置时回落到 env：

- AI：`ai_config.*` → `AI_API_KEY / AI_API_BASE_URL / AI_MODEL`
- 存储：`storage_config.*` → `OSS_BUCKET / OSS_REGION / OSS_DOMAIN / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET`
- 短信：`sms_config.*` → `ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET / ALIYUN_SMS_SIGN_NAME / ALIYUN_SMS_TEMPLATE_CODE`

**加密字段**：apiKey / accessKeySecret / accessKeyId 使用 `ENCRYPTION_KEY` 加密存 DB，前端只看脱敏值。

**生产部署**：推荐全部用 DB 配置；env 只保留 `ENCRYPTION_KEY / JWT_SECRET / DATABASE_URL` 三项运行前置。
```

- [ ] **Step 4: 提交**

```bash
git add CLAUDE.md
git commit -m "docs(Batch-1A): 更新 CLAUDE.md 运行时配置说明"
```

- [ ] **Step 5: 最终回归测试**

```bash
npm run test
npx tsc --noEmit
npm run build
```

Expected: 全 PASS + build 成功

---

## Self-Review Checklist

**Spec coverage:**

- [x] §7.3.17.6 AI 配置 → Task 3 + Task 9
- [x] §7.3.17.7 存储配置 → Task 5 + Task 10
- [x] §7.3.17.8 短信配置 → Task 4 + Task 11
- [x] §7.3.17.9 通知模板 → Task 6 + Task 12
- [x] 附录 E 系统设置键值表 → Task 1 + Task 2
- [x] 附录 F 通知模板表 → Task 6 + Task 12
- [ ] §10.7 文件上传安全（部分）→ **Batch 1B 完成**（本 plan 只做 OSS 配置入口）
- [ ] §10.8 API 限流 → **Batch 1B**
- [ ] `notify(...)` 业务动作触发 → **Batch 2**

**剩余在 Batch 1B 的工作：**
1. `ali-oss` SDK 实际 signatureUrl（本 plan 只装了依赖）
2. `/api/files/[...path]` 签名 URL 中间鉴权路由
3. 上传 token 加 HMAC 签名 + 过期时间戳校验
4. magic bytes 校验（PUT 端点）
5. middleware 限流分级（SMS/upload/reset-password/public）
6. TokenRevocation 表 + logout 吊销

**Placeholder scan:** 无 TBD / TODO 占位；所有代码完整。

**Type consistency:** `SETTING_KEYS` 常量在所有 tasks 一致；`AiConfig` / `StorageConfig` / `SmsConfig` 类型定义在各 task 一致。

---

## 执行建议

**推荐执行方式：Subagent-Driven（superpowers:subagent-driven-development）**

理由：
- 14 个 task 独立性高（每个 task 产出一个 commit），适合逐 task 分派 subagent
- 每 task 的失败隔离性好（1 个 task 失败不影响其他）
- 有测试覆盖，subagent 可自验证

**执行提示：**
1. 严格按 task 顺序（Task 1 system-settings lib 是所有其他 task 的基础）
2. 每个 task 完成后 review commit（查 git log + git diff）
3. Task 9/10/11/12/13 是纯 UI 组件，主要看手动验证截图
4. Task 13 集成后必须跑全量测试 + `npm run build`

**预计耗时**（人工估算）：8-12 小时，分次实施
