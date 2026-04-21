# Admin 创建 Creator 账号 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox `- [ ]` syntax.

**Goal:** 管理端后台能创建创作者账号（已能创建 admin / reviewer，独缺 creator），解决 `GAP-ADMIN-NEW-CREATE-CREATOR`（用户回归反馈，P1）。

**Architecture:** 仿现有 `POST /api/admin/accounts/create-reviewer` + `/admin/accounts` reviewer tab 创建按钮的实现。新增 `POST /api/admin/accounts/create-creator` 路由；放开 accounts 页 `tab === 'reviewer'` 条件，让 creator tab 也有创建按钮；复用 AdminModal + 相似表单结构。

**Tech Stack:** Next.js App Router / Prisma / React / 已有 `tests/api/_helpers.ts` 辅助函数

---

## 文件结构

### 新建文件（1 个）
- `src/app/api/admin/accounts/create-creator/route.ts` — 创建 creator 的 POST 路由

### 修改文件（2 个）
- `src/app/(admin)/admin/accounts/page.tsx` — 按钮条件 + 新 Modal + CreateCreatorForm 组件
- `tests/api/admin-users-roles.test.ts` — 新增 API 测试

---

## Task 1: `POST /api/admin/accounts/create-creator` 路由 + 测试

**Files:**
- Create: `D:/Project/museek/src/app/api/admin/accounts/create-creator/route.ts`
- Test: `D:/Project/museek/tests/api/admin-users-roles.test.ts`

**行为：**
- body 必填：`name` / `phone` / `password`；可选：`email` / `groupId`
- 校验：phone 格式、password 至少 8 位且含字母+数字、phone 不重复
- 创建 `User { type: 'creator', realNameStatus: 'unverified' }`
- groupId 存在则绑 UserGroup
- logAdminAction('create_creator', ...)
- 返回 `{ id, name, phone, email, type, groups }`

### Step 1: 从 main 切分支

```bash
cd "D:/Project/museek"
git checkout main && git pull
git checkout -b feature/admin-create-creator
```

### Step 2: 先写失败测试

在 `tests/api/admin-users-roles.test.ts` 末尾追加：

```typescript
  it('TC-CCR-001 admin POST /api/admin/accounts/create-creator 创建 creator 账号', async () => {
    const { prisma } = await import('@/lib/prisma')
    // 清掉可能的同号遗留
    const testPhone = `1380000${Math.floor(1000 + Math.random() * 9000)}`
    await prisma.user.deleteMany({ where: { phone: testPhone } })

    const { cookie: admC } = await adminLogin()
    const group = await prisma.group.findUnique({ where: { inviteCode: 'E2ETEST1' } })

    const r = await http('/api/admin/accounts/create-creator', {
      method: 'POST',
      cookie: admC,
      body: { name: '测试创作者', phone: testPhone, email: 'test@x.com', password: 'Abc12345', groupId: group!.id },
    })
    expectOk(r, 'create-creator')
    const data = r.json.data as { id: number; name: string; phone: string; type: string; groups: Array<{ id: number; name: string }> }
    expect(data.type).toBe('creator')
    expect(data.phone).toBe(testPhone)
    expect(data.groups.length).toBe(1)

    // 验证能用这个账号登录 creator 端
    const loginR = await http('/api/auth/login', {
      method: 'POST',
      body: { account: testPhone, password: 'Abc12345', portal: 'creator' },
    })
    expect(loginR.json.code).toBe(200)

    // cleanup
    await prisma.userGroup.deleteMany({ where: { userId: data.id } })
    await prisma.user.delete({ where: { id: data.id } })
  })

  it('TC-CCR-002 重复 phone → 400', async () => {
    const { cookie: admC } = await adminLogin()
    const r = await http('/api/admin/accounts/create-creator', {
      method: 'POST',
      cookie: admC,
      body: { name: '重复测试', phone: '13800001234', password: 'Abc12345' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('已被注册')
  })

  it('TC-CCR-003 密码弱（无字母或无数字）→ 400', async () => {
    const { cookie: admC } = await adminLogin()
    const r = await http('/api/admin/accounts/create-creator', {
      method: 'POST',
      cookie: admC,
      body: { name: '弱密码', phone: '13911112222', password: '12345678' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toMatch(/字母|数字|强度/)
  })
```

### Step 3: 跑失败

```bash
cd "D:/Project/museek"
TEST_BASE_URL=http://localhost:3100 npx vitest run tests/api/admin-users-roles.test.ts -t 'TC-CCR' --reporter=verbose
```

Expected: FAIL（路由 404）。

### Step 4: 创建 route.ts

`D:/Project/museek/src/app/api/admin/accounts/create-creator/route.ts`：

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { hashPassword } from '@/lib/password'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { name, phone, email, groupId, password } = body as {
    name?: string
    phone?: string
    email?: string
    groupId?: number | null
    password?: string
  }

  if (!name || !phone || !password) {
    return err('缺少必填字段：name, phone, password')
  }

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return err('手机号格式不正确')
  }

  if (password.length < 8) {
    return err('密码长度不能少于 8 位')
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return err('密码强度不足，需同时包含字母与数字')
  }

  const existing = await prisma.user.findUnique({ where: { phone } })
  if (existing) {
    return err('该手机号已被注册')
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.user.create({
    data: {
      name,
      phone,
      email: email || null,
      passwordHash,
      type: 'creator',
      realNameStatus: 'unverified',
      ...(groupId
        ? { userGroups: { create: { groupId } } }
        : {}),
    },
    include: {
      userGroups: {
        include: { group: { select: { id: true, name: true } } },
      },
    },
  })

  await logAdminAction(request, {
    action: 'create_creator',
    targetType: 'user',
    targetId: user.id,
    detail: { name: user.name, phone: user.phone, groupId: groupId ?? null },
  })

  return ok({
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    type: user.type,
    groups: user.userGroups.map((ug) => ({ id: ug.group.id, name: ug.group.name })),
  })
})
```

### Step 5: 跑通过 + 全 test 回归

```bash
cd "D:/Project/museek"
TEST_BASE_URL=http://localhost:3100 npx vitest run tests/api/admin-users-roles.test.ts -t 'TC-CCR' --reporter=verbose
TEST_BASE_URL=http://localhost:3100 npx vitest run tests/api/admin-users-roles.test.ts --reporter=verbose 2>&1 | tail -15
```

Expected: 3 条新 case PASS，既有 case 不回归。

### Step 6: 提交

```bash
cd "D:/Project/museek"
git add src/app/api/admin/accounts/create-creator/route.ts tests/api/admin-users-roles.test.ts
git commit -m "feat(admin): 新增 POST /api/admin/accounts/create-creator 创建创作者账号"
```

---

## Task 2: 前端 `/admin/accounts` creator tab 加创建按钮 + Modal

**Files:**
- Modify: `D:/Project/museek/src/app/(admin)/admin/accounts/page.tsx`

**行为：**
- 按钮条件从 `tab === 'reviewer'` 改为两 tab 都有
- 根据 tab 决定显示哪个 Modal（createReviewerModal / createCreatorModal）
- 新增 `CreateCreatorForm` 组件（仿 CreateReviewerForm，字段基本一致）
- 按钮文案：reviewer tab "+ 创建评审账号"；creator tab "+ 创建创作者账号"

### Step 1: 读当前 page.tsx 结构

Read 整份，重点看：
- `const [tab, setTab] = useState('reviewer')`（约 L72）
- `const [createModal, setCreateModal] = useState(false)` 或类似状态
- 按钮渲染块（L333-337）
- Modal 渲染块（L370-389）
- `CreateReviewerForm` 组件定义（约 L419-479）

### Step 2: 改动清单

**2.a** 将 `createModal` 状态**拆为两个**：

```typescript
const [createReviewerModal, setCreateReviewerModal] = useState(false)
const [createCreatorModal, setCreateCreatorModal] = useState(false)
```

把原 `setCreateModal(true)` / `createModal` 的引用替换成对应的 reviewer 版本。

**2.b** 按钮块改（约 L333-337）：

```tsx
{tab === 'reviewer' && (
  <button className={btnPrimary} onClick={() => setCreateReviewerModal(true)}>
    + 创建评审账号
  </button>
)}
{tab === 'creator' && (
  <button className={btnPrimary} onClick={() => setCreateCreatorModal(true)}>
    + 创建创作者账号
  </button>
)}
```

**2.c** 在既有 Reviewer Modal 下紧接新增 Creator Modal：

```tsx
{/* 创建创作者账号 Modal */}
<AdminModal
  open={createCreatorModal}
  onClose={() => setCreateCreatorModal(false)}
  title="创建创作者账号"
>
  <CreateCreatorForm
    groups={groups}
    onSubmit={async (body) => {
      const res = await apiCall('/api/admin/accounts/create-creator', 'POST', body)
      if (res.ok) {
        setCreateCreatorModal(false)
        showToast('✅ 创作者账号创建成功')
        refetch()
      } else {
        showToast(res.message ?? '创建失败')
      }
    }}
  />
</AdminModal>
```

**2.d** 文件末尾紧挨 `CreateReviewerForm` 新增 `CreateCreatorForm` 组件（和 reviewer 版几乎一样，只改文案）：

```tsx
// ── Create Creator Form ─────────────────────────────────────────
function CreateCreatorForm({ groups, onSubmit }: { groups: UserGroup[]; onSubmit: (body: Record<string, unknown>) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [groupId, setGroupId] = useState('')
  const [password, setPassword] = useState('Abc12345')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label className={labelCls}>姓名 *</label>
        <input className={inputCls} placeholder="创作者姓名" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>手机号 *</label>
        <input className={inputCls} placeholder="11位手机号" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>邮箱</label>
        <input className={inputCls} placeholder="user@example.com（可选）" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>加入用户组</label>
        <select
          className={inputCls}
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          <option value="">请选择用户组（可选）</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>初始密码</label>
        <input className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div
        style={{
          padding: 12,
          background: 'rgba(108,92,231,.08)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--accent2)',
          lineHeight: 1.6,
        }}
      >
        💡 创建后创作者即可使用手机号 + 密码登录创作者端，无需走短信注册。
      </div>
      <button
        className={`${btnPrimary} w-full flex justify-center`}
        onClick={() => onSubmit({ name, phone, email: email || undefined, groupId: groupId ? Number(groupId) : null, password })}
      >
        创建创作者账号
      </button>
    </div>
  )
}
```

### Step 3: 类型检查 + 验证

```bash
cd "D:/Project/museek"
npx tsc --noEmit 2>&1 | head -20
```

Expected: 无错。

### Step 4: 手动检查（可选，主要留给用户 E2E）

dev server 在 :3100，打开 `http://localhost:3100/admin/accounts`：
- reviewer tab 仍有"+ 创建评审账号"
- creator tab 有"+ 创建创作者账号"
- 点击弹 Modal，填表能提交

### Step 5: 提交

```bash
cd "D:/Project/museek"
git add 'src/app/(admin)/admin/accounts/page.tsx'
git commit -m "feat(admin/accounts): creator tab 新增创建按钮 + CreateCreatorForm Modal"
```

---

## Task 3: 集成自测 + PR

**Files:**
- Verify: tsc + vitest

### Step 1: 全量 tsc + 相关测试

```bash
cd "D:/Project/museek"
npx tsc --noEmit
TEST_BASE_URL=http://localhost:3100 npx vitest run tests/api/admin-users-roles.test.ts --reporter=verbose 2>&1 | tail -15
```

### Step 2: 推分支 + 开 PR

```bash
cd "D:/Project/museek"
git push -u origin feature/admin-create-creator
```

PR 用既有 REST API 流程（会话历史里有 Batch 1A / Theme 2 的示范）：
- title: `feat(admin): admin 可创建创作者账号（补 create-creator API + UI）`
- body 包含：
  - Summary: 新 API + UI 扩展，覆盖 `GAP-ADMIN-NEW-CREATE-CREATOR`（用户回归反馈 #3）
  - Test Plan: tsc / vitest 3 条新 case / 手动点击创建测试

---

## Self-Review Checklist

- [x] 路由文件结构参照 `create-reviewer`（命名、错误处理、logAdminAction）
- [x] 密码强度与 sms/verify 自助注册一致（8 位 + 字母 + 数字）
- [x] 手机号格式校验（`^1[3-9]\d{9}$`）
- [x] groupId 可空（admin 可选择是否立即绑组）
- [x] 前端 UI 复用 CreateReviewerForm 样式不发明新设计
- [x] 3 条测试覆盖成功 / 重复 phone / 弱密码

**Placeholder scan:** 无 TBD / TODO。

**Type consistency:** route.ts body 解构字段名与前端 onSubmit 调用体字段名一致。

---

## 执行建议

**推荐 Subagent-Driven**（3 个 Task 各 1 个 commit）。每 Task 小，haiku 足矣。
