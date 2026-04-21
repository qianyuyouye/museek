# Theme 4: 发行链路自动化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `publish` 动作自动 fan-out 生成 `distributions` 待提交记录、把全站「发行平台」三处硬编码列表收敛到 `SystemSetting('platform_configs')` 单一真实来源、并把 `RevenueImport.platform` 从硬枚举松绑为 VARCHAR 动态白名单，打通 Phase 4 → Phase 5 断链（GAP-ADMIN-028 / 092 / 013 / 079）。

**Architecture:**
- 新增 `src/lib/platforms.ts`：统一读 `SystemSetting('platform_configs')`、归一化 `status|enabled` + `mapping|mapped` 两种历史键名、过滤空名、接入现成 `cache.ts` 做 5 分钟进程内 TTL 缓存，无配置时回落到 5 个传统平台（防破坏已有安装）。
- `src/app/api/admin/songs/[id]/status/route.ts` 的 `publish` 分支改走 `prisma.$transaction`：song.update + `distribution.createMany(skipDuplicates)`，其中每条初始 `status='pending'`，平台列表来自 `getEnabledPlatforms()`。
- `api/admin/distributions` 两个路由和 `admin/distributions/page.tsx` 改 `PLATFORMS` 常量为运行时读取；前端直接消费 API 已返回的 `data.platforms`。
- `prisma/schema.prisma` 把 `RevenueImport.platform` 从 `RevenuePlatform` enum 改成 `VarChar(50)`；`api/admin/revenue/imports/route.ts` 的 `VALID_PLATFORMS` 换成 `getEnabledPlatforms()` + 保留几个内部 key（`qishui` 等）向后兼容。
- 每次 PUT `platform_configs` 在 `api/admin/settings/route.ts` 调 `invalidate('platforms')` 保证变更即时生效。
- 不在本 Theme 处理 Decision 4 的 B 项（对账外部 API 接入）—— `publish-confirm/sync` 路由保持不动。

**Tech Stack:** Prisma / Next.js App Router / vitest（通过 `tests/api/_helpers.ts` 对本地 `localhost:3000` 发请求）。

---

## 文件结构

### 新建文件（2 个）

| 文件 | 职责 |
|---|---|
| `src/lib/platforms.ts` | 读取/归一/缓存 `platform_configs`，暴露 `getEnabledPlatforms()` / `isPlatformEnabled()` / `invalidatePlatforms()` |
| `tests/api/theme4-distribution-automation.test.ts` | Theme 4 端到端集成用例（publish → distributions 自动生成 + 平台白名单动态化） |

### 修改文件（7 个）

| 文件 | 修改点 |
|---|---|
| `prisma/schema.prisma` | `RevenueImport.platform` 由 `RevenuePlatform @default(qishui)` 改为 `String @default("qishui") @db.VarChar(50)`；删除或保留 `enum RevenuePlatform`（保留以便兼容既有 import 脚本） |
| `src/app/api/admin/songs/[id]/status/route.ts` | publish 分支包一层 `prisma.$transaction`，内部 `distribution.createMany(skipDuplicates)` |
| `src/app/api/admin/distributions/route.ts` | 移除顶部 `const PLATFORMS`；改用 `await getEnabledPlatforms()` |
| `src/app/api/admin/distributions/[songId]/route.ts` | 移除顶部 `const PLATFORMS = new Set(...)`；POST 校验用 `isPlatformEnabled()` |
| `src/app/(admin)/admin/distributions/page.tsx` | 删除顶部 `const PLATFORMS`；改读 `data?.platforms ?? []` 驱动列渲染 |
| `src/app/api/admin/settings/route.ts` | PUT 成功后若 keys 含 `platform_configs` 调 `invalidatePlatforms()` |
| `src/app/api/admin/revenue/imports/route.ts` | 移除 `VALID_PLATFORMS` 硬编码 Set；`platformStr` 校验改 `await isPlatformEnabled(platformStr, { allowLegacyKeys: true })`；`data.platform` 直接存字符串（不再 cast 成 enum） |

---

## 前置条件

1. main 已合并 Theme 3 权限系统修复（当前 HEAD `58d719c`）。
2. Prisma client 已生成 `DistributionStatus` 枚举（现存），`prisma.distribution` 有 `@@unique([songId, platform])` 复合键（现存 `schema.prisma:461`），`createMany(skipDuplicates:true)` 可直接用。
3. 本地 dev server `npm run dev` 可在 `http://localhost:3000` 起来；`seed-test-users` 跑过（admin/creator 13800001234/reviewer 13500008888）。
4. **外部对账 API 非本 Theme 目标**：Decision 4 明确砍到 A + C；`publish-confirm/sync` 路由不动。

---

## Task 1: 建立 `lib/platforms.ts` 单一真实来源

**Files:**
- Create: `src/lib/platforms.ts`
- Test: `tests/api/theme4-distribution-automation.test.ts`（Task 7 再写，Task 1 暂不测）

**背景：** 当前 3 处硬编码 `['QQ音乐', '网易云音乐', 'Spotify', 'Apple Music', '酷狗音乐']`（`api/admin/distributions/route.ts:5`, `api/admin/distributions/[songId]/route.ts:7`, `admin/distributions/page.tsx:9`）；settings 页「平台管理」tab 改了没用（GAP-ADMIN-013 / 079）。`system_settings.platform_configs` 的历史数据存在键名不一致：seed 种子默认 `{ name, region, enabled, mapped }`，UI state 用 `{ name, region, status, mapping }`。helper 必须同时吃两种格式。

- [ ] **Step 1: 从 main 切新分支**

```bash
cd "D:/Project/museek"
git checkout main && git pull
git checkout -b feature/theme4-distribution-automation
```

- [ ] **Step 2: 写 `src/lib/platforms.ts`**

```typescript
import { getSetting, SETTING_KEYS } from './system-settings'
import { cacheGet, invalidate } from './cache'

/** 无 DB 配置时回落平台列表（避免 fresh install 拿到空数组导致 /distributions 矩阵空列） */
const FALLBACK_PLATFORMS = ['QQ音乐', '网易云音乐', '酷狗音乐', 'Spotify', 'Apple Music']

/** RevenueImport.platform 向后兼容的内部 key（即使 platform_configs 未收录也放行） */
const LEGACY_IMPORT_KEYS = new Set(['qishui', 'qq_music', 'netease', 'spotify', 'apple_music', 'kugou'])

const CACHE_KEY = 'platforms'
const CACHE_TTL_MS = 5 * 60 * 1000

interface RawPlatformItem {
  name?: string
  region?: string
  status?: boolean
  enabled?: boolean
  mapping?: boolean
  mapped?: boolean
}

function normalizeItem(raw: RawPlatformItem): { name: string; enabled: boolean } | null {
  const name = (raw.name ?? '').trim()
  if (!name) return null
  const enabled = raw.enabled !== undefined ? !!raw.enabled : !!raw.status
  return { name, enabled }
}

async function loadPlatforms(): Promise<string[]> {
  const raw = await getSetting<RawPlatformItem[]>(SETTING_KEYS.PLATFORM_CONFIGS, [])
  if (!Array.isArray(raw) || raw.length === 0) return [...FALLBACK_PLATFORMS]
  const enabled = raw.map(normalizeItem).filter((x): x is { name: string; enabled: boolean } => !!x && x.enabled)
  if (enabled.length === 0) return [...FALLBACK_PLATFORMS]
  return enabled.map((x) => x.name)
}

/** 返回当前启用的平台名称列表（含 5 分钟缓存 + fallback） */
export async function getEnabledPlatforms(): Promise<string[]> {
  return cacheGet(CACHE_KEY, CACHE_TTL_MS, loadPlatforms)
}

interface IsEnabledOpts {
  /** RevenueImport 路由用：即使不在 platform_configs 里，几个历史 key 也放行 */
  allowLegacyKeys?: boolean
}

export async function isPlatformEnabled(name: string, opts: IsEnabledOpts = {}): Promise<boolean> {
  if (!name) return false
  if (opts.allowLegacyKeys && LEGACY_IMPORT_KEYS.has(name)) return true
  const list = await getEnabledPlatforms()
  return list.includes(name)
}

/** 管理员保存 platform_configs 后调用 */
export function invalidatePlatforms(): void {
  invalidate(CACHE_KEY)
}
```

- [ ] **Step 3: tsc 检查本文件**

```bash
npx tsc --noEmit
```

Expected: 无新错误。

- [ ] **Step 4: Commit**

```bash
git add src/lib/platforms.ts
git commit -m "feat(platforms): 新增 lib/platforms 单一真实来源（读 platform_configs + 5 分钟缓存 + 历史格式兼容）"
```

---

## Task 2: settings PUT 平台配置后失效 platforms 缓存

**Files:**
- Modify: `src/app/api/admin/settings/route.ts:126-131`

**背景：** settings route 的 PUT 改 `platform_configs` 后不 invalidate，其它路由仍吃 5 分钟缓存导致保存后「平台管理」立刻生效失败。

- [ ] **Step 1: 加 import**

在 `src/app/api/admin/settings/route.ts` 顶部 import 段加：

```typescript
import { invalidatePlatforms } from '@/lib/platforms'
```

- [ ] **Step 2: PUT 末尾 logAdminAction 之前加缓存失效**

定位到 `PUT` 函数 logAdminAction 调用前（约 line 125），在 for 循环结束后 + logAdminAction 之前插入：

```typescript
  if (settings.some((s) => s.key === SETTING_KEYS.PLATFORM_CONFIGS)) {
    invalidatePlatforms()
  }
```

（`SETTING_KEYS` 已在该文件顶部 import 过）

- [ ] **Step 3: tsc 检查**

```bash
npx tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/settings/route.ts
git commit -m "feat(settings): PUT platform_configs 后失效 platforms 缓存（让平台管理即时生效）"
```

---

## Task 3: `publish` 动作自动 fan-out 生成 distributions

**Files:**
- Modify: `src/app/api/admin/songs/[id]/status/route.ts:71-100`

**背景：** GAP-ADMIN-028：song 状态改 `published` 后不会写 distributions，导致「发行渠道管理」和「发行状态确认 · 待提交」tab 永远为空，Phase 5 断链。要求在同一事务里 publish 成功后批量 `createMany distributions`，每条 `{songId, platform, status: 'pending'}`。

- [ ] **Step 1: 加 import**

在 `src/app/api/admin/songs/[id]/status/route.ts` 顶部 import 段加：

```typescript
import { getEnabledPlatforms } from '@/lib/platforms'
```

- [ ] **Step 2: 改 publish 分支走 transaction**

定位到 line 71-100，整块替换为以下逻辑（保留 notify / logAdminAction / invalidate('dashboard') 不变）：

```typescript
  let distributionsCreated = 0
  if (action === 'publish') {
    const platforms = await getEnabledPlatforms()
    const result = await prisma.$transaction(async (tx) => {
      const song2 = await tx.platformSong.update({
        where: { id: songId },
        data: { status: transition.to },
      })
      const r = await tx.distribution.createMany({
        data: platforms.map((p) => ({ songId: song2.id, platform: p, status: 'pending' as const })),
        skipDuplicates: true,
      })
      return { song2, count: r.count }
    })
    distributionsCreated = result.count
  } else {
    await prisma.platformSong.update({
      where: { id: songId },
      data: { status: transition.to },
    })
  }

  // 看板统计依赖歌曲状态分布，写后立即失效
  invalidate('dashboard')

  try {
    if (action === 'publish') {
      await notify(song.userId, 'tpl.song_published', { songTitle: song.title, songId: song.id }, 'song', song.id)
    } else if (action === 'archive') {
      await notify(song.userId, 'tpl.song_archived', { songTitle: song.title, songId: song.id }, 'song', song.id)
    }
  } catch (e) {
    console.error('[notify] song status change failed:', e)
  }

  await logAdminAction(request, {
    action: `song_${action}`,
    targetType: 'platform_song',
    targetId: songId,
    detail: {
      title: song.title,
      copyrightCode: song.copyrightCode,
      from: song.status,
      to: transition.to,
      ...(action === 'publish' ? { distributionsCreated } : {}),
    },
  })
  return ok({ id: songId, status: transition.to, distributionsCreated: action === 'publish' ? distributionsCreated : undefined })
```

说明：
- publish 走事务；其他 action 保持单条 update 不变。
- `skipDuplicates: true` 处理 "archived → restore → publish 再 publish" 的幂等（同 songId+platform 已有行时跳过）。
- logAdminAction detail 补 `distributionsCreated`，便于排障。
- 返回 body 给前端一个可见的 `distributionsCreated` 字段（仅 publish）。

- [ ] **Step 3: tsc 检查**

```bash
npx tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/songs/[id]/status/route.ts
git commit -m "feat(songs/status): publish 成功后事务内批量生成 distributions (pending)（GAP-ADMIN-028）"
```

---

## Task 4: `api/admin/distributions/*` 去掉硬编码 PLATFORMS

**Files:**
- Modify: `src/app/api/admin/distributions/route.ts`
- Modify: `src/app/api/admin/distributions/[songId]/route.ts`

**背景：** GAP-ADMIN-013：两个路由各自硬编码同一组 5 个平台，新增「汽水音乐」等平台在矩阵里不出现、POST 校验还会 400。

- [ ] **Step 1: 改 `src/app/api/admin/distributions/route.ts`**

整文件替换为：

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, safeHandler} from '@/lib/api-utils'
import { getEnabledPlatforms } from '@/lib/platforms'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.distributions.view')
  if ('error' in auth) return auth.error

  const platforms = await getEnabledPlatforms()
  const platformSet = new Set(platforms)

  const songs = await prisma.platformSong.findMany({
    where: { status: 'published' },
    select: {
      id: true,
      title: true,
      coverUrl: true,
      distributions: {
        select: { platform: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const matrix: Record<number, Record<string, string>> = {}
  const songList = songs.map((s) => {
    const row: Record<string, string> = {}
    for (const p of platforms) row[p] = 'none'
    for (const d of s.distributions) {
      if (platformSet.has(d.platform)) row[d.platform] = d.status
    }
    matrix[s.id] = row
    return { id: s.id, title: s.title, cover: s.coverUrl }
  })

  return ok({ songs: songList, platforms, matrix })
})
```

- [ ] **Step 2: 改 `src/app/api/admin/distributions/[songId]/route.ts`**

在顶部 import 段加：

```typescript
import { isPlatformEnabled } from '@/lib/platforms'
```

删除顶部的：

```typescript
const PLATFORMS = new Set(['QQ音乐', '网易云音乐', 'Spotify', 'Apple Music', '酷狗音乐'])
```

把 POST 中的这一段：

```typescript
  if (!platform || !PLATFORMS.has(platform)) {
    return err('无效的平台名称')
  }
```

换成：

```typescript
  if (!platform || typeof platform !== 'string' || !(await isPlatformEnabled(platform))) {
    return err('无效的平台名称')
  }
```

- [ ] **Step 3: tsc 检查**

```bash
npx tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/distributions/route.ts src/app/api/admin/distributions/[songId]/route.ts
git commit -m "refactor(distributions): PLATFORMS 从 platform_configs 动态读取（GAP-ADMIN-013）"
```

---

## Task 5: 前端 distributions 页面去硬编码

**Files:**
- Modify: `src/app/(admin)/admin/distributions/page.tsx:9,115-123,136-155`

**背景：** 同 GAP-ADMIN-013；API 已返回 `data.platforms`，但页面仍读本地常量 `PLATFORMS`，导致新增平台不出现在矩阵列。

- [ ] **Step 1: 删除第 9 行**

```typescript
const PLATFORMS = ['QQ音乐', '网易云音乐', 'Spotify', 'Apple Music', '酷狗音乐']
```

整行删除。

- [ ] **Step 2: 组件内读 `data.platforms`**

在 `AdminDistributionsPage` 里 `const distributions` 定义之后、函数体内加：

```typescript
  const platforms = data?.platforms ?? []
```

- [ ] **Step 3: thead 渲染改用 `platforms`**

把 `{PLATFORMS.map((p) => (` 改成 `{platforms.map((p) => (`。（位于 thead tr 内，原 line ~115）

- [ ] **Step 4: tbody 渲染改用 `platforms`**

把 `{PLATFORMS.map((platform) => {` 改成 `{platforms.map((platform) => {`。（位于 tbody tr 内，原 line ~136）

- [ ] **Step 5: tsc 检查**

```bash
npx tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/admin/distributions/page.tsx"
git commit -m "refactor(distributions/page): 平台列表改读 API data.platforms，删硬编码"
```

---

## Task 6: `RevenueImport.platform` 解耦 enum → VarChar(50)

**Files:**
- Modify: `prisma/schema.prisma:314`（移除 enum 类型），`332-339`（删 enum 定义或保留）
- Modify: `src/app/api/admin/revenue/imports/route.ts:2,38-40,140,231`

**背景：** GAP-ADMIN-079：「平台管理」新增平台后，CSV 导入选该平台 → 400。根因是 `RevenuePlatform` 硬枚举。V6 diff 决定放开成 VARCHAR + 运行时白名单。

> **重要：** 仅改 schema 类型，DB 列类型 `VARCHAR(50)` 和既有 ENUM 的底层 MySQL 列类型实际一致；`prisma db push` 不会丢数据。先备份或在 dev 数据库跑。

- [ ] **Step 1: 改 `prisma/schema.prisma:312-330`**

把：

```prisma
model RevenueImport {
  id             Int           @id @default(autoincrement())
  platform       RevenuePlatform @default(qishui)
  fileName       String        @map("file_name") @db.VarChar(200)
  ...
}
```

改为：

```prisma
model RevenueImport {
  id             Int           @id @default(autoincrement())
  platform       String        @default("qishui") @db.VarChar(50)
  fileName       String        @map("file_name") @db.VarChar(200)
  ...
}
```

（仅改 `platform` 那一行，其他字段原样保留。）

- [ ] **Step 2: 保留 `enum RevenuePlatform` 定义**

332-339 行的 `enum RevenuePlatform { ... }` **保留**（删了如果还有别的代码 import 会报 tsc 错；保留当遗留无害）。若 `npx tsc --noEmit` 之后 grep 出来确认无引用再删（见 Step 5）。

- [ ] **Step 3: `prisma db push` + 生成 client**

```bash
npx prisma db push
npx prisma generate
```

Expected: `✔ Generated Prisma Client`，无报错。MySQL 底层 `revenue_imports.platform` 列类型从 enum 变 varchar(50)。

- [ ] **Step 4: 改 `src/app/api/admin/revenue/imports/route.ts`**

1) 删除第 2 行的 `RevenuePlatform` import：

```typescript
import { Prisma, RevenuePlatform } from '@prisma/client'
```

改为：

```typescript
import { Prisma } from '@prisma/client'
```

2) 顶部 import 段加：

```typescript
import { isPlatformEnabled } from '@/lib/platforms'
```

3) 删除 38-40 行的硬编码 Set：

```typescript
const VALID_PLATFORMS = new Set<string>([
  'qishui', 'qq_music', 'netease', 'spotify', 'apple_music', 'kugou',
])
```

整块删除。

4) 定位到原 line 140（`if (!VALID_PLATFORMS.has(platformStr)) return err('无效的平台')`），替换为：

```typescript
  if (!(await isPlatformEnabled(platformStr, { allowLegacyKeys: true }))) return err('无效的平台')
```

5) 定位到原 line 231（`platform: platformStr as RevenuePlatform,`），改为：

```typescript
      platform: platformStr,
```

（去掉 cast；现在字段就是 String。）

- [ ] **Step 5: grep 确认 `RevenuePlatform` 无其他 import 处**

使用 Grep 工具搜 pattern `RevenuePlatform`，预期仅剩 `prisma/schema.prisma` 自己的 enum 定义行。若确认无其它 import，schema 里的 enum 定义也可删除；有引用就保留。

- [ ] **Step 6: tsc 检查**

```bash
npx tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/app/api/admin/revenue/imports/route.ts
git commit -m "refactor(revenue/imports): RevenuePlatform enum 改 VarChar(50) 动态白名单（GAP-ADMIN-079）"
```

---

## Task 7: 集成测试

**Files:**
- Create: `tests/api/theme4-distribution-automation.test.ts`

**背景：** 闭环验证 publish 后自动生成 distributions + 平台配置动态生效；放在单独文件便于与已有 `admin-content-dist.test.ts` / `settings-publish.test.ts` 并行执行不冲突。

**前置：** dev server 在 `localhost:3000` 跑着；seed-test-users 执行过。测试用例自行创建所需歌曲（避免污染既有 fixture）。

- [ ] **Step 1: 写测试文件**

`tests/api/theme4-distribution-automation.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { http, adminLogin, creatorLogin, expectOk } from './_helpers'
import { prisma } from '@/lib/prisma'

let adminCookie = ''
let creatorCookie = ''
let creatorId = 0
let songId = 0

const ISRC = `CN-T4A-26-${Date.now().toString().slice(-5)}`
const SUFFIX = Date.now().toString().slice(-6)

describe('Theme 4 · 发行链路自动化', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    const creator = await creatorLogin()
    creatorCookie = creator.cookie
    creatorId = creator.userId!

    // 确保 creator 已签约 + 实名（publish 校验会卡这两项）
    await prisma.user.update({
      where: { id: creatorId },
      data: { agencyContract: true, realNameStatus: 'verified' },
    })

    // 造一首 reviewed 的歌：直接 DB 插，绕开 upload 流程
    const created = await prisma.platformSong.create({
      data: {
        userId: creatorId,
        title: `theme4-${SUFFIX}`,
        status: 'reviewed',
        copyrightCode: `T4-${SUFFIX}`,
        isrc: ISRC,
      },
    })
    songId = created.id

    // 清理该歌曲上可能遗留的 distribution 记录（rerun 防污染）
    await prisma.distribution.deleteMany({ where: { songId } })
  })

  afterAll(async () => {
    await prisma.distribution.deleteMany({ where: { songId } })
    await prisma.platformSong.delete({ where: { id: songId } }).catch(() => {})
  })

  it('TC-T4-001 publish 成功后自动批量创建 distributions（pending）', async () => {
    const r = await http(`/api/admin/songs/${songId}/status`, {
      method: 'POST',
      cookie: adminCookie,
      body: { action: 'publish' },
    })
    expectOk(r, 'publish')
    expect(r.json.data.distributionsCreated).toBeGreaterThan(0)

    const dists = await prisma.distribution.findMany({ where: { songId } })
    expect(dists.length).toBe(r.json.data.distributionsCreated)
    expect(dists.every((d) => d.status === 'pending')).toBe(true)

    const platforms = new Set(dists.map((d) => d.platform))
    expect(platforms.size).toBe(dists.length) // 无重复
  })

  it('TC-T4-002 /api/admin/distributions 返回的 platforms 驱动矩阵列', async () => {
    const r = await http('/api/admin/distributions', { cookie: adminCookie })
    expectOk(r, 'distributions list')
    const platforms = r.json.data.platforms as string[]
    expect(Array.isArray(platforms)).toBe(true)
    expect(platforms.length).toBeGreaterThan(0)

    // 新建歌曲应在 songs 列表里，matrix 该歌每个平台都有一个 status 值
    const row = r.json.data.matrix?.[songId] as Record<string, string> | undefined
    expect(row).toBeTruthy()
    for (const p of platforms) expect(row![p]).toBeDefined()
  })

  it('TC-T4-003 platform_configs 保存后 /distributions 即时反映新平台', async () => {
    const newPlatform = `测试平台_${SUFFIX}`
    const current = await prisma.systemSetting.findUnique({ where: { key: 'platform_configs' } })
    const snapshot = current?.value ?? null

    try {
      const payload = [
        { name: 'QQ音乐', region: '中国', status: true, mapping: true },
        { name: '网易云音乐', region: '中国', status: true, mapping: true },
        { name: '酷狗音乐', region: '中国', status: true, mapping: false },
        { name: 'Spotify', region: '全球', status: true, mapping: true },
        { name: 'Apple Music', region: '全球', status: true, mapping: false },
        { name: newPlatform, region: '中国', status: true, mapping: false },
      ]
      const put = await http('/api/admin/settings', {
        method: 'PUT',
        cookie: adminCookie,
        body: { settings: [{ key: 'platform_configs', value: payload }] },
      })
      expectOk(put, 'save platform_configs')

      const r = await http('/api/admin/distributions', { cookie: adminCookie })
      expectOk(r, 'distributions after save')
      expect((r.json.data.platforms as string[])).toContain(newPlatform)
    } finally {
      if (snapshot !== null) {
        await prisma.systemSetting.update({
          where: { key: 'platform_configs' },
          data: { value: snapshot as any },
        })
      } else {
        await prisma.systemSetting.delete({ where: { key: 'platform_configs' } }).catch(() => {})
      }
      // 保存后主动失效缓存，让后续用例读到恢复后的数据
      await http('/api/admin/settings', {
        method: 'PUT',
        cookie: adminCookie,
        body: { settings: [{ key: 'platform_configs', value: snapshot ?? [] }] },
      }).catch(() => {})
    }
  })

  it('TC-T4-004 POST /distributions/:id 校验未知平台 → 400', async () => {
    const r = await http(`/api/admin/distributions/${songId}`, {
      method: 'POST',
      cookie: adminCookie,
      body: { platform: '不存在的平台', status: 'pending' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('平台')
  })

  it('TC-T4-005 revenue imports 接受 legacy key qishui（向后兼容）', async () => {
    const r = await http('/api/admin/revenue/imports', {
      method: 'POST',
      cookie: adminCookie,
      body: { fileName: `legacy-${SUFFIX}.csv`, platform: 'qishui', period: '2026-Q1' },
    })
    expectOk(r, 'legacy import')
    expect(r.json.data.platform).toBe('qishui')
    // 清理
    await prisma.revenueImport.delete({ where: { id: r.json.data.id } }).catch(() => {})
  })
})
```

- [ ] **Step 2: 起 dev server**

```bash
npm run dev
```

等待 "Ready"，保持 terminal 不关。

- [ ] **Step 3: 另开 terminal 跑测试**

```bash
cd "D:/Project/museek"
npx vitest run tests/api/theme4-distribution-automation.test.ts
```

Expected: 全部 5 条用例 PASS。

- [ ] **Step 4: 若 TC-T4-003 失败（缓存未失效）**

检查 Task 2 是否实际生效：`src/app/api/admin/settings/route.ts` 应在 PUT 成功后对 `platform_configs` 调 `invalidatePlatforms()`。

- [ ] **Step 5: Commit**

```bash
git add tests/api/theme4-distribution-automation.test.ts
git commit -m "test(theme4): 发行自动化 + 平台配置动态化 5 条集成用例"
```

---

## Task 8: 回归 + 终审

**背景：** 确认改动没打破 `admin-content-dist`（原来断言 `platforms` 是 Array）、`settings-publish`、`permission-matrix` 等存量测试；最后把 feature branch 并回 main。

- [ ] **Step 1: 全量跑 tsc**

```bash
npx tsc --noEmit
```

Expected: 0 errors。

- [ ] **Step 2: 跑所有 API 测试**

dev server 仍在 `localhost:3000` 跑着，另开 terminal：

```bash
cd "D:/Project/museek"
npx vitest run
```

Expected: 全部 PASS。如有回归，看以下常见坑：
- `admin-content-dist.test.ts` line 99-101：断言 `r.json.data.platforms` 是 Array（仍应通过）。
- `settings-publish.test.ts` 若存在依赖 `platform_configs` 形状的断言：新 helper 已兼容两种格式（enabled/status），不应破坏。
- `tests/api/permission-*`：Theme 3 刚改过，应仍稳。

- [ ] **Step 3: 人工回归：3 条黄金路径**

1. 登录 admin（`http://localhost:3000/admin/login`，`admin/Abc12345`）。
2. `/admin/settings` → 平台管理 tab → 新增「测试平台」→ 保存 → `/admin/distributions` 看矩阵头是否多一列。
3. `/admin/songs` 挑一首 `ready_to_publish` 歌（需 creator 签约+实名+ISRC），点发行 → `/admin/distributions` 看该歌曲行各平台格是否都是「待提交」；再到 `/admin/publish-confirm?status=pending` 确认新记录在列。
4. 回 `/admin/settings` 删除「测试平台」→ 保存 → `/admin/distributions` 矩阵该列消失（已有 distribution 记录仍在 DB，不会自动删；矩阵只不再显示该列）。

若 3 条黄金路径全过，进 Step 4。

- [ ] **Step 4: 进 superpowers:requesting-code-review skill 做自审**

参考 `Skill` 调用：

```
Skill: superpowers:requesting-code-review
```

回顾 7 项改动是否覆盖 GAP-ADMIN-028 / 092 / 013 / 079，对照 spec 条目 § Theme 4 补齐动作。

- [ ] **Step 5: 合并到 main**

```bash
git checkout main
git merge --no-ff feature/theme4-distribution-automation -m "Merge Theme 4: 发行链路自动化（GAP-ADMIN-028/013/079/092）"
```

（**不 push**，按项目规则只在用户明确要求时 push。）

- [ ] **Step 6: 更新 Theme 进度标记**

把 `docs/superpowers/specs/2026-04-20-platform-alignment-gap-list.md` 顶部元数据或 Executive Summary 加一句 Theme 4 已完成；或由用户在后续会话自行处理。

---

## 覆盖校验（Self-Review）

| Spec 要求 | 对应 Task | 验证点 |
|---|---|---|
| GAP-ADMIN-028 publish 后自动创建 distributions | Task 3 + TC-T4-001 | `distributionsCreated > 0` + DB 查有 pending 记录 |
| GAP-ADMIN-092 与 028 联动（一键生成 pending） | Task 3 | 同上；不再需要矩阵手点 pending |
| GAP-ADMIN-013 PLATFORMS 三处硬编码 → SystemSetting 单一来源 | Task 1 / 4 / 5 + TC-T4-002 + TC-T4-003 | 全文 grep 无 `['QQ音乐'` 硬编码 |
| GAP-ADMIN-079 RevenuePlatform 硬枚举 → 动态白名单 | Task 6 + TC-T4-005 | schema 字段已改 VarChar(50) + legacy key 放行 |
| Decision 4 = A+C（不做 B 外部 API 接入） | 无 | `publish-confirm/sync` 路由保持不改 |
| 平台变更即时生效 | Task 2 + TC-T4-003 | PUT platform_configs 后 `/distributions` 立刻看到新平台 |
| 向后兼容（fresh install 未配 platform_configs） | Task 1 FALLBACK_PLATFORMS | 空配置回落 5 个传统平台 |

## 非范围（明确不做）

- GAP-ADMIN-012（sync 外部 HTTP 接入）：Decision 4 砍掉 B，后续 Theme。
- GAP-ADMIN-011（`data_confirmed` 伪状态）：P1 孤立项，后续单独修。
- GAP-ADMIN-014（发行 Modal 加 url 输入）：P1，与 theme 关联度低。
- GAP-ADMIN-080（报表字段映射 UI）：P1 settings 配置项，不在 theme 4。

---

## 执行建议

完成本 plan 后按三端对齐检查：
- **管理端**：`/admin/distributions`、`/admin/publish-confirm`、`/admin/settings`（平台管理 tab）、`/admin/revenue/imports` 全部响应。
- **创作者端**：作品发行后在 `/creator/songs` 看状态 `published`；`/creator/notifications` 收到 `tpl.song_published`（Theme 2 已就绪，顺带验证）。
- **评审端**：无变化（发行不经评审路由）。

Plan 完成后可 handoff 到 subagent-driven-development / executing-plans 任一 skill 执行。
