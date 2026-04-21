# Theme 6: 字段契约对齐 + 歌曲默认填充 + 版权序号原子递增 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 9 条 P0/P1（GAP-CRTR-011/016/020/004, GAP-ADMIN-010/008/100/029, GAP-SCHM-005），消除前后端字段错位导致的 UI undefined/硬编码 0/随机版权号，让上传表单默认带 performer/album 字段，并把版权号改为年度原子递增。

**Architecture:** 4 独立 patch 结构。A 纯前端字段别名（4 处一行改）+ B 后端补真值（_count 关联 + 重置密码明文返回）+ C 歌曲默认值 helper（fillSongDefaults）+ 2 表单新增 5 输入框 + D `copyright_sequences` 单行表 + `nextCopyrightCode(tx)` helper + 2 路由调用点。按 TDD：每 Task 先写失败测试，再实现，最后 green + commit。

**Tech Stack:** Next.js 15 App Router + Prisma + MySQL 8（`SELECT ... FOR UPDATE` 行锁）+ React 19 + Vitest（集成测试跑在本地 dev server）

---

## File Structure

改动严格限制在以下文件（不动相邻模块）：

| 文件 | 动作 | Patch | 责任 |
|---|---|---|---|
| `src/app/(creator)/creator/notifications/page.tsx` | 修改 | A | `n.time` → `n.createdAt` + Intl.DateTimeFormat 渲染 |
| `src/app/(creator)/creator/community/page.tsx` | 修改 | A | type 补 `coverUrl`，渲染 `<img>` 替代 emoji 渐变 |
| `src/app/(creator)/creator/songs/page.tsx` | 修改 | A | type `aiTool` 改 `aiTools?: string[]` + join(', ') |
| `src/app/(admin)/admin/publish-confirm/page.tsx` | 修改 | A | type `songTitle/songCover` → `title/coverUrl` |
| `src/app/api/admin/publish-confirm/route.ts` | 修改 | A | list response 补 `coverUrl: d.song.coverUrl` |
| `src/app/api/admin/accounts/route.ts` | 修改 | B1 | findMany 补 `_count: { songs }` + list.map 补 `songCount` |
| `src/app/api/admin/accounts/[id]/reset-password/route.ts` | 修改 | B2 | 自动生成分支返回 `{ password: plaintext }` 代替 masked |
| `src/app/(admin)/admin/accounts/page.tsx` | 修改 | B2 | 读 `data.password` 弹框 30 秒复制提示 |
| `src/lib/song-defaults.ts` | 新建 | C | `fillSongDefaults(body, user)` pure helper |
| `src/app/api/creator/upload/route.ts` | 修改 | C+D | `fillSongDefaults` + `nextCopyrightCode(tx)` |
| `src/app/api/creator/assignments/[id]/submit/route.ts` | 修改 | C+D | 同上 |
| `src/app/(creator)/creator/upload/page.tsx` | 修改 | C | 高级信息折叠区 + 5 Input + useEffect 预填 |
| `src/app/(creator)/creator/assignments/page.tsx` | 修改 | C | 同上 |
| `src/lib/copyright-code.ts` | 新建 | D | `nextCopyrightCode(tx)` INSERT IGNORE + SELECT FOR UPDATE |
| `prisma/schema.prisma` | 修改 | D | +model CopyrightSequence |
| `tests/api/theme6.test.ts` | 新建 | all | 集成测试（9 用例） |

---

## 前置准备：测试文件脚手架

**Files:**
- Create: `tests/api/theme6.test.ts`

- [ ] **Step 1: 建测试文件骨架**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, expectOk } from './_helpers'
import { prisma } from '@/lib/prisma'

let adminCookie = ''
let creatorCookie = ''
let creatorUserId = 0

describe('Theme 6 field-contract + defaults + copyright', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    const login = await creatorLogin()
    creatorCookie = login.cookie
    creatorUserId = login.userId!
  })

  // Patch B1 & B2 tests
  // Patch C tests
  // Patch D tests
})
```

- [ ] **Step 2: 确认 dev server 启动**

```bash
npm run dev
```

等待看到 `Ready in ...` 字样后再跑测试（端口 3000）。

- [ ] **Step 3: commit 骨架**

```bash
git add tests/api/theme6.test.ts
git commit -m "test(theme6): 建集成测试骨架"
```

---

## Patch A — 前端字段别名对齐（4 处纯前端改动）

Patch A 的所有 4 小改都是纯前端读字段错位。策略：**一口气改完 4 处 + API 补一个字段 + 一次 commit**，不拆 TDD（A 的断言用静态 grep 覆盖，不跑集成测试）。

### Task A1: 消息中心 `n.time` → `n.createdAt`

**Files:**
- Modify: `src/app/(creator)/creator/notifications/page.tsx:164`

- [ ] **Step 1: 定位现场**

```bash
grep -n "n\.time" src/app/\(creator\)/creator/notifications/page.tsx
```

预期看到 164 行：`{n.time} | {TYPE_LABEL[n.type]}`

- [ ] **Step 2: 改读 createdAt + 格式化**

把 164 行替换为：

```tsx
                  {new Date(n.createdAt).toLocaleString('zh-CN', { hour12: false })} | {TYPE_LABEL[n.type]}
```

同时确保本文件顶部的 Notification 类型定义里有 `createdAt: string`（可能已有；若用的是 `time`，改为 `createdAt`）。

- [ ] **Step 3: 回归 grep**

```bash
grep -rn "n\.time\b" "src/app/(creator)/creator/notifications/"
```

预期：无输出。

---

### Task A2: 作品广场封面 `song.cover` → `song.coverUrl`

**Files:**
- Modify: `src/app/(creator)/creator/community/page.tsx:36-46,117-122`

当前 type 把 `cover: string` 当 emoji map key 用，实际 API 只返 `coverUrl`。改为：有 `coverUrl` 时渲染 `<img>`，否则回落默认渐变。

- [ ] **Step 1: 修改 type**

文件顶部 `interface PublishedSong` 里 `cover: string` 改为：

```tsx
interface PublishedSong {
  id: number
  userId: number
  title: string
  genre: string
  coverUrl: string | null
  score: number | null
  likeCount: number
  copyrightCode: string
  authorName?: string
}
```

- [ ] **Step 2: 修改渲染**

第 117-122 行原：

```tsx
      <div
        className="..."
        style={{ background: COVER_GRADIENTS[song.cover] || DEFAULT_GRADIENT }}
      >
        <span className="text-[56px]">
          {song.cover}
        </span>
      </div>
```

改为：

```tsx
      <div
        className="..."
        style={song.coverUrl ? undefined : { background: DEFAULT_GRADIENT }}
      >
        {song.coverUrl ? (
          <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[56px]">🎵</span>
        )}
      </div>
```

`COVER_GRADIENTS` 常量不再使用，但保留（方便回滚；下游任务如有需要可一并删）。

- [ ] **Step 3: 回归 grep**

```bash
grep -rn "song\.cover\b" "src/app/(creator)/creator/community/"
```

预期：无输出（全部替换为 `song.coverUrl`）。

- [ ] **Step 4: 类型检查**

```bash
npx tsc --noEmit
```

预期：0 错误。

---

### Task A3: 创作者作品库 `song.aiTool` → `song.aiTools`

**Files:**
- Modify: `src/app/(creator)/creator/songs/page.tsx:19,233`

- [ ] **Step 1: 改 type**

第 19 行 `aiTool: string` 改为：

```tsx
  aiTools?: string[] | null
```

- [ ] **Step 2: 改消费点**

第 233 行 `['AI工具', song.aiTool],` 改为：

```tsx
                  ['AI工具', (song.aiTools ?? []).join(', ') || '—'],
```

- [ ] **Step 3: 回归 grep**

```bash
grep -rn "song\.aiTool\b" "src/app/(creator)/creator/songs/"
```

预期：无输出（`aiTools` 带 s 的不会匹配）。

---

### Task A4: 发行状态确认页 `songTitle/songCover` → `title/coverUrl`

涉及前端 + API 两边：API list 当前只返 `title`，需要补 `coverUrl`。

**Files:**
- Modify: `src/app/api/admin/publish-confirm/route.ts:73-89`
- Modify: `src/app/(admin)/admin/publish-confirm/page.tsx:24-25,132-139,301`

- [ ] **Step 1: API list 补 coverUrl**

`src/app/api/admin/publish-confirm/route.ts` 里 findMany 的 select 确保拉到 coverUrl。先看第 25-35 行 select 块（原查询已 include song），确认 `coverUrl: true` 存在；若缺，补上。

然后第 81 行附近的 map 返回体，在 `title: d.song.title,` 下方追加一行：

```typescript
      coverUrl: d.song.coverUrl,
```

（如果 list 映射里 song 的 select 没有 coverUrl，先补 select）。

- [ ] **Step 2: 前端 type**

`src/app/(admin)/admin/publish-confirm/page.tsx` 第 24-25 行：

```tsx
  songTitle: string
  songCover: string
```

改为：

```tsx
  title: string
  coverUrl: string | null
```

- [ ] **Step 3: 前端列定义**

第 132-139 行 render 逻辑（找到 key: 'songTitle' 列）改为：

```tsx
    {
      key: 'title',
      title: '歌曲',
      render: (_: unknown, t: Track) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t.coverUrl ? (
            <img src={t.coverUrl} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
          ) : null}
          <span style={{ fontWeight: 600 }}>{t.title}</span>
        </div>
      ),
    },
```

- [ ] **Step 4: 详情行（第 301 行附近）**

原：

```tsx
['歌曲', `${detailTrack.songCover} ${detailTrack.songTitle}`],
```

改为：

```tsx
['歌曲', detailTrack.title],
```

（封面不再作为文字拼接）

- [ ] **Step 5: 回归 grep**

```bash
grep -rn "songTitle\|songCover" "src/app/(admin)/admin/publish-confirm/"
```

预期：无输出。

- [ ] **Step 6: 类型检查**

```bash
npx tsc --noEmit
```

预期：0 错误。

---

### Task A5: Patch A commit

- [ ] **Step 1: commit**

```bash
git add \
  "src/app/(creator)/creator/notifications/page.tsx" \
  "src/app/(creator)/creator/community/page.tsx" \
  "src/app/(creator)/creator/songs/page.tsx" \
  "src/app/(admin)/admin/publish-confirm/page.tsx" \
  "src/app/api/admin/publish-confirm/route.ts"
git commit -m "fix(ui): 4 处前端字段名对齐（GAP-CRTR-011/016/020, GAP-ADMIN-010）"
```

---

## Patch B — 后端补真值（2 个 API）

### Task B1: admin/accounts 返回 songCount（GAP-ADMIN-100）

**Files:**
- Modify: `src/app/api/admin/accounts/route.ts:33-44,74-89`
- Test: `tests/api/theme6.test.ts`

- [ ] **Step 1: 先写失败集成测试**

在 `tests/api/theme6.test.ts` 的 describe 块内追加：

```typescript
  describe('B1: /api/admin/accounts songCount (GAP-ADMIN-100)', () => {
    it('GET /api/admin/accounts?tab=creator 每条 list 项含 songCount 数字', async () => {
      const r = await http('/api/admin/accounts?tab=creator&pageSize=50', { cookie: adminCookie })
      expectOk(r, 'accounts creator tab')
      const list = r.json.data.list as Array<{ type: string; songCount: number }>
      expect(list.length).toBeGreaterThan(0)
      expect(list.every((u) => typeof u.songCount === 'number')).toBe(true)
    })

    it('songCount 与 platformSong 关联表真实计数一致', async () => {
      const r = await http('/api/admin/accounts?tab=creator&pageSize=100', { cookie: adminCookie })
      const list = r.json.data.list as Array<{ id: number; songCount: number }>
      // 任选一位有作品的 creator 交叉校验
      const firstWithSongs = list.find((u) => u.songCount > 0)
      if (!firstWithSongs) return
      const actual = await prisma.platformSong.count({ where: { userId: firstWithSongs.id } })
      expect(firstWithSongs.songCount).toBe(actual)
    })
  })
```

- [ ] **Step 2: 跑失败**

```bash
npx vitest run tests/api/theme6.test.ts -t "B1"
```

预期：`expected undefined to be a number`（当前 API 不返 songCount）。

- [ ] **Step 3: 修改 API**

`src/app/api/admin/accounts/route.ts` 里 findMany 的 include 块（第 38-43 行）：

```typescript
      include: {
        userGroups: {
          include: { group: { select: { id: true, name: true } } },
        },
      },
```

改为：

```typescript
      include: {
        userGroups: {
          include: { group: { select: { id: true, name: true } } },
        },
        _count: { select: { songs: true } },
      },
```

然后 list.map 第 74-89 行的 return 对象末尾（`...(tab === 'reviewer' ? ...)` 之前）追加：

```typescript
    songCount: u._count.songs,
```

- [ ] **Step 4: 跑绿**

```bash
npx vitest run tests/api/theme6.test.ts -t "B1"
```

预期：两条用例均通过。

- [ ] **Step 5: commit**

```bash
git add src/app/api/admin/accounts/route.ts tests/api/theme6.test.ts
git commit -m "feat(admin/accounts): 返回 songCount 真值，消除 UI fallback 0（GAP-ADMIN-100）"
```

---

### Task B2: 重置密码返回明文（GAP-ADMIN-008）

**Files:**
- Modify: `src/app/api/admin/accounts/[id]/reset-password/route.ts:63-74`
- Modify: `src/app/(admin)/admin/accounts/page.tsx`（弹框接收 password）
- Test: `tests/api/theme6.test.ts`

- [ ] **Step 1: 先写失败集成测试**

追加到 describe 块：

```typescript
  describe('B2: reset-password 返回明文（GAP-ADMIN-008）', () => {
    it('POST /admin/accounts/:id/reset-password 自动生成时返回 data.password 8+ 位明文', async () => {
      // 先拿一个非 admin 的 creator 用户
      const listRes = await http('/api/admin/accounts?tab=creator&pageSize=1', { cookie: adminCookie })
      const target = (listRes.json.data.list as Array<{ id: number }>)[0]
      expect(target).toBeTruthy()

      const r = await http(`/api/admin/accounts/${target.id}/reset-password`, {
        method: 'POST',
        body: {},
        cookie: adminCookie,
      })
      expectOk(r, 'reset-password generated')
      expect(r.json.data.generated).toBe(true)
      expect(typeof r.json.data.password).toBe('string')
      expect((r.json.data.password as string).length).toBeGreaterThanOrEqual(8)
      expect(/[A-Za-z]/.test(r.json.data.password)).toBe(true)
      expect(/\d/.test(r.json.data.password)).toBe(true)
    })

    it('POST 带 password 参数时不回传明文（管理员已知原值）', async () => {
      const listRes = await http('/api/admin/accounts?tab=creator&pageSize=1', { cookie: adminCookie })
      const target = (listRes.json.data.list as Array<{ id: number }>)[0]

      const r = await http(`/api/admin/accounts/${target.id}/reset-password`, {
        method: 'POST',
        body: { password: 'Admin9999' },
        cookie: adminCookie,
      })
      expectOk(r, 'reset-password specified')
      expect(r.json.data.generated).toBe(false)
      expect(r.json.data.password).toBeUndefined()
    })
  })
```

- [ ] **Step 2: 跑失败**

```bash
npx vitest run tests/api/theme6.test.ts -t "B2"
```

预期：第一条 fail `expected undefined to be a string`（当前返 masked 不返 password）。

- [ ] **Step 3: 修改 API**

`src/app/api/admin/accounts/[id]/reset-password/route.ts` 第 63-74 行替换为：

```typescript
  // 自动生成密码回传一次明文，供管理员复制并通过安全渠道下发给用户
  // - 自动生成：返回 password 明文 + 提示 UI 弹框复制（30 秒内）
  // - 管理员指定：不回传（操作者已知原值）
  if (isGenerated && password) {
    return ok({
      generated: true,
      password,
      message: '新密码已生成，请在弹窗内复制后通过安全渠道发送给用户',
    })
  }
  return ok({ generated: false, message: '密码已重置' })
```

`masked` 本地变量和赋值可删除。

- [ ] **Step 4: 前端弹框接收明文**

`src/app/(admin)/admin/accounts/page.tsx` 里原本读 `data.masked` 的弹框逻辑改读 `data.password`。定位命令：

```bash
grep -n "masked\|resetResult\|data\.password" "src/app/(admin)/admin/accounts/page.tsx"
```

把 `data.masked` 改为 `data.password`，并把弹框文案从 "完整密码请通过短信..." 改为 "请在 30 秒内复制上方密码"。如果弹框目前不存在，追加一个简单 alert/toast 展示 password 即可（不强求酷炫 UI，PRD §3 要求"可见+可复制"就够）。

- [ ] **Step 5: 跑绿**

```bash
npx vitest run tests/api/theme6.test.ts -t "B2"
```

预期：两条用例均通过。

- [ ] **Step 6: 类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: commit**

```bash
git add \
  src/app/api/admin/accounts/\[id\]/reset-password/route.ts \
  "src/app/(admin)/admin/accounts/page.tsx" \
  tests/api/theme6.test.ts
git commit -m "fix(admin/reset-password): 自动生成密码回传 password 明文（GAP-ADMIN-008）"
```

---

## Patch C — 歌曲默认字段 helper + 表单补字段

### Task C1: 新建 `fillSongDefaults` helper

**Files:**
- Create: `src/lib/song-defaults.ts`
- Test: `tests/api/theme6.test.ts`

- [ ] **Step 1: 先写失败单测**

在 `tests/api/theme6.test.ts` 最顶部追加（外层 describe 之前）：

```typescript
import { fillSongDefaults } from '@/lib/song-defaults'
```

然后在 describe 块外再新增一个 describe（纯单元测试）：

```typescript
describe('fillSongDefaults helper (GAP-CRTR-004 / GAP-SCHM-005)', () => {
  const user = { realName: '张三', name: 'zhangsan' }

  it('空字段回落 realName', () => {
    const r = fillSongDefaults({ title: '新歌' }, user)
    expect(r.performer).toBe('张三')
    expect(r.lyricist).toBe('张三')
    expect(r.composer).toBe('张三')
    expect(r.albumArtist).toBe('张三')
  })

  it('空 albumName 回落 title', () => {
    const r = fillSongDefaults({ title: '新歌' }, user)
    expect(r.albumName).toBe('新歌')
  })

  it('非空字段保留', () => {
    const r = fillSongDefaults({ title: '新歌', performer: '编曲师' }, user)
    expect(r.performer).toBe('编曲师')
  })

  it('realName 为空时用 name', () => {
    const r = fillSongDefaults({ title: '新歌' }, { realName: null, name: 'zhangsan' })
    expect(r.performer).toBe('zhangsan')
  })

  it('空白字符串视作未填', () => {
    const r = fillSongDefaults({ title: '新歌', performer: '   ' }, user)
    expect(r.performer).toBe('张三')
  })
})
```

- [ ] **Step 2: 跑失败**

```bash
npx vitest run tests/api/theme6.test.ts -t "fillSongDefaults"
```

预期：import 报错 `Cannot find module '@/lib/song-defaults'`。

- [ ] **Step 3: 写 helper**

新建 `src/lib/song-defaults.ts`：

```typescript
export interface SongSubmitLike {
  title: string
  performer?: string | null
  lyricist?: string | null
  composer?: string | null
  albumName?: string | null
  albumArtist?: string | null
}

interface UserLike {
  realName?: string | null
  name: string
}

/**
 * 按 PRD §7.1.2 为歌曲提交体填充默认值：
 * - performer / lyricist / composer / albumArtist：实名（未实名回落登录名）
 * - albumName：标题
 * 已填写的字段（含非空白字符串）原样保留。
 */
export function fillSongDefaults<T extends SongSubmitLike>(body: T, user: UserLike): T {
  const fallback = (user.realName?.trim() || user.name).trim()
  const nonEmpty = (v: string | null | undefined) =>
    v && v.trim().length > 0 ? v.trim() : null
  return {
    ...body,
    performer: nonEmpty(body.performer) ?? fallback,
    lyricist: nonEmpty(body.lyricist) ?? fallback,
    composer: nonEmpty(body.composer) ?? fallback,
    albumName: nonEmpty(body.albumName) ?? body.title,
    albumArtist: nonEmpty(body.albumArtist) ?? fallback,
  }
}
```

- [ ] **Step 4: 跑绿**

```bash
npx vitest run tests/api/theme6.test.ts -t "fillSongDefaults"
```

预期：5 条全 pass。

- [ ] **Step 5: commit**

```bash
git add src/lib/song-defaults.ts tests/api/theme6.test.ts
git commit -m "feat(lib): fillSongDefaults helper（PRD §7.1.2 默认实名/同标题，GAP-CRTR-004）"
```

---

### Task C2: /api/creator/upload 接入 fillSongDefaults

**Files:**
- Modify: `src/app/api/creator/upload/route.ts`
- Test: `tests/api/theme6.test.ts`

- [ ] **Step 1: 先写失败集成测试**

追加到 theme6.test.ts describe 块：

```typescript
  describe('C: /api/creator/upload 默认字段填充（GAP-CRTR-004）', () => {
    it('不传 performer 时 DB 行 performer = user.realName', async () => {
      const user = await prisma.user.findUnique({
        where: { id: creatorUserId },
        select: { realName: true, name: true },
      })
      const expected = (user!.realName?.trim() || user!.name).trim()

      const r = await http('/api/creator/upload', {
        method: 'POST',
        cookie: creatorCookie,
        body: {
          title: '默认 performer 测试',
          aiTools: ['Suno'],
          contribution: 'lead',
          audioUrl: '/uploads/audio/test.mp3',
        },
      })
      expectOk(r, 'upload default performer')
      const id = r.json.data.id
      const song = await prisma.platformSong.findUnique({ where: { id } })
      expect(song?.performer).toBe(expected)
      expect(song?.albumName).toBe('默认 performer 测试')
      await prisma.platformSong.delete({ where: { id } })
    })

    it('传入 performer 时保留', async () => {
      const r = await http('/api/creator/upload', {
        method: 'POST',
        cookie: creatorCookie,
        body: {
          title: '显式 performer 测试',
          aiTools: ['Suno'],
          contribution: 'lead',
          audioUrl: '/uploads/audio/test.mp3',
          performer: '编曲师小王',
          albumName: '专辑 X',
        },
      })
      expectOk(r, 'upload explicit performer')
      const id = r.json.data.id
      const song = await prisma.platformSong.findUnique({ where: { id } })
      expect(song?.performer).toBe('编曲师小王')
      expect(song?.albumName).toBe('专辑 X')
      await prisma.platformSong.delete({ where: { id } })
    })
  })
```

- [ ] **Step 2: 跑失败**

```bash
npx vitest run tests/api/theme6.test.ts -t "C: /api/creator/upload"
```

预期：第一条 `expected null to be '张三'`（当前 route 不填 performer，DB 行 performer 为 null）。

- [ ] **Step 3: 修改 upload route**

`src/app/api/creator/upload/route.ts` 在 import 区追加：

```typescript
import { fillSongDefaults } from '@/lib/song-defaults'
```

在 import 区下方（文件顶部）追加：

```typescript
async function loadUserForDefaults(userId: number) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { realName: true, name: true },
  })
  if (!u) throw new Error('用户不存在')
  return u
}
```

**新建分支**（第 66-88 行 `const copyrightCode = await generateCopyrightCode()` 到 `create({ data: { ... } })`）重构为：

```typescript
  const user = await loadUserForDefaults(userId)
  const defaults = fillSongDefaults({ title, performer: body.performer, lyricist, composer, albumName: body.albumName, albumArtist: body.albumArtist }, user)

  const copyrightCode = await generateCopyrightCode()

  const song = await prisma.platformSong.create({
    data: {
      copyrightCode,
      userId,
      title,
      performer: defaults.performer,
      lyricist: defaults.lyricist,
      composer: defaults.composer,
      albumName: defaults.albumName,
      albumArtist: defaults.albumArtist,
      aiTools: normalizedAiTools,
      genre,
      bpm: normalizedBpm,
      lyrics,
      styleDesc: normalizedStyleDesc,
      audioUrl: audioUrl || undefined,
      coverUrl: coverUrl || undefined,
      audioFeatures: audioFeatures || undefined,
      contribution: contribution || 'lead',
      creationDesc,
      source: 'upload',
      status: 'pending_review',
    },
  })
```

注意：body 解构需要补 `performer`、`albumName`、`albumArtist`（第 23 行原解构里需加三个字段）：

```typescript
  const { songId, title, lyricist, composer, aiTool, aiTools, genre, bpm, prompt, lyrics, contribution, creationDesc, styleDesc, audioUrl, coverUrl, audioFeatures, performer, albumName, albumArtist } = body
```

**重新提交分支**（第 32-63 行 `if (songId != null)` 块内 update）：update 的 data 也加 performer/albumName/albumArtist，但不走 fillSongDefaults（重新提交是修改既有字段，null/undefined 跳过更新更合理）。具体在 update.data 里追加：

```typescript
        performer: performer ?? undefined,
        albumName: albumName ?? undefined,
        albumArtist: albumArtist ?? undefined,
```

- [ ] **Step 4: 跑绿**

```bash
npx vitest run tests/api/theme6.test.ts -t "C: /api/creator/upload"
```

预期：两条均 pass。

- [ ] **Step 5: 回归现有 creator 用例**

```bash
npx vitest run tests/api/creator.test.ts tests/api/songs.test.ts
```

预期：全绿（上游 upload 依赖未 regress）。

- [ ] **Step 6: commit**

```bash
git add src/app/api/creator/upload/route.ts tests/api/theme6.test.ts
git commit -m "feat(creator/upload): 接入 fillSongDefaults 兜底 performer/album 字段（GAP-CRTR-004）"
```

---

### Task C3: /api/creator/assignments/:id/submit 接入 fillSongDefaults

**Files:**
- Modify: `src/app/api/creator/assignments/[id]/submit/route.ts`
- Test: `tests/api/theme6.test.ts`

- [ ] **Step 1: 先写失败集成测试**

追加到 describe 块内：

```typescript
  describe('C: /api/creator/assignments/:id/submit 默认字段填充', () => {
    it('作业提交不传 performer → DB 行 performer = user.realName', async () => {
      // 找到一个 active 作业且本 creator 在组内（不依赖 seed，查询一次）
      const assignment = await prisma.assignment.findFirst({
        where: { status: 'active', group: { userGroups: { some: { userId: creatorUserId } } } },
        select: { id: true },
      })
      if (!assignment) {
        console.warn('[T-C3] 无 active 作业，跳过')
        return
      }

      // 如果已提交，先删（幂等）
      await prisma.assignmentSubmission.deleteMany({
        where: { assignmentId: assignment.id, userId: creatorUserId },
      })

      const user = await prisma.user.findUnique({
        where: { id: creatorUserId },
        select: { realName: true, name: true },
      })
      const expected = (user!.realName?.trim() || user!.name).trim()

      const r = await http(`/api/creator/assignments/${assignment.id}/submit`, {
        method: 'POST',
        cookie: creatorCookie,
        body: { title: '作业默认测试', aiTools: ['Suno'] },
      })
      expectOk(r, 'assignment submit default')
      const songId = r.json.data.songId
      const song = await prisma.platformSong.findUnique({ where: { id: songId } })
      expect(song?.performer).toBe(expected)
      expect(song?.albumName).toBe('作业默认测试')
      // cleanup
      await prisma.assignmentSubmission.deleteMany({ where: { assignmentId: assignment.id, userId: creatorUserId } })
      await prisma.platformSong.deleteMany({ where: { id: songId } })
    })
  })
```

- [ ] **Step 2: 跑失败**

```bash
npx vitest run tests/api/theme6.test.ts -t "assignments/:id/submit 默认字段"
```

预期：`expected null to be '张三'`。

- [ ] **Step 3: 修改 submit route**

`src/app/api/creator/assignments/[id]/submit/route.ts` import 追加：

```typescript
import { fillSongDefaults } from '@/lib/song-defaults'
```

第 53-54 行 body 解构之后加：

```typescript
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { realName: true, name: true },
  })
  if (!user) return err('用户不存在', 404)
  const defaults = fillSongDefaults({ title, performer, lyricist, composer, albumName, albumArtist }, user)
```

然后第 62-74 行（重新提交分支 update.data）和第 105-123 行（新建分支 create.data）里，把：

```typescript
          performer,
          lyricist,
          composer,
          ...
          albumName,
          albumArtist,
```

替换为：

```typescript
          performer: defaults.performer,
          lyricist: defaults.lyricist,
          composer: defaults.composer,
          ...
          albumName: defaults.albumName,
          albumArtist: defaults.albumArtist,
```

重新提交分支同样这么改（因为重新提交也可能清空这些字段，应兜底）。

- [ ] **Step 4: 跑绿**

```bash
npx vitest run tests/api/theme6.test.ts -t "assignments/:id/submit 默认字段"
```

预期：pass。

- [ ] **Step 5: 回归**

```bash
npx vitest run tests/api/creator.test.ts
```

预期：全绿。

- [ ] **Step 6: commit**

```bash
git add src/app/api/creator/assignments/\[id\]/submit/route.ts tests/api/theme6.test.ts
git commit -m "feat(creator/assignments): submit 路由接入 fillSongDefaults（GAP-CRTR-004）"
```

---

### Task C4: 创作者上传表单补 5 个字段输入

**Files:**
- Modify: `src/app/(creator)/creator/upload/page.tsx`

前端表单补「高级信息」折叠区，含 performer / lyricist / composer / albumName / albumArtist 五个 Input，`useEffect` 监听用户信息自动预填。不写集成测试（前端 UI 不在本次测试覆盖内），用 grep 核查字段渲染存在即可。

- [ ] **Step 1: 读现有表单结构**

```bash
wc -l "src/app/(creator)/creator/upload/page.tsx"
```

定位 submit 按钮所在 form 容器，找到合适插入位置（推荐放在「AI 工具/风格」之后、「音频上传」之前）。

- [ ] **Step 2: 插入折叠区 + 5 个 Input**

示例结构（具体样式跟该页现有 Input 类名一致即可；以下伪代码，请参照同页既有 Input 的 className）：

```tsx
// state 区域追加
const [performer, setPerformer] = useState('')
const [lyricist, setLyricist] = useState('')
const [composer, setComposer] = useState('')
const [albumName, setAlbumName] = useState('')
const [albumArtist, setAlbumArtist] = useState('')
const [advancedOpen, setAdvancedOpen] = useState(false)

// 从 /api/profile 拉到的 user 信息（页面已有 currentUser 类似 state）
useEffect(() => {
  if (!currentUser) return
  const fallback = currentUser.realName?.trim() || currentUser.name
  // 仅在未填时预填
  if (!performer) setPerformer(fallback)
  if (!lyricist) setLyricist(fallback)
  if (!composer) setComposer(fallback)
  if (!albumArtist) setAlbumArtist(fallback)
  if (!albumName) setAlbumName(title)
}, [currentUser, title])

// JSX 追加（在表单合适位置）
<div className="...">
  <button type="button" onClick={() => setAdvancedOpen((v) => !v)} className="text-sm text-[var(--accent)]">
    {advancedOpen ? '收起' : '展开'}高级信息
  </button>
  {advancedOpen && (
    <div className="grid grid-cols-2 gap-3 mt-3">
      <label>演唱者 <input value={performer} onChange={(e) => setPerformer(e.target.value)} /></label>
      <label>作词 <input value={lyricist} onChange={(e) => setLyricist(e.target.value)} /></label>
      <label>作曲 <input value={composer} onChange={(e) => setComposer(e.target.value)} /></label>
      <label>专辑名 <input value={albumName} onChange={(e) => setAlbumName(e.target.value)} /></label>
      <label>专辑艺人 <input value={albumArtist} onChange={(e) => setAlbumArtist(e.target.value)} /></label>
    </div>
  )}
</div>
```

提交时把这 5 个字段加到 body。在 handleSubmit 的 fetch body 里把现有 `{ title, aiTools, ... }` 加上：

```typescript
performer: performer || undefined,
lyricist: lyricist || undefined,
composer: composer || undefined,
albumName: albumName || undefined,
albumArtist: albumArtist || undefined,
```

- [ ] **Step 3: 类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 本地手测**

跑 dev server，打开 /creator/upload，确认：
- 默认折叠
- 展开后 5 个输入已预填实名姓名 / 标题
- 未实名账号显示登录名
- 修改后提交不被覆盖

- [ ] **Step 5: commit**

```bash
git add "src/app/(creator)/creator/upload/page.tsx"
git commit -m "feat(creator/upload): 表单高级信息补 performer/lyricist/composer/albumName/albumArtist 预填（GAP-CRTR-004）"
```

---

### Task C5: 作业提交表单补 5 个字段输入

**Files:**
- Modify: `src/app/(creator)/creator/assignments/page.tsx`

作业提交页（Modal/Panel 触发处）补同样的 5 字段预填。

- [ ] **Step 1: 定位作业提交表单**

作业提交触发通常是点击作业卡片的"去提交"按钮后展开的 Modal 或 Panel。用以下命令定位：

```bash
grep -n "submit\|handleSubmit\|aiTools\|创建作品\|提交作品" "src/app/(creator)/creator/assignments/page.tsx" | head -20
```

找到 POST `/api/creator/assignments/.../submit` 的调用点和附近的表单 state。

- [ ] **Step 2: 插入 state + useEffect 预填**

在该组件 state 声明区追加：

```tsx
const [performer, setPerformer] = useState('')
const [lyricist, setLyricist] = useState('')
const [composer, setComposer] = useState('')
const [albumName, setAlbumName] = useState('')
const [albumArtist, setAlbumArtist] = useState('')
const [advancedOpen, setAdvancedOpen] = useState(false)

useEffect(() => {
  if (!currentUser) return
  const fallback = currentUser.realName?.trim() || currentUser.name
  if (!performer) setPerformer(fallback)
  if (!lyricist) setLyricist(fallback)
  if (!composer) setComposer(fallback)
  if (!albumArtist) setAlbumArtist(fallback)
  if (!albumName) setAlbumName(title)
}, [currentUser, title])
```

（`currentUser` 命名以本页实际取用户信息的变量名为准，可能叫 `user` / `profile` / `me`。）

- [ ] **Step 3: 插入折叠区 JSX**

在表单"标题"和"提交"按钮之间插入：

```tsx
<div className="mt-4">
  <button type="button" onClick={() => setAdvancedOpen((v) => !v)} className="text-sm text-[var(--accent)]">
    {advancedOpen ? '收起' : '展开'}高级信息
  </button>
  {advancedOpen && (
    <div className="grid grid-cols-2 gap-3 mt-3">
      <label>演唱者 <input value={performer} onChange={(e) => setPerformer(e.target.value)} /></label>
      <label>作词 <input value={lyricist} onChange={(e) => setLyricist(e.target.value)} /></label>
      <label>作曲 <input value={composer} onChange={(e) => setComposer(e.target.value)} /></label>
      <label>专辑名 <input value={albumName} onChange={(e) => setAlbumName(e.target.value)} /></label>
      <label>专辑艺人 <input value={albumArtist} onChange={(e) => setAlbumArtist(e.target.value)} /></label>
    </div>
  )}
</div>
```

Input 的 className 请参照本页已有 Input 的样式保持一致。

- [ ] **Step 4: handleSubmit 补 body 字段**

POST 调用的 body 加 5 字段：

```typescript
performer: performer || undefined,
lyricist: lyricist || undefined,
composer: composer || undefined,
albumName: albumName || undefined,
albumArtist: albumArtist || undefined,
```

- [ ] **Step 5: 类型检查 + 手测**

```bash
npx tsc --noEmit
```

然后跑 dev server，进入 /creator/assignments，打开 active 作业提交表单，确认：
- 默认折叠
- 展开后 5 字段已预填（实名或登录名 / 标题）
- 提交后对应字段在 DB 有真值（可用 prisma studio 验证）

- [ ] **Step 6: commit**

```bash
git add "src/app/(creator)/creator/assignments/page.tsx"
git commit -m "feat(creator/assignments): 提交表单高级信息补 5 字段预填（GAP-CRTR-004）"
```

---

## Patch D — `copyright_sequences` 表 + `nextCopyrightCode(tx)`

### Task D1: prisma schema 追加 `CopyrightSequence` 模型

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 追加 model**

在 `prisma/schema.prisma` 末尾追加：

```prisma
model CopyrightSequence {
  year      Int      @id
  counter   Int      @default(0)
  updatedAt DateTime @updatedAt

  @@map("copyright_sequences")
}
```

- [ ] **Step 2: 同步 DB**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 3: 确认表存在**

```bash
npx prisma studio
```

（浏览器打开后确认 `copyright_sequences` 表已建；或 `SHOW TABLES`）

- [ ] **Step 4: commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): 新增 copyright_sequences 表（年度递增版权号，GAP-ADMIN-029）"
```

---

### Task D2: 新建 `nextCopyrightCode(tx)` helper

**Files:**
- Create: `src/lib/copyright-code.ts`
- Test: `tests/api/theme6.test.ts`

- [ ] **Step 1: 先写失败测试**

追加到 theme6.test.ts：

```typescript
import { nextCopyrightCode } from '@/lib/copyright-code'

describe('nextCopyrightCode helper (GAP-ADMIN-029)', () => {
  it('返回形如 AIMU-YYYY-NNNNNN', async () => {
    const result = await prisma.$transaction((tx) => nextCopyrightCode(tx))
    expect(result).toMatch(/^AIMU-\d{4}-\d{6}$/)
  })

  it('连续调用递增', async () => {
    const a = await prisma.$transaction((tx) => nextCopyrightCode(tx))
    const b = await prisma.$transaction((tx) => nextCopyrightCode(tx))
    const parseNo = (s: string) => parseInt(s.split('-')[2], 10)
    expect(parseNo(b) - parseNo(a)).toBe(1)
  })

  it('并发 5 次得到互不相同且步长 1 的序号', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => prisma.$transaction((tx) => nextCopyrightCode(tx))),
    )
    const nums = results.map((s) => parseInt(s.split('-')[2], 10)).sort((a, b) => a - b)
    expect(new Set(nums).size).toBe(5)
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i] - nums[i - 1]).toBe(1)
    }
  })
})
```

- [ ] **Step 2: 跑失败**

```bash
npx vitest run tests/api/theme6.test.ts -t "nextCopyrightCode"
```

预期：import 报错。

- [ ] **Step 3: 实现 helper**

新建 `src/lib/copyright-code.ts`：

```typescript
import type { Prisma } from '@prisma/client'

/**
 * 在事务内生成年度递增版权码，形如 `AIMU-2026-000001`。
 *
 * 实现：
 *   1. `INSERT IGNORE` 确保当年行存在（首次落库）
 *   2. `SELECT ... FOR UPDATE` 行锁读 counter
 *   3. `UPDATE counter = counter + 1` 落盘
 *
 * 并发两条事务：第二条在 FOR UPDATE 阻塞至第一条 commit 后 +1，零竞态。
 */
export async function nextCopyrightCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear()
  await tx.$executeRaw`INSERT IGNORE INTO copyright_sequences (year, counter, updatedAt) VALUES (${year}, 0, NOW())`
  const rows = await tx.$queryRaw<{ counter: number }[]>`SELECT counter FROM copyright_sequences WHERE year = ${year} FOR UPDATE`
  const next = rows[0].counter + 1
  await tx.$executeRaw`UPDATE copyright_sequences SET counter = ${next} WHERE year = ${year}`
  return `AIMU-${year}-${String(next).padStart(6, '0')}`
}
```

- [ ] **Step 4: 跑绿**

```bash
npx vitest run tests/api/theme6.test.ts -t "nextCopyrightCode"
```

预期：3 条全 pass。

> **调试提示**：如果并发用例失败且 MySQL 报死锁或超时，可能需要把实现改为单语句原子化：
> ```sql
> INSERT INTO copyright_sequences (year, counter) VALUES (?, 1)
> ON DUPLICATE KEY UPDATE counter = counter + 1
> ```
> 然后再查当前 counter。但默认实现应该能过，优先保持可读性。

- [ ] **Step 5: commit**

```bash
git add src/lib/copyright-code.ts tests/api/theme6.test.ts
git commit -m "feat(lib): nextCopyrightCode helper，年度原子递增（GAP-ADMIN-029）"
```

---

### Task D3: upload route 替换 generateCopyrightCode

**Files:**
- Modify: `src/app/api/creator/upload/route.ts`
- Test: `tests/api/theme6.test.ts`

- [ ] **Step 1: 先写失败集成测试**

追加：

```typescript
  describe('D: /api/creator/upload copyrightCode 格式（GAP-ADMIN-029）', () => {
    it('POST /creator/upload → copyrightCode 形如 AIMU-YYYY-NNNNNN', async () => {
      const r = await http('/api/creator/upload', {
        method: 'POST',
        cookie: creatorCookie,
        body: { title: 'D1 测试歌', aiTools: ['Suno'], contribution: 'lead', audioUrl: '/uploads/audio/d1.mp3' },
      })
      expectOk(r, 'upload copyrightCode')
      const code = r.json.data.copyrightCode as string
      expect(code).toMatch(/^AIMU-\d{4}-\d{6}$/)
      await prisma.platformSong.delete({ where: { id: r.json.data.id } })
    })

    it('并发 5 次 upload → 5 个 copyrightCode 唯一且步长 1', async () => {
      const reqs = Array.from({ length: 5 }, (_, i) =>
        http('/api/creator/upload', {
          method: 'POST',
          cookie: creatorCookie,
          body: { title: `并发 D2 ${i}`, aiTools: ['Suno'], contribution: 'lead', audioUrl: `/uploads/audio/d2_${i}.mp3` },
        }),
      )
      const results = await Promise.all(reqs)
      const ids = results.map((r) => r.json.data.id as number)
      const codes = results.map((r) => r.json.data.copyrightCode as string)
      const nums = codes.map((c) => parseInt(c.split('-')[2], 10)).sort((a, b) => a - b)
      expect(new Set(nums).size).toBe(5)
      for (let i = 1; i < nums.length; i++) {
        expect(nums[i] - nums[i - 1]).toBe(1)
      }
      await prisma.platformSong.deleteMany({ where: { id: { in: ids } } })
    })
  })
```

- [ ] **Step 2: 跑失败**

```bash
npx vitest run tests/api/theme6.test.ts -t "D: /api/creator/upload copyrightCode"
```

预期：并发用例会有概率 fail（Math.random 哈希冲突率低但并不步长 1），或第 1 条因格式不匹配失败（旧实现格式和新期望一致 `AIMU-2026-NNNNNN`，但序号是随机不是递增，实际上第 1 条格式会过，第 2 条"步长 1"必 fail）。

- [ ] **Step 3: 修改 upload route**

替换顶部 `generateCopyrightCode` 函数，引入 helper 并把 create 包入 `$transaction`：

把 `src/app/api/creator/upload/route.ts` 第 5-16 行（`async function generateCopyrightCode` 整段）删除。

在 import 区追加：

```typescript
import { nextCopyrightCode } from '@/lib/copyright-code'
```

把新建分支（第 66-88 行）改为：

```typescript
  const user = await loadUserForDefaults(userId)  // 已在 C2 添加
  const defaults = fillSongDefaults({ title, performer: body.performer, lyricist, composer, albumName: body.albumName, albumArtist: body.albumArtist }, user)

  const song = await prisma.$transaction(async (tx) => {
    const copyrightCode = await nextCopyrightCode(tx)
    return tx.platformSong.create({
      data: {
        copyrightCode,
        userId,
        title,
        performer: defaults.performer,
        lyricist: defaults.lyricist,
        composer: defaults.composer,
        albumName: defaults.albumName,
        albumArtist: defaults.albumArtist,
        aiTools: normalizedAiTools,
        genre,
        bpm: normalizedBpm,
        lyrics,
        styleDesc: normalizedStyleDesc,
        audioUrl: audioUrl || undefined,
        coverUrl: coverUrl || undefined,
        audioFeatures: audioFeatures || undefined,
        contribution: contribution || 'lead',
        creationDesc,
        source: 'upload',
        status: 'pending_review',
      },
    })
  })
```

- [ ] **Step 4: 跑绿**

```bash
npx vitest run tests/api/theme6.test.ts -t "D: /api/creator/upload copyrightCode"
```

预期：两条 pass。

- [ ] **Step 5: 回归**

```bash
npx vitest run tests/api/creator.test.ts tests/api/songs.test.ts tests/api/theme4-distribution-automation.test.ts
```

预期：全绿（尤其 theme4 依赖 published 歌曲的 distribution 自动化，不应 regress）。

- [ ] **Step 6: commit**

```bash
git add src/app/api/creator/upload/route.ts tests/api/theme6.test.ts
git commit -m "refactor(creator/upload): 版权号改 nextCopyrightCode 原子递增（GAP-ADMIN-029）"
```

---

### Task D4: submit route 替换 generateCopyrightCode

**Files:**
- Modify: `src/app/api/creator/assignments/[id]/submit/route.ts`
- Test: `tests/api/theme6.test.ts`

- [ ] **Step 1: 先写失败集成测试**

追加：

```typescript
  it('D: /api/creator/assignments/:id/submit copyrightCode 格式 AIMU-YYYY-NNNNNN', async () => {
    const assignment = await prisma.assignment.findFirst({
      where: { status: 'active', group: { userGroups: { some: { userId: creatorUserId } } } },
      select: { id: true },
    })
    if (!assignment) return
    await prisma.assignmentSubmission.deleteMany({
      where: { assignmentId: assignment.id, userId: creatorUserId },
    })
    const r = await http(`/api/creator/assignments/${assignment.id}/submit`, {
      method: 'POST',
      cookie: creatorCookie,
      body: { title: 'D4 作业测试', aiTools: ['Suno'] },
    })
    expectOk(r, 'assignment submit copyrightCode')
    const code = r.json.data.copyrightCode as string
    expect(code).toMatch(/^AIMU-\d{4}-\d{6}$/)
    // cleanup
    await prisma.assignmentSubmission.deleteMany({ where: { assignmentId: assignment.id, userId: creatorUserId } })
    await prisma.platformSong.deleteMany({ where: { id: r.json.data.songId } })
  })
```

- [ ] **Step 2: 跑失败**

```bash
npx vitest run tests/api/theme6.test.ts -t "D: /api/creator/assignments"
```

预期：格式匹配 pass（旧实现也是 AIMU-年份-6 位），但如果旧实现生成的是 `AIMU-2026-523871` 这种纯随机，格式是过的 → 本条用例**会意外 pass**。此时补一条并发用例：

```typescript
  it('D: 并发 3 次 submit → copyrightCode 互不相同', async () => {
    // 找 3 个 active 作业（或复用同一个作业在不同用户？PRD 允许同作业同用户不能重复提交）
    const assignments = await prisma.assignment.findMany({
      where: { status: 'active', group: { userGroups: { some: { userId: creatorUserId } } } },
      take: 3,
    })
    if (assignments.length < 3) {
      console.warn('[T-D4] 可提交 active 作业少于 3，跳过')
      return
    }
    // 清残留
    for (const a of assignments) {
      await prisma.assignmentSubmission.deleteMany({ where: { assignmentId: a.id, userId: creatorUserId } })
    }
    const results = await Promise.all(
      assignments.map((a, i) =>
        http(`/api/creator/assignments/${a.id}/submit`, {
          method: 'POST',
          cookie: creatorCookie,
          body: { title: `并发 D4 ${i}`, aiTools: ['Suno'] },
        }),
      ),
    )
    const codes = results.map((r) => r.json.data.copyrightCode as string)
    expect(new Set(codes).size).toBe(3)
    // cleanup
    for (let i = 0; i < assignments.length; i++) {
      await prisma.assignmentSubmission.deleteMany({ where: { assignmentId: assignments[i].id, userId: creatorUserId } })
      await prisma.platformSong.deleteMany({ where: { id: results[i].json.data.songId } })
    }
  })
```

- [ ] **Step 3: 修改 submit route**

`src/app/api/creator/assignments/[id]/submit/route.ts`：

删除第 5-16 行 `generateCopyrightCode` 函数。

import 追加：

```typescript
import { nextCopyrightCode } from '@/lib/copyright-code'
```

第 102 行原 `const copyrightCode = await generateCopyrightCode()` 删除。

第 104 行开始的 `prisma.$transaction(async (tx) => {`: 在 tx 开始后第一行加：

```typescript
    const copyrightCode = await nextCopyrightCode(tx)
```

（这样 copyrightCode 生成和 song.create 同一个 tx 内，行锁在事务 commit 后释放）。

- [ ] **Step 4: 跑绿**

```bash
npx vitest run tests/api/theme6.test.ts -t "D: /api/creator/assignments"
```

预期：两条 pass。

- [ ] **Step 5: 回归**

```bash
npx vitest run tests/api/creator.test.ts tests/api/theme7.test.ts
```

预期：全绿。

- [ ] **Step 6: commit**

```bash
git add src/app/api/creator/assignments/\[id\]/submit/route.ts tests/api/theme6.test.ts
git commit -m "refactor(creator/assignments): 版权号改 nextCopyrightCode 原子递增（GAP-ADMIN-029）"
```

---

## Patch 收尾：全局回归 + PR 描述

### Task E1: 全套集成测试 + 类型检查

- [ ] **Step 1: 全量跑测**

```bash
npx vitest run
```

期望：100% 绿灯。

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

期望：0 错误。

- [ ] **Step 3: 静态 grep（Patch A 断言）**

```bash
grep -rn "n\.time\b" "src/app/(creator)/creator/notifications/"
grep -rn "song\.cover\b" "src/app/(creator)/creator/community/"
grep -rn "song\.aiTool\b" "src/app/(creator)/creator/songs/"
grep -rn "songTitle\|songCover" "src/app/(admin)/admin/publish-confirm/"
```

4 条全部无输出。

- [ ] **Step 4: build check**

```bash
npm run build
```

期望通过（不 build 也可以，但 production 构建会暴露少见的 TS error）。

### Task E2: 合并到 main（按主题风格单独 PR 或直接 push）

- [ ] **Step 1: 总览本次改动**

```bash
git log --oneline main..HEAD
```

预期：9-10 条 commit（前置骨架 + Patch A + B1 + B2 + C1~5 + D1~4 + 收尾）。

- [ ] **Step 2: 要求用户确认合并策略**

回执给用户：列出改动 commit 和文件清单。由用户决定：
- 直接 push 到 main
- 开 PR 走 review
- rebase squash 为 1 个合并 commit

**不擅自 push。**

---

## Self-Review 追记（writing-plans 完成后）

**Spec 覆盖核对**：

| Spec 项 | 对应 Task |
|---|---|
| Patch A 4 处前端字段别名 | Task A1/A2/A3/A4/A5 |
| Patch B1 songCount | Task B1 |
| Patch B2 reset-password 明文 | Task B2 |
| Patch C fillSongDefaults helper | Task C1 |
| Patch C upload 接入 | Task C2 |
| Patch C assignments/submit 接入 | Task C3 |
| Patch C upload 表单 UI | Task C4 |
| Patch C assignments 表单 UI | Task C5 |
| Patch D schema CopyrightSequence | Task D1 |
| Patch D nextCopyrightCode helper | Task D2 |
| Patch D upload route 替换 | Task D3 |
| Patch D submit route 替换 | Task D4 |
| Success Criteria 1 集成测试 + 静态断言 | Task E1 |
| Success Criteria 2 回归 | Task E1 |
| Success Criteria 3 UI undefined 消除 | Task A5 grep 收尾 |
| Success Criteria 4 并发递增 | Task D3 / D4 并发用例 |

全部覆盖，无缺。

**Placeholder 扫描**：所有 Step 都含具体命令或代码块，未见"implement later"等模糊词。

**类型一致性**：`fillSongDefaults` / `nextCopyrightCode` 签名在 Task C1/C2/C3/D2/D3/D4 中一致。
