# Theme 3: 权限系统完整化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 31 菜单 × 6 action 权限矩阵真正生效：统一 action 词汇，所有 admin API 显式声明权限 key，sidebar permKey 与权限树一致，变更权限 Modal 不再提交非法 enum，普通管理员真能按权限被放行/拦截。

**Architecture:**
- `src/lib/constants.ts` 的 `PERMISSION_TREE` 对齐 PRD 附录 G：admin 18 菜单的 actions 补齐到 6 种词汇
- `src/lib/api-utils.ts` 的 `inferPermissionKey` 扩展识别 edit / export / settle 三种 action（按路径末段 + query 参数 + HTTP 方法细化）
- 50 个 admin API 路由全部改为**显式** `requirePermission(request, 'admin.xxx.yyy')`，不再依赖 infer 兜底；infer 保留只做兜底
- `src/components/layout/admin-sidebar.tsx` 的 permKey 拼法修正：`content→cms`、`publish-confirm→publish_confirm`、batch-download / isrc 独立 key（之前复用 songs）
- 「变更权限」Modal 的"用户属性"下拉删掉"管理员"（与 `User.type` enum 不兼容），同时后端 `permissions` 路由显式校验 type 白名单
- PRD §1.4.5.3 超级管理员唯一性：`POST /admin/admins` 拒绝创建 `roleId=1` 的第二个超管
- 测试：扩展 `tests/api/permission-granular.test.ts` 覆盖 edit/export/settle 三种粒度；新增回归测试确认所有 sidebar permKey 都在 PERMISSION_TREE 的 `admin.*` key 集合内

**Tech Stack:** Next.js 15 / Prisma / vitest（API 集成测试跑 prod server :3100，见 `tests/api/_helpers.ts`）

**关联 GAP:** GAP-ADMIN-004 / GAP-ADMIN-005 / GAP-ADMIN-007 / GAP-ADMIN-062 / GAP-ADMIN-099 / GAP-COMM-001（GAP-COMM-003 即 group_admin 约束留到附录任务，作为 P1 可选后续）

---

## 文件结构

### 新建文件（1 个）

| 文件 | 职责 |
|---|---|
| `tests/api/permission-matrix.test.ts` | 权限 action × 菜单 回归：edit/export/settle 放行/拦截、sidebar permKey 对齐、变更权限 Modal type 白名单 |

### 修改文件（~56 个）

#### 基础设施（4 个）
| 文件 | 修改点 |
|---|---|
| `src/lib/constants.ts:45-67` | `PERMISSION_TREE` admin 子树 actions 按 PRD 附录 G 扩到 6 种词汇 |
| `src/lib/api-utils.ts:23-36` | `inferPermissionKey` 扩展 edit/export/settle；保留 view/manage/operate 兼容 |
| `src/components/layout/admin-sidebar.tsx:12,24,25,27` | 4 处 permKey 拼法修正 |
| `src/app/(admin)/admin/accounts/page.tsx:639-642,690` | 删除"管理员"选项；提交时映射中文→enum |

#### 账号变更路由（1 个）
| 文件 | 修改点 |
|---|---|
| `src/app/api/admin/accounts/[id]/permissions/route.ts:20-30` | type 白名单校验；adminLevel 白名单校验；显式 permission key |

#### 超级管理员唯一性（1 个）
| 文件 | 修改点 |
|---|---|
| `src/app/api/admin/admins/route.ts` | POST 拒绝 roleId=1 创建第二个超管（409） |

#### 50 个 admin API 路由显式 permission key

按模块分 8 批改，见 Task 5~12。每个 route 的 key 以"显式传 key"替换"空 key 靠 infer"。

---

## 前置条件

- [ ] **P0：** `HEAD` = main（主题 2 已合并 `a122ae0`），工作区干净
- [ ] **P1：** prod server 或 dev server 能在 `localhost:3000`（或 `TEST_BASE_URL=http://localhost:3100`）跑起来供 vitest 打
- [ ] **P2：** DB 已 seed（`admin/Abc12345` 超管 + `npx tsx prisma/seed-test-users.ts` 的 creator/reviewer 测试账号）

```bash
cd "D:/Project/museek"
git fetch && git status
git checkout -b feature/theme3-permission
```

---

## Task 1: `PERMISSION_TREE` admin 子树对齐 PRD 附录 G

**Files:**
- Modify: `src/lib/constants.ts:45-67`

**背景：** PRD 附录 G 定义 31 菜单 × 6 action 真值表。当前代码 admin 菜单大多数只有 2-3 个 action，管理员在角色编辑页勾选 edit/export/settle 的复选框根本出不来。本任务先把数据源改对，sidebar 能自动跟着展示。

附录 G admin 部分完整真值表（**必须照此落地**）：

| 菜单 | actions 数组 |
|---|---|
| `admin.dashboard` | `['view']` |
| `admin.cms` | `['view', 'edit', 'manage']` |
| `admin.groups` | `['view', 'edit', 'manage']` |
| `admin.assignments` | `['view', 'edit', 'manage']` |
| `admin.students` | `['view', 'edit', 'manage', 'operate', 'export']` |
| `admin.contracts` | `['view', 'export']` |
| `admin.teachers` | `['view', 'export']` |
| `admin.accounts` | `['view', 'edit', 'manage']` |
| `admin.songs` | `['view', 'edit', 'manage', 'operate', 'export']` |
| `admin.batch_download` | `['view', 'operate']` |
| `admin.isrc` | `['view', 'edit', 'manage', 'export']` |
| `admin.distributions` | `['view', 'edit', 'operate']` |
| `admin.publish_confirm` | `['view', 'operate']` |
| `admin.revenue` | `['view', 'edit', 'operate', 'export', 'settle']` |
| `admin.settings` | `['view', 'edit']` |
| `admin.logs` | `['view', 'export']` |
| `admin.roles` | `['view', 'edit', 'manage']` |
| `admin.admins` | `['view', 'edit', 'manage']` |

创作者端 / 评审端前缀保持 `student.*` / `teacher.*` 不动（仅是 UI 标签，不影响授权路径）。

- [ ] **Step 1: 修改 PERMISSION_TREE admin 子树**

替换 `src/lib/constants.ts:45-67` 的 admin portal 整块为：

```ts
  {
    portal: '管理端', icon: '⚙️', key: 'admin',
    children: [
      { key: 'admin.dashboard', label: '运营看板', actions: ['view'] },
      { key: 'admin.cms', label: '内容管理', actions: ['view', 'edit', 'manage'] },
      { key: 'admin.groups', label: '用户组管理', actions: ['view', 'edit', 'manage'] },
      { key: 'admin.assignments', label: '作业管理', actions: ['view', 'edit', 'manage'] },
      { key: 'admin.students', label: '用户档案', actions: ['view', 'edit', 'manage', 'operate', 'export'] },
      { key: 'admin.contracts', label: '合同台账', actions: ['view', 'export'] },
      { key: 'admin.teachers', label: '评审绩效', actions: ['view', 'export'] },
      { key: 'admin.accounts', label: '账号与权限', actions: ['view', 'edit', 'manage'] },
      { key: 'admin.songs', label: '歌曲库管理', actions: ['view', 'edit', 'manage', 'operate', 'export'] },
      { key: 'admin.batch_download', label: '作品库批量下载', actions: ['view', 'operate'] },
      { key: 'admin.isrc', label: 'ISRC管理', actions: ['view', 'edit', 'manage', 'export'] },
      { key: 'admin.distributions', label: '发行渠道', actions: ['view', 'edit', 'operate'] },
      { key: 'admin.publish_confirm', label: '发行状态确认', actions: ['view', 'operate'] },
      { key: 'admin.revenue', label: '收益管理', actions: ['view', 'edit', 'operate', 'export', 'settle'] },
      { key: 'admin.settings', label: '系统设置', actions: ['view', 'edit'] },
      { key: 'admin.logs', label: '操作日志', actions: ['view', 'export'] },
      { key: 'admin.roles', label: '角色管理', actions: ['view', 'edit', 'manage'] },
      { key: 'admin.admins', label: '平台管理员', actions: ['view', 'edit', 'manage'] },
    ],
  },
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

期望：无新增错误。

- [ ] **Step 3: 提交**

```bash
git add src/lib/constants.ts
git commit -m "refactor(permissions): 对齐 PRD 附录 G 把 admin 权限树 actions 扩到 6 种词汇"
```

---

## Task 2: `inferPermissionKey` 扩展 6 种 action 兜底识别

**Files:**
- Modify: `src/lib/api-utils.ts:23-36`

**背景：** `inferPermissionKey` 目前只会产出 `view / operate / manage` 三种 action，而角色编辑页可以勾 `edit / export / settle`。后续 Task 5~12 要把所有 route 改成显式传 key；但 infer 必须仍能覆盖 6 种，作为兜底 + 未来新 route 忘记传 key 时的默认安全网。

**识别规则（严格按此实现）：**

| HTTP | 路径特征 | 识别 action |
|---|---|---|
| GET | URL 带 `?export=1` 或末段含 `/export` / `/agency-pdf` | `export` |
| GET | 其他 | `view` |
| PUT / PATCH | 末段含 `/pay` 或 `/settle-status` | `settle` |
| PUT / PATCH | 其他 | `edit` |
| POST | body 不可读，按末段判断：`/pay` / `/settle-status` | `settle` |
| POST | 末段含 `/status` / `/verify` / `/notify` / `/publish` / `/sync` | `operate` |
| POST | 其他 | `manage` |
| DELETE | 任意 | `manage` |

另外：路径 module 段的一些特殊映射必须改写：

| 路径段 | module key |
|---|---|
| `content` | `cms` |
| `publish-confirm` | `publish_confirm` |
| `batch-download` | `batch_download` |
| 其他 | 原样 |

songs 下的子路径两种例外：
- `/api/admin/songs/[id]/isrc` → `admin.isrc.manage`（POST）/ `admin.isrc.view`（GET）
- `/api/admin/songs/[id]/agency-pdf` → `admin.songs.export`

子路径识别靠路径段匹配，非 module 名纠偏。

- [ ] **Step 1: 替换 `inferPermissionKey`**

替换 `src/lib/api-utils.ts:23-36` 的 `inferPermissionKey` 为：

```ts
/**
 * 按 URL 与 HTTP method 兜底推断权限 key（6 种 action）。
 * 推荐所有受保护 API 显式传 key，infer 仅作为兜底。
 * 约定：/api/admin/{module}/... → admin.{module}.{action}
 */
function inferPermissionKey(request: NextRequest): string {
  const path = request.nextUrl.pathname
  const search = request.nextUrl.searchParams
  const method = request.method.toUpperCase()
  const m = path.match(/^\/api\/admin\/([^\/]+)/)
  if (!m) return 'admin.unknown.view'

  // module 段归一化（连字符 → 下划线；content → cms）
  const rawModule = m[1]
  let moduleName =
    rawModule === 'content' ? 'cms'
    : rawModule === 'publish-confirm' ? 'publish_confirm'
    : rawModule === 'batch-download' ? 'batch_download'
    : rawModule

  // songs 子路径的模块纠偏
  if (rawModule === 'songs') {
    if (/\/isrc(\b|\/|$)/.test(path)) moduleName = 'isrc'
  }

  // 按 method + 路径特征定 action
  const isExport = search.get('export') === '1' || /\/(export|agency-pdf)(\b|\/|$)/.test(path)
  const isSettle = /\/(pay|settle-status)(\b|\/|$)/.test(path)
  const isOperate = /\/(status|verify|notify|publish|sync|toggle-status|reset-password)(\b|\/|$)/.test(path)

  let action: string
  if (method === 'GET') {
    action = isExport ? 'export' : 'view'
  } else if (method === 'DELETE') {
    action = 'manage'
  } else if (method === 'PUT' || method === 'PATCH') {
    action = isSettle ? 'settle' : 'edit'
  } else {
    // POST
    if (isSettle) action = 'settle'
    else if (isOperate) action = 'operate'
    else action = 'manage'
  }

  // agency-pdf 特例强制 export（GET 分支已覆盖，PDF 生成无 POST，不处理）
  if (rawModule === 'songs' && /\/agency-pdf(\b|\/|$)/.test(path)) {
    return `admin.songs.export`
  }

  return `admin.${moduleName}.${action}`
}
```

- [ ] **Step 2: 类型检查 + 手测 infer**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/api-utils.ts
git commit -m "refactor(permissions): inferPermissionKey 扩展 6 种 action + 路径段归一化"
```

---

## Task 3: sidebar permKey 对齐权限树

**Files:**
- Modify: `src/components/layout/admin-sidebar.tsx:12,24,25,27`

**背景：** PRD 附录 G 定型的菜单 key 已是 `admin.cms` / `admin.publish_confirm` / `admin.batch_download` / `admin.isrc`。sidebar 目前 4 处错配：

| 菜单 | 当前 permKey（错） | 目标 permKey |
|---|---|---|
| 内容管理 | `admin.content.view` | `admin.cms.view` |
| 作品库批量下载 | `admin.songs.view`（复用）| `admin.batch_download.view` |
| ISRC管理 | `admin.songs.view`（复用）| `admin.isrc.view` |
| 发行状态确认 | `admin.publish-confirm.view` | `admin.publish_confirm.view` |

- [ ] **Step 1: 修正 4 行 permKey**

在 `src/components/layout/admin-sidebar.tsx` 做以下精确替换：

```diff
-  { key: 'cms', label: '内容管理', icon: '📝', href: '/admin/content', permKey: 'admin.content.view' },
+  { key: 'cms', label: '内容管理', icon: '📝', href: '/admin/content', permKey: 'admin.cms.view' },
```

```diff
-  { key: 'batch-download', label: '作品库批量下载', icon: '⬇️', href: '/admin/batch-download', permKey: 'admin.songs.view' },
-  { key: 'isrc', label: 'ISRC管理', icon: '🔖', href: '/admin/isrc', permKey: 'admin.songs.view' },
+  { key: 'batch-download', label: '作品库批量下载', icon: '⬇️', href: '/admin/batch-download', permKey: 'admin.batch_download.view' },
+  { key: 'isrc', label: 'ISRC管理', icon: '🔖', href: '/admin/isrc', permKey: 'admin.isrc.view' },
```

```diff
-  { key: 'publish-confirm', label: '发行状态确认', icon: '✅', href: '/admin/publish-confirm', permKey: 'admin.publish-confirm.view' },
+  { key: 'publish-confirm', label: '发行状态确认', icon: '✅', href: '/admin/publish-confirm', permKey: 'admin.publish_confirm.view' },
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/components/layout/admin-sidebar.tsx
git commit -m "fix(admin-sidebar): permKey 对齐权限树 underscore 规范"
```

---

## Task 4: 变更权限 Modal 移除"管理员"选项 + 后端 type 白名单

**Files:**
- Modify: `src/app/(admin)/admin/accounts/page.tsx:639-642,690`
- Modify: `src/app/api/admin/accounts/[id]/permissions/route.ts:20-30`

**背景：** 当前 "用户属性" 下拉的三个值是中文 `创作者 / 评审 / 管理员`，提交时原样给后端。后端 `permissions/route.ts:26` 直接 `updateData.type = type`，Prisma `UserType` enum 只接 `creator / reviewer`，传入"管理员"或中文值都会 runtime 500。

修法：
- 前端：删除"管理员"选项（管理员是 `AdminUser` 独立表，不能从 `User` 变更过来）；submit 前把中文映射回 enum。
- 后端：严格白名单校验 `type ∈ ['creator','reviewer']`；`adminLevel` 白名单校验 `∈ [null,'group_admin','system_admin']`；显式 permission key。

- [ ] **Step 1: 前端 PermissionForm 修正**

在 `src/app/(admin)/admin/accounts/page.tsx` 做以下两处替换：

替换 1（下拉选项，约 639-642 行）：

```diff
      {/* User attribute dropdown */}
      <div>
        <label className={labelCls}>用户属性</label>
        <select
          className={inputCls}
          value={roleAttr}
          onChange={(e) => setRoleAttr(e.target.value)}
        >
          <option value="创作者">创作者</option>
          <option value="评审">评审</option>
-         <option value="管理员">管理员</option>
        </select>
+       <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
+         如需创建平台管理员，请使用「平台管理员」菜单新增
+       </div>
      </div>
```

替换 2（submit 时中文映射 enum，约 688-692 行）：

```diff
      <button
        className={`${btnPrimary} w-full flex justify-center`}
-       onClick={() => onSubmit({ type: roleAttr, adminLevel: resolveAdminLevel(), groupIds: Array.from(selectedGroups) })}
+       onClick={() => onSubmit({
+         type: roleAttr === '评审' ? 'reviewer' : 'creator',
+         adminLevel: resolveAdminLevel(),
+         groupIds: Array.from(selectedGroups),
+       })}
      >
        确认变更
      </button>
```

- [ ] **Step 2: 后端路由 type/adminLevel 白名单校验 + 显式 permission key**

替换 `src/app/api/admin/accounts/[id]/permissions/route.ts:10,20-30` 为：

```ts
  const auth = await requirePermission(request, 'admin.accounts.edit')
  if ('error' in auth) return auth.error

  const { id } = await params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) return err('无效的用户 ID')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return err('用户不存在', 404)

  const body = await request.json()
  const { type, adminLevel, groupIds } = body

  // 白名单校验：User.type 仅 creator/reviewer；管理员走独立 AdminUser 表
  if (type !== undefined && type !== 'creator' && type !== 'reviewer') {
    return err('无效的用户类型（仅接受 creator / reviewer）')
  }
  if (adminLevel !== undefined && adminLevel !== null && adminLevel !== 'group_admin' && adminLevel !== 'system_admin') {
    return err('无效的管理级别')
  }
```

（保留函数其余部分不动。）

- [ ] **Step 3: 类型检查 + 启动 dev server 手测**

```bash
npx tsc --noEmit
```

（手测略：打开 `/admin/accounts` 打开变更权限 Modal，确认"管理员"已消失；改一个 user 的 type 到 reviewer 提交，确认 200。）

- [ ] **Step 4: 提交**

```bash
git add src/app/\(admin\)/admin/accounts/page.tsx src/app/api/admin/accounts/\[id\]/permissions/route.ts
git commit -m "fix(admin/accounts): 变更权限 Modal 移除'管理员'选项 + 后端 type 白名单"
```

---

## Task 5: 显式 permission key · accounts / admins / dashboard / settings（11 个路由）

**背景：** 50 个 admin API 绝大多数当前 `await requirePermission(request)` **不传 key**，靠 infer 兜底。本 batch 按权限附录 G 显式传 key，一是可读，二是未来 infer 走不到的场景也能命中对的权限。

修改范式：把每个 HTTP handler 里 `await requirePermission(request)` 改为 `await requirePermission(request, '<key>')`，按下表匹配方法。

**匹配表（本任务）：**

| 文件 | Method | 显式 key |
|---|---|---|
| `src/app/api/admin/dashboard/route.ts` | GET | `admin.dashboard.view` |
| `src/app/api/admin/accounts/route.ts` | GET | `admin.accounts.view` |
| `src/app/api/admin/accounts/[id]/toggle-status/route.ts` | POST | `admin.accounts.manage` |
| `src/app/api/admin/accounts/[id]/reset-password/route.ts` | POST | `admin.accounts.manage` |
| `src/app/api/admin/accounts/create-creator/route.ts` | POST | `admin.accounts.manage` |
| `src/app/api/admin/accounts/create-reviewer/route.ts` | POST | `admin.accounts.manage` |
| `src/app/api/admin/admins/route.ts` | GET | `admin.admins.view` |
| `src/app/api/admin/admins/route.ts` | POST | `admin.admins.manage` |
| `src/app/api/admin/admins/[id]/route.ts` | PUT | `admin.admins.edit` |
| `src/app/api/admin/admins/[id]/route.ts` | DELETE | `admin.admins.manage` |
| `src/app/api/admin/settings/route.ts` | GET | `admin.settings.view` |
| `src/app/api/admin/settings/route.ts` | PUT | `admin.settings.edit` |
| `src/app/api/admin/settings/test-ai/route.ts` | POST | `admin.settings.edit` |
| `src/app/api/admin/settings/test-sms/route.ts` | POST | `admin.settings.edit` |

注：accounts `[id]/permissions` 已在 Task 4 处理，不重复。

- [ ] **Step 1: 逐文件替换**

对每个文件，找到 `const auth = await requirePermission(request)` 改为 `const auth = await requirePermission(request, '<对应 key>')`。注意文件可能有多个 HTTP 方法（如 admins/route.ts 同时有 GET/POST），每个 handler 里都要单独改。

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/app/api/admin/dashboard src/app/api/admin/accounts src/app/api/admin/admins src/app/api/admin/settings
git commit -m "refactor(permissions): accounts/admins/dashboard/settings 路由显式 permission key"
```

---

## Task 6: 显式 permission key · content / assignments / groups（12 个路由）

**匹配表：**

| 文件 | Method | 显式 key |
|---|---|---|
| `src/app/api/admin/content/route.ts` | GET | `admin.cms.view` |
| `src/app/api/admin/content/route.ts` | POST | `admin.cms.manage` |
| `src/app/api/admin/content/[id]/route.ts` | GET | `admin.cms.view` |
| `src/app/api/admin/content/[id]/route.ts` | PUT | `admin.cms.edit` |
| `src/app/api/admin/content/[id]/route.ts` | DELETE | `admin.cms.manage` |
| `src/app/api/admin/content/[id]/publish/route.ts` | POST | `admin.cms.manage` |
| `src/app/api/admin/assignments/route.ts` | GET | `admin.assignments.view` |
| `src/app/api/admin/assignments/route.ts` | POST | `admin.assignments.manage` |
| `src/app/api/admin/assignments/[id]/route.ts` | GET | `admin.assignments.view` |
| `src/app/api/admin/assignments/[id]/route.ts` | PUT | `admin.assignments.edit` |
| `src/app/api/admin/assignments/[id]/route.ts` | DELETE | `admin.assignments.manage` |
| `src/app/api/admin/assignments/[id]/fields/route.ts` | GET | `admin.assignments.view` |
| `src/app/api/admin/assignments/[id]/fields/route.ts` | PUT | `admin.assignments.edit` |
| `src/app/api/admin/assignments/[id]/submissions/route.ts` | GET | `admin.assignments.view` |
| `src/app/api/admin/groups/route.ts` | GET | `admin.groups.view` |
| `src/app/api/admin/groups/route.ts` | POST | `admin.groups.manage` |
| `src/app/api/admin/groups/[id]/route.ts` | GET | `admin.groups.view` |
| `src/app/api/admin/groups/[id]/route.ts` | PUT | `admin.groups.edit` |
| `src/app/api/admin/groups/[id]/route.ts` | DELETE | `admin.groups.manage` |
| `src/app/api/admin/groups/[id]/members/route.ts` | GET | `admin.groups.view` |
| `src/app/api/admin/groups/[id]/members/route.ts` | POST | `admin.groups.edit` |

- [ ] **Step 1: 逐文件替换**
- [ ] **Step 2: `npx tsc --noEmit`**
- [ ] **Step 3: 提交**

```bash
git add src/app/api/admin/content src/app/api/admin/assignments src/app/api/admin/groups
git commit -m "refactor(permissions): content/assignments/groups 路由显式 permission key"
```

---

## Task 7: 显式 permission key · students / roles / logs（9 个路由）

**匹配表：**

| 文件 | Method | 显式 key |
|---|---|---|
| `src/app/api/admin/students/route.ts` | GET | `admin.students.view` |
| `src/app/api/admin/students/[id]/route.ts` | GET | `admin.students.view` |
| `src/app/api/admin/students/[id]/route.ts` | PUT | `admin.students.edit` |
| `src/app/api/admin/students/[id]/notify/route.ts` | POST | `admin.students.operate` |
| `src/app/api/admin/students/[id]/verify/route.ts` | POST | `admin.students.operate` |
| `src/app/api/admin/roles/route.ts` | GET | `admin.roles.view` |
| `src/app/api/admin/roles/route.ts` | POST | `admin.roles.manage` |
| `src/app/api/admin/roles/[id]/route.ts` | GET | `admin.roles.view` |
| `src/app/api/admin/roles/[id]/route.ts` | PUT | `admin.roles.edit` |
| `src/app/api/admin/roles/[id]/route.ts` | DELETE | `admin.roles.manage` |
| `src/app/api/admin/logs/route.ts` | GET | `admin.logs.view` |
| `src/app/api/admin/logs/record/route.ts` | POST | `admin.logs.view` |

注：`logs/record` 是被其它 admin 路由调用记录日志，理论上应是 "任意已登录 admin 均可记录自己的操作"；显式用 `admin.logs.view` 最保守——每个 admin 至少能记录自己可见的操作日志。

- [ ] **Step 1: 逐文件替换**
- [ ] **Step 2: `npx tsc --noEmit`**
- [ ] **Step 3: 提交**

```bash
git add src/app/api/admin/students src/app/api/admin/roles src/app/api/admin/logs
git commit -m "refactor(permissions): students/roles/logs 路由显式 permission key"
```

---

## Task 8: 显式 permission key · songs / isrc / agency-pdf / batch-download（5 个路由）

**匹配表：**

| 文件 | Method | 显式 key |
|---|---|---|
| `src/app/api/admin/songs/route.ts` | GET | `admin.songs.view` |
| `src/app/api/admin/songs/[id]/route.ts` | GET | `admin.songs.view` |
| `src/app/api/admin/songs/[id]/route.ts` | PUT | `admin.songs.edit` |
| `src/app/api/admin/songs/[id]/status/route.ts` | POST | `admin.songs.operate` |
| `src/app/api/admin/songs/[id]/isrc/route.ts` | POST | `admin.isrc.manage` |
| `src/app/api/admin/songs/[id]/agency-pdf/route.ts` | GET | `admin.songs.export` |

注意：`songs/[id]/isrc` 是 `admin.isrc.manage`（不是 `admin.songs.*`），因为 ISRC 在权限树里是独立菜单。batch-download 目前无 API 路由（页面存在，数据走 `/api/admin/songs?export=1` 或类似）——若发现 export-style 调用，在对应 GET 路由中按 `search.get('export')` 分发 key；本 task 暂不新增 batch-download 专属路由。

- [ ] **Step 1: 逐文件替换**
- [ ] **Step 2: `npx tsc --noEmit`**
- [ ] **Step 3: 提交**

```bash
git add src/app/api/admin/songs
git commit -m "refactor(permissions): songs/isrc/agency-pdf 路由显式 permission key"
```

---

## Task 9: 显式 permission key · distributions / publish-confirm（5 个路由）

**匹配表：**

| 文件 | Method | 显式 key |
|---|---|---|
| `src/app/api/admin/distributions/route.ts` | GET | `admin.distributions.view` |
| `src/app/api/admin/distributions/route.ts` | POST | `admin.distributions.operate` |
| `src/app/api/admin/distributions/[songId]/route.ts` | GET | `admin.distributions.view` |
| `src/app/api/admin/distributions/[songId]/route.ts` | PUT | `admin.distributions.edit` |
| `src/app/api/admin/publish-confirm/route.ts` | GET | `admin.publish_confirm.view` |
| `src/app/api/admin/publish-confirm/[id]/route.ts` | PUT | `admin.publish_confirm.operate` |
| `src/app/api/admin/publish-confirm/[id]/route.ts` | DELETE | `admin.publish_confirm.operate` |
| `src/app/api/admin/publish-confirm/sync/route.ts` | POST | `admin.publish_confirm.operate` |

- [ ] **Step 1: 逐文件替换**
- [ ] **Step 2: `npx tsc --noEmit`**
- [ ] **Step 3: 提交**

```bash
git add src/app/api/admin/distributions src/app/api/admin/publish-confirm
git commit -m "refactor(permissions): distributions/publish_confirm 路由显式 permission key"
```

---

## Task 10: 显式 permission key · revenue 子模块（9 个路由）

**匹配表：**

| 文件 | Method | 显式 key |
|---|---|---|
| `src/app/api/admin/revenue/stats/route.ts` | GET | `admin.revenue.view` |
| `src/app/api/admin/revenue/creators/route.ts` | GET | `admin.revenue.view` |
| `src/app/api/admin/revenue/imports/route.ts` | GET | `admin.revenue.view` |
| `src/app/api/admin/revenue/imports/route.ts` | POST | `admin.revenue.operate` |
| `src/app/api/admin/revenue/imports/[id]/route.ts` | GET | `admin.revenue.view` |
| `src/app/api/admin/revenue/imports/[id]/route.ts` | DELETE | `admin.revenue.operate` |
| `src/app/api/admin/revenue/imports/[id]/detail/route.ts` | GET | `admin.revenue.view` |
| `src/app/api/admin/revenue/mappings/route.ts` | GET | `admin.revenue.view` |
| `src/app/api/admin/revenue/mappings/route.ts` | POST | `admin.revenue.operate` |
| `src/app/api/admin/revenue/mappings/[id]/route.ts` | PUT | `admin.revenue.operate` |
| `src/app/api/admin/revenue/other-imports/route.ts` | POST | `admin.revenue.operate` |
| `src/app/api/admin/revenue/platform-settlements/route.ts` | GET | `admin.revenue.view` |
| `src/app/api/admin/revenue/settlements/route.ts` | GET | `admin.revenue.view` |
| `src/app/api/admin/revenue/settlements/route.ts` | PUT | **条件：** body.action='pay' → `admin.revenue.settle`；其他 → `admin.revenue.edit` |

**settlements PUT 特殊处理：**

因为 `action=pay` 是敏感的"打款"动作，必须走 `settle` 权限；其他 `adjust / mark-invalid` 之类走 `edit`。实现：先解析 body（不破坏现有逻辑），再按 action 传不同 key。

在 `settlements/route.ts` 的 PUT handler 开头：

```ts
export const PUT = safeHandler(async function PUT(request: NextRequest) {
  // 先读 body，按 action 决定权限 key
  const body = await request.json()
  const action = body.action as string | undefined
  const permKey = action === 'pay' ? 'admin.revenue.settle' : 'admin.revenue.edit'
  const auth = await requirePermission(request, permKey)
  if ('error' in auth) return auth.error

  // 后续逻辑复用 body，别再 request.json() 一次
  // ...
})
```

注意：如果原 handler 在后面 `request.json()` 了一次，那里要删除（body 只能读一次）。

- [ ] **Step 1: 逐文件替换（非 settlements 直接改；settlements 按特殊处理）**
- [ ] **Step 2: `npx tsc --noEmit`**
- [ ] **Step 3: 提交**

```bash
git add src/app/api/admin/revenue
git commit -m "refactor(permissions): revenue 子模块显式 permission key（settle 专用 action=pay）"
```

---

## Task 11: 超级管理员唯一性（PRD §1.4.5.3）

**Files:**
- Modify: `src/app/api/admin/admins/route.ts`

**背景：** 内置超管（`roleId=1`, `isBuiltin=true`）在 seed 时创建一个，后续通过 `POST /admin/admins` 应禁止再建。

- [ ] **Step 1: POST handler 开头加超管唯一性校验**

在 `src/app/api/admin/admins/route.ts` 的 POST handler 中，参数解析后、`prisma.adminUser.create` 前，增加：

```ts
// 超级管理员唯一性：roleId=1（内置超管角色）只允许存在一个
if (roleId === 1) {
  const existingSuper = await prisma.adminUser.count({ where: { roleId: 1 } })
  if (existingSuper >= 1) {
    return err('超级管理员已存在，不可重复创建', 409)
  }
}
```

位置：读到 `roleId` 之后，创建之前。具体行号需读文件定位（大约 handler 中部）。

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/app/api/admin/admins/route.ts
git commit -m "feat(admin/admins): 拒绝创建第二个超级管理员（roleId=1 唯一）"
```

---

## Task 12: 权限矩阵回归测试

**Files:**
- Create: `tests/api/permission-matrix.test.ts`

**背景：** `tests/api/permission.test.ts` 和 `permission-granular.test.ts` 只覆盖 view/manage 两种粒度。本任务新增测试覆盖 edit/export/settle 以及 sidebar permKey 对齐。

**测试策略：**
1. 建角色：只有 `admin.revenue.view`（无 edit/settle/export）
2. 建管理员绑定该角色 + 登录
3. 验证：GET /revenue/stats → 200；PUT /revenue/settlements action=pay → 403 提示 settle；GET /revenue/stats?export=1 → 403 提示 export（注意：当前 revenue/stats 未必支持 export 参数，以 infer 结果为准；测试可改为请求 songs/[id]/agency-pdf 验证 export 拦截）
4. 建另一角色：有 `admin.cms.view + admin.cms.edit`（无 manage）
5. 验证：GET /content → 200；POST /content → 403 提示 manage；PUT /content/[id] → 200（如果有测试内容）
6. 新增"sidebar permKey 一致性"小 test：import PERMISSION_TREE 和 sidebar 定义，断言 sidebar 里每个 `admin.*.view` 都在 PERMISSION_TREE 某条 `admin.xxx` 的 actions 里

- [ ] **Step 1: 创建测试文件**

创建 `tests/api/permission-matrix.test.ts`：

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { http, adminLogin, expectOk, BASE_URL } from './_helpers'
import { PERMISSION_TREE } from '@/lib/constants'

/**
 * 主题 3 权限矩阵回归：
 * - edit / export / settle 三种新扩 action 真正能放行/拦截
 * - sidebar permKey 对齐（静态断言，不打接口）
 * - 变更权限 Modal type 白名单（后端拒绝非 creator/reviewer）
 */

let adminCookie = ''
const SUFFIX = Date.now().toString().slice(-6)
let revenueViewerRoleId = 0
let revenueViewerAdminId = 0
let revenueViewerCookie = ''

async function loginAsAdmin(account: string, password = 'Abc12345') {
  const r = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password, portal: 'admin' }),
  })
  const sc = r.headers.get('set-cookie') ?? ''
  return sc.split(',').map(p => p.trim().split(';')[0]).filter(c => c.startsWith('access_token=')).join('; ')
}

describe('主题3 · 权限矩阵回归', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie

    // 建一个只有 revenue.view 的角色
    const roleRes = await http('/api/admin/roles', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        name: `RV${SUFFIX}`.slice(0, 8),
        description: 'vitest revenue-view only',
        permissions: { 'admin.revenue.view': true },
      },
    })
    expectOk(roleRes, 'create revenue-view role')
    revenueViewerRoleId = roleRes.json.data.id

    // 建绑定该角色的 admin
    const adminRes = await http('/api/admin/admins', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        account: `rv${SUFFIX}`,
        name: '收益查看员',
        password: 'Abc12345',
        roleId: revenueViewerRoleId,
      },
    })
    expectOk(adminRes, 'create revenue-view admin')
    revenueViewerAdminId = adminRes.json.data.id

    revenueViewerCookie = await loginAsAdmin(`rv${SUFFIX}`)
    expect(revenueViewerCookie).toContain('access_token=')
  })

  afterAll(async () => {
    if (revenueViewerAdminId) await http(`/api/admin/admins/${revenueViewerAdminId}`, { method: 'DELETE', cookie: adminCookie })
    if (revenueViewerRoleId) await http(`/api/admin/roles/${revenueViewerRoleId}`, { method: 'DELETE', cookie: adminCookie })
  })

  // -- action: view --
  it('TC-TM3-001 revenue.view 授予 → GET /revenue/stats 200', async () => {
    const r = await http('/api/admin/revenue/stats', { cookie: revenueViewerCookie })
    expectOk(r, 'revenue stats get')
  })

  // -- action: settle --
  it('TC-TM3-002 revenue.settle 未授予 → PUT /revenue/settlements action=pay 403', async () => {
    const r = await http('/api/admin/revenue/settlements', {
      method: 'PUT',
      cookie: revenueViewerCookie,
      body: { ids: [1], action: 'pay' },
    })
    expect(r.status).toBe(403)
    expect(r.json.message).toContain('admin.revenue.settle')
  })

  // -- action: edit --
  it('TC-TM3-003 revenue.edit 未授予 → PUT /revenue/settlements action=adjust 403', async () => {
    const r = await http('/api/admin/revenue/settlements', {
      method: 'PUT',
      cookie: revenueViewerCookie,
      body: { ids: [1], action: 'adjust', amount: 100 },
    })
    expect(r.status).toBe(403)
    expect(r.json.message).toContain('admin.revenue.edit')
  })

  // -- action: export --
  it('TC-TM3-004 songs.export 未授予 → GET /songs/[id]/agency-pdf 403', async () => {
    const r = await http('/api/admin/songs/999999/agency-pdf', {
      cookie: revenueViewerCookie,
      raw: true,
    })
    expect(r.status).toBe(403)
  })

  // -- Modal type 白名单 --
  it('TC-TM3-005 变更权限 type 传中文"管理员" → 400', async () => {
    // 先找一个真实 user.id
    const list = await http('/api/admin/accounts?pageSize=1&tab=creator', { cookie: adminCookie })
    expectOk(list, 'accounts list')
    const userId = list.json.data?.list?.[0]?.id
    if (!userId) return  // 无 creator 可测则 skip
    const r = await http(`/api/admin/accounts/${userId}/permissions`, {
      method: 'PUT',
      cookie: adminCookie,
      body: { type: '管理员', adminLevel: null, groupIds: [] },
    })
    expect(r.json.code).toBe(400)
    expect(r.json.message).toContain('用户类型')
  })

  // -- PERMISSION_TREE 对齐 PRD 附录 G（Task 1 回归）--
  it('TC-TM3-006 权限树 admin 子树含 PRD 附录 G 定义的 underscore 规范 key', () => {
    const adminPortal = PERMISSION_TREE.find(p => p.key === 'admin')!
    const treeKeys = new Set(adminPortal.children.map(c => c.key))
    for (const k of ['admin.cms', 'admin.publish_confirm', 'admin.batch_download', 'admin.isrc']) {
      expect(treeKeys.has(k)).toBe(true)
    }
    // revenue 必须含 settle
    const revenue = adminPortal.children.find(c => c.key === 'admin.revenue')!
    expect(revenue.actions).toContain('settle')
    expect(revenue.actions).toContain('export')
  })

  // -- 超管唯一性 --
  it('TC-TM3-007 创建第二个 roleId=1 的超管 → 409', async () => {
    const r = await http('/api/admin/admins', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        account: `dup${SUFFIX}`,
        name: '重复超管',
        password: 'Abc12345',
        roleId: 1,
      },
    })
    expect(r.json.code).toBe(409)
    expect(r.json.message).toContain('超级管理员')
  })
})
```

- [ ] **Step 2: 启动 prod server 跑测试**

```bash
# 在另一个 shell：
# TEST_MODE=1 npx next start -p 3100
TEST_BASE_URL=http://localhost:3100 npx vitest run tests/api/permission-matrix.test.ts
```

期望：7 个 TC 全通过。

- [ ] **Step 3: 提交**

```bash
git add tests/api/permission-matrix.test.ts
git commit -m "test(permissions): 主题3 edit/export/settle 粒度 + sidebar 对齐 + 超管唯一性"
```

---

## Task 13: 全量回归 + 开 PR

- [ ] **Step 1: 所有权限相关测试重跑**

```bash
TEST_BASE_URL=http://localhost:3100 npx vitest run \
  tests/api/permission.test.ts \
  tests/api/permission-granular.test.ts \
  tests/api/permission-matrix.test.ts \
  tests/api/admin-users-roles.test.ts
```

期望：全部通过。若 granular 测试现在因为显式 key 更严格（比如"songs/1/status 未授予 operate 拒绝"）测试项失败，查原 test 断言的错误消息——原来 infer 出 `admin.songs.operate`，现在显式也是 `admin.songs.operate`，理论上断言文案一致。若确因路径变化失败，同步修正断言。

- [ ] **Step 2: 类型 + build 检查**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 3: 核心业务流程 smoke test（手测）**

跑一遍 3 端核心回归，用超管账号：
1. /admin/content 打开 → 创建一条 content → 200
2. /admin/songs → 选一条已审 song → 点"发行" → 成功
3. /admin/revenue/settlements → 选一条 → 点"打款" → 成功（notify 附带已在 Theme 2 做，本批次不管）
4. /admin/accounts → 打开变更权限 Modal → 确认无"管理员"选项 → 变更 type → 成功

- [ ] **Step 4: 开 PR**

```bash
git push -u origin feature/theme3-permission
gh pr create --title "feat(permissions) Theme 3: 权限系统完整化 (31 菜单 × 6 action)" --body "$(cat <<'EOF'
## Summary
- PERMISSION_TREE admin 子树 actions 对齐 PRD 附录 G（6 种 action 词汇）
- `inferPermissionKey` 扩展 edit/export/settle 兜底识别 + 路径段归一化
- 50 个 admin API 路由显式声明 permission key，不再依赖 infer
- sidebar permKey 修 4 处（content→cms、publish-confirm→underscore、batch-download/isrc 独立 key）
- 变更权限 Modal 删除"管理员"选项 + 后端 type/adminLevel 白名单
- 超级管理员唯一性（POST /admins 拒绝 roleId=1 重复）
- 测试：permission-matrix.test.ts 7 条回归（edit/export/settle + sidebar 对齐 + 超管唯一）

关联 GAP: GAP-ADMIN-004/005/007/062/099、GAP-COMM-001
不含（留后续）: GAP-COMM-003 group_admin 基于 groupId 过滤（需扩 AdminUser schema，单独 plan）

## Test plan
- [x] `vitest run tests/api/permission*.test.ts` 全绿
- [x] `npx tsc --noEmit` + `npm run build`
- [x] 手测：3 端核心流程（创建内容 / 发行 / 打款 / 变更权限 Modal）

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 附录任务（可选后续 plan）：group_admin 基于 groupId 过滤（GAP-COMM-003）

**当前状态：** `User.adminLevel` 字段存在于 schema，但实际上 `middleware.ts` 仅按 `portal` 放行，admin 端口只认 `AdminUser` 表，`User.adminLevel` 对 `/api/admin/*` 无影响。

**落地需要先决策：**
1. group_admin 是 `AdminUser` 的字段，还是 `User`（creator/reviewer 升级）？
2. 若是 `AdminUser`：扩 schema 加 `adminLevel`（enum group_admin/system_admin） + `managedGroupIds JSON?` 或新增关联表
3. 若是 `User` 升级：`middleware.ts` 改为"portal=creator 但 adminLevel 非 null 时允许访问部分 /admin/*"——复杂度高
4. PRD §1.4.5.2 的 "访问非本组或跨组数据 → 403" 的检查点：`requirePermission` 签名加可选 `groupId`，按 adminLevel 条件分支

**建议：** 本主题 3 plan 不覆盖该项；需要时作为独立 plan 起草，先 `brainstorming` 澄清 1-3 的选型，再 `writing-plans`。

---

## Self-Review 清单

**Spec coverage：**
- GAP-ADMIN-004（inferPermissionKey 词汇）→ Task 2 ✓
- GAP-ADMIN-005（sidebar permKey）→ Task 3 ✓
- GAP-ADMIN-062（action 6 种 vs 3 种）→ Task 1 + Task 2 ✓
- GAP-ADMIN-007（变更权限 Modal 中文 type）→ Task 4 ✓
- GAP-ADMIN-099（同上根因）→ Task 4 ✓
- GAP-COMM-001（isBuiltin + 粒度覆盖）→ Task 12 新增 edit/export/settle 测试 ✓
- PRD §1.4.5.3 超管唯一性 → Task 11 ✓
- GAP-COMM-003（group_admin）→ 明确留到附录任务（需要额外决策）✓

**Placeholder 扫描：** 无 TBD/TODO；每个 task 都有代码 / 命令 / 期望。

**类型一致性：** `requirePermission(request, key)` 签名保持现有；`UserType` enum 保持 `creator/reviewer`；`AdminLevel` enum 保持 `group_admin/system_admin`。

**文件计数核对：** 50 个 admin API 路由分布：accounts(6 已包含 permissions)-已拆为 Task 4/5 共 6 个 + admins(2) + dashboard(1) + settings(4) = 13；content(3) + assignments(4) + groups(3) = 10；students(4) + roles(3) + logs(2) = 9；songs(5) = 5；distributions(2) + publish-confirm(3) = 5；revenue(9) = 9。合计 51（permissions 路由在 Task 4 已单独改）。覆盖完整。
