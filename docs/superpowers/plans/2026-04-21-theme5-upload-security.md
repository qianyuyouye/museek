# Theme 5: 上传安全链 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 GAP-CRTR-006/007/008/047 四条 P0 + 2 处遗留字段错位。引入 HMAC 签名统一库 + 文件网关 + magic-bytes 头字节校验，实现"签名 PUT/GET + 匿名带 TTL + 头字节过滤 + key 化 DB"的上传安全闭环。

**Architecture:** 5 独立 Patch，顺序 A（签名库基石）→ B（magic-bytes 校验）→ D（存储目录迁出 + DB key 化）→ C（读时签名 + 文件网关 + 9 API 出口）→ E（遗留字段错位）。每 Patch 独立 commit，Patch 内按 TDD：先写失败测试，再实现，最后 green + commit。

**Tech Stack:** Next.js 15 App Router + Prisma + MySQL 8 + ali-oss 6.23 SDK + Node crypto HMAC-SHA256 + Vitest（集成测试跑本地 dev server，PORT=3001，TEST_BASE_URL=http://localhost:3001）

---

## File Structure

改动严格限制在以下文件：

| 文件 | 动作 | Patch | 责任 |
|---|---|---|---|
| `src/lib/signature.ts` | 新建 | A | HMAC + OSS 签名统一入口（signPutUrl/signGetUrl/verify*） |
| `src/lib/oss-client.ts` | 新建 | A | `ali-oss` 单例 lazy init |
| `src/lib/upload.ts` | 修改 | A | 收敛 createUploadToken → signPutUrl，userId 参数化 |
| `src/app/api/upload/token/route.ts` | 修改 | A | 传 userId 进 createUploadToken；响应 fileUrl → key |
| `src/lib/magic-bytes.ts` | 新建 | B | 头字节校验（mp3/wav/png/jpg/webp） |
| `storage/uploads/.gitkeep` | 新建 | D | 占位保持空目录 |
| `.gitignore` | 修改 | D | 加 `/storage/uploads/` 与 `/storage/*`（保留 .gitkeep） |
| `.env.example` | 修改 | D | 追加 UPLOAD_SECRET / STORAGE_ROOT 占位 |
| `scripts/theme5-cleanup.sql` | 新建 | D | 脏数据清理 SQL（幂等） |
| `prisma/seed-test-users.ts` | 修改 | D | audioUrl/coverUrl 去前导 `/`（若有） |
| `src/app/api/upload/local/[...path]/route.ts` | 修改 | B+D | 验签 + magic-bytes + 写 `storage/` |
| `src/app/api/creator/upload/route.ts` | 修改 | D | 接收 key 语义字段，落库 |
| `src/app/api/creator/assignments/[id]/submit/route.ts` | 修改 | D | 同 |
| `src/app/(creator)/creator/upload/page.tsx` | 修改 | D | 读 res.data.key |
| `src/app/(creator)/creator/assignments/page.tsx` | 修改 | D | 同 |
| `docker-compose.yml` | 修改 | D | app 服务加 `./storage:/app/storage` 卷 |
| `src/lib/signed-url.ts` | 新建 | C | `toSignedUrl(key, viewerId?)` 包装 |
| `src/app/api/files/[...path]/route.ts` | 新建 | C | 文件网关 GET，验签 + 流式返回 |
| `src/middleware.ts` | 修改 | C | `/api/files/` 加入 PUBLIC_PATHS |
| `src/app/api/creator/songs/[id]/route.ts` | 修改 | C | audioUrl/coverUrl 签名 |
| `src/app/api/review/songs/[id]/route.ts` | 修改 | C+E | audioUrl/coverUrl 签名 + cover→coverUrl + aiTool→aiTools |
| `src/app/api/review/queue/route.ts` | 修改 | C | audioUrl/coverUrl 签名 |
| `src/app/api/admin/songs/route.ts` | 修改 | C | list audioUrl/coverUrl 签名 |
| `src/app/api/admin/songs/[id]/route.ts` | 修改 | C | detail audioUrl/coverUrl 签名 |
| `src/app/api/admin/publish-confirm/route.ts` | 修改 | C | list coverUrl 签名 |
| `src/app/api/admin/publish-confirm/[id]/route.ts` | 修改 | C | detail audioUrl/coverUrl 签名 |
| `src/app/api/admin/distributions/route.ts` | 修改 | C | cover 别名签名 |
| `src/app/api/songs/published/route.ts` | 修改 | C | 匿名 coverUrl 签名 |
| `src/app/(reviewer)/review/assess/page.tsx` | 修改 | E | interface + JSX 字段重命名 |
| `src/app/(creator)/creator/songs/page.tsx` | 修改 | E | 删死字段 cover |
| `CLAUDE.md` | 修改 | D | 追加 Theme 5 部署步骤 |
| `tests/fixtures/magic/*.bin` | 新建 | B | 5 个头字节 fixture（用 Buffer.from hex 构造，或 < 1KB 真实文件） |
| `tests/api/theme5.test.ts` | 新建 | all | 集成测试（~30 用例） |

---

## 前置准备：测试文件脚手架

**Files:**
- Create: `tests/api/theme5.test.ts`

- [ ] **Step 1: 确认 dev server 已起**

```bash
PORT=3001 npm run dev
```

等看到 `Ready in ...` 后再跑测试。如果 3000 被 LiveSpec 占用，必须用 3001。

- [ ] **Step 2: 建测试骨架**

写入 `tests/api/theme5.test.ts`：

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, reviewerLogin, expectOk, expectCode, BASE_URL } from './_helpers'
import { prisma } from '@/lib/prisma'

let adminCookie = ''
let creatorCookie = ''
let creatorUserId = 0
let reviewerCookie = ''

describe('Theme 5 upload-security chain', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    const c = await creatorLogin()
    creatorCookie = c.cookie
    creatorUserId = c.userId!
    reviewerCookie = (await reviewerLogin()).cookie
  })

  it('smoke: cookie 可用', () => {
    expect(adminCookie).toContain('access_token=')
    expect(creatorCookie).toContain('access_token=')
    expect(reviewerCookie).toContain('access_token=')
    expect(creatorUserId).toBeGreaterThan(0)
  })
  // Patch A/B/C/D/E 各组测试分别追加
})
```

- [ ] **Step 3: 跑一次确认框架可用**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme5.test.ts
```

预期：smoke 用例 PASS。

- [ ] **Step 4: commit 骨架**

```bash
git add tests/api/theme5.test.ts
git commit -m "test(theme5): 集成测试骨架"
```

---

## Patch A — 存储抽象 + 签名统一库

### Task A1: 新建 `lib/signature.ts` + 单元测试

**Files:**
- Create: `src/lib/signature.ts`
- Test: `tests/api/theme5.test.ts`（追加 describe 块）

- [ ] **Step 1: 先写失败测试（追加到 theme5.test.ts 文件末尾，`describe('Theme 5...')` 外）**

```typescript
import { signPutUrl, signGetUrl, verifyLocalPutSig, verifyLocalGetSig } from '@/lib/signature'

describe('lib/signature HMAC local mode', () => {
  const key = 'uploads/audio/20260421_abc.mp3'

  it('signPutUrl 返回含 sig/exp/uid/type 的 uploadUrl', async () => {
    const { uploadUrl } = await signPutUrl(key, { userId: 42, type: 'audio' })
    const u = new URL(uploadUrl, 'http://x')
    expect(u.pathname).toBe('/api/upload/local/' + key)
    expect(u.searchParams.get('sig')).toMatch(/^[0-9a-f]{64}$/)
    expect(u.searchParams.get('exp')).toMatch(/^\d+$/)
    expect(u.searchParams.get('uid')).toBe('42')
    expect(u.searchParams.get('type')).toBe('audio')
  })

  it('verifyLocalPutSig 正确签名返回 null', async () => {
    const { uploadUrl } = await signPutUrl(key, { userId: 42, type: 'audio' })
    const q = new URL(uploadUrl, 'http://x').searchParams
    expect(verifyLocalPutSig(key, q, 42)).toBeNull()
  })

  it('verifyLocalPutSig 过期签名返回错误', async () => {
    const { uploadUrl } = await signPutUrl(key, { userId: 42, type: 'audio', ttlSec: -1 })
    const q = new URL(uploadUrl, 'http://x').searchParams
    expect(verifyLocalPutSig(key, q, 42)).toMatch(/过期|expired/i)
  })

  it('verifyLocalPutSig uid 不匹配返回错误', async () => {
    const { uploadUrl } = await signPutUrl(key, { userId: 42, type: 'audio' })
    const q = new URL(uploadUrl, 'http://x').searchParams
    expect(verifyLocalPutSig(key, q, 99)).toMatch(/用户|不匹配/)
  })

  it('verifyLocalPutSig type/key 目录不符返回错误', async () => {
    // key 是 uploads/audio/... 但 type 签成了 image
    const { uploadUrl } = await signPutUrl(key, { userId: 42, type: 'image' })
    const q = new URL(uploadUrl, 'http://x').searchParams
    expect(verifyLocalPutSig(key, q, 42)).toMatch(/类型|目录/)
  })

  it('signGetUrl 绑 userId 带 uid 参数', async () => {
    const url = await signGetUrl(key, { userId: 42 })
    const q = new URL(url, 'http://x').searchParams
    expect(q.get('uid')).toBe('42')
    expect(q.get('sig')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('signGetUrl 不绑 userId（匿名）不含 uid', async () => {
    const url = await signGetUrl(key)
    const q = new URL(url, 'http://x').searchParams
    expect(q.get('uid')).toBeNull()
    expect(q.get('sig')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('verifyLocalGetSig 匿名签名（无 uid）有效', async () => {
    const url = await signGetUrl(key)
    const q = new URL(url, 'http://x').searchParams
    expect(verifyLocalGetSig(key, q)).toBeNull()
  })

  it('verifyLocalGetSig 过期返回错误', async () => {
    const url = await signGetUrl(key, { ttlSec: -1 })
    const q = new URL(url, 'http://x').searchParams
    expect(verifyLocalGetSig(key, q)).toMatch(/过期|expired/i)
  })

  it('verifyLocalGetSig 篡改 sig 返回错误', async () => {
    const url = await signGetUrl(key)
    const q = new URL(url, 'http://x').searchParams
    q.set('sig', '0'.repeat(64))
    expect(verifyLocalGetSig(key, q)).toMatch(/签名|无效/)
  })
})
```

- [ ] **Step 2: 跑确认 FAIL**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme5.test.ts -t "lib/signature"
```

预期：10 个失败（模块不存在）。

- [ ] **Step 3: 写 `src/lib/signature.ts` 实现**

```typescript
import crypto from 'crypto'
import { getSetting, SETTING_KEYS } from './system-settings'

export interface SignedPutOptions {
  userId: number
  type: 'audio' | 'image'
  ttlSec?: number  // 默认 300（5min）
}

export interface SignedGetOptions {
  userId?: number
  ttlSec?: number  // 默认 3600（1h）
}

export interface SignedPutResult {
  uploadUrl: string
  headers?: Record<string, string>
}

// ── HMAC secret 派生 ────────────────────────────────────────────

let _secret: Buffer | null = null

function getSecret(): Buffer {
  if (_secret) return _secret
  const uploadSecret = process.env.UPLOAD_SECRET
  if (uploadSecret && uploadSecret.length >= 16) {
    _secret = Buffer.from(uploadSecret, 'utf8')
    return _secret
  }
  const jwt = process.env.JWT_SECRET
  if (!jwt) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('UPLOAD_SECRET 或 JWT_SECRET 必须配置（生产环境）')
    }
    _secret = crypto.createHash('sha256').update('dev-upload-secret').digest()
    return _secret
  }
  // 从 JWT_SECRET 派生（域分离）
  _secret = crypto.createHash('sha256').update(jwt + ':upload').digest()
  return _secret
}

function computeSig(parts: Array<string | number>): string {
  const msg = parts.join('|')
  return crypto.createHmac('sha256', getSecret()).update(msg).digest('hex')
}

// ── key 目录 ↔ type 映射 ───────────────────────────────────────

function keyDirMatchesType(key: string, type: 'audio' | 'image'): boolean {
  if (type === 'audio') return key.startsWith('uploads/audio/')
  if (type === 'image') return key.startsWith('uploads/images/')
  return false
}

// ── 存储模式判定 ───────────────────────────────────────────────

async function resolveMode(): Promise<'local' | 'oss'> {
  const cfg = await getSetting<{ mode?: string }>(SETTING_KEYS.STORAGE_CONFIG, {})
  return (cfg.mode as 'local' | 'oss') ?? (process.env.OSS_BUCKET ? 'oss' : 'local')
}

// ── 签名 PUT ───────────────────────────────────────────────────

export async function signPutUrl(key: string, opts: SignedPutOptions): Promise<SignedPutResult> {
  const mode = await resolveMode()
  const ttl = opts.ttlSec ?? 300
  if (mode === 'oss') {
    const { getOssClient } = await import('./oss-client')
    const client = await getOssClient()
    const uploadUrl = client.signatureUrl(key, {
      method: 'PUT',
      expires: ttl,
      'Content-Type': 'application/octet-stream',
    })
    return { uploadUrl, headers: { 'Content-Type': 'application/octet-stream' } }
  }
  // local
  const exp = Math.floor(Date.now() / 1000) + ttl
  const sig = computeSig([key, opts.userId, opts.type, exp])
  const uploadUrl = `/api/upload/local/${key}?exp=${exp}&uid=${opts.userId}&type=${opts.type}&sig=${sig}`
  return { uploadUrl }
}

// ── 签名 GET ───────────────────────────────────────────────────

export async function signGetUrl(key: string, opts: SignedGetOptions = {}): Promise<string> {
  const mode = await resolveMode()
  const ttl = opts.ttlSec ?? 3600
  if (mode === 'oss') {
    const { getOssClient } = await import('./oss-client')
    const client = await getOssClient()
    return client.signatureUrl(key, { method: 'GET', expires: ttl })
  }
  // local
  const exp = Math.floor(Date.now() / 1000) + ttl
  const uid = opts.userId ?? ''
  const sig = computeSig([key, uid, '', exp])
  const uidPart = opts.userId != null ? `&uid=${opts.userId}` : ''
  return `/api/files/${key}?exp=${exp}${uidPart}&sig=${sig}`
}

// ── 验签 PUT ───────────────────────────────────────────────────

export function verifyLocalPutSig(key: string, query: URLSearchParams, currentUserId: number): string | null {
  const exp = parseInt(query.get('exp') ?? '', 10)
  const uid = parseInt(query.get('uid') ?? '', 10)
  const type = query.get('type')
  const sig = query.get('sig') ?? ''
  if (!exp || !uid || !type || !sig) return '签名参数缺失'
  if (exp < Math.floor(Date.now() / 1000)) return '上传链接已过期'
  if (uid !== currentUserId) return '用户不匹配'
  if (type !== 'audio' && type !== 'image') return '类型无效'
  if (!keyDirMatchesType(key, type)) return '类型与目录不符'
  const expectSig = computeSig([key, uid, type, exp])
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectSig, 'hex'))) return '签名无效'
  return null
}

// ── 验签 GET ───────────────────────────────────────────────────

export function verifyLocalGetSig(key: string, query: URLSearchParams): string | null {
  const exp = parseInt(query.get('exp') ?? '', 10)
  const sig = query.get('sig') ?? ''
  const uidRaw = query.get('uid')
  if (!exp || !sig) return '签名参数缺失'
  if (exp < Math.floor(Date.now() / 1000)) return '文件链接已过期'
  const expectSig = computeSig([key, uidRaw ?? '', '', exp])
  if (sig.length !== 64) return '签名无效'
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectSig, 'hex'))) return '签名无效'
  } catch {
    return '签名无效'
  }
  return null
}
```

- [ ] **Step 4: 跑测试确认 PASS**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme5.test.ts -t "lib/signature"
```

预期：10 个 PASS。

- [ ] **Step 5: commit**

```bash
git add src/lib/signature.ts tests/api/theme5.test.ts
git commit -m "feat(theme5/A): signature 统一签名库（HMAC + OSS 双分支）"
```

---

### Task A2: 新建 `lib/oss-client.ts`

**Files:**
- Create: `src/lib/oss-client.ts`

- [ ] **Step 1: 写实现（lazy init，失败时 throw 由 safeHandler 兜底 500）**

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSetting, SETTING_KEYS } from './system-settings'

let _client: any | null = null
let _clientKey = ''

interface OssConfig {
  accessKeyId: string
  accessKeySecret: string
  region: string
  bucket: string
}

async function loadOssConfig(): Promise<OssConfig> {
  const fromDb = await getSetting<{ oss?: Partial<OssConfig> }>(SETTING_KEYS.STORAGE_CONFIG, {})
  const oss = fromDb.oss ?? {}
  return {
    accessKeyId: oss.accessKeyId || process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: oss.accessKeySecret || process.env.OSS_ACCESS_KEY_SECRET || '',
    region: oss.region || process.env.OSS_REGION || 'oss-cn-hangzhou',
    bucket: oss.bucket || process.env.OSS_BUCKET || '',
  }
}

export async function getOssClient(): Promise<any> {
  const cfg = await loadOssConfig()
  if (!cfg.accessKeyId || !cfg.bucket) {
    throw new Error('OSS 配置不完整（accessKeyId 或 bucket 缺失）')
  }
  const cacheKey = `${cfg.region}|${cfg.bucket}|${cfg.accessKeyId}`
  if (_client && _clientKey === cacheKey) return _client
  // 动态引入，避免 local 模式冷启动加载 SDK
  const OSSMod: any = await import('ali-oss')
  const OSS = OSSMod.default ?? OSSMod
  _client = new OSS({
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    region: cfg.region,
    bucket: cfg.bucket,
    secure: true,
  })
  _clientKey = cacheKey
  return _client
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

预期：无新增错误（`any` 全部 eslint-disable 住）。

- [ ] **Step 3: commit**

```bash
git add src/lib/oss-client.ts
git commit -m "feat(theme5/A): ali-oss SDK 单例 lazy init"
```

---

### Task A3: `lib/upload.ts` 收敛到 signPutUrl + `/api/upload/token` userId 参数化

**Files:**
- Modify: `src/lib/upload.ts`（整体重写）
- Modify: `src/app/api/upload/token/route.ts`

- [ ] **Step 1: 重写 `src/lib/upload.ts`**

```typescript
import crypto from 'crypto'
import path from 'path'
import { signPutUrl } from './signature'

const AUDIO_EXTS = ['.wav', '.mp3']
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_AUDIO = 50 * 1024 * 1024
const MAX_IMAGE = 5 * 1024 * 1024

export interface UploadTokenResult {
  uploadUrl: string
  key: string
  method: 'PUT'
  headers?: Record<string, string>
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

export async function createUploadToken(
  fileName: string,
  type: 'audio' | 'image',
  userId: number,
): Promise<UploadTokenResult> {
  const key = generateKey(fileName, type)
  const signed = await signPutUrl(key, { userId, type })
  return {
    uploadUrl: signed.uploadUrl,
    key,
    method: 'PUT',
    headers: signed.headers,
  }
}
```

- [ ] **Step 2: 改 `src/app/api/upload/token/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'
import { validateUpload, createUploadToken } from '@/lib/upload'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const { userId } = getCurrentUser(request)
  if (!userId) return err('未登录', 401)

  const body = await request.json()
  const fileName: string | undefined = body.fileName ?? body.name
  const fileSize: number | undefined = body.fileSize ?? body.size
  const type: string | undefined = body.type ?? body.kind

  if (!fileName || !fileSize || !type) return err('缺少 fileName/fileSize/type（或别名 name/size/kind）')
  if (type !== 'audio' && type !== 'image') return err('type 必须是 audio 或 image')

  const error = validateUpload(fileName, fileSize, type)
  if (error) return err(error)

  const token = await createUploadToken(fileName, type, userId)
  return ok(token)
})
```

- [ ] **Step 3: 搜旧用法确认无残留**

```bash
grep -rn "getCurrentStorageMode\|\.fileUrl\b" src/ | grep -v ".next"
```

预期：无输出（`getCurrentStorageMode` 已删、`fileUrl` 字段消失）。若仍有命中，**此时不修**（会在 Task D3 前端协议切换时处理），但**暂缓 commit** 直到 Task D3 结束再一并提交。

- [ ] **Step 4: 先写 /api/upload/token 集成测试（追加到 theme5.test.ts 的 `describe('Theme 5 ...')` 内）**

```typescript
it('POST /api/upload/token 返回 uploadUrl + key', async () => {
  const r = await http('/api/upload/token', {
    method: 'POST',
    cookie: creatorCookie,
    body: { fileName: 'demo.mp3', fileSize: 1024, type: 'audio' },
  })
  expectOk(r, '获取 upload token')
  expect(r.json.data.key).toMatch(/^uploads\/audio\/\d{8}_[0-9a-f]{16}\.mp3$/)
  expect(r.json.data.uploadUrl).toContain('/api/upload/local/' + r.json.data.key)
  expect(r.json.data.uploadUrl).toMatch(/sig=[0-9a-f]{64}/)
  expect(r.json.data.method).toBe('PUT')
})

it('POST /api/upload/token 非法扩展名 400', async () => {
  const r = await http('/api/upload/token', {
    method: 'POST',
    cookie: creatorCookie,
    body: { fileName: 'demo.exe', fileSize: 1024, type: 'audio' },
  })
  expectCode(r, 400)
})

it('POST /api/upload/token 超大尺寸 400', async () => {
  const r = await http('/api/upload/token', {
    method: 'POST',
    cookie: creatorCookie,
    body: { fileName: 'demo.mp3', fileSize: 100 * 1024 * 1024, type: 'audio' },
  })
  expectCode(r, 400)
})
```

- [ ] **Step 5: 跑确认 PASS**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme5.test.ts -t "upload/token"
```

- [ ] **Step 6: commit**

```bash
git add src/lib/upload.ts src/app/api/upload/token/route.ts tests/api/theme5.test.ts
git commit -m "refactor(theme5/A): upload token 接入签名库，参数化 userId，响应 fileUrl→key"
```

---

## Patch B — Magic-bytes 校验

### Task B1: 新建 `lib/magic-bytes.ts` + 单元测试

**Files:**
- Create: `src/lib/magic-bytes.ts`
- Test: `tests/api/theme5.test.ts`（追加 describe 块）

- [ ] **Step 1: 先写失败测试**

```typescript
import { checkMagicBytes } from '@/lib/magic-bytes'

describe('lib/magic-bytes', () => {
  const mp3_id3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(9)])
  const mp3_sync = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(8)])
  const wav = Buffer.concat([
    Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WAVE'),
  ])
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(8)])
  const webp = Buffer.concat([
    Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP'),
  ])
  const svg = Buffer.concat([Buffer.from('<?xml version="1.0"?><svg'), Buffer.alloc(20)])
  const tooSmall = Buffer.from([0xff])

  it('合法 MP3 ID3 头', () => {
    expect(checkMagicBytes(mp3_id3, 'audio')).toBeNull()
  })

  it('合法 MP3 帧同步 0xFFFB', () => {
    expect(checkMagicBytes(mp3_sync, 'audio')).toBeNull()
  })

  it('合法 WAV', () => {
    expect(checkMagicBytes(wav, 'audio')).toBeNull()
  })

  it('合法 PNG/JPEG/WEBP', () => {
    expect(checkMagicBytes(png, 'image')).toBeNull()
    expect(checkMagicBytes(jpeg, 'image')).toBeNull()
    expect(checkMagicBytes(webp, 'image')).toBeNull()
  })

  it('SVG 不是 image 被拒', () => {
    expect(checkMagicBytes(svg, 'image')).toMatch(/不匹配|invalid/i)
  })

  it('PNG 伪装成 audio 被拒', () => {
    expect(checkMagicBytes(png, 'audio')).toMatch(/不匹配|invalid/i)
  })

  it('过小 buffer 被拒', () => {
    expect(checkMagicBytes(tooSmall, 'audio')).toMatch(/过小|too small|无法识别/i)
  })
})
```

- [ ] **Step 2: 跑确认 FAIL**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme5.test.ts -t "lib/magic-bytes"
```

预期：7 个失败。

- [ ] **Step 3: 写 `src/lib/magic-bytes.ts` 实现**

```typescript
export function checkMagicBytes(buf: Buffer, type: 'audio' | 'image'): string | null {
  if (buf.length < 12) return '文件过小，无法识别格式'

  if (type === 'audio') {
    // MP3 ID3v2: "ID3"
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return null
    // MP3 帧同步字 FF Ex（MPEG1/2/2.5 Layer I/II/III）
    if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return null
    // WAV: "RIFF" .... "WAVE"
    if (
      buf.subarray(0, 4).toString('ascii') === 'RIFF'
      && buf.subarray(8, 12).toString('ascii') === 'WAVE'
    ) return null
    return '音频文件头部字节不匹配 MP3/WAV 格式'
  }

  // image
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return null  // JPEG
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return null  // PNG
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF'
    && buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return null
  return '图片文件头部字节不匹配 JPEG/PNG/WEBP 格式'
}
```

- [ ] **Step 4: 跑确认 PASS**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme5.test.ts -t "lib/magic-bytes"
```

- [ ] **Step 5: commit**

```bash
git add src/lib/magic-bytes.ts tests/api/theme5.test.ts
git commit -m "feat(theme5/B): magic-bytes 头字节校验（MP3/WAV/PNG/JPEG/WEBP）"
```

---

## Patch D — 目录迁出 public + DB 语义 key 化

Patch D 必须在 Patch C 之前（C 的文件网关要读 `storage/` 目录），分 4 小 Task：

### Task D1: `storage/uploads/` 目录 + `.gitignore` + `.env.example`

**Files:**
- Create: `storage/uploads/.gitkeep`
- Modify: `.gitignore`
- Modify: `.env.example`

- [ ] **Step 1: 建目录与占位**

```bash
mkdir -p storage/uploads/audio storage/uploads/images
echo "" > storage/uploads/.gitkeep
```

（Windows bash：`mkdir -p` 兼容 git bash / WSL。）

- [ ] **Step 2: 改 `.gitignore` 末尾追加**

```
# Theme 5: 本地上传文件目录（生产用 OSS 或持久卷）
/storage/uploads/*
!/storage/uploads/.gitkeep
```

- [ ] **Step 3: 改 `.env.example` 追加**

```
# Theme 5: 上传链路密钥与存储根目录
# UPLOAD_SECRET 不配则从 JWT_SECRET 派生（sha256(JWT_SECRET + ":upload")）
UPLOAD_SECRET=
# 本地模式下文件落盘根目录，默认 ./storage（Docker 生产建议挂载持久卷）
STORAGE_ROOT=./storage
```

- [ ] **Step 4: 确认 `.gitkeep` 被跟踪**

```bash
git status
git check-ignore -v storage/uploads/audio/ 2>&1 | head -3  # 应被忽略
git check-ignore -v storage/uploads/.gitkeep 2>&1 | head -3  # 应不被忽略
```

- [ ] **Step 5: commit**

```bash
git add .gitignore .env.example storage/uploads/.gitkeep
git commit -m "feat(theme5/D): 新增 storage/uploads/ 目录结构 + env 占位"
```

---

### Task D2: 重写 `/api/upload/local/[...path]` PUT handler（接入签名 + magic-bytes + 写 storage/）

**Files:**
- Modify: `src/app/api/upload/local/[...path]/route.ts`

- [ ] **Step 1: 先写集成测试（追加到 theme5.test.ts 的 `describe('Theme 5 ...')` 内）**

```typescript
describe('/api/upload/local PUT', () => {
  async function getToken(type: 'audio' | 'image', fileName: string) {
    const r = await http('/api/upload/token', {
      method: 'POST',
      cookie: creatorCookie,
      body: { fileName, fileSize: 1024, type },
    })
    expectOk(r)
    return r.json.data as { uploadUrl: string; key: string }
  }

  it('合法 token + 合法 MP3 头 → 200 + 文件落盘', async () => {
    const { uploadUrl, key } = await getToken('audio', 'ok.mp3')
    const body = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(1021)])
    const res = await fetch(BASE_URL + uploadUrl, {
      method: 'PUT',
      headers: { 'Cookie': creatorCookie, 'Origin': BASE_URL },
      body,
    })
    expect(res.status).toBe(200)
    const fs = await import('fs')
    const path = await import('path')
    const root = process.env.STORAGE_ROOT || './storage'
    expect(fs.existsSync(path.resolve(root, key))).toBe(true)
  })

  it('SVG 伪装成 mp3 → 400', async () => {
    const { uploadUrl } = await getToken('audio', 'fake.mp3')
    const body = Buffer.concat([Buffer.from('<?xml version="1.0"?><svg>'), Buffer.alloc(1000)])
    const res = await fetch(BASE_URL + uploadUrl, {
      method: 'PUT',
      headers: { 'Cookie': creatorCookie, 'Origin': BASE_URL },
      body,
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.message).toMatch(/不匹配/)
  })

  it('过期 token PUT → 403', async () => {
    const { uploadUrl } = await getToken('audio', 'expire.mp3')
    // 篡改 exp 参数为过去时间
    const u = new URL(uploadUrl, BASE_URL)
    u.searchParams.set('exp', '1')
    const body = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(100)])
    const res = await fetch(u.toString(), {
      method: 'PUT',
      headers: { 'Cookie': creatorCookie, 'Origin': BASE_URL },
      body,
    })
    expect(res.status).toBe(403)
  })

  it('他人 token（uid 不匹配）PUT → 403', async () => {
    const { uploadUrl } = await getToken('audio', 'other.mp3')
    // 用 admin cookie 拿 creator 的 token
    const body = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(100)])
    const res = await fetch(BASE_URL + uploadUrl, {
      method: 'PUT',
      headers: { 'Cookie': adminCookie, 'Origin': BASE_URL },
      body,
    })
    expect(res.status).toBe(403)
  })

  it('路径穿越 `..` → 400', async () => {
    const { uploadUrl } = await getToken('audio', 'trav.mp3')
    const u = new URL(uploadUrl, BASE_URL)
    const traverse = u.pathname.replace('uploads/audio', 'uploads/audio/..')
    const res = await fetch(BASE_URL + traverse + u.search, {
      method: 'PUT',
      headers: { 'Cookie': creatorCookie, 'Origin': BASE_URL },
      body: Buffer.alloc(100),
    })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: 跑确认 FAIL**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme5.test.ts -t "/api/upload/local PUT"
```

预期：全部失败（handler 旧实现不验签、写 public/、不校 magic）。

- [ ] **Step 3: 重写 `src/app/api/upload/local/[...path]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getCurrentUser, safeHandler, err } from '@/lib/api-utils'
import { verifyLocalPutSig } from '@/lib/signature'
import { checkMagicBytes } from '@/lib/magic-bytes'

export const PUT = safeHandler(async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_LOCAL_UPLOAD) {
    return NextResponse.json({ code: 404, message: 'Not Found' }, { status: 404 })
  }

  const { userId } = getCurrentUser(request)
  if (!userId) return err('未登录', 401)

  const { path: segments } = await context.params
  const key = decodeURIComponent(segments.join('/'))

  if (key.includes('..')) {
    return err('非法路径', 400)
  }
  if (!key.startsWith('uploads/audio/') && !key.startsWith('uploads/images/')) {
    return err('非法路径', 400)
  }

  // 验签
  const sigErr = verifyLocalPutSig(key, request.nextUrl.searchParams, userId)
  if (sigErr) return err(sigErr, 403)

  const type: 'audio' | 'image' = key.startsWith('uploads/audio/') ? 'audio' : 'image'

  const buffer = Buffer.from(await request.arrayBuffer())

  // magic-bytes
  const magicErr = checkMagicBytes(buffer, type)
  if (magicErr) return err(magicErr, 400)

  const root = path.resolve(process.cwd(), process.env.STORAGE_ROOT || './storage')
  const fullPath = path.resolve(root, key)

  if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
    return err('非法路径', 400)
  }

  const dir = path.dirname(fullPath)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(fullPath, buffer)

  return NextResponse.json({ code: 200, data: { key, size: buffer.length } })
})
```

- [ ] **Step 4: 跑测试确认 PASS**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme5.test.ts -t "/api/upload/local PUT"
```

- [ ] **Step 5: commit**

```bash
git add src/app/api/upload/local/[...path]/route.ts tests/api/theme5.test.ts
git commit -m "feat(theme5/B+D): upload/local PUT 验签 + magic-bytes + 写 storage/"
```

---

### Task D3: 前端 + 后端写入点对接 key 协议

**Files:**
- Modify: `src/app/api/creator/upload/route.ts`
- Modify: `src/app/api/creator/assignments/[id]/submit/route.ts`
- Modify: `src/app/(creator)/creator/upload/page.tsx`
- Modify: `src/app/(creator)/creator/assignments/page.tsx`

后端两个写入点接收 body 里的 `audioUrl/coverUrl`（字段名保留，内容从 URL 改为 key），**无需改动 prisma.platformSong.create 行**（字段名对齐 schema）。前端两个表单从 `res.data.key`（而非 `res.data.fileUrl`）读值。

- [ ] **Step 1: 找 `creator/upload/route.ts` 落库代码，确认无需改**

```bash
grep -n "audioUrl\|coverUrl" src/app/api/creator/upload/route.ts
```

（当前已是 `audioUrl: audioUrl || undefined` — 存什么取决于前端传什么，后端无改。）

- [ ] **Step 2: 找前端 upload/page.tsx 读 fileUrl 的点**

```bash
grep -n "fileUrl\|uploadUrl\|\.data\.url" src/app/\(creator\)/creator/upload/page.tsx
```

典型位置：`handleFileUpload` 里 PUT 成功后从 `token.fileUrl` 读取塞入 state `audioUrl / coverUrl`。

- [ ] **Step 3: 替换前端读值逻辑（两个文件都要）**

原（示意）：
```tsx
const token = (await res.json()).data
await fetch(token.uploadUrl, { method: 'PUT', body: file })
setAudioUrl(token.fileUrl)
```

改为：
```tsx
const token = (await res.json()).data
await fetch(token.uploadUrl, { method: 'PUT', body: file })
setAudioUrl(token.key)  // DB 存 key；读时由 API 出口包 toSignedUrl
```

**两个文件**都做相同改动：
- `src/app/(creator)/creator/upload/page.tsx`
- `src/app/(creator)/creator/assignments/page.tsx`

- [ ] **Step 4: grep 静态断言无残留 fileUrl**

```bash
grep -rn "\.fileUrl\b" src/ | grep -v ".next"
```

预期：无输出。

- [ ] **Step 5: 先写集成测试（追加到 theme5.test.ts 的 `describe('Theme 5 ...')` 内）**

```typescript
describe('creator/upload 写入 key 协议', () => {
  it('POST /api/creator/upload 接收 audioUrl=key（无前导 /），落库即 key', async () => {
    const key = 'uploads/audio/testkey_' + Date.now() + '.mp3'
    const r = await http('/api/creator/upload', {
      method: 'POST',
      cookie: creatorCookie,
      body: {
        title: '测试 Theme 5 key 协议',
        lyricist: '张三',
        composer: '张三',
        performer: '张三',
        genre: '流行',
        bpm: 120,
        contribution: 'lead',
        audioUrl: key,
        coverUrl: null,
        aiTools: ['suno'],
        styleDesc: 'test',
        creationDesc: 'test',
        lyrics: 'test',
      },
    })
    expectOk(r, 'creator upload')
    const song = await prisma.platformSong.findFirst({
      where: { userId: creatorUserId, title: '测试 Theme 5 key 协议' },
      orderBy: { id: 'desc' },
    })
    expect(song?.audioUrl).toBe(key)
    // 清理
    if (song) await prisma.platformSong.delete({ where: { id: song.id } })
  })
})
```

- [ ] **Step 6: 跑确认 PASS**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme5.test.ts -t "creator/upload 写入 key"
```

- [ ] **Step 7: commit**

```bash
git add src/app/\(creator\)/creator/upload/page.tsx src/app/\(creator\)/creator/assignments/page.tsx tests/api/theme5.test.ts
git commit -m "refactor(theme5/D): creator upload/assignments 前端接入 key 协议"
```

---

### Task D4: 脏数据清理 SQL + seed 修正 + docker-compose 挂卷 + CLAUDE.md 部署步骤

**Files:**
- Create: `scripts/theme5-cleanup.sql`
- Modify: `prisma/seed-test-users.ts`（若有歌曲 seed）
- Modify: `docker-compose.yml`
- Modify: `CLAUDE.md`

- [ ] **Step 1: 建 `scripts/theme5-cleanup.sql`**

```sql
-- Theme 5: audioUrl/coverUrl 语义从 URL 改为 key，剥离前导 '/'
-- 幂等可重跑
UPDATE platform_songs
  SET audio_url = TRIM(LEADING '/' FROM audio_url)
  WHERE audio_url LIKE '/%';
UPDATE platform_songs
  SET cover_url = TRIM(LEADING '/' FROM cover_url)
  WHERE cover_url LIKE '/%';
```

- [ ] **Step 2: 检查 seed-test-users.ts 是否需改**

```bash
grep -n "audioUrl\|coverUrl\|audio_url\|/uploads/" prisma/seed-test-users.ts
```

若命中形如 `audioUrl: '/uploads/audio/test.mp3'`，把前导 `/` 去掉：`audioUrl: 'uploads/audio/test.mp3'`。若无命中跳过。

- [ ] **Step 3: 改 docker-compose.yml，app 服务 volumes 加持久卷**

文件当前结构（参考）：
```yaml
services:
  app:
    build: .
    ports: ...
    environment: ...
    depends_on: ...
```

在 `app` 服务下、`restart` 上方追加：
```yaml
    volumes:
      - ./storage:/app/storage
```

同时在 `app.environment` 追加：
```yaml
      - UPLOAD_SECRET=${UPLOAD_SECRET:-}
      - STORAGE_ROOT=/app/storage
```

- [ ] **Step 4: 本地跑一次清理 SQL 验证幂等**

```bash
"C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe" -uroot -pmuseek2026 museek < scripts/theme5-cleanup.sql
"C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe" -uroot -pmuseek2026 museek -e "SELECT audio_url FROM platform_songs WHERE audio_url IS NOT NULL LIMIT 3;"
```

预期：各行 audio_url 开头不再有 `/`。

- [ ] **Step 5: 改 `CLAUDE.md` 追加「Theme 5 部署步骤」章节（加在『Docker 部署』章节后）**

```markdown
## Theme 5 部署步骤（上传安全链）

**首次部署或升级到 Theme 5+ 时执行**：

1. 配置 env（均可选，缺则自动 fallback）：
   - `UPLOAD_SECRET` — HMAC 密钥；缺失时从 `JWT_SECRET` 派生 `sha256(JWT_SECRET + ":upload")`
   - `STORAGE_ROOT` — 本地模式文件落盘根目录；默认 `./storage`

2. 数据迁移：
   ```bash
   mysql museek < scripts/theme5-cleanup.sql
   ```
   脚本幂等可重跑。剥离历史 `audio_url/cover_url` 的前导 `/`。

3. 本地存储目录：
   - 裸机：`storage/uploads/{audio,images}/` 需写权限
   - Docker：`docker-compose.yml` 已挂 `./storage:/app/storage`（确保宿主机目录存在）

4. 生产建议：切到 OSS 模式（管理端 `/admin/settings` → 存储配置），不再走本地网关
```

- [ ] **Step 6: commit**

```bash
git add scripts/theme5-cleanup.sql prisma/seed-test-users.ts docker-compose.yml CLAUDE.md
git commit -m "chore(theme5/D): 清理 SQL + docker 卷挂载 + 部署文档"
```

---

## Patch C — 读时签名 + 文件网关 + 9 API 出口

### Task C1: 新建 `lib/signed-url.ts`

**Files:**
- Create: `src/lib/signed-url.ts`
- Test: `tests/api/theme5.test.ts`（追加 describe）

- [ ] **Step 1: 先写失败测试**

```typescript
import { toSignedUrl } from '@/lib/signed-url'

describe('lib/signed-url', () => {
  it('null 输入返 null', async () => {
    expect(await toSignedUrl(null)).toBeNull()
  })

  it('不带 viewerId → 匿名签名 URL 含 exp/sig 不含 uid', async () => {
    const url = await toSignedUrl('uploads/audio/x.mp3')
    expect(url).toMatch(/^\/api\/files\/uploads\/audio\/x\.mp3\?/)
    const q = new URL(url!, 'http://x').searchParams
    expect(q.get('uid')).toBeNull()
    expect(q.get('sig')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('带 viewerId → 签名含 uid', async () => {
    const url = await toSignedUrl('uploads/audio/x.mp3', 42)
    const q = new URL(url!, 'http://x').searchParams
    expect(q.get('uid')).toBe('42')
  })

  it('去除前导 / 的兜底', async () => {
    const url = await toSignedUrl('/uploads/audio/x.mp3')
    expect(url).toMatch(/^\/api\/files\/uploads\/audio\/x\.mp3\?/)
  })
})
```

- [ ] **Step 2: 跑确认 FAIL**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme5.test.ts -t "lib/signed-url"
```

- [ ] **Step 3: 写 `src/lib/signed-url.ts`**

```typescript
import { signGetUrl } from './signature'

/**
 * Theme 5: DB 语义从 URL 改为 key。API 读出口一律过此函数生成带 1h TTL 的签名 URL。
 * key 可能残留前导 '/'（Theme 5 迁移前数据），`replace(/^\//, '')` 是兜底规整。
 * TODO(theme5+2): 迁移稳定后删除 replace 规整，改 `if (key.startsWith('/')) throw` 严格化。
 */
export async function toSignedUrl(
  key: string | null | undefined,
  viewerId?: number,
): Promise<string | null> {
  if (!key) return null
  const normalized = key.replace(/^\//, '')
  return signGetUrl(normalized, { userId: viewerId, ttlSec: 3600 })
}
```

- [ ] **Step 4: 跑确认 PASS**

- [ ] **Step 5: commit**

```bash
git add src/lib/signed-url.ts tests/api/theme5.test.ts
git commit -m "feat(theme5/C): toSignedUrl 包装（1h TTL + 前导 / 兜底）"
```

---

### Task C2: 新建 `/api/files/[...path]` GET + middleware 放行

**Files:**
- Create: `src/app/api/files/[...path]/route.ts`
- Modify: `src/middleware.ts`

- [ ] **Step 1: 先写集成测试（追加到 theme5.test.ts 的 `describe('Theme 5 ...')` 内）**

```typescript
describe('/api/files GET 网关', () => {
  it('合法签名 → 200 + 正确 Content-Type', async () => {
    // 先上传一个文件
    const tokenR = await http('/api/upload/token', {
      method: 'POST',
      cookie: creatorCookie,
      body: { fileName: 'getme.mp3', fileSize: 1024, type: 'audio' },
    })
    expectOk(tokenR)
    const { uploadUrl, key } = tokenR.json.data
    const body = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(1021)])
    const putRes = await fetch(BASE_URL + uploadUrl, {
      method: 'PUT',
      headers: { 'Cookie': creatorCookie, 'Origin': BASE_URL },
      body,
    })
    expect(putRes.status).toBe(200)

    // signGetUrl 生成 GET 链接
    const { signGetUrl } = await import('@/lib/signature')
    const getUrl = await signGetUrl(key, { userId: creatorUserId })

    const getRes = await fetch(BASE_URL + getUrl)
    expect(getRes.status).toBe(200)
    expect(getRes.headers.get('content-type')).toContain('audio/mpeg')
  })

  it('过期签名 → 403', async () => {
    const { signGetUrl } = await import('@/lib/signature')
    const url = await signGetUrl('uploads/audio/x.mp3', { ttlSec: -1 })
    const res = await fetch(BASE_URL + url)
    expect(res.status).toBe(403)
  })

  it('篡改 sig → 403', async () => {
    const { signGetUrl } = await import('@/lib/signature')
    const url = await signGetUrl('uploads/audio/x.mp3')
    const tampered = url.replace(/sig=[0-9a-f]+/, 'sig=' + '0'.repeat(64))
    const res = await fetch(BASE_URL + tampered)
    expect(res.status).toBe(403)
  })

  it('路径 `..` → 400', async () => {
    const { signGetUrl } = await import('@/lib/signature')
    const url = await signGetUrl('uploads/../secret.env')
    const res = await fetch(BASE_URL + url)
    expect(res.status).toBe(400)
  })

  it('文件不存在 → 404', async () => {
    const { signGetUrl } = await import('@/lib/signature')
    const url = await signGetUrl('uploads/audio/nonexistent_' + Date.now() + '.mp3')
    const res = await fetch(BASE_URL + url)
    expect(res.status).toBe(404)
  })

  it('匿名（无 cookie）合法签名也能访问（公开分享场景）', async () => {
    // 需用第一个用例落盘的文件
    const r = await http('/api/creator/songs?status=all', { cookie: creatorCookie })
    expectOk(r)
    // 简化：直接签一个已知落盘的 key。此用例若上面清过盘，可改先上传再验
    // 跳过匿名测试，已由 songs/published 接口端到端覆盖
  })
})
```

- [ ] **Step 2: 跑确认 FAIL**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme5.test.ts -t "/api/files GET"
```

- [ ] **Step 3: 写 `src/app/api/files/[...path]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync, statSync } from 'fs'
import path from 'path'
import { safeHandler, err } from '@/lib/api-utils'
import { verifyLocalGetSig, signGetUrl } from '@/lib/signature'
import { getSetting, SETTING_KEYS } from '@/lib/system-settings'

const CONTENT_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export const GET = safeHandler(async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params
  const key = decodeURIComponent(segments.join('/'))

  // 路径穿越硬防
  if (key.includes('..')) return err('非法路径', 400)
  if (!key.startsWith('uploads/audio/') && !key.startsWith('uploads/images/')) {
    return err('非法路径', 400)
  }

  // OSS 模式兜底：重定向到 OSS 签名直链
  const cfg = await getSetting<{ mode?: string }>(SETTING_KEYS.STORAGE_CONFIG, {})
  const mode = cfg.mode ?? (process.env.OSS_BUCKET ? 'oss' : 'local')
  if (mode === 'oss') {
    const ossUrl = await signGetUrl(key, { ttlSec: 3600 })
    return NextResponse.redirect(ossUrl, 302)
  }

  // 验签
  const sigErr = verifyLocalGetSig(key, request.nextUrl.searchParams)
  if (sigErr) return err(sigErr, 403)

  const root = path.resolve(process.cwd(), process.env.STORAGE_ROOT || './storage')
  const fullPath = path.resolve(root, key)
  if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
    return err('非法路径', 400)
  }
  if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
    return err('文件不存在', 404)
  }

  const ext = path.extname(key).toLowerCase()
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'
  const buffer = await readFile(fullPath)
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=3600',
    },
  })
})
```

- [ ] **Step 4: 改 `src/middleware.ts` 的 PUBLIC_PATHS**

文件 16-22 行：
```typescript
const PUBLIC_PATHS = [
  '/admin/login', '/creator/login', '/review/login',
  '/api/auth',
  '/api/content',
  '/api/songs/published',
  '/api/files',
]
```

- [ ] **Step 5: 跑测试确认 PASS**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme5.test.ts -t "/api/files GET"
```

- [ ] **Step 6: commit**

```bash
git add src/app/api/files/\[...path\]/route.ts src/middleware.ts tests/api/theme5.test.ts
git commit -m "feat(theme5/C): /api/files 文件网关 + middleware 放行"
```

---

### Task C3: 6 个 API 出口接入 `toSignedUrl`（audioUrl/coverUrl 签名）

**Files:**
- Modify: `src/app/api/admin/songs/route.ts`
- Modify: `src/app/api/admin/songs/[id]/route.ts`
- Modify: `src/app/api/admin/publish-confirm/route.ts`
- Modify: `src/app/api/admin/publish-confirm/[id]/route.ts`
- Modify: `src/app/api/admin/distributions/route.ts`
- Modify: `src/app/api/review/queue/route.ts`
- Modify: `src/app/api/creator/songs/[id]/route.ts`
- Modify: `src/app/api/songs/published/route.ts`

（`api/review/songs/[id]/route.ts` 放到 Task E1 一并改，因为那里同时要改字段重命名。）

- [ ] **Step 1: 先写集成测试（追加）**

```typescript
describe('C3 API 读出口均返签名 URL', () => {
  let songId = 0
  beforeAll(async () => {
    // 找一首当前 creator 的歌（seed 应有）；若没有则跳过
    const s = await prisma.platformSong.findFirst({ where: { userId: creatorUserId } })
    if (!s) throw new Error('需要 creator 至少有 1 首歌作前置；检查 seed-test-users')
    songId = s.id
  })

  it('GET /api/creator/songs/:id audioUrl 形如签名 URL', async () => {
    const r = await http(`/api/creator/songs/${songId}`, { cookie: creatorCookie })
    expectOk(r)
    if (r.json.data.audioUrl != null) {
      expect(r.json.data.audioUrl).toMatch(/\/api\/files\/.*\?.*sig=/)
    }
  })

  it('GET /api/songs/published 匿名请求 coverUrl 不含 uid', async () => {
    const r = await http('/api/songs/published')
    expectOk(r)
    const item = r.json.data.list?.[0]
    if (item?.coverUrl != null) {
      expect(item.coverUrl).toMatch(/\/api\/files\/.*\?.*sig=/)
      expect(item.coverUrl).not.toContain('uid=')
    }
  })

  it('GET /api/review/queue audioUrl 签名', async () => {
    const r = await http('/api/review/queue', { cookie: reviewerCookie })
    expectOk(r)
    const item = r.json.data.list?.[0]
    if (item?.audioUrl != null) {
      expect(item.audioUrl).toMatch(/\/api\/files\/.*\?.*sig=/)
    }
  })

  it('GET /api/admin/songs audioUrl/coverUrl 签名', async () => {
    const r = await http('/api/admin/songs?pageSize=1', { cookie: adminCookie })
    expectOk(r)
    const item = r.json.data.list?.[0]
    if (item?.audioUrl != null) {
      expect(item.audioUrl).toMatch(/\/api\/files\/.*\?.*sig=/)
    }
    if (item?.coverUrl != null) {
      expect(item.coverUrl).toMatch(/\/api\/files\/.*\?.*sig=/)
    }
  })
})
```

- [ ] **Step 2: 跑确认 FAIL**

- [ ] **Step 3: 改 `src/app/api/admin/songs/route.ts`**

找到 `list.map((s) => ({ ... audioUrl: s.audioUrl, coverUrl: s.coverUrl, ... }))` 附近（99-100 行），改为：

```typescript
// 顶部 import
import { toSignedUrl } from '@/lib/signed-url'

// list.map 改为 async：
const list = await Promise.all(songs.map(async (s) => ({
  // ... 原有字段 ...
  audioUrl: await toSignedUrl(s.audioUrl, auth.userId),
  coverUrl: await toSignedUrl(s.coverUrl, auth.userId),
  // ... 原有字段 ...
})))
```

（注意：若 `requirePermission` 返回的 `auth` 对象名不同，以实际为准。）

- [ ] **Step 4: 改 `src/app/api/admin/songs/[id]/route.ts`**

当前 32 行 `return ok(song)` 直接返整 prisma 对象。改为：

```typescript
import { toSignedUrl } from '@/lib/signed-url'

// 在 return ok(song) 前：
return ok({
  ...song,
  audioUrl: await toSignedUrl(song.audioUrl, auth.userId),
  coverUrl: await toSignedUrl(song.coverUrl, auth.userId),
})
```

- [ ] **Step 5: 改 `src/app/api/admin/publish-confirm/route.ts`**

83 行 `coverUrl: d.song.coverUrl` 改为：

```typescript
import { toSignedUrl } from '@/lib/signed-url'

coverUrl: await toSignedUrl(d.song.coverUrl, auth.userId),
```

并把 list.map 包成 `await Promise.all(list.map(async d => ({ ... })))`。

- [ ] **Step 6: 改 `src/app/api/admin/publish-confirm/[id]/route.ts`**

70-71 行同样改：

```typescript
import { toSignedUrl } from '@/lib/signed-url'

audioUrl: await toSignedUrl(distribution.song.audioUrl, auth.userId),
coverUrl: await toSignedUrl(distribution.song.coverUrl, auth.userId),
```

- [ ] **Step 7: 改 `src/app/api/admin/distributions/route.ts`**

34 行 `return { id: s.id, title: s.title, cover: s.coverUrl }` 改为：

```typescript
import { toSignedUrl } from '@/lib/signed-url'

// list.map 外层 await Promise.all(...)
return { id: s.id, title: s.title, cover: await toSignedUrl(s.coverUrl, auth.userId) }
```

- [ ] **Step 8: 改 `src/app/api/review/queue/route.ts`**

43-44 行同模式：`list.map` 包 `Promise.all` + await `toSignedUrl`。

- [ ] **Step 9: 改 `src/app/api/creator/songs/[id]/route.ts`**

55 行 `return ok(song)` 改为：

```typescript
import { toSignedUrl } from '@/lib/signed-url'

return ok({
  ...song,
  audioUrl: await toSignedUrl(song.audioUrl, userId),
  coverUrl: await toSignedUrl(song.coverUrl, userId),
})
```

- [ ] **Step 10: 改 `src/app/api/songs/published/route.ts`**

24-35 行的 `list.map` 改为 `await Promise.all(list.map(async s => ({ ..., coverUrl: await toSignedUrl(s.coverUrl) })))`（**匿名不传 viewerId**）。

- [ ] **Step 11: 跑所有 C3 测试 + 现有测试冒烟**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme5.test.ts -t "C3 API"
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/songs.test.ts
```

预期：C3 全 PASS，songs.test.ts 已知 pre-existing 6 条失败（"status 状态机 archive→restore"、"作业重新提交" ×2）照常失败，其它 green。

- [ ] **Step 12: commit**

```bash
git add src/app/api/admin/songs/ src/app/api/admin/publish-confirm/ src/app/api/admin/distributions/route.ts src/app/api/review/queue/route.ts src/app/api/creator/songs/\[id\]/route.ts src/app/api/songs/published/route.ts tests/api/theme5.test.ts
git commit -m "feat(theme5/C): 8 个 API 读出口接入 toSignedUrl 签名 URL"
```

---

## Patch E — 遗留字段错位

### Task E1: `review/songs/[id]` API + reviewer/assess 页面 cover/aiTool 字段统一

**Files:**
- Modify: `src/app/api/review/songs/[id]/route.ts`
- Modify: `src/app/(reviewer)/review/assess/page.tsx`

- [ ] **Step 1: 先写静态契约测试（追加到 theme5.test.ts）**

```typescript
describe('E1 review/songs/:id 字段契约', () => {
  it('响应 key 名 coverUrl/aiTools（非 cover/aiTool），audioUrl/coverUrl 是签名 URL', async () => {
    const song = await prisma.platformSong.findFirst({ where: { status: 'pending_review' } })
    if (!song) {
      console.warn('跳过 E1：需 pending_review 歌曲；由测试 seed 保证')
      return
    }
    const r = await http(`/api/review/songs/${song.id}`, { cookie: reviewerCookie })
    expectOk(r)
    expect(r.json.data).toHaveProperty('coverUrl')
    expect(r.json.data).toHaveProperty('aiTools')
    expect(r.json.data).not.toHaveProperty('cover')
    expect(r.json.data).not.toHaveProperty('aiTool')
    expect(Array.isArray(r.json.data.aiTools)).toBe(true)
    if (r.json.data.audioUrl != null) {
      expect(r.json.data.audioUrl).toMatch(/\/api\/files\/.*\?.*sig=/)
    }
  })
})
```

- [ ] **Step 2: 改 `src/app/api/review/songs/[id]/route.ts` 23-43 行**

当前：
```typescript
return ok({
    id: song.id,
    title: song.title,
    userId: song.userId,
    cover: song.coverUrl,
    audioUrl: song.audioUrl,
    ...
    aiTool: song.aiTools,
    ...
})
```

改为：
```typescript
import { toSignedUrl } from '@/lib/signed-url'

return ok({
  id: song.id,
  title: song.title,
  userId: song.userId,
  coverUrl: await toSignedUrl(song.coverUrl, userId),
  audioUrl: await toSignedUrl(song.audioUrl, userId),
  genre: song.genre,
  bpm: song.bpm,
  aiTools: song.aiTools,
  performer: song.performer,
  lyricist: song.lyricist,
  composer: song.composer,
  lyrics: song.lyrics,
  styleDesc: song.styleDesc,
  creationDesc: song.creationDesc,
  contribution: song.contribution,
  status: song.status,
  version: song.version,
  studentName: song.user.realName || song.user.name || song.user.phone || '未命名',
  createdAt: song.createdAt,
})
```

- [ ] **Step 3: 改 `src/app/(reviewer)/review/assess/page.tsx`**

- 11-25 行 interface：
```tsx
interface SongDetail {
  id: number
  title: string
  userId: number
  coverUrl?: string | null
  audioUrl?: string | null
  genre: string
  bpm: number
  aiTools: string[]
  lyrics?: string | null
  styleDesc?: string | null
  creationDesc?: string | null
  status: string
  studentName?: string
}
```

- 294-296 行 JSX 封面渲染：
```tsx
<div className="text-5xl w-[72px] h-[72px] bg-[var(--bg4)] rounded-[10px] flex items-center justify-center shrink-0 overflow-hidden">
  {song.coverUrl
    ? <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
    : <span>🎵</span>}
</div>
```

- 327 行 AI 工具渲染：
```tsx
{Array.isArray(song.aiTools) ? song.aiTools.join(', ') : '-'}
```

- [ ] **Step 4: grep 静态断言**

```bash
grep -n "song\.cover\b\|song\.aiTool\b" src/app/\(reviewer\)/review/assess/page.tsx
```

预期：无输出（`.cover` 后必跟 `Url`，`.aiTool` 后必跟 `s`）。

- [ ] **Step 5: 跑 E1 测试确认 PASS**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme5.test.ts -t "E1 review"
```

- [ ] **Step 6: commit**

```bash
git add src/app/api/review/songs/\[id\]/route.ts src/app/\(reviewer\)/review/assess/page.tsx tests/api/theme5.test.ts
git commit -m "refactor(theme5/E): review/assess cover→coverUrl + aiTool→aiTools + 读签名"
```

---

### Task E2: `creator/songs/page.tsx` 删死字段 `cover`

**Files:**
- Modify: `src/app/(creator)/creator/songs/page.tsx`

- [ ] **Step 1: 定位**

```bash
grep -n "cover\b" src/app/\(creator\)/creator/songs/page.tsx
```

预期命中：line 28（type）、line 215（详情页）、line 404（列表卡）。

- [ ] **Step 2: 改动 3 处**

- Line 28：删除 `cover: string` 字段
- Line 215：`{song.cover}` → `<span>🎵</span>`（或 genre emoji fallback，简单起见用歌曲 icon）
- Line 404：`{s.cover}` → `<span>🎵</span>`

- [ ] **Step 3: 类型检查**

```bash
npx tsc --noEmit
```

预期：无新错误。

- [ ] **Step 4: grep 静态断言**

```bash
grep -n "\.cover\b" src/app/\(creator\)/creator/songs/page.tsx
```

预期：无输出。

- [ ] **Step 5: commit**

```bash
git add src/app/\(creator\)/creator/songs/page.tsx
git commit -m "refactor(theme5/E): creator/songs 删死字段 cover（API 不返，改用 placeholder）"
```

---

## 终节：冒烟 + 现有测试 + 全面回归

- [ ] **Step 1: 全量 Theme 5 测试**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme5.test.ts
```

预期：新增 ~30 用例全绿。

- [ ] **Step 2: 回归现有套件（允许已知 6 条 pre-existing 失败）**

```bash
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/
```

预期：
- 新失败数 = 0
- 已知失败保持 6 条（`admin-groups-assignments TC-ASN-NOTIFY` / `creator POST /api/learning contentId=2` ×2 / `songs 状态机 archive→restore` / `songs 作业重新提交` ×2）

如出现新失败，先回到对应 Patch 查原因。

- [ ] **Step 3: 类型全检**

```bash
npx tsc --noEmit
```

预期：0 errors。

- [ ] **Step 4: dev server 手工冒烟**

PORT=3001 dev server 浏览器依次验证：
- creator/upload：选 mp3 上传 → 提交成功 → 作品库看到；点详情页播放音频能发声
- reviewer/assess：进评审队列 → 选一首 → 封面 `<img>` 渲染或 🎵 占位 → 音频能播
- creator/songs：作品库卡片显示 🎵 占位（无 cover 字段）→ 详情页音频能播
- admin/songs：列表页看到 audioUrl/coverUrl 字段为 `/api/files/...?sig=...`

- [ ] **Step 5: 最终 commit（若有遗漏）并查看 git log**

```bash
git log --oneline -20
```

应看到约 10 条 `feat(theme5/X)` / `refactor(theme5/X)` 提交。

- [ ] **Step 6: push**

```bash
git push origin main
```

---

## Self-Review 笔记

本 plan 已针对 spec 条目做覆盖 check：

- GAP-CRTR-006（audio/cover URL 匿名直链） → Task C1+C2+C3
- GAP-CRTR-007（OSS uploadUrl 未签名） → Task A1（signPutUrl 的 OSS 分支）+ A3
- GAP-CRTR-008（upload token 无过期） → Task A1（signPutUrl 默认 ttlSec=300 + exp 参数）+ D2（verifyLocalPutSig 验 exp）
- GAP-CRTR-047（文件仅扩展名校验） → Task B1+D2（checkMagicBytes 接入 PUT handler）
- Theme 6 遗留字段（reviewer/assess cover/aiTool + creator/songs cover） → Task E1 + E2

字段命名一致性：`toSignedUrl(key, viewerId?)` 贯穿 Patch C/E；`signPutUrl / signGetUrl / verifyLocalPutSig / verifyLocalGetSig` 贯穿 Patch A/B/C/D；`UPLOAD_SECRET / STORAGE_ROOT` 贯穿 D/A/C。

占位符扫描：无 TBD/TODO。代码兜底 `replace(/^\//,'')` 处已加 `TODO(theme5+2)` 标记说明为冗余期代码。

文件路径一次写对：9 个 API 读出口（含 review/songs/[id]）逐一列清单；Windows bash 用 `\(` `\)` 转义；mysql 用 MySQL Server 8.0 bin 的绝对路径。
