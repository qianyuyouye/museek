# Theme 2: 通知触发机制 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Batch 1A 就绪的 `renderTemplate` 接到 6 个核心业务动作上，让创作者真的收到通知；补齐 Notification schema 字段和前端点击跳转逻辑。

**Architecture:**
- 在 `src/lib/notifications.ts` 新增 `notify(userId, templateKey, vars, targetType?, targetId?)` 主函数，内部走 `renderTemplate` → `prisma.notification.create`；模板缺失返回 null 而非抛错（降级优先）
- Notification schema 增加 4 个可空字段（`targetType / targetId / content / linkUrl`），保持向前兼容，不改 `type` 列类型（VarChar 够用）
- 6 个业务动作路由（review submit / publish / settlement pay / realname verify / assignment create / ISRC bind）**在各自现有事务外**调用 `notify(...)`，通知失败不影响主业务
- 前端 `/creator/notifications` 点击卡片读 `linkUrl` 跳转
- `GET /api/creator/notifications` 返回体扩 4 字段；`src/types/api.ts` 补类型契约

**Tech Stack:** Prisma / Next.js App Router / vitest（API 层集成测试对 prod server :3100，见 `tests/api/_helpers.ts`）

---

## 文件结构

### 新建文件（1 个）

- `prisma/migrations/2026-04-20-notification-fields.sql`（可选，用 `prisma db push` 就不需要，先标注）

### 修改文件（~12 个）

| 文件 | 修改点 |
|---|---|
| `prisma/schema.prisma:550-561` | `Notification` model 加 4 字段 + 加 `user` 关联 + index |
| `src/lib/notifications.ts` | 新增 `notify()`；在 `TemplateKey` 加 `'tpl.isrc_bound'`；在 `DEFAULT_TEMPLATES` 补对应模板 |
| `src/types/api.ts` | 新增 `NotificationResponse` / `NotificationsListResponse` |
| `src/app/api/creator/notifications/route.ts:5-42` | GET select 增加 4 字段；响应体映射对齐 |
| `src/app/(creator)/creator/notifications/page.tsx:11-17` | 接口加 `linkUrl`；点击卡片先 `markAsRead` 再 `router.push(linkUrl)` |
| `src/app/api/review/submit/route.ts:103` | 事务外 `notify` 创作者（分 `tpl.review_done` / `tpl.song_needs_revision`） |
| `src/app/api/admin/songs/[id]/status/route.ts:73` | action='publish' 成功后 `notify` 创作者 `tpl.song_published`；action='archive' 后 `tpl.song_archived` |
| `src/app/api/admin/revenue/settlements/route.ts:114` | action='pay' 对每条 settlement `notify` 对应创作者 `tpl.settlement_paid` |
| `src/app/api/admin/students/[id]/verify/route.ts:9-51` | 读 body 新增 `reason` 字段；approve → `tpl.realname_approved`，reject → `tpl.realname_rejected` |
| `src/app/api/admin/assignments/route.ts:61-78` | 创建成功后查 `UserGroup.userId` 广播 `tpl.assignment_created` |
| `src/app/api/admin/songs/[id]/isrc/route.ts:30` | update 成功后 `notify` 创作者 `tpl.isrc_bound` |
| `tests/lib/notifications.test.ts` | 新增 `notify()` 单测 |
| `tests/api/*.test.ts`（按触发点） | 每个触发点加 1 条集成用例验证 `prisma.notification.findMany` 有对应记录 |

---

## 前置条件

1. Museek prod server 在 `localhost:3100` 跑着（`TEST_MODE=1 npx next start -p 3100`）；seed-test-users 已跑（admin + creator 13800001234 + reviewer 13500008888 + group E2ETEST1）
2. 当前 `HEAD` = main branch（Batch 1A 已合并），从 main 开新分支 `feature/theme2-notifications`
3. Batch 1A 的 `src/lib/notifications.ts` 已提供 `renderTemplate` + `getTemplate` + `DEFAULT_TEMPLATES`，不要重写

---

## Task 1: Notification schema 扩字段（加 4 列 + user 关联）

**Files:**
- Modify: `prisma/schema.prisma:550-561`

**背景：** 现状 Notification 只有 6 个字段，缺 `targetType / targetId / content / linkUrl` 导致点击跳转无法落地，通知内容只能塞在 title。PRD §4.X 要求扩 schema。

- [ ] **Step 1: 从 main 切新分支**

```bash
cd "D:/Project/museek"
git checkout main && git pull
git checkout -b feature/theme2-notifications
```

- [ ] **Step 2: 修改 schema.prisma**

定位到 `model Notification`（行 550-561），替换整块为：

```prisma
// 4.16 notifications（站内通知）
model Notification {
  id         Int      @id @default(autoincrement())
  userId     Int      @map("user_id")
  type       String   @db.VarChar(30)
  title      String   @db.VarChar(500)
  content    String?  @db.Text
  targetType String?  @map("target_type") @db.VarChar(30)
  targetId   String?  @map("target_id") @db.VarChar(64)
  linkUrl    String?  @map("link_url") @db.VarChar(500)
  read       Boolean  @default(false)
  createdAt  DateTime @default(now()) @map("created_at")

  user       User     @relation(fields: [userId], references: [id])

  @@index([userId, read])
  @@index([userId, type, createdAt])
  @@map("notifications")
}
```

并在 `model User` 里加反向关联（紧挨现有 `learningRecords` 下一行）：

```prisma
  notifications   Notification[]
```

- [ ] **Step 3: push schema 到 DB**

```bash
npx prisma db push
npx prisma generate
```

Expected: prisma 打印 4 个 ALTER TABLE；prisma generate 成功。

- [ ] **Step 4: 验证新字段真的进了表**

```bash
npx tsx -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.notification.findFirst().then(r=>{console.log('cols=',Object.keys(r||{userId:0,type:'',title:'',content:null,targetType:null,targetId:null,linkUrl:null,read:false,id:0,createdAt:new Date()}));p.\$disconnect()})"
```

Expected: 列出包含 content / targetType / targetId / linkUrl 的对象 key。

- [ ] **Step 5: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat(Theme-2): Notification schema 扩 content/targetType/targetId/linkUrl 字段 + user 关联"
```

---

## Task 2: `notify()` 主函数 + 补 'tpl.isrc_bound' + 单测

**Files:**
- Modify: `src/lib/notifications.ts`
- Test: `tests/lib/notifications.test.ts`

**背景：** Batch 1A 只做了模板渲染（renderTemplate），没有到 `prisma.notification.create` 的主触发函数。本 Task 把这层补上，并新增 ISRC 绑定模板（Batch 1A 落下的）。

- [ ] **Step 1: 先写失败测试**

在 `tests/lib/notifications.test.ts` 末尾（现有 describe 后）追加：

```typescript
import { notify } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'

describe('notify() 业务触发', () => {
  // 测试前清 creator 13800001234 (id 通过 phone 查) 的 notifications
  let userId = 0
  beforeAll(async () => {
    const u = await prisma.user.findUnique({ where: { phone: '13800001234' }, select: { id: true } })
    if (!u) throw new Error('未 seed creator 13800001234')
    userId = u.id
    await prisma.notification.deleteMany({ where: { userId } })
  })
  afterEach(async () => {
    await prisma.notification.deleteMany({ where: { userId } })
  })

  it('tpl.review_done 渲染变量并创建 notification', async () => {
    const n = await notify(userId, 'tpl.review_done', { songTitle: '测试曲', score: 88, songId: 42 })
    expect(n).not.toBeNull()
    expect(n!.type).toBe('work')
    expect(n!.title).toContain('测试曲')
    expect(n!.content).toContain('88')
    expect(n!.linkUrl).toBe('/creator/songs?id=42')
  })

  it('targetType/targetId 参数落库', async () => {
    const n = await notify(userId, 'tpl.song_published', { songTitle: 'X', songId: 99 }, 'song', 99)
    expect(n!.targetType).toBe('song')
    expect(n!.targetId).toBe('99')
  })

  it('不存在的 template key 返回 null 而非抛错', async () => {
    const n = await notify(userId, 'tpl.not_exist' as never, {})
    expect(n).toBeNull()
  })

  it('tpl.isrc_bound 模板存在且正常渲染', async () => {
    const n = await notify(userId, 'tpl.isrc_bound', { songTitle: 'Y', isrc: 'CN-XXX-26-00001', songId: 7 })
    expect(n).not.toBeNull()
    expect(n!.title).toContain('Y')
    expect(n!.content).toContain('CN-XXX-26-00001')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run tests/lib/notifications.test.ts --reporter=verbose
```

Expected: 4 个新 case FAIL（`notify is not a function` 或 `tpl.isrc_bound` 模板不存在）。

- [ ] **Step 3: 在 `src/lib/notifications.ts` 改代码**

**a) `TemplateKey` 加一项**（找到现有定义）：

```typescript
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
  | 'tpl.isrc_bound'  // NEW
```

**b) `DEFAULT_TEMPLATES` 补对应模板**（在对象末尾加，保持 trailing comma）：

```typescript
  'tpl.isrc_bound': {
    type: 'work',
    title: '版权编号已分配：《{songTitle}》',
    content: '平台已为作品分配 ISRC 编号：{isrc}。',
    linkUrl: '/creator/songs?id={songId}',
  },
```

**c) 文件末尾新增 `notify()` 函数**：

```typescript
import { prisma } from './prisma'
import type { Notification } from '@prisma/client'

/**
 * 业务动作触发通知：渲染模板 + 落库。
 * - 模板缺失返回 null（降级，不抛错，不影响主业务）
 * - targetType + targetId 用于前端点击跳转和分组
 */
export async function notify(
  userId: number,
  templateKey: TemplateKey,
  vars: Record<string, unknown>,
  targetType?: string,
  targetId?: string | number,
): Promise<Notification | null> {
  const rendered = await renderTemplate(templateKey, vars)
  if (!rendered) return null
  return prisma.notification.create({
    data: {
      userId,
      type: rendered.type,
      title: rendered.title,
      content: rendered.content,
      linkUrl: rendered.linkUrl,
      targetType: targetType ?? null,
      targetId: targetId != null ? String(targetId) : null,
    },
  })
}
```

注意：`import { prisma } from './prisma'` 如果文件顶部已有 `getSetting` 的 import，可能已经带 prisma；核对不要重复导入。

- [ ] **Step 4: 跑测试确认通过**

```bash
npx vitest run tests/lib/notifications.test.ts --reporter=verbose
```

Expected: 全部 PASS（含原 4 条 Batch 1A + 新 4 条）。

- [ ] **Step 5: 提交**

```bash
git add src/lib/notifications.ts tests/lib/notifications.test.ts
git commit -m "feat(Theme-2): notifications lib 新增 notify() 主函数 + tpl.isrc_bound 模板"
```

---

## Task 3: GET/PUT `/api/creator/notifications` 返回扩字段 + types/api.ts 契约

**Files:**
- Modify: `src/app/api/creator/notifications/route.ts:5-42`
- Modify: `src/types/api.ts`
- Test: `tests/api/creator.test.ts`（新增一条用例）

- [ ] **Step 1: 在 `src/types/api.ts` 末尾补类型**

```typescript
// 站内通知（Theme-2）
export type NotificationTypeKey = 'work' | 'revenue' | 'system' | 'assignment'

export interface NotificationResponse {
  id: number
  type: NotificationTypeKey
  title: string
  content: string | null
  targetType: string | null
  targetId: string | null
  linkUrl: string | null
  read: boolean
  createdAt: string
}

export interface NotificationsListResponse {
  list: NotificationResponse[]
  total: number
  page: number
  pageSize: number
  unreadCount: number
  typeCounts: Record<NotificationTypeKey, number>
}
```

- [ ] **Step 2: 修改 `src/app/api/creator/notifications/route.ts` GET 返回**

找到当前 map 块，换成：

```typescript
const list = notifications.map((n) => ({
  id: n.id,
  type: n.type as 'work' | 'revenue' | 'system' | 'assignment',
  title: n.title,
  content: n.content,
  targetType: n.targetType,
  targetId: n.targetId,
  linkUrl: n.linkUrl,
  read: n.read,
  createdAt: n.createdAt.toISOString(),
}))
```

Prisma 默认 select 全字段，不用改 `prisma.notification.findMany(...)` 的 where/select；只需要 map 时把新字段带上。

- [ ] **Step 3: 在 `tests/api/creator.test.ts` 加一条验证返回字段**

在文件已有 describe（例如 "创作者端"）末尾加：

```typescript
  it('GET /api/notifications 返回包含 content/linkUrl/targetType/targetId', async () => {
    // 先用 notify() 造一条
    const { prisma } = await import('@/lib/prisma')
    const { notify } = await import('@/lib/notifications')
    const u = await prisma.user.findUnique({ where: { phone: '13800001234' }, select: { id: true } })
    await notify(u!.id, 'tpl.song_published', { songTitle: '契约测试', songId: 12345 }, 'song', 12345)

    const { cookie } = await creatorLogin()
    const r = await http('/api/creator/notifications', { cookie })
    expectOk(r, 'notifications')
    const n = (r.json.data.list as Array<{ title: string; linkUrl: string | null; targetType: string | null; targetId: string | null; content: string | null }>).find(
      (x) => x.title?.includes('契约测试')
    )
    expect(n).toBeTruthy()
    expect(n!.linkUrl).toBe('/creator/songs?id=12345')
    expect(n!.targetType).toBe('song')
    expect(n!.targetId).toBe('12345')
    expect(n!.content).toContain('契约测试')

    // cleanup
    await prisma.notification.deleteMany({ where: { userId: u!.id, title: { contains: '契约测试' } } })
  })
```

- [ ] **Step 4: 跑测试**

```bash
npx vitest run tests/api/creator.test.ts --reporter=verbose
```

Expected: 新用例 PASS；老用例不 regression（若老 case 用到 type assertion 可能需要顺手改，但 interface 本身只加不减）。

- [ ] **Step 5: 提交**

```bash
git add src/app/api/creator/notifications/route.ts src/types/api.ts tests/api/creator.test.ts
git commit -m "feat(Theme-2): /api/creator/notifications 返回 content/linkUrl/targetType/targetId + types 契约"
```

---

## Task 4: 评审提交 → notify 创作者（review_done / song_needs_revision）

**Files:**
- Modify: `src/app/api/review/submit/route.ts`（在事务结束后插 notify）
- Test: `tests/api/reviewer.test.ts`（新增 case）

**行为：**
- `newSongStatus === 'needs_revision'` → `tpl.song_needs_revision`（变量：songTitle / score / comment）
- 其他（reviewed / ready_to_publish）→ `tpl.review_done`（变量：songTitle / score / songId）
- 目标：`targetType='song'`, `targetId=songId`

- [ ] **Step 1: 写测试 case（先让它挂）**

在 `tests/api/reviewer.test.ts` 新增：

```typescript
  it('TC-RV-NOTIFY 评审完成后创作者收到 tpl.review_done 通知', async () => {
    const { prisma } = await import('@/lib/prisma')
    const creator = await prisma.user.findUnique({ where: { phone: '13800001234' }, select: { id: true } })
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })

    // 造一首 pending_review 的歌
    const song = await prisma.platformSong.create({
      data: { title: '通知测试曲', userId: creator!.id, status: 'pending_review', audioUrl: 'x', coverUrl: 'x' },
    })

    const { cookie: revCookie } = await reviewerLogin()
    const r = await http('/api/review/submit', {
      method: 'POST',
      cookie: revCookie,
      body: { songId: song.id, originalityScore: 85, melodyScore: 85, lyricsScore: 85, aiUseScore: 85, recommendation: 'recommend', comment: '不错' },
    })
    expectOk(r, 'review submit')

    const notes = await prisma.notification.findMany({ where: { userId: creator!.id, targetType: 'song', targetId: String(song.id) } })
    expect(notes.length).toBe(1)
    expect(notes[0].title).toContain('通知测试曲')
    expect(notes[0].type).toBe('work')
    expect(notes[0].linkUrl).toBe(`/creator/songs?id=${song.id}`)

    // cleanup
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })
    await prisma.review.deleteMany({ where: { songId: song.id } })
    await prisma.platformSong.delete({ where: { id: song.id } })
  })
```

- [ ] **Step 2: 跑确认失败**

```bash
npx vitest run tests/api/reviewer.test.ts -t 'TC-RV-NOTIFY' --reporter=verbose
```

Expected: FAIL（notes.length === 0）。

- [ ] **Step 3: 改 `src/app/api/review/submit/route.ts`**

在文件顶部 import：

```typescript
import { notify } from '@/lib/notifications'
```

在事务 `await prisma.$transaction(async (tx) => { ... })` **结束后**（不要放事务内，通知失败不能回滚主业务），拿到 `song`（当前代码里有 `const song = await tx.platformSong.findUnique(...)` 或类似；若事务内结构复杂，把 songTitle 从事务返回值里传出来）。然后：

```typescript
// 事务完成后异步通知（不 await 阻塞响应亦可；为了测试确定性这里 await）
const newStatus = result.songStatus  // 事务返回的新状态
const templateKey = newStatus === 'needs_revision' ? 'tpl.song_needs_revision' : 'tpl.review_done'
try {
  await notify(
    result.creatorId,  // 事务返回里带出
    templateKey,
    {
      songTitle: result.songTitle,
      score: totalScore,
      songId,
      comment: comment ?? '',
    },
    'song',
    songId,
  )
} catch (e) {
  console.error('[notify] review submit failed:', e)
}
```

**注意：** 如果当前事务返回值没带 songTitle / creatorId，需要改事务内的返回（`return { songStatus: newStatus, creatorId: song.userId, songTitle: song.title }`）。这是事务返回值扩展，不改主逻辑。

- [ ] **Step 4: 跑测试确认通过**

```bash
npx vitest run tests/api/reviewer.test.ts -t 'TC-RV-NOTIFY' --reporter=verbose
```

Expected: PASS。同时 `npx vitest run tests/api/reviewer.test.ts` 全量，确认原 case 不 regression。

- [ ] **Step 5: 提交**

```bash
git add src/app/api/review/submit/route.ts tests/api/reviewer.test.ts
git commit -m "feat(Theme-2): 评审提交后触发 tpl.review_done / tpl.song_needs_revision 通知"
```

---

## Task 5: 歌曲状态变更（publish / archive）→ notify 创作者

**Files:**
- Modify: `src/app/api/admin/songs/[id]/status/route.ts`
- Test: `tests/api/songs.test.ts`

**行为：**
- action='publish' 成功（status → published）→ `tpl.song_published`（songTitle / songId）
- action='archive' 成功（status → archived）→ `tpl.song_archived`（songTitle / songId）
- restore 不 notify（恢复到 reviewed 不打扰）

- [ ] **Step 1: 写测试**

在 `tests/api/songs.test.ts` 新增（找到"TC-A-06 状态机" describe 相邻位置）：

```typescript
  it('TC-A-NOTIFY 发行成功后创作者收到 tpl.song_published 通知', async () => {
    const { prisma } = await import('@/lib/prisma')
    const creator = await prisma.user.findUnique({ where: { phone: '13800001234' }, select: { id: true } })
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })

    // 造一首 ready_to_publish + 已签约 + 已实名 + 有 ISRC 的歌
    await prisma.user.update({ where: { id: creator!.id }, data: { agencyContract: true, realNameStatus: 'verified' } })
    const song = await prisma.platformSong.create({
      data: { title: '发行通知测试', userId: creator!.id, status: 'ready_to_publish', audioUrl: 'x', coverUrl: 'x', isrc: 'CN-TEST-26-00001' },
    })

    const { cookie: admC } = await adminLogin()
    const r = await http(`/api/admin/songs/${song.id}/status`, {
      method: 'PATCH',
      cookie: admC,
      body: { action: 'publish' },
    })
    expectOk(r, 'publish')

    const notes = await prisma.notification.findMany({ where: { userId: creator!.id, targetType: 'song', targetId: String(song.id) } })
    expect(notes.some((n) => n.title.includes('发行通知测试') && n.type === 'work')).toBe(true)

    // cleanup
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })
    await prisma.platformSong.delete({ where: { id: song.id } })
  })
```

- [ ] **Step 2: 跑确认失败**

```bash
npx vitest run tests/api/songs.test.ts -t 'TC-A-NOTIFY' --reporter=verbose
```

Expected: FAIL。

- [ ] **Step 3: 改 route**

`src/app/api/admin/songs/[id]/status/route.ts` 顶部：

```typescript
import { notify } from '@/lib/notifications'
```

在 `await prisma.platformSong.update(...)` **之后**（即原 L70-73 update 和 L75 logAdminAction 之间），针对 action='publish' / 'archive' 加 notify：

```typescript
try {
  if (action === 'publish') {
    await notify(song.userId, 'tpl.song_published', { songTitle: song.title, songId: song.id }, 'song', song.id)
  } else if (action === 'archive') {
    await notify(song.userId, 'tpl.song_archived', { songTitle: song.title, songId: song.id }, 'song', song.id)
  }
} catch (e) {
  console.error('[notify] song status change failed:', e)
}
```

- [ ] **Step 4: 测试通过**

```bash
npx vitest run tests/api/songs.test.ts -t 'TC-A-NOTIFY' --reporter=verbose
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/app/api/admin/songs/[id]/status/route.ts tests/api/songs.test.ts
git commit -m "feat(Theme-2): 歌曲 publish/archive 后触发通知"
```

---

## Task 6: 结算打款 action='pay' → 批量 notify

**Files:**
- Modify: `src/app/api/admin/revenue/settlements/route.ts:103-114`
- Test: `tests/api/revenue.test.ts`

**行为：** action='pay' 时，针对每条被 update 到 paid 状态的 settlement，`notify(creator, 'tpl.settlement_paid', { amount, periodLabel }, 'settlement', settlement.id)`。

- [ ] **Step 1: 测试**

`tests/api/revenue.test.ts` 加（结构仿既有 settlement 用例）：

```typescript
  it('TC-SET-NOTIFY action=pay 后每条 settlement 对应 creator 收到 tpl.settlement_paid', async () => {
    const { prisma } = await import('@/lib/prisma')
    const creator = await prisma.user.findUnique({ where: { phone: '13800001234' }, select: { id: true } })
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })

    // 造一条 exported 状态的 settlement
    const s = await prisma.settlement.create({
      data: { userId: creator!.id, period: '2026-04', totalAmount: 1000, creatorAmount: 700, platformAmount: 300, status: 'exported' },
    })

    const { cookie: admC } = await adminLogin()
    const r = await http('/api/admin/revenue/settlements', {
      method: 'POST',
      cookie: admC,
      body: { ids: [s.id], action: 'pay' },
    })
    expectOk(r, 'pay')

    const notes = await prisma.notification.findMany({ where: { userId: creator!.id, targetType: 'settlement', targetId: String(s.id) } })
    expect(notes.length).toBe(1)
    expect(notes[0].type).toBe('revenue')
    expect(notes[0].content).toContain('700')

    await prisma.notification.deleteMany({ where: { userId: creator!.id } })
    await prisma.settlement.delete({ where: { id: s.id } })
  })
```

- [ ] **Step 2: 跑确认失败**

```bash
npx vitest run tests/api/revenue.test.ts -t 'TC-SET-NOTIFY' --reporter=verbose
```

- [ ] **Step 3: 改 route**

`src/app/api/admin/revenue/settlements/route.ts` 顶部 import `notify`。在 `await prisma.settlement.updateMany(...)` 之后，针对 pay 分支：

```typescript
if (action === 'pay') {
  // 重新查回被 update 的 settlement 含 creator/period/amount
  const paid = await prisma.settlement.findMany({
    where: { id: { in: ids } },
    select: { id: true, userId: true, creatorAmount: true, period: true },
  })
  await Promise.all(
    paid.map((s) =>
      notify(
        s.userId,
        'tpl.settlement_paid',
        { amount: s.creatorAmount, periodLabel: s.period },
        'settlement',
        s.id,
      ).catch((e) => console.error('[notify] settlement_paid failed:', e)),
    ),
  )
}
```

（Promise.all + 各自 catch 保证单个失败不影响其他）

- [ ] **Step 4: 测试通过**

```bash
npx vitest run tests/api/revenue.test.ts -t 'TC-SET-NOTIFY' --reporter=verbose
```

- [ ] **Step 5: 提交**

```bash
git add src/app/api/admin/revenue/settlements/route.ts tests/api/revenue.test.ts
git commit -m "feat(Theme-2): 结算 pay 动作批量触发 tpl.settlement_paid 通知"
```

---

## Task 7: 实名审核 approve/reject → notify + 支持 reason 字段

**Files:**
- Modify: `src/app/api/admin/students/[id]/verify/route.ts`
- Test: `tests/api/admin-users-roles.test.ts`（或新建 admin-students-verify.test.ts）

**额外 gap：** 当前 reject 没有接收 reason 字段，但模板 `tpl.realname_rejected` 要 `{reason}`。本 Task 顺带补。

- [ ] **Step 1: 测试**

找一个已有的 admin 测试文件，加：

```typescript
  it('TC-RN-NOTIFY approve → tpl.realname_approved；reject + reason → tpl.realname_rejected', async () => {
    const { prisma } = await import('@/lib/prisma')
    const creator = await prisma.user.findUnique({ where: { phone: '13800001234' }, select: { id: true } })
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })

    // 先置为 pending
    await prisma.user.update({ where: { id: creator!.id }, data: { realNameStatus: 'pending' } })

    const { cookie: admC } = await adminLogin()
    let r = await http(`/api/admin/students/${creator!.id}/verify`, { method: 'POST', cookie: admC, body: { action: 'approve' } })
    expectOk(r, 'approve')
    let notes = await prisma.notification.findMany({ where: { userId: creator!.id } })
    expect(notes.some((n) => n.title.includes('实名') && n.type === 'system')).toBe(true)
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })

    await prisma.user.update({ where: { id: creator!.id }, data: { realNameStatus: 'pending' } })
    r = await http(`/api/admin/students/${creator!.id}/verify`, { method: 'POST', cookie: admC, body: { action: 'reject', reason: '身份证模糊' } })
    expectOk(r, 'reject')
    notes = await prisma.notification.findMany({ where: { userId: creator!.id } })
    expect(notes.some((n) => n.content?.includes('身份证模糊'))).toBe(true)

    // restore
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })
    await prisma.user.update({ where: { id: creator!.id }, data: { realNameStatus: 'verified' } })
  })
```

- [ ] **Step 2: 跑确认失败**

```bash
npx vitest run tests/api/admin-users-roles.test.ts -t 'TC-RN-NOTIFY' --reporter=verbose
```

- [ ] **Step 3: 改 route**

`src/app/api/admin/students/[id]/verify/route.ts`：

a) body 读取加 reason：

```typescript
const body = await request.json()
const { action, reason } = body as { action: 'approve' | 'reject'; reason?: string }
```

b) 顶部 import `notify`。update 之后：

```typescript
try {
  if (action === 'approve') {
    await notify(userId, 'tpl.realname_approved', {}, 'user', userId)
  } else {
    await notify(userId, 'tpl.realname_rejected', { reason: reason ?? '请重新提交' }, 'user', userId)
  }
} catch (e) {
  console.error('[notify] realname verify failed:', e)
}
```

c) logAdminAction 的 detail 把 reason 加进去（不强制，但合理）：

```typescript
detail: { action, reason: reason ?? null, before: user.realNameStatus, after: newStatus }
```

- [ ] **Step 4: 测试通过**

```bash
npx vitest run tests/api/admin-users-roles.test.ts -t 'TC-RN-NOTIFY' --reporter=verbose
```

- [ ] **Step 5: 提交**

```bash
git add src/app/api/admin/students/[id]/verify/route.ts tests/api/admin-users-roles.test.ts
git commit -m "feat(Theme-2): 实名审核 approve/reject 触发通知 + 支持 reject reason 字段"
```

---

## Task 8: 作业创建 → 广播给组内成员

**Files:**
- Modify: `src/app/api/admin/assignments/route.ts:42-79`
- Test: `tests/api/admin-groups-assignments.test.ts`

**行为：** 创建 assignment 后，查询该 `groupId` 下所有 creator（type='creator'），对每个人 notify `tpl.assignment_created`（变量：assignmentTitle / deadline / assignmentId）。广播用 Promise.all。

- [ ] **Step 1: 测试**

```typescript
  it('TC-ASN-NOTIFY 作业创建后广播 tpl.assignment_created 给组成员', async () => {
    const { prisma } = await import('@/lib/prisma')
    const creator = await prisma.user.findUnique({ where: { phone: '13800001234' }, select: { id: true } })
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })

    const group = await prisma.group.findUnique({ where: { inviteCode: 'E2ETEST1' } })
    const { cookie: admC } = await adminLogin()
    const r = await http('/api/admin/assignments', {
      method: 'POST',
      cookie: admC,
      body: { title: '通知测试作业', description: '做一做', groupId: group!.id, deadline: '2099-12-31' },
    })
    expectOk(r, 'assignment create')

    const asnId = (r.json.data as { id: number }).id
    const notes = await prisma.notification.findMany({ where: { userId: creator!.id, targetType: 'assignment', targetId: String(asnId) } })
    expect(notes.length).toBe(1)
    expect(notes[0].title).toContain('通知测试作业')
    expect(notes[0].type).toBe('assignment')

    await prisma.notification.deleteMany({ where: { userId: creator!.id } })
    await prisma.assignment.delete({ where: { id: asnId } })
  })
```

- [ ] **Step 2: 跑确认失败**

```bash
npx vitest run tests/api/admin-groups-assignments.test.ts -t 'TC-ASN-NOTIFY' --reporter=verbose
```

- [ ] **Step 3: 改 route**

`src/app/api/admin/assignments/route.ts` 顶部 import `notify`。在 `const assignment = await prisma.assignment.create(...)` 之后：

```typescript
try {
  const members = await prisma.userGroup.findMany({
    where: { groupId: assignment.groupId, user: { type: 'creator', status: 'active' } },
    select: { userId: true },
  })
  await Promise.all(
    members.map((m) =>
      notify(
        m.userId,
        'tpl.assignment_created',
        { assignmentTitle: assignment.title, deadline: assignment.deadline?.toISOString() ?? '', assignmentId: assignment.id },
        'assignment',
        assignment.id,
      ).catch((e) => console.error('[notify] assignment_created failed uid=', m.userId, e)),
    ),
  )
} catch (e) {
  console.error('[notify] assignment broadcast failed:', e)
}
```

- [ ] **Step 4: 测试通过**

```bash
npx vitest run tests/api/admin-groups-assignments.test.ts -t 'TC-ASN-NOTIFY' --reporter=verbose
```

- [ ] **Step 5: 提交**

```bash
git add src/app/api/admin/assignments/route.ts tests/api/admin-groups-assignments.test.ts
git commit -m "feat(Theme-2): 作业创建后广播 tpl.assignment_created 到组内成员"
```

---

## Task 9: ISRC 绑定 → notify 创作者

**Files:**
- Modify: `src/app/api/admin/songs/[id]/isrc/route.ts:6-37`
- Test: `tests/api/songs.test.ts`

- [ ] **Step 1: 测试**

```typescript
  it('TC-ISRC-NOTIFY 绑定 ISRC 成功后创作者收到 tpl.isrc_bound', async () => {
    const { prisma } = await import('@/lib/prisma')
    const creator = await prisma.user.findUnique({ where: { phone: '13800001234' }, select: { id: true } })
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })

    const song = await prisma.platformSong.create({
      data: { title: 'ISRC 通知测试', userId: creator!.id, status: 'reviewed', audioUrl: 'x', coverUrl: 'x' },
    })
    const { cookie: admC } = await adminLogin()
    const r = await http(`/api/admin/songs/${song.id}/isrc`, { method: 'POST', cookie: admC, body: { isrc: 'CN-TEST-26-99999' } })
    expectOk(r, 'isrc bind')

    const notes = await prisma.notification.findMany({ where: { userId: creator!.id, targetType: 'song', targetId: String(song.id) } })
    expect(notes.some((n) => n.content?.includes('CN-TEST-26-99999'))).toBe(true)

    await prisma.notification.deleteMany({ where: { userId: creator!.id } })
    await prisma.platformSong.delete({ where: { id: song.id } })
  })
```

- [ ] **Step 2: 跑确认失败**

```bash
npx vitest run tests/api/songs.test.ts -t 'TC-ISRC-NOTIFY' --reporter=verbose
```

- [ ] **Step 3: 改 route**

`src/app/api/admin/songs/[id]/isrc/route.ts` 顶部 import `notify`。在 update 之后：

```typescript
try {
  await notify(
    song.userId,
    'tpl.isrc_bound',
    { songTitle: song.title, isrc, songId: song.id },
    'song',
    song.id,
  )
} catch (e) {
  console.error('[notify] isrc_bound failed:', e)
}
```

- [ ] **Step 4: 测试通过**

```bash
npx vitest run tests/api/songs.test.ts -t 'TC-ISRC-NOTIFY' --reporter=verbose
```

- [ ] **Step 5: 提交**

```bash
git add src/app/api/admin/songs/[id]/isrc/route.ts tests/api/songs.test.ts
git commit -m "feat(Theme-2): ISRC 绑定后触发 tpl.isrc_bound 通知"
```

---

## Task 10: 前端通知点击 → 跳转 linkUrl

**Files:**
- Modify: `src/app/(creator)/creator/notifications/page.tsx:11-17,134`

**行为：** 通知卡片 `onClick` 先 `markAsRead(id)` 再 `router.push(n.linkUrl)`（若 linkUrl 存在）。加一个 subtitle 显示 `content` 前 60 字。

- [ ] **Step 1: 改 Notification 接口**

```typescript
interface Notification {
  id: number
  type: NotificationType
  title: string
  content: string | null
  linkUrl: string | null
  time: string
  read: boolean
}
```

- [ ] **Step 2: 改 map 块**

```typescript
const list = notifications.map((n) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  content: n.content,
  linkUrl: n.linkUrl,
  read: n.read,
  time: formatRelativeTime(n.createdAt),  // 或你原有的时间格式化
}))
```

- [ ] **Step 3: 改 onClick**

找到通知卡片 `onClick={() => markAsRead(n.id)}`，替换为：

```tsx
onClick={() => {
  void markAsRead(n.id)
  if (n.linkUrl) router.push(n.linkUrl)
}}
```

`router` 用 `const router = useRouter()`（next/navigation）导入，若已 import 则复用。

- [ ] **Step 4: 在标题下加 content 摘要（可选）**

```tsx
{n.content && <div className="text-xs text-[var(--text3)] mt-0.5 truncate">{n.content}</div>}
```

- [ ] **Step 5: 手动验证**

打开 `/creator/notifications`，点一条带 linkUrl 的通知（先跑 Task 6 或 Task 4 造一条），期望：
- 卡片变灰（已读样式）
- 浏览器跳转到 linkUrl

- [ ] **Step 6: 提交**

```bash
git add src/app/\(creator\)/creator/notifications/page.tsx
git commit -m "feat(Theme-2): 通知卡片点击跳转 linkUrl + 显示 content 摘要"
```

---

## Task 11: 集成自测 + CLAUDE.md 更新 + PR

**Files:**
- Modify: `CLAUDE.md`
- Verify: 全量测试

- [ ] **Step 1: 跑全量测试（prod 模式）**

确保 prod server 在 :3100 运行（`TEST_MODE=1 npx next start -p 3100`），然后：

```bash
cd "D:/Project/museek"
npx tsc --noEmit
TEST_BASE_URL=http://localhost:3100 npm run test 2>&1 | tail -10
```

Expected: tsc 无错；全量测试 Batch 1A + Theme 2 新增 case 全 PASS。Pre-existing 11 条失败数不变。

- [ ] **Step 2: 手动 E2E**

| 场景 | 操作 | 期望 |
|---|---|---|
| 评审→通知 | 评审端对一个 pending_review 作品打分提交 | `/creator/notifications` 新增一条，点击跳 `/creator/songs?id=X` |
| 发行→通知 | admin 点 publish | 同上 |
| 打款→通知 | admin 把 settlement 点 pay | `/creator/notifications` 多一条，type=revenue |
| 实名驳回 | admin 点驳回填 reason | 创作者端通知含 reason 文本 |
| 新作业广播 | admin 给组建作业 | 组内所有 creator 都收到 |
| ISRC 绑定 | admin 绑一个 ISRC | 创作者通知含该 ISRC |

- [ ] **Step 3: CLAUDE.md 加一段**

找到「运行时配置（Batch 1A 起）」后面，追加：

```markdown
## 通知触发（Theme 2 起）

6 类业务动作事务完成后自动 `notify(...)`（`src/lib/notifications.ts`）：评审提交 / 歌曲 publish|archive / 结算 pay / 实名 approve|reject / 作业创建广播 / ISRC 绑定。通知失败只打 console.error，不回滚主业务。

模板从 `notification_templates` DB 读，fallback 到 `DEFAULT_TEMPLATES`。前端 `/creator/notifications` 点击卡片跳 `linkUrl`。

**字段契约** (`Notification` schema)：`id / userId / type / title / content / targetType / targetId / linkUrl / read / createdAt`。
```

- [ ] **Step 4: 提交 + 推 + 开 PR**

```bash
git add CLAUDE.md
git commit -m "docs(Theme-2): CLAUDE.md 补通知触发说明"
git push -u origin feature/theme2-notifications
```

PR 用既有 REST API 流程（参考 Batch 1A 创建 PR 的脚本逻辑，见会话历史：用 `git credential fill` 拿 token，curl `https://api.github.com/repos/qianyuyouye/museek/pulls`）。

PR title: `feat(Theme-2): 6 业务动作触发站内通知 + Notification schema 扩字段`

PR body 要点：
- 消灭的 P0/P1：GAP-LOOP-005 / GAP-CRTR-001 / GAP-CRTR-038 / GAP-ADMIN-050 / GAP-ADMIN-089 / GAP-SCHM-006
- 不在本 PR：作业截止定时提醒（需 cron 基础设施，单独 Theme）、作业提交 → reviewer 通知（缺 reviewer 分配机制，单独 Theme）

---

## 运行时配置（非 plan 步骤，参考信息）

- prod server 启动：`TEST_MODE=1 npx next start -p 3100`（继承 Batch 1A 验收时的配置）
- seed-test-users 已存在：admin / `13800001234` creator / `13500008888` reviewer / E2ETEST1 group
- 如果 prod server 没起：参考 `prisma/seed-test-users.ts` + `npm run build && TEST_MODE=1 npx next start -p 3100`

---

## Self-Review Checklist

**Spec coverage（对照 `docs/superpowers/specs/2026-04-20-platform-alignment-gap-list.md` 主题 2）：**

- [x] 评审通过 → 通知（Task 4）
- [x] 发行完成 → 通知（Task 5）
- [x] 结算打款 → 通知（Task 6）
- [x] 实名审核 → 通知（Task 7）
- [x] 作业需修改 → 通知（Task 4 的 tpl.song_needs_revision 分支覆盖；代码来源同一路由）
- [x] 作业创建广播 → 通知（Task 8）
- [x] ISRC 绑定 → 通知（Task 9，补了 Batch 1A 未列模板）
- [x] schema `target_type / target_id / content / link_url`（Task 1）
- [x] 通知模板化（Batch 1A 已完成，本 plan 只是补 'tpl.isrc_bound' + 调用）
- [ ] 作业截止提醒 → **超出范围**（需 cron 基础设施）
- [ ] 作业提交 → reviewer 通知 → **超出范围**（缺 reviewer 分配机制，见 gap 4e 报告）

**Placeholder scan:** 无 TBD / TODO；所有 step 带完整代码或具体命令。

**Type consistency:**
- `notify()` 签名在 Task 2 定义，Task 4-9 调用保持一致（`userId, templateKey, vars, targetType?, targetId?`）
- `TemplateKey` 'tpl.isrc_bound' 在 Task 2 新增，Task 9 使用
- `NotificationResponse` / `NotificationsListResponse` 在 Task 3 定义；Task 10 的前端 Notification interface 用相同字段名（content / linkUrl）
- `targetId` 在 schema 是 `String?`（Task 1），所有 notify 调用把 number id 用 `String(id)` 转（Task 2 的 notify 内部处理）

---

## 执行建议

**推荐执行方式：Subagent-Driven（superpowers:subagent-driven-development）**

理由：
- 11 个 Task 独立性高（每个 Task 一个 commit、一条或几条测试）
- 每个业务动作路由互不影响，测试失败可单独调
- Subagent 能自验证（跑 vitest 相关 case）

**执行提示：**
1. Task 1 是 schema 前置，必须先做且验证 `prisma db push` 成功
2. Task 2 是 notify 函数，Task 4-9 所有依赖它
3. Task 3 / 10 是前端消费侧，Task 4-9 的集成测试已验证后端字段，前端改动相对独立
4. 每个 Task 的测试都要跑 prod server（`:3100`），别切回 dev

**预计耗时：** 4-6 小时
