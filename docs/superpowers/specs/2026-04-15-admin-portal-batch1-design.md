# 管理端第一批页面设计文档

## 概述

实现管理端第一批 5 个页面，采用**前端优先 + Mock 数据**策略。
- **功能逻辑**：完全复刻 `docs/管理端.html` 原型中的交互和业务规则
- **UI 视觉**：严格复刻 `docs/AI音乐平台/` 目录下的 PNG 截图样式

**范围：**
1. 运营看板 (`/admin/dashboard`)
2. 用户组管理 (`/admin/groups`)
3. 用户档案 (`/admin/students`)
4. 平台管理员 (`/admin/admins`)
5. 角色管理 (`/admin/roles`)

---

## 通用架构

### 共享组件 `src/components/admin/`

#### 1. `PageHeader`
- 标题（18px fontWeight:700）+ 灰色副标题（12px `var(--text3)`）
- 右侧 actions slot
- 对应 HTML 原型的 `PageLayout` 组件

#### 2. `DataTable`
- 基于 shadcn `<Table>`
- 表头：`padding: 10px 12px`, `color: var(--text2)`, `fontWeight: 500`, `fontSize: 12`, `borderBottom: 1px solid var(--border)`
- 行：`padding: 12px`, hover 背景 `#f8faff`, `cursor: pointer`（如果有 onRowClick）
- 无竖线，行间 `1px solid var(--border)`

#### 3. `SearchBar`
- 搜索输入（带🔍图标）+ 可选的 Select 下拉筛选
- 搜索按钮（紫色渐变 `linear-gradient(135deg,#6366f1,#4f46e5)` 实心白字）
- 重置按钮（`background:transparent; border:1px solid var(--border)`）

#### 4. `StatusBadge`
- 圆角标签 `padding:3px 10px; border-radius:20px; fontSize:12px`
- 颜色映射：
  - `verified`/已认证/活跃 → `color:#16a34a; bg:#f0fdf4`
  - `pending`/待审核 → `color:#d97706; bg:#fef9ec`
  - `rejected`/已驳回 → `color:#e53e3e; bg:#fff0f0`
  - `unverified`/未认证 → `color:#64748b; bg:#f1f5f9`

#### 5. `StatCard`
- 白底卡片，`border:1px solid var(--border)`, `border-radius:12px`, `padding:16px 13px`
- 顶部 3px 彩色条 `position:absolute; top:0; left:0; right:0; height:3`
- 42x42 图标容器（圆角，浅色背景）
- 数字 24px fontWeight:700
- 标签 11px `color:#94a3b8`
- 副文本 11px
- hover: `translateY(-2px)`, 增强 boxShadow

#### 6. `Modal`
- 全屏遮罩 `background:rgba(0,0,0,.6); backdropFilter:blur(4px)`
- 居中白色卡片，`border-radius:var(--radius-lg)`, `padding:24px`
- 标题 18px fontWeight:600 + 右侧关闭按钮
- 入场动画 `modalIn`

#### 7. `Tab`
- 胶囊样式 tab：`background:#f0f4fb; borderRadius:10; padding:3`
- 活跃项：`background:var(--accent); color:#fff`
- 非活跃：`background:transparent; color:var(--text2)`
- 支持 count 显示

### Mock 数据

统一 mock 文件 `src/lib/mock/admin.ts`，直接复用 HTML 原型的 MOCK 对象结构：
- `userGroups` — 5 条用户组
- `students` — 5 条创作者档案（含 groupIds, songCount, totalRevenue, adminLevel 等）
- `songs` — 14 首歌曲（status 覆盖所有状态）
- `MOCK_ROLES` — 4 个角色（超级管理员、运营专员、评审主管、财务专员）
- `MOCK_PLATFORM_ADMINS` — 4 个管理员
- `PERMISSION_TREE` — 三端菜单权限树定义

### 图表

Dashboard 的折线图用 SVG 手绘（HTML 原型就是手动 SVG path），不引入 Recharts，保持轻量。

---

## 页面设计（完全对齐 HTML 原型功能）

### 1. 运营看板 `/admin/dashboard`

**UI 参考：** `运营看板.png` + HTML `AdminDashboard`

**结构：**
1. **紫色渐变横幅**：`linear-gradient(135deg,#6366f1,#4f46e5,#4338ca,#6366f1)`，圆角14px，标语"运营数据全透视，寻找下一个增长奇点"，装饰圆形和 emoji 透明层
2. **6 个统计卡片**（grid 6列）：
   - 注册学生 156（`#6366f1`），总作品数 428（`#ec4899`），待审核（`#0694a2`），已发行（`#3b82f6`），总收益 ¥52,600（`#f59e0b`），用户组数（`#7c3aed`）
   - 每个卡片可点击跳转到对应页面
3. **下方 grid 3:2**：
   - 左侧：收益趋势 SVG 折线图（12个月数据，hover 显示 tooltip）
   - 右侧：关键转化率（4 个进度条：注册首次上传率72%、评审通过率68%、代理协议签署率45%、实名认证完成率61%）

### 2. 用户组管理 `/admin/groups`

**UI 参考：** HTML `AdminUserGroups`

**列表视图：**
1. **3 个统计卡片**：总用户组、活跃组、暂停组
2. **表格**：
   - 列：组名（粗体+描述副文本）、邀请码（monospace 紫色背景标签）、成员数、状态（✅活跃/⏸️暂停）、创建时间、操作
   - 操作：🔗邀请码按钮、详情→按钮
   - 行可点击进入详情

3. **创建用户组 Modal**：
   - 组名（必填）、描述（textarea）、自定义邀请码（留空自动生成）
   - 提示文案：创建后系统自动生成邀请码和注册链接

4. **邀请码 Modal**：
   - 大号邀请码展示（32px monospace letterSpacing:4）
   - 注册链接 + 复制按钮
   - 重新生成 / 停用邀请码

**详情视图**（点击行或"详情→"进入）：
1. 顶部有"← 返回列表"按钮
2. **左右 grid 2列**：
   - 左卡片"组信息"：组名、描述、状态、创建时间、成员数 + 编辑/暂停按钮
   - 右卡片"专属邀请"：邀请码输入框（只读+复制）、注册链接（只读+复制）、重新生成按钮
3. **成员表格**：
   - 列：头像、姓名、属性（创作者/评审）、管理权限（组管理员/系统管理员/—）、实名状态、手机号、操作
   - 操作：设为/取消组管理员、移出

### 3. 用户档案 `/admin/students`

**UI 参考：** `学生档案.png` + HTML `AdminStudents`

**列表视图：**
1. **搜索栏**：搜索输入 + 实名状态 Select 下拉
2. **表格**：
   - 列：头像 emoji、姓名（粗体）、属性（创作者/评审 + 组管理员标记）、手机号、实名状态、用户组、代理协议（已签署/未签署）、作品数、总收益（¥格式）
   - 行可点击进入详情

**详情视图**（点击行进入）：
1. 顶部"← 返回列表"按钮
2. **左右 grid 2列**：
   - 左卡片"基本信息"：姓名、手机号、邮箱、用户属性、管理权限、所属用户组、作品数、总收益
   - 实名认证状态区域（4 种状态不同展示）：
     - `pending`：黄色提示 + 通过/驳回按钮
     - `verified`：绿色标签 + 真实姓名、身份证号、实名手机号
     - `rejected`：红色提示 + 发送提醒按钮
     - `unverified`：灰色提示 + 发送提醒按钮
   - 底部：禁用账号按钮（danger）
   - 右卡片"作品列表"：用户的所有歌曲，每行显示 封面emoji + 标题 + 状态Badge

### 4. 平台管理员 `/admin/admins`

**UI 参考：** `账号管理.png` + HTML `AdminPlatformAdmins`

**列表视图：**
1. **搜索栏**（card 样式）：账号输入 + 名称输入 + 查询按钮 + 重置按钮 + 导出按钮
2. **表格**：
   - 列：头像 emoji、账号（monospace 粗体）、名称、角色（紫色标签）、创建时间、最后登录时间、最后登录IP（monospace）、状态（toggle 开关）、操作（编辑）
   - 状态 toggle：`width:44px height:24px borderRadius:12` 滑动开关，点击切换启用/禁用

**添加/编辑管理员**（全屏子页面，非 Modal）：
1. 顶部"← 返回"按钮
2. 表单字段（maxWidth:500）：
   - 账号（必填，编辑时 disabled）
   - 名称（必填）
   - 角色（Select 下拉，从 MOCK_ROLES 获取选项）
   - 密码 + 确认密码（仅新建时显示）
   - 管理员状态（toggle 开关）
   - 支持多处登录（toggle 开关）
   - 管理员头像（上传占位）
3. 保存 + 取消按钮

### 5. 角色管理 `/admin/roles`

**UI 参考：** HTML `AdminRoles` + `PermissionTree`

**列表视图：**
1. **表格**：
   - 列：ID、名称（粗体 + 内置角色标记橙色标签）、权限数（紫色）、说明、创建时间、操作
   - 操作：编辑（所有角色）、删除（仅非内置角色，confirm 确认）

**添加/编辑角色**（全屏子页面，非 Modal）：
1. 顶部"← 返回"按钮
2. 表单字段（maxWidth:680）：
   - 名称（必填，maxLength:8，右侧显示字符计数 `x/8`）
   - 描述（textarea）
   - **权限树 `PermissionTree` 组件**（核心）：
     - 三端（创作者端、评审端、管理端）层级树
     - 每个端下有多个菜单项，每个菜单项有多个 action（查看、编辑、管理、操作、导出、结算）
     - 支持：全选/不全选、端级别全选、菜单级别全选、单个 action 勾选
     - checkbox 支持 indeterminate 状态
     - 完整权限树定义（PERMISSION_TREE）包含 8 个创作者端菜单 + 5 个评审端菜单 + 18 个管理端菜单
3. 保存 + 取消按钮

---

## 文件结构

```
src/
├── components/admin/
│   ├── page-header.tsx          # 页面头部（标题+副标题+actions）
│   ├── data-table.tsx           # 通用数据表格（对齐原型 Table 组件样式）
│   ├── search-bar.tsx           # 搜索栏（输入+筛选+按钮）
│   ├── status-badge.tsx         # 状态标签
│   ├── stat-card.tsx            # 统计卡片
│   ├── modal.tsx                # 弹窗组件
│   ├── tab.tsx                  # Tab 切换组件
│   └── permission-tree.tsx      # 权限树组件（角色管理用）
├── lib/mock/
│   └── admin.ts                 # 所有管理端 Mock 数据（复用原型 MOCK 结构）
├── app/(admin)/admin/
│   ├── dashboard/page.tsx       # 运营看板
│   ├── groups/page.tsx          # 用户组管理（列表+详情双视图）
│   ├── students/page.tsx        # 用户档案（列表+详情双视图）
│   ├── admins/page.tsx          # 平台管理员（列表+添加/编辑子页面）
│   └── roles/page.tsx           # 角色管理（列表+添加/编辑子页面）
```

## 依赖

无新增依赖。Dashboard 折线图用 SVG 手绘（与原型一致），不引入 Recharts。

## 视觉规范

- 严格复刻 `docs/AI音乐平台/` 目录下 PNG 截图的视觉风格
- 功能交互完全对齐 `docs/管理端.html` 原型
- 主色调：`var(--accent)` (#6366f1) 紫色
- 按钮渐变：`linear-gradient(135deg,#6366f1,#4f46e5)`
- 卡片样式：`background:#fff; border:1px solid #e8edf5; border-radius:12px; box-shadow:0 1px 4px rgba(99,102,241,.06)`
- 输入框：`padding:10px 14px; border:1.5px solid #e8edf5; border-radius:8px`
- 字体：Noto Sans SC
