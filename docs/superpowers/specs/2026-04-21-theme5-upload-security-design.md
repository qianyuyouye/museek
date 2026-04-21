# Theme 5: 上传安全链 Design

## 元信息

| 项 | 值 |
|---|---|
| 设计日期 | 2026-04-21 |
| 设计者 | superpowers:brainstorming |
| PRD 基准 | v5.2 对齐版 + `2026-04-20-platform-alignment-gap-list.md`「主题 5」 |
| 状态 | 待用户 review |
| 下一步 | 通过后用 superpowers:writing-plans 产出实施计划 |

## 背景

PRD v5.2 对齐版 30 条 P0 收敛为 7 主题。主题 1/2/3/4/6/7 已完成，本设计覆盖剩余的**主题 5（上传安全链）** 并顺带收掉主题 6 范围外的 2 处同族字段错位。

主题 5 根因是"上传链路四不设防"：文件静态直链匿名可取 / OSS 拼接 URL 不签名 / upload token 永久有效 / 仅扩展名校验放行 SVG-with-script。本次一次性修掉 4 条 P0 + 1 项遗留字段，建立"签名（GET/PUT）+ magic bytes + key 化存储"的完整闭环。

## 目标与范围

### In-Scope

| ID | 缺口 | 修复方向 |
|---|---|---|
| GAP-CRTR-006 / GAP-LOOP-006 | audio/cover URL 匿名可访问 | 所有 API 读出口走 `toSignedUrl(key, viewerId)`（1h TTL） |
| GAP-CRTR-007 / GAP-LOOP-002 | OSS uploadUrl 未签名 | 接入 `ali-oss.signatureUrl(key, {method:'PUT', expires:300})` |
| GAP-CRTR-008 | upload token 无过期/可无限重用 | HMAC 签名 + exp（5min）+ 绑 userId/type/key |
| GAP-CRTR-047 / GAP-LOOP-007 | 文件仅校验扩展名 | 自写 magic-bytes 头部字节校验（MP3/WAV/PNG/JPG/WEBP） |
| 遗留字段 1 | `reviewer/assess/page.tsx:15,295,327` cover/aiTool 单数 | interface + API 契约重命名 `coverUrl/aiTools` |
| 遗留字段 2 | `creator/songs/page.tsx:28,215,404` 死字段 cover | 删字段、UI 用 placeholder（API 补字段是 GAP-CRTR-018 P1 另排） |

### Out-of-Scope

- GAP-CRTR-018（作品库 list API 补 coverUrl/audioUrl）：P1，另排
- GAP-CRTR-059（/api/songs/published 匿名限流）：P1，另排
- GAP-CRTR-009（短信/重置密码/upload-token IP 限流）：P0 但非上传链路，另主题
- OSS 生产真实压测 + CSP
- 批量下载链路（`/api/admin/songs/batch-download`）保持现状

### 成功标准

1. 匿名 GET 原始 `/storage/uploads/audio/xxx.mp3` 路径返回 404（静态目录完全不托管）
2. API 返 audioUrl/coverUrl 均形如 `/api/files/uploads/xxx?exp=...&sig=...`（local）或 `https://bucket.oss-region.aliyuncs.com/xxx?...OSSAccessKeyId=...&Signature=...`（OSS）
3. 过期签名 URL GET 返 403，路径穿越 `..` 返 400
4. OSS 模式下 `createUploadToken` 返回的 uploadUrl 含真实 OSS Signature（`client.signatureUrl` 生成）
5. 伪装 MP3 的 SVG buffer PUT 被 400 拒绝，扩展名正确但头字节不对的文件被拦
6. Upload token 超过 5min、他人 uid、type/key 目录不匹配三种场景 PUT 403
7. 集成测试 `tests/api/theme5.test.ts` 全绿；现有测试无 regression（允许已知 6 条 pre-existing 失败）
8. 遗留字段 reviewer/assess 的 `aiTools` 数组能正常 `join(', ')` 展示，creator/songs 不再渲染 undefined

## 架构：5 个独立 Patch

| Patch | 主题 | 新建/改动 | 依赖 |
|---|---|---|---|
| **A** | 存储抽象 + 签名统一库 | `lib/signature.ts`、`lib/oss-client.ts`；改 `lib/upload.ts` | — |
| **B** | Magic-bytes 校验 | `lib/magic-bytes.ts`；接入 `/api/upload/local` PUT | A |
| **C** | 读时签名 + 文件网关 | `/api/files/[...path]`；6 个 API 出口 + `middleware.ts` | A |
| **D** | DB 语义 key 化 + 目录迁出 public | `storage/uploads/`、cleanup SQL、seed 修正 | A |
| **E** | 遗留字段错位 | `reviewer/assess` + `creator/songs` | C（借签名 URL） |

推荐顺序：`A → B → D → C → E`（D 放 C 前，让 C 的签名流程直接指向 storage/ 新位置）。

### Patch A — 存储抽象 + 签名统一库

**`src/lib/signature.ts`**（~80 行）：
```typescript
export interface SignedPutOptions { userId: number; type: 'audio' | 'image'; ttlSec?: number }
export interface SignedGetOptions { userId?: number; ttlSec?: number }

// OSS 分支走 ossClient.signatureUrl；local 分支走 HMAC
export async function signPutUrl(key: string, opts: SignedPutOptions): Promise<{ uploadUrl: string; headers?: Record<string,string> }>
export async function signGetUrl(key: string, opts?: SignedGetOptions): Promise<string>

// local 模式下路由内部调用
export function verifyLocalPutSig(key: string, query: URLSearchParams, currentUserId: number): string | null  // null=OK
export function verifyLocalGetSig(key: string, query: URLSearchParams): string | null

// HMAC 算法：HMAC-SHA256(UPLOAD_SECRET, `${key}|${uid ?? ''}|${type ?? ''}|${exp}`) hex
```

**secret 来源**：
- 优先 `process.env.UPLOAD_SECRET`
- 缺失时派生 `sha256(JWT_SECRET + ':upload').hex()` —— 与 JWT 域分离，且免新 env
- 若 JWT_SECRET 也缺且 `NODE_ENV === 'production'`：模块初始化 throw

**`src/lib/oss-client.ts`**（~20 行）：
```typescript
import type OSSType from 'ali-oss'
let _client: OSSType | null = null

export async function getOssClient(): Promise<OSSType> {
  if (_client) return _client
  const config = await loadStorageConfig()
  const OSS = (await import('ali-oss')).default
  _client = new OSS({
    accessKeyId: config.oss.accessKeyId,
    accessKeySecret: config.oss.accessKeySecret,
    region: config.oss.region,
    bucket: config.oss.bucket,
    secure: true,
  })
  return _client
}
```

**改动 `src/lib/upload.ts`**：
- `createUploadToken(fileName, type)` → `createUploadToken(fileName, type, userId)`
- 返回 `{ uploadUrl, key, method: 'PUT', headers? }`（**移除 `fileUrl`**；DB 只存 key）
- 旧 `getLocalToken / getOSSToken` 合并进 `createUploadToken` 内，全部 delegate 到 `signPutUrl`

**改动 `src/app/api/upload/token/route.ts`**：
- 从 session 拿 userId 传入
- 返回体：`{ uploadUrl, key, method, headers? }`（原 `fileUrl` 替换为 `key`）

**前端协议**：
- creator/upload 和 assignments/submit 从 `res.data.key`（而非 `res.data.fileUrl`）读值
- 提交表单 body 中 `audioUrl/coverUrl` 字段名保留，内容语义从 URL 改为 key

### Patch B — Magic-bytes 校验

**`src/lib/magic-bytes.ts`**（~50 行）：
```typescript
export function checkMagicBytes(buf: Buffer, type: 'audio' | 'image'): string | null {
  if (buf.length < 12) return '文件过小，无法识别格式'

  if (type === 'audio') {
    // MP3 ID3 头
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return null
    // MP3 帧同步字 FF Ex（覆盖 MPEG1/2/2.5）
    if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return null
    // WAV: "RIFF" ... "WAVE"
    if (buf.subarray(0, 4).toString('ascii') === 'RIFF'
     && buf.subarray(8, 12).toString('ascii') === 'WAVE') return null
    return '音频文件头部字节不匹配 MP3/WAV 格式'
  }

  // image
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return null  // JPEG
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return null  // PNG
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF'
   && buf.subarray(8, 12).toString('ascii') === 'WEBP') return null  // WEBP
  return '图片文件头部字节不匹配 JPEG/PNG/WEBP 格式'
}
```

**接入 `/api/upload/local/[...path]` PUT**：
- 收 buffer 后、写盘前先 `verifyLocalPutSig` → `checkMagicBytes`
- 失败均 400，错误信息给用户（扩展名 vs 头字节不符要显式提示）
- type 从 query 传（`?type=audio`），服务端还会校验 type 与 key 目录一致（`uploads/audio/*` ↔ audio）

**OSS 不做 magic-bytes**：OSS 直传不经 Node，代偿靠预签名限制扩展名与 size（后续如需真实校验可加 OSS 回调）。

### Patch C — 读时签名 + 文件网关

**`src/app/api/files/[...path]/route.ts`**（GET，~50 行）：
- local 模式：读 HMAC sig + exp，从 `storage/uploads/${path}` 读 buffer 返回
- Content-Type 按扩展名映射（audio/mpeg、audio/wav、image/jpeg、image/png、image/webp、image/jpg → jpeg）
- OSS 模式：理论不该命中此路由（API 出口已签 OSS 直链）；兜底 302 redirect 到 `signGetUrl(key)`
- 路径安全：
  - key 不能含 `..`
  - 必须以 `uploads/audio/` 或 `uploads/images/` 开头
  - 解析后绝对路径必须在 `STORAGE_ROOT` 内
- 签名不合法：403（返回统一 "链接已过期或无效"，不区分 exp/sig 原因）

**middleware.ts**：`/api/files/` 加入 `PUBLIC_PATHS`（由 HMAC 自担保）

**`src/lib/signed-url.ts`**（~15 行）：
```typescript
import { signGetUrl } from './signature'
export async function toSignedUrl(key: string | null, viewerId?: number): Promise<string | null> {
  if (!key) return null
  return signGetUrl(key.replace(/^\//, ''), { userId: viewerId, ttlSec: 3600 })
}
```

> 注：`replace(/^\//, '')` 是 Patch D 迁移期冗余兜底，两个版本后移除（加 TODO 标记）。

**批量接入 6 个 API 出口**：

| 路由 | 改动 |
|---|---|
| `api/creator/songs/[id]/route.ts` | `audioUrl: await toSignedUrl(song.audioUrl, userId)` |
| `api/review/songs/[id]/route.ts` | audioUrl + coverUrl 签名（字段重命名见 Patch E） |
| `api/review/queue/route.ts` | list.map 内 audioUrl 签名（`Promise.all`） |
| `api/admin/songs/[id]/route.ts` | audioUrl/coverUrl 签名 |
| `api/admin/songs/route.ts` | list audioUrl/coverUrl 签名 |
| `api/songs/published/route.ts` | audioUrl/coverUrl 签名（viewerId 省略 → 匿名只绑 exp） |

**列表接口性能**：`await Promise.all(list.map(async s => ({ ...s, audioUrl: await toSignedUrl(s.audioUrl) })))`，HMAC 计算 μs 级，20 条列表无压力。

### Patch D — DB 语义 key 化 + 目录迁出 public

**存储目录**：
- 新建 `storage/uploads/audio/` 和 `storage/uploads/images/`（仓库根下，`.gitignore`，保留 `.gitkeep`）
- 新增 env `STORAGE_ROOT`（默认 `./storage`），`/api/upload/local` 与 `/api/files` 均读此常量
- 删除 `public/uploads/`（实际已不存在）

**DB 语义变更**（字段不动，内容从 URL 改为 key）：
- 字段名 `audio_url / cover_url VARCHAR(500)` 保持
- 写入：`platformSong.create` 时 `audioUrl: res.key`（前端 PUT 完回传）
- `lib/upload.ts` 返回体移除 `fileUrl`，前端改读 `key`

**涉及写入点**：
- `api/creator/upload/route.ts`：接收前端 body 中 `audioUrl/coverUrl`（值为 key），落库
- `api/creator/assignments/[id]/submit/route.ts`：同
- `(creator)/creator/upload/page.tsx`：从 `res.data.key` 取值
- `(creator)/creator/assignments/page.tsx`：同

**Seed 清理**：
- `prisma/seed-test-users.ts`（若 seed 了 platform_songs）：audioUrl 值从 `/uploads/audio/test.mp3` 改为 `uploads/audio/test.mp3`
- `scripts/theme5-cleanup.sql`（commit 进仓库，幂等可重跑）：
```sql
UPDATE platform_songs SET audio_url = TRIM(LEADING '/' FROM audio_url) WHERE audio_url LIKE '/%';
UPDATE platform_songs SET cover_url = TRIM(LEADING '/' FROM cover_url) WHERE cover_url LIKE '/%';
```

**代码兜底**：`toSignedUrl()` 内部 `replace(/^\//, '')` 规整，哪怕漏跑 SQL 也不崩

**docker-compose.yml**（若存在）：加 `./storage:/app/storage` 卷映射

**CLAUDE.md**：追加 "Theme 5 部署步骤" 章节，明确 3 步：
1. 配 `UPLOAD_SECRET`（可选）和 `STORAGE_ROOT`（可选）
2. 执行 `mysql museek < scripts/theme5-cleanup.sql`
3. Docker 部署需挂 `storage/` 持久卷

### Patch E — 遗留字段错位

**E1: `src/app/(reviewer)/review/assess/page.tsx`**
- Line 15: `cover: string` → `coverUrl?: string | null`
- Line 19: `aiTool: string` → `aiTools: string[]`
- Line 295: `{song.cover}` → `<img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover rounded-[10px]">`（coverUrl 为空时保留 emoji fallback）
- Line 327: `{song.aiTool}` → `{song.aiTools?.join(', ') || '-'}`

**E1 配套 API**：`src/app/api/review/songs/[id]/route.ts`
- Line 27 `cover: song.coverUrl` → `coverUrl: await toSignedUrl(song.coverUrl, userId)`
- Line 28 `audioUrl: song.audioUrl` → `audioUrl: await toSignedUrl(song.audioUrl, userId)`
- Line 31 `aiTool: song.aiTools` → `aiTools: song.aiTools`

**E2: `src/app/(creator)/creator/songs/page.tsx`**
- Line 28: 删 `cover: string` 字段
- Line 215 / 404: `{song.cover}` / `{s.cover}` → `<div>🎵</div>` 或 genre emoji fallback
- **不碰 API**；API 补 coverUrl 是 GAP-CRTR-018（P1 另排）

## 数据流

### 上传（写路径）

```
前端 creator/upload/page
  1. POST /api/upload/token { fileName, fileSize, type:'audio' }
       ↓ 验 session → createUploadToken(fileName, 'audio', userId)
       ↓ signPutUrl(key, {userId, type:'audio', ttlSec:300})
       ↓ local:  uploadUrl = /api/upload/local/uploads/audio/xxx.mp3?exp&uid&type&sig
       ↓ OSS:    uploadUrl = ossClient.signatureUrl(key, {method:'PUT', expires:300})
     ← { uploadUrl, key, method:'PUT', headers? }
  2. PUT uploadUrl + file buffer
       ↓ local:  verifyLocalPutSig → checkMagicBytes → write storage/uploads/xxx
       ↓ OSS:    文件直传 OSS（不过 Node）
     ← 200 OK
  3. POST /api/creator/upload { ..., audioUrl: key, coverUrl: key2 }
       ↓ prisma.platformSong.create({ data: { audioUrl: key, coverUrl: key2 } })
     ← 200
```

### 播放（读路径）

```
前端 review/assess or creator/songs
  GET /api/review/songs/:id
    ↓ prisma.platformSong.findUnique(...)
    ↓ audioUrl: await toSignedUrl(song.audioUrl, userId)  // 1h TTL
    ↓ coverUrl: await toSignedUrl(song.coverUrl, userId)
  ← { ..., audioUrl: '/api/files/uploads/audio/xxx.mp3?exp=...&uid=42&sig=HEX', coverUrl: '...' }

<audio src={res.audioUrl}>
  → GET /api/files/uploads/audio/xxx.mp3?...
    ↓ verifyLocalGetSig → 读 storage/uploads/audio/xxx.mp3 → Content-Type audio/mpeg
  ← 200 + binary
```

### 匿名广场

```
GET /api/songs/published (无 access_token)
  ↓ middleware PUBLIC_PATHS 放行
  ↓ audioUrl: await toSignedUrl(song.audioUrl)  // 无 userId，仅绑 exp
← { list: [{ audioUrl: '/api/files/...?exp=...&sig=...' }] }
```

## 错误处理

- **签名失败**：统一 `err('文件链接已过期或无效', 403)`，不区分 exp/sig 原因（防探测）
- **Magic-bytes 失败**：`err(msg, 400)`，msg 明确（用户要知道允许格式）
- **文件不存在**：`err('文件不存在', 404)`
- **OSS SDK 异常**：`safeHandler` 500 兜底，日志 `[OSS] <op> failed:`
- **`UPLOAD_SECRET` + `JWT_SECRET` 都缺（prod）**：模块 init 阶段 throw
- **`toSignedUrl(null)`**：返 null
- **路径穿越**：`err('非法路径', 400)`

## 测试策略

新建 `tests/api/theme5.test.ts`（~250 行，vitest，与 Theme 6/7 同风格）。

| 组 | 用例 | 断言 |
|---|---|---|
| T-A | `signPutUrl(key, {userId:42, type:'audio'})` 本地模式 | URL query sig/exp/uid/type 齐全 |
| | `verifyLocalPutSig` 正确签名 → null | 5min TTL 内有效 |
| | 过期签名 → "过期" | exp < now |
| | userId 不匹配 → "用户不匹配" | 防盗链 |
| | type 与 key 目录不符 → "类型错误" | |
| T-B | ID3 头 mp3 → null | 合法 |
| | MP3 帧同步 FFFB → null | 合法 |
| | RIFF+WAVE → null | 合法 |
| | PNG/JPEG/WEBP 头 → null | 合法 |
| | SVG `<svg>` → 错误 | 伪装 |
| | type='audio' 但 buffer 是 PNG → 错误 | 跨类型攻击 |
| T-C | 登录 creator GET /api/creator/songs/:id → audioUrl 是签名 URL | 含 ?exp&sig |
| | 匿名 GET /api/songs/published → audioUrl 不含 uid | 仅签 exp |
| | 过期签名 GET /api/files/... → 403 | 网关验签 |
| | 正确签名但路径 `..` → 400 | 防穿越 |
| T-D | 合法 token + 正确 magic bytes → 200 + 文件落盘 storage/ | E2E |
| | 合法 token 但 buffer 是 SVG 伪装 mp3 → 400 | 类型不匹配 |
| | 过期 token PUT → 403 | TTL |
| | 他人 token PUT（uid 不匹配）→ 403 | |
| T-E | GET /api/review/songs/:id 响应 aiTools 数组、coverUrl 字符串或 null | 静态契约 |
| | grep 静态断言 creator/songs/page.tsx 不再有 `.cover\b` | 死字段清除 |

**Fixture**：`tests/fixtures/{audio,image,bad}/sample.*`，小体积（< 1KB 可用 Buffer.from(hex) 构造）。

**不做**：OSS 真实签名压测、Docker 挂载测试。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| OSS SDK ESM/CJS 加载在 Next standalone 打包下失败 | 动态 `await import('ali-oss')`；若 prod 报错，加 `next.config` 的 `serverExternalPackages: ['ali-oss']` |
| Docker 部署忘挂卷 → storage 数据随容器重启丢失 | docker-compose.yml 显式卷 + CLAUDE.md 部署步骤两处提醒 |
| HMAC 密钥泄漏 → token 伪造 | 独立 `UPLOAD_SECRET`；fallback 派生 `sha256(JWT_SECRET+':upload')` 域分离；.env.example 占位提示 |
| 广场匿名签名 URL 爬虫 | 1h TTL + 限流（GAP-CRTR-059 另排） |
| 写时 5min 窗口内同 key 覆盖 | uid 绑定阻断外人；合法用户重传覆盖自己是预期 |
| Magic-bytes 只检头不检尾，藏 shell/script 风险 | 不允许 SVG；其他格式头校验后，静态资源不被浏览器当代码执行，CSP 未来主题兜底 |
| 迁移脚本未跑 → audioUrl 带前导 `/` | `toSignedUrl` 内 `replace(/^\//, '')` 兜底冗余 |
| 5 patch + 6 API + 前端协议变化回归风险 | 独立 commit + 每 patch 跑 dev server 冒烟 + 集成测试 |

## 完整文件清单

### 新建（8 个 + 1 组 fixture）

- `src/lib/signature.ts` — HMAC/OSS 统一签名（~80 行）
- `src/lib/oss-client.ts` — ali-oss 单例（~20 行）
- `src/lib/magic-bytes.ts` — 头部字节校验（~50 行）
- `src/lib/signed-url.ts` — `toSignedUrl(key, userId?)` 包装（~15 行）
- `src/app/api/files/[...path]/route.ts` — 文件网关 GET（~50 行）
- `scripts/theme5-cleanup.sql` — 脏数据清理（~5 行）
- `storage/uploads/.gitkeep` — 目录占位
- `tests/api/theme5.test.ts` — 集成测试（~250 行）
- `tests/fixtures/{audio,image,bad}/sample.*` — 5 个 fixture

### 修改（~19 个）

- `src/lib/upload.ts` — 收敛 token 生成，引入 userId 参数，移除 fileUrl
- `src/app/api/upload/token/route.ts` — 返回体 fileUrl → key
- `src/app/api/upload/local/[...path]/route.ts` — 验签 + magic-bytes + 写 storage/
- `src/app/api/creator/upload/route.ts` — 接收 key 作为 audioUrl/coverUrl
- `src/app/api/creator/assignments/[id]/submit/route.ts` — 同
- `src/app/(creator)/creator/upload/page.tsx` — 读 res.data.key
- `src/app/(creator)/creator/assignments/page.tsx` — 同
- `src/app/api/creator/songs/[id]/route.ts` — audioUrl 签名
- `src/app/api/review/songs/[id]/route.ts` — coverUrl/aiTools 重命名 + 签名
- `src/app/api/review/queue/route.ts` — audioUrl 签名
- `src/app/api/admin/songs/[id]/route.ts` — audioUrl/coverUrl 签名
- `src/app/api/admin/songs/route.ts` — list audioUrl/coverUrl
- `src/app/api/songs/published/route.ts` — 匿名签名
- `src/app/(reviewer)/review/assess/page.tsx` — cover → coverUrl、aiTool → aiTools
- `src/app/(creator)/creator/songs/page.tsx` — 删死字段 cover
- `src/middleware.ts` — `/api/files/` 加入 PUBLIC_PATHS
- `prisma/seed-test-users.ts` — audioUrl 去前导 `/`（若有）
- `.env.example` — 追加 UPLOAD_SECRET + STORAGE_ROOT 占位
- `CLAUDE.md` — Theme 5 部署步骤
- `docker-compose.yml`（若存在）— storage 卷挂载

## 后续

- 本设计通过后用 superpowers:writing-plans 产出 `docs/superpowers/plans/2026-04-21-theme5-upload-security.md`
- 实施按 Patch A → B → D → C → E 顺序独立 commit
- 合入后 Museek 平台对齐工作基础部分（Theme 1~7 全部 P0）完成，剩余 P1/P2 另行排期
