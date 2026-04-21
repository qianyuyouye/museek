# Theme 7: 核心用户流程闭环断链修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 5 条独立 P0/P2 bug（GAP-CRTR-002/003/005 + GAP-ADMIN-006/051），让创作者作品库入库 Tab、汽水收益 Tab、拖拽上传、评审绩效页权限口径、用户档案副标题全部恢复到 PRD 要求的行为。

**Architecture:** 每条 bug 独立修复、独立提交，不做跨 bug 抽象。后端改动聚焦参数解析 + 额外 query；前端改动聚焦事件绑定与文案。新增 `/api/admin/teachers` 让评审绩效页摆脱对 `admin.accounts.view` 权限的耦合。

**Tech Stack:** Next.js 15 App Router + Prisma + React 19 + Vitest（集成测试跑在 dev server）

---

## File Structure

本次改动涉及以下文件（严格限制在 bug 范围内，不动相邻逻辑）：

| 文件 | 动作 | 责任 |
|---|---|---|
| `src/app/api/creator/songs/route.ts` | 修改 | 识别虚拟状态 `in_library`，映射为三状态 `in` 筛选 |
| `src/app/api/creator/revenue/route.ts` | 修改 | 在返回体新增 `qishuiDetails: { list, total }` |
| `src/app/(creator)/creator/revenue/page.tsx` | 无需改动 | 前端已通过 `qishuiObj?.list ?? []` 消费，API 补字段即可生效 |
| `src/app/(creator)/creator/upload/page.tsx` | 修改 | 音频/封面 dashed 容器加 `onDragOver` / `onDrop` |
| `src/app/(creator)/creator/assignments/page.tsx` | 修改 | 作业提交页音频 dashed 容器加 `onDragOver` / `onDrop` |
| `src/app/api/admin/teachers/route.ts` | 新建 | 独立评审绩效 API，权限 `admin.teachers.view` |
| `src/app/(admin)/admin/teachers/page.tsx` | 修改 | 调用新 `/api/admin/teachers` 而非 `accounts?tab=reviewer` |
| `src/app/api/admin/students/route.ts` | 修改 | 不显式传 `type` 时默认 `type=creator` |
| `src/app/(admin)/admin/students/page.tsx` | 修改 | 副标题改为"共 N 名创作者" |
| `tests/api/creator.test.ts` | 修改 | 新增 `status=in_library`、`qishuiDetails` 断言 |
| `tests/api/songs.test.ts` 或新建 `tests/api/theme7.test.ts` | 新建 | `/api/admin/teachers` + students 默认过滤断言 |

`tests/api/theme7.test.ts` 是推荐的新测试文件位置，保持 1 主题 1 测试文件节奏。

---

## Task 1: 创作者 `status=in_library` 映射三状态（GAP-CRTR-002）

**Files:**
- Modify: `src/app/api/creator/songs/route.ts:16-22`
- Test: `tests/api/creator.test.ts`（新增用例追加到 `describe('创作者端', ...)` 中）

- [ ] **Step 1: 先写失败的集成测试**

在 `tests/api/creator.test.ts` 中 `it('GET /api/creator/songs?status=needs_revision 需修改', ...)` 之后追加：

```typescript
  it('GET /api/creator/songs?status=in_library 合并 reviewed/ready_to_publish/archived', async () => {
    const r = await http('/api/creator/songs?status=in_library', { cookie })
    expectOk(r, 'in_library')
    const list = r.json.data.list as { status: string }[]
    const allowed = new Set(['reviewed', 'ready_to_publish', 'archived'])
    expect(list.every((s) => allowed.has(s.status))).toBe(true)
  })
```

- [ ] **Step 2: 运行测试确认 fail**

本地起 dev server 后：

```bash
npx vitest run tests/api/creator.test.ts -t "status=in_library"
```

预期：失败，`expected 400 to equal 200`（当前后端直接 400「无效的状态值」）。

- [ ] **Step 3: 修改 API 接受虚拟状态**

改 `src/app/api/creator/songs/route.ts`，把 `where` 构造逻辑改为：

```typescript
  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const status = searchParams.get('status')

  const IN_LIBRARY_STATUSES: SongStatus[] = ['reviewed', 'ready_to_publish', 'archived']

  if (status && status !== 'all' && status !== 'in_library' && !VALID_STATUSES.has(status)) {
    return err('无效的状态值')
  }

  const where = {
    userId,
    ...(status === 'in_library'
      ? { status: { in: IN_LIBRARY_STATUSES } }
      : status && status !== 'all'
        ? { status: status as SongStatus }
        : {}),
  }
```

注意：`SongStatus[]` 字面量数组不需要再手动 `as SongStatus[]`，TS 会从 enum 导入推断。如 TS 报错，显式 `: SongStatus[]` 保持即可。

- [ ] **Step 4: 运行测试确认 pass**

```bash
npx vitest run tests/api/creator.test.ts -t "status=in_library"
```

同时回归原三条 `status=` 用例：

```bash
npx vitest run tests/api/creator.test.ts -t "作品库|筛选已发行|需修改"
```

全部 pass。

- [ ] **Step 5: 类型检查**

```bash
npx tsc --noEmit
```

预期：0 错误。

- [ ] **Step 6: Commit**

```bash
git add src/app/api/creator/songs/route.ts tests/api/creator.test.ts
git commit -m "fix(creator): songs 接受 status=in_library 映射 reviewed/ready_to_publish/archived（GAP-CRTR-002）"
```

---

## Task 2: 创作者收益页返回 `qishuiDetails` 列表（GAP-CRTR-003）

**Files:**
- Modify: `src/app/api/creator/revenue/route.ts:72-111`
- Test: `tests/api/creator.test.ts`

- [ ] **Step 1: 先写失败的集成测试**

在 `tests/api/creator.test.ts` 的 `it('GET /api/creator/revenue 两 Tab 数据结构', ...)` 之后追加：

```typescript
  it('GET /api/creator/revenue 返回 qishuiDetails.list 列表', async () => {
    const r = await http('/api/creator/revenue', { cookie })
    expectOk(r, 'qishuiDetails')
    const qd = r.json.data.qishuiDetails
    expect(qd).toBeTruthy()
    expect(Array.isArray(qd.list)).toBe(true)
    expect(typeof qd.total).toBe('number')
  })
```

- [ ] **Step 2: 运行测试确认 fail**

```bash
npx vitest run tests/api/creator.test.ts -t "qishuiDetails"
```

预期：`expected undefined to be truthy`（当前 API 没有 qishuiDetails 字段）。

- [ ] **Step 3: 在 revenue route 追加 qishuiDetails 查询**

修改 `src/app/api/creator/revenue/route.ts`，在当前 `qishuiAgg` 聚合后追加明细查询，并把返回体加字段：

把第 71-76 行替换为：

```typescript
  // 汽水收益聚合与明细：通过 revenueRows joined via songMappings
  const [qishuiAgg, qishuiRows, qishuiRowCount] = await Promise.all([
    prisma.revenueRow.aggregate({
      where: { mapping: { creatorId: userId } },
      _sum: { totalRevenue: true },
    }),
    prisma.revenueRow.findMany({
      where: { mapping: { creatorId: userId } },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        songName: true,
        period: true,
        douyinRevenue: true,
        qishuiRevenue: true,
        totalRevenue: true,
      },
    }),
    prisma.revenueRow.count({ where: { mapping: { creatorId: userId } } }),
  ])
  const qishuiTotal = toNumber(qishuiAgg._sum.totalRevenue)
  const qishuiDetailsList = qishuiRows.map((row) => ({
    id: row.id,
    songName: row.songName,
    period: row.period,
    month: row.period,  // UI 兼容字段 row.month ?? row.period
    douyinRevenue: toNumber(row.douyinRevenue),
    qishuiRevenue: toNumber(row.qishuiRevenue),
    totalRevenue: toNumber(row.totalRevenue),
  }))
```

把返回体 `return ok({...})` 中间加入 `qishuiDetails` 字段（放在 `qishuiRevenue` 后面）：

```typescript
  return ok({
    settlements: { list: settleList, total: settleTotal, page, pageSize },
    qishuiRevenue: qishuiTotal,
    qishuiDetails: { list: qishuiDetailsList, total: qishuiRowCount },
    stats: {
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      paidAmount: Math.round(paidAmount * 100) / 100,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      total: Math.round(totalEarnings * 100) / 100,
      qishuiTotal: Math.round(qishuiTotal * 100) / 100,
      paid: Math.round(paidAmount * 100) / 100,
      pending: Math.round(pendingAmount * 100) / 100,
    },
  })
```

- [ ] **Step 4: 运行测试确认 pass**

```bash
npx vitest run tests/api/creator.test.ts -t "qishuiDetails|两 Tab"
```

预期：全部 pass。

- [ ] **Step 5: 类型检查**

```bash
npx tsc --noEmit
```

预期：0 错误。

- [ ] **Step 6: Commit**

```bash
git add src/app/api/creator/revenue/route.ts tests/api/creator.test.ts
git commit -m "fix(creator): revenue 返回 qishuiDetails.list 让汽水 Tab 表格可渲染（GAP-CRTR-003）"
```

---

## Task 3: 创作者上传页拖拽上传（GAP-CRTR-005）

**Files:**
- Modify: `src/app/(creator)/creator/upload/page.tsx:449-503`
- Modify: `src/app/(creator)/creator/assignments/page.tsx:300-327`

本任务为纯 UI 行为修复，无集成测试（TDD 跳过，理由：HTMLDrop 事件需 jsdom + dragEventConstructor polyfill，性价比过低；改动极轻量，靠视觉回归验证）。执行时只做代码审查 + 手动 smoke。

- [ ] **Step 1: 修改 upload/page.tsx 音频 dashed 区**

把 `src/app/(creator)/creator/upload/page.tsx:449-456` 这段：

```tsx
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                form.audioUploaded
                  ? 'border-[var(--green)] bg-green-50/30'
                  : 'border-[var(--border)] hover:border-[var(--accent)]'
              }`}
              onClick={() => audioRef.current?.click()}
            >
```

改为：

```tsx
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                form.audioUploaded
                  ? 'border-[var(--green)] bg-green-50/30'
                  : 'border-[var(--border)] hover:border-[var(--accent)]'
              }`}
              onClick={() => audioRef.current?.click()}
              onDragOver={(e) => { e.preventDefault() }}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) handleFileUpload(f, 'audio')
              }}
            >
```

- [ ] **Step 2: 修改 upload/page.tsx 封面 dashed 区**

把 `src/app/(creator)/creator/upload/page.tsx:481-488` 这段：

```tsx
            <div
              className={`mt-4 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                form.coverUploaded
                  ? 'border-[var(--green)] bg-green-50/30'
                  : 'border-[var(--border)] hover:border-[var(--accent)]'
              }`}
              onClick={() => coverRef.current?.click()}
            >
```

改为：

```tsx
            <div
              className={`mt-4 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                form.coverUploaded
                  ? 'border-[var(--green)] bg-green-50/30'
                  : 'border-[var(--border)] hover:border-[var(--accent)]'
              }`}
              onClick={() => coverRef.current?.click()}
              onDragOver={(e) => { e.preventDefault() }}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) handleFileUpload(f, 'image')
              }}
            >
```

- [ ] **Step 3: 修改 assignments/page.tsx 音频 dashed 区**

把 `src/app/(creator)/creator/assignments/page.tsx:300-303` 这段：

```tsx
          <div
            className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center cursor-pointer transition-all mb-6 hover:border-[var(--accent)]"
            onClick={() => audioRef.current?.click()}
          >
```

改为：

```tsx
          <div
            className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center cursor-pointer transition-all mb-6 hover:border-[var(--accent)]"
            onClick={() => audioRef.current?.click()}
            onDragOver={(e) => { e.preventDefault() }}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              if (f) handleAudioUpload(f)
            }}
          >
```

- [ ] **Step 4: 类型检查**

```bash
npx tsc --noEmit
```

预期：0 错误。

- [ ] **Step 5: Build 检查**

```bash
npm run build
```

预期：构建成功，无 React 警告。如果 build 时间过长，也可只跑 lint：

```bash
npx next lint --dir src/app/\(creator\)
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(creator\)/creator/upload/page.tsx src/app/\(creator\)/creator/assignments/page.tsx
git commit -m "fix(creator): upload/assignments dashed 区补 onDragOver+onDrop 支持拖拽上传（GAP-CRTR-005）"
```

---

## Task 4: 新建 `/api/admin/teachers` 独立评审绩效 API（GAP-ADMIN-006）

**Files:**
- Create: `src/app/api/admin/teachers/route.ts`
- Modify: `src/app/(admin)/admin/teachers/page.tsx:68-71`
- Test: `tests/api/theme7.test.ts`（新建）

**Why 新建独立路由：** sidebar 的权限 key 是 `admin.teachers.view`，但当前页面调 `/api/admin/accounts?tab=reviewer` 走的是 `admin.accounts.view`。持有评审绩效权限但无账号管理权限的管理员会 403。

- [ ] **Step 1: 先写失败的集成测试**

新建 `tests/api/theme7.test.ts`：

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, expectOk } from './_helpers'

let adminCookie = ''

describe('Theme 7 fixes', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
  })

  describe('/api/admin/teachers (GAP-ADMIN-006)', () => {
    it('GET 返回 list+total，含 reviewCount/avgTimeSeconds/avgScore/recommendRate', async () => {
      const r = await http('/api/admin/teachers?pageSize=100', { cookie: adminCookie })
      expectOk(r, 'teachers')
      const list = r.json.data.list as Array<Record<string, unknown>>
      expect(Array.isArray(list)).toBe(true)
      expect(typeof r.json.data.total).toBe('number')
      if (list.length > 0) {
        const row = list[0]
        expect(row).toHaveProperty('reviewCount')
        expect(row).toHaveProperty('avgTimeSeconds')
        expect(row).toHaveProperty('avgScore')
        expect(row).toHaveProperty('recommendRate')
      }
    })

    it('GET 只返回 type=reviewer 用户', async () => {
      const r = await http('/api/admin/teachers?pageSize=100', { cookie: adminCookie })
      expectOk(r, 'teachers type')
      const list = r.json.data.list as Array<{ type?: string }>
      expect(list.every((u) => !u.type || u.type === 'reviewer')).toBe(true)
    })
  })
})
```

- [ ] **Step 2: 运行测试确认 fail**

```bash
npx vitest run tests/api/theme7.test.ts -t "teachers"
```

预期：`expected 404 to equal 200`（路由不存在）。

- [ ] **Step 3: 新建 teachers route**

新建 `src/app/api/admin/teachers/route.ts`：

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, parsePagination, safeHandler } from '@/lib/api-utils'
import { Prisma } from '@prisma/client'

/**
 * 评审绩效列表：LEFT JOIN reviews 聚合每个 reviewer 的批改数/平均用时/平均评分/推荐率。
 * 权限 key: admin.teachers.view（与 sidebar 对齐；不复用 admin.accounts.view）。
 */
export const GET = safeHandler(async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.teachers.view')
  if ('error' in auth) return auth.error

  const { searchParams } = request.nextUrl
  const { page, pageSize, skip } = parsePagination(searchParams)
  const search = searchParams.get('search')

  const where: Prisma.UserWhereInput = { type: 'reviewer' }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { realName: { contains: search } },
      { phone: { contains: search } },
    ]
  }

  const [total, reviewers] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        realName: true,
        phone: true,
        avatarUrl: true,
        adminLevel: true,
      },
    }),
  ])

  const reviewerIds = reviewers.map((u) => u.id)
  const stats = new Map<number, { reviewCount: number; avgTimeSeconds: number; avgScore: number; recommendRate: number }>()

  if (reviewerIds.length > 0) {
    const agg = await prisma.review.groupBy({
      by: ['reviewerId'],
      where: { reviewerId: { in: reviewerIds } },
      _count: { _all: true },
      _avg: { totalScore: true, durationSeconds: true },
    })
    const recCounts = await prisma.review.groupBy({
      by: ['reviewerId'],
      where: { reviewerId: { in: reviewerIds }, recommendation: 'strongly_recommend' },
      _count: { _all: true },
    })
    const recMap = new Map(recCounts.map((r) => [r.reviewerId, r._count._all]))
    for (const row of agg) {
      const cnt = row._count._all
      const strongly = recMap.get(row.reviewerId) ?? 0
      stats.set(row.reviewerId, {
        reviewCount: cnt,
        avgTimeSeconds: Math.round(row._avg.durationSeconds ?? 0),
        avgScore: Math.round((row._avg.totalScore ?? 0) * 10) / 10,
        recommendRate: cnt > 0 ? Math.round((strongly / cnt) * 100) : 0,
      })
    }
  }

  const list = reviewers.map((u) => ({
    id: u.id,
    name: u.realName || u.name,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    adminLevel: u.adminLevel,
    type: 'reviewer' as const,
    ...(stats.get(u.id) ?? { reviewCount: 0, avgTimeSeconds: 0, avgScore: 0, recommendRate: 0 }),
  }))

  return ok({ list, total, page, pageSize })
})
```

- [ ] **Step 4: 切换 teachers 页面调用**

修改 `src/app/(admin)/admin/teachers/page.tsx:68-70`，把：

```tsx
  const { data: teachersData, loading } = useApi<{ list: Teacher[] }>(
    '/api/admin/accounts?tab=reviewer&pageSize=100'
  )
```

改为：

```tsx
  const { data: teachersData, loading } = useApi<{ list: Teacher[] }>(
    '/api/admin/teachers?pageSize=100'
  )
```

- [ ] **Step 5: 运行测试确认 pass**

```bash
npx vitest run tests/api/theme7.test.ts -t "teachers"
```

预期：两条用例 pass。

- [ ] **Step 6: 类型检查 + 回归老测试**

```bash
npx tsc --noEmit
npx vitest run tests/api/songs.test.ts -t "accounts?tab=reviewer"
npx vitest run tests/api/stats-extra.test.ts -t "accounts?tab=reviewer"
```

预期：原 `/api/admin/accounts?tab=reviewer` 测试依然 pass（保留不动），新测试也 pass。

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/teachers/route.ts src/app/\(admin\)/admin/teachers/page.tsx tests/api/theme7.test.ts
git commit -m "feat(admin): 新建 /api/admin/teachers 解绑 accounts 权限，评审绩效页走独立 API（GAP-ADMIN-006）"
```

---

## Task 5: `/api/admin/students` 默认只返回创作者 + 修正副标题（GAP-ADMIN-051）

**Files:**
- Modify: `src/app/api/admin/students/route.ts:27-29`
- Modify: `src/app/(admin)/admin/students/page.tsx:501`
- Test: `tests/api/theme7.test.ts`

**决策：** 用户档案 = 创作者档案（对应 PRD §7.3.1 面向创作者的档案）。`/admin/teachers` 承载评审列表。把 `/api/admin/students` 默认 `type=creator`；前端若要看评审，可显式传 `?type=reviewer`（保留能力，不破坏可扩展性）。副标题改为"共 N 名创作者"。

- [ ] **Step 1: 在 theme7.test.ts 追加失败测试**

在 Task 4 新建的 `tests/api/theme7.test.ts` 的 `describe('Theme 7 fixes', ...)` 内追加：

```typescript
  describe('/api/admin/students 默认创作者 (GAP-ADMIN-051)', () => {
    it('不传 type 参数默认只返回 creator', async () => {
      const r = await http('/api/admin/students?pageSize=100', { cookie: adminCookie })
      expectOk(r, 'students default creator')
      const list = r.json.data.list as Array<{ type: string }>
      expect(list.every((u) => u.type === 'creator')).toBe(true)
    })

    it('显式 type=reviewer 仍可返回评审', async () => {
      const r = await http('/api/admin/students?type=reviewer&pageSize=100', { cookie: adminCookie })
      expectOk(r, 'students explicit reviewer')
      const list = r.json.data.list as Array<{ type: string }>
      expect(list.every((u) => u.type === 'reviewer')).toBe(true)
    })
  })
```

- [ ] **Step 2: 运行测试确认 fail**

```bash
npx vitest run tests/api/theme7.test.ts -t "默认创作者"
```

预期：第一条失败，因为当前 API 默认返回 creator+reviewer。

- [ ] **Step 3: 修改 students API 默认过滤**

修改 `src/app/api/admin/students/route.ts`，把第 21-29 行：

```typescript
  const type = searchParams.get('type')
  const realNameStatus = searchParams.get('realNameStatus')
  const search = searchParams.get('search')

  const where: Prisma.UserWhereInput = {}

  if (type === 'creator' || type === 'reviewer') {
    where.type = type
  }
```

改为：

```typescript
  const type = searchParams.get('type')
  const realNameStatus = searchParams.get('realNameStatus')
  const search = searchParams.get('search')

  const where: Prisma.UserWhereInput = {}

  // 默认只返回创作者（用户档案库 = 创作者档案）；显式传 type=reviewer 可切换
  if (type === 'reviewer') {
    where.type = 'reviewer'
  } else {
    where.type = 'creator'
  }
```

- [ ] **Step 4: 修改 students 页面副标题**

修改 `src/app/(admin)/admin/students/page.tsx:499-502`，把：

```tsx
      <PageHeader
        title="用户档案库"
        subtitle={`共 ${studentsData?.total ?? 0} 名用户（含创作者与评审）`}
      />
```

改为：

```tsx
      <PageHeader
        title="用户档案库"
        subtitle={`共 ${studentsData?.total ?? 0} 名创作者`}
      />
```

- [ ] **Step 5: 运行测试确认 pass**

```bash
npx vitest run tests/api/theme7.test.ts -t "默认创作者|type=reviewer"
```

预期：两条用例 pass。

- [ ] **Step 6: 回归跑整个 theme7 + 相关老测**

```bash
npx vitest run tests/api/theme7.test.ts
npx vitest run tests/api/admin-users-roles.test.ts
```

预期：theme7 全 pass；admin-users-roles 如果包含对 `/api/admin/students` 的断言需要人工检视 —— 若老用例不传 `type` 时断言 reviewer 存在，改为显式 `?type=reviewer` 即可。

- [ ] **Step 7: 类型检查**

```bash
npx tsc --noEmit
```

预期：0 错误。

- [ ] **Step 8: Commit**

```bash
git add src/app/api/admin/students/route.ts src/app/\(admin\)/admin/students/page.tsx tests/api/theme7.test.ts
git commit -m "fix(admin): students 默认 type=creator，副标题改为「共 N 名创作者」（GAP-ADMIN-051）"
```

---

## Task 6: 最终三轮审查 + 全量回归

**Files:** 无改动，纯验证。

- [ ] **Step 1: 跑全量测试**

```bash
npm test
```

预期：全部 pass。

- [ ] **Step 2: Build 一次确认无 lint/类型硬错**

```bash
npx tsc --noEmit && npm run build
```

预期：0 错误，构建成功。

- [ ] **Step 3: 三轮代码审查（Claude 自检）**

按 CLAUDE.md 要求，对 Task 1-5 所有改动做 3 轮 review：
1. 条件判断是否覆盖 `status=all`、`status=in_library`、`status=pending_review` 三种分支。
2. `qishuiDetails` 追加查询是否会影响 N+1（只跑一次，且被 Promise.all 并行化）。
3. `/api/admin/teachers` 是否漏 search 参数（已补）；students 默认过滤是否会漏调用方（全仓 grep `/api/admin/students` 走查）。
4. 拖拽事件 `preventDefault` 是否两处都加（onDragOver + onDrop 缺一不可）。
5. 副标题文案 + Theme 7 测试文件是否都已 stage。

列出每轮发现 + 处理结论。

- [ ] **Step 4: 输出修复报告**

把 5 条 bug 的 before/after 行号 + 测试用例名列成一张表贴在终端，确认对齐 spec。无需额外 commit。

---

## Self-Review

**Spec 覆盖检查：**
- GAP-CRTR-002 → Task 1 ✅（in_library 三状态映射）
- GAP-CRTR-003 → Task 2 ✅（qishuiDetails.list）
- GAP-CRTR-005 → Task 3 ✅（upload + assignments 两处 dashed 容器）
- GAP-ADMIN-006 → Task 4 ✅（新建 /api/admin/teachers 解绑 accounts 权限）
- GAP-ADMIN-051 → Task 5 ✅（默认 type=creator + 副标题）

**Placeholder 扫描：** 无 TBD/TODO。每个代码步骤都有完整代码块。

**类型一致性：** `handleFileUpload(f, 'audio' | 'image')` 与 `handleAudioUpload(f)` 函数签名已核对；`VALID_STATUSES` 原有导入保留，`IN_LIBRARY_STATUSES` 常量局部新增；`qishuiDetails: { list, total }` 前端 `qishuiObj?.list ?? []` 已存在消费逻辑无需改动。
