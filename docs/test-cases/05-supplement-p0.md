# P0 级补充用例（基于 GAPS.md 与 SCHEMA-DIFF.md）

本文件补充 `GAPS.md` 列出的 P0 优先级遗漏，共 10 组约 50 条。
用例 ID 前缀 `TC-SUPP-*` 表示 supplement（补充），后续执行时可并入对应主模块文件。

---

## 01. 权限 6 种粒度分离（对应 GAPS A-1）

### 前置数据

- 创建 3 个管理员角色：
  - `role_view_only`：仅 `admin.revenue.view=true`
  - `role_operate_only`：`admin.revenue.view=true`, `admin.revenue.operate=true`
  - `role_settle_full`：`admin.revenue.view=true`, `admin.revenue.operate=true`, `admin.revenue.settle=true`
- 分别绑定到 3 个测试管理员账号

| 用例 ID | 按钮/功能 | 前置/步骤 | 预期结果 | 优先级 |
|--------|----------|-----------|---------|--------|
| TC-SUPP-A1-001 | 仅 view | view_only 账号访问收益管理 | 能看到列表；所有操作按钮（导入/确认/导出/打款）**禁用或隐藏** | P0 |
| TC-SUPP-A1-002 | view 接口直连 | view_only 调 POST 确认接口 | 返回 403，不改 DB | P0 |
| TC-SUPP-A1-003 | operate 无 settle | operate_only 点击"标记打款" | 按钮禁用；直连接口 403 | P0 |
| TC-SUPP-A1-004 | operate 有 operate | operate_only 点击"确认结算" | 正常执行 | P0 |
| TC-SUPP-A1-005 | settle 全权限 | settle_full 点击"标记打款" | 正常执行（实名通过时） | P0 |
| TC-SUPP-A1-006 | 导出粒度 | 只有 `admin.revenue.export` 无 `settle` | 可导出 xlsx 但不可触发打款 | P0 |
| TC-SUPP-A1-007 | manage 粒度 | `admin.groups.manage=true` 含删除 | 可删除用户组；`admin.groups.operate` 只能改不能删 | P0 |
| TC-SUPP-A1-008 | 权限即时生效 | role_view_only 登录后，超管改其角色增加 operate | 该管理员**不需重登**，下次操作刷新即可用（或需说明重登策略） | P0 |

---

## 02. distributions.status=failed（对应 GAPS B-1）

| 用例 ID | 按钮/功能 | 前置/步骤 | 预期结果 | 优先级 |
|--------|----------|-----------|---------|--------|
| TC-SUPP-B1-001 | 失败状态展示 | 人工置 distributions.status=failed | 发行渠道矩阵对应单元格显示❌ 或特殊图标；点击展示失败原因 | P0 |
| TC-SUPP-B1-002 | 重新提交 | failed 状态点击"重新提交" | status 改回 `submitted`（或 `pending`），清空 failed 原因 | P0 |
| TC-SUPP-B1-003 | 失败自动标记 | 平台接口返回失败回调 | 自动置 failed 并记录错误；operation_logs `distribution.fail` | P0 |

---

## 03. revenue_imports 部分失败（对应 GAPS B-2）

| 用例 ID | 按钮/功能 | 前置/步骤 | 预期结果 | 优先级 |
|--------|----------|-----------|---------|--------|
| TC-SUPP-B2-001 | CSV 中途格式异常 | 1000 行中第 500 行金额非法 | 异步任务标记：前 499 行已写入 revenue_rows，后续停止，批次 status=failed；提示具体行号 | P0 |
| TC-SUPP-B2-002 | 回滚策略 | 同上 | **方案 A**：全量回滚（推荐）；**方案 B**：部分提交；需与产品确认，测试用例按确认后实现 | P0 |
| TC-SUPP-B2-003 | 失败重试 | failed 批次点击"重试" | 重跑导入；去重规则仍按 `UNIQUE(qishui_song_id, period)` 生效 | P0 |

---

## 04. 缓存失效触发（对应 GAPS D-1~D-4）

| 用例 ID | 场景 | 前置/步骤 | 预期结果 | 优先级 |
|--------|------|-----------|---------|--------|
| TC-SUPP-D-001 | 角色权限缓存失效 | 管理员 A 绑定角色 R，R 初始无 `admin.revenue.view`。A 登录后访问收益页被 403。超管修改 R 增加该权限 | A **不需等 1h TTL**，下次请求立即可访问；实现上应主动 invalidate `role:permissions:{role_id}` | P0 |
| TC-SUPP-D-002 | 表单配置缓存失效 | 管理员修改组 G 的 form_field_configs 后 | 组 G 学员打开作业提交页**立即看到新字段**（不等 10min） | P0 |
| TC-SUPP-D-003 | 课程列表缓存失效 | CMS 发布新课程 | 创作者端课程中心刷新**立即可见**（不等 30min） | P0 |
| TC-SUPP-D-004 | 分成规则缓存失效 | 系统设置改分成比例规则后 | 下次 CSV 导入生成的 settlement **使用新规则**（不等 1h） | P0 |

---

## 05. 消息触发规则（对应 GAPS E-1）

基于 schema 实际字段 `notifications(user_id, type, title, read)`：

| 用例 ID | 触发动作 | 预期消息 | 优先级 |
|--------|---------|---------|--------|
| TC-SUPP-E-001 | 评审提交（推荐=强推） | 创作者收到 `type=song` 消息"您的作品《X》已通过评审" | P0 |
| TC-SUPP-E-002 | 评审提交（建议修改） | 创作者收到 `type=song` 消息"您的作品《X》需要修改" + 评语摘要 | P0 |
| TC-SUPP-E-003 | 管理员确认发行 | 创作者收到 `type=song` 消息"您的作品《X》已发行" | P0 |
| TC-SUPP-E-004 | settlement.paid | 创作者收到 `type=revenue` 消息"您有一笔收益到账：¥X" | P0 |
| TC-SUPP-E-005 | 实名审核通过 | 创作者收到 `type=system` 消息"实名认证已通过" | P0 |
| TC-SUPP-E-006 | 实名审核驳回 | 创作者收到 `type=system` 消息"实名未通过：{reason}" | P0 |
| TC-SUPP-E-007 | 新作业发布 | 组内所有创作者收到 `type=system` 消息"您有新作业《X》" | P0 |
| TC-SUPP-E-008 | 消息顺序 | 多事件并发 | notifications 按 created_at 正序，不丢失 | P0 |

> ⚠️ 当前 schema `notifications` 表**缺 `target_id` / `content`**，无法携带跳转目标和消息正文。实施前需补表结构。

---

## 06. 安全测试最小集（对应 GAPS I-1~I-5）

| 用例 ID | 类型 | 场景 | 预期结果 | 优先级 |
|--------|------|------|---------|--------|
| TC-SUPP-I-001 | XSS | 创作者上传时歌词含 `<script>alert(1)</script>` | 创作者端/评审端/管理端展示时**转义为文本**，不执行脚本 | P0 |
| TC-SUPP-I-002 | XSS | 评审评语含 HTML | 同上 | P0 |
| TC-SUPP-I-003 | XSS | 昵称含 `<img onerror=...>` | 同上 | P0 |
| TC-SUPP-I-004 | XSS | CMS 富文本正文含恶意 `<iframe>` / `<script>` | 发布前/渲染时过滤（白名单富文本） | P0 |
| TC-SUPP-I-005 | SQL 注入 | 搜索框输入 `'; DROP TABLE users; --` | 参数化绑定，不影响 DB；返回空或 400 | P0 |
| TC-SUPP-I-006 | CSRF | 跨域 POST 到 `/api/admin/*` | 带错 Origin/Referer 或无 CSRF token 被拒绝 | P0 |
| TC-SUPP-I-007 | 文件上传 | 上传 `evil.mp3`（实际是 PHP/JS） | MIME 校验 + 文件头校验 + 二次扩展名检查，拒绝 | P0 |
| TC-SUPP-I-008 | 文件上传 | 上传带脚本的 SVG 作为头像 | 拒绝（仅允许 JPEG/PNG/WebP） | P0 |
| TC-SUPP-I-009 | 身份证号脱敏 | API 响应体 | 所有返回 users 详情的接口均返回脱敏身份证号（前 6 后 4），不返回明文 | P0 |
| TC-SUPP-I-010 | 身份证号日志 | grep 日志 / operation_logs.detail | 不含身份证号明文 | P0 |

---

## 07. 公开接口 & 音频签名（对应 GAPS G-1~G-3）

| 用例 ID | 场景 | 前置/步骤 | 预期结果 | 优先级 |
|--------|------|-----------|---------|--------|
| TC-SUPP-G-001 | 未登录访问歌曲接口 | `GET /api/songs` | 仅返回 `status=published` 作品；不含汽水 ID；不含创作者隐私字段 | P0 |
| TC-SUPP-G-002 | 未登录访问内容接口 | `GET /api/content/courses` | 仅返回 `status=published` 课程 | P0 |
| TC-SUPP-G-003 | 匿名接口限流 | 同 IP 每分钟 >60 次 | 返回 429 | P0 |
| TC-SUPP-G-004 | 音频签名 URL 过期 | 复用 1 小时前的签名 URL | 403 | P0 |
| TC-SUPP-G-005 | 音频签名跨用户 | 用户 A 的签名 URL 被用户 B 访问 | 根据实现：签名绑定用户/会话则 403；仅时间签名则放行（需产品决策） | P0 |

---

## 08. 默认值填充（对应 GAPS J-1~J-3）

> 注：schema **无 `@default`**，测试内容是"API 层默认值策略"。

| 用例 ID | 字段 | 场景 | 预期结果 | 优先级 |
|--------|------|------|---------|--------|
| TC-SUPP-J-001 | performer | 提交时留空 + 实名已过 | 后端填充 `real_name` | P0 |
| TC-SUPP-J-002 | lyricist / composer | 同上 | 同上 | P0 |
| TC-SUPP-J-003 | album_name | 提交时留空 | 后端填充 `title` | P0 |
| TC-SUPP-J-004 | album_artist | 同 J-1 | 同 J-1 | P0 |
| TC-SUPP-J-005 | 实名未通过时提交 | real_name 为空 | 各字段保持为空（不填充垃圾数据）；不阻塞提交 | P0 |
| TC-SUPP-J-006 | 前端已填 vs 后端默认 | 前端已填 "别名 A" 提交 | 不被后端覆盖为 real_name | P0 |

---

## 09. 时区（对应 GAPS H-1）

| 用例 ID | 场景 | 前置/步骤 | 预期结果 | 优先级 |
|--------|------|-----------|---------|--------|
| TC-SUPP-H-001 | DB 存储 | 提交作品后查库 | `created_at` 为 UTC 时间；通过 `DEFAULT now()` 写入时和服务器时区无关 | P0 |
| TC-SUPP-H-002 | 前端展示 | 作品详情页"提交时间" | 按浏览器本地时区渲染（+8 显示为 CST） | P0 |
| TC-SUPP-H-003 | 跨时区用户 | 用户 A (UTC+8) 提交 23:59，用户 B (UTC-5) 次日查看 | 双方看到的"提交时间"各自本地化；数据库记录一致 | P0 |
| TC-SUPP-H-004 | period 字段 | CSV 原串 `2026/02/01 - 2026/02/28` | 直接存储不做时区转换；展示时原样输出 | P0 |

---

## 10. CMS 新建内容（对应 GAPS F-4）

基于 schema `CmsContent(title, cover, category, type, content, views, status)`：

| 用例 ID | 按钮/字段 | 前置/步骤 | 预期结果 | 优先级 |
|--------|----------|-----------|---------|--------|
| TC-SUPP-F4-001 | 标题 | 留空 | 阻断"请填标题"；≤200 字符 | P0 |
| TC-SUPP-F4-002 | 封面上传 | JPG ≤5MB | 上传到 OSS，cover 存 URL | P1 |
| TC-SUPP-F4-003 | 栏目 category | 从系统设置读取选项或自由输入 | 保存字符串 | P0 |
| TC-SUPP-F4-004 | 类型 type | 单选 video/article | 必选 | P0 |
| TC-SUPP-F4-005 | 视频类型 | type=video | content 存视频 URL；文本编辑器禁用 | P0 |
| TC-SUPP-F4-006 | 图文类型 | type=article | content 存富文本；视频上传禁用 | P0 |
| TC-SUPP-F4-007 | 富文本 XSS | 正文含 `<script>` | 发布/渲染前过滤 | P0 |
| TC-SUPP-F4-008 | 保存草稿 | 点击"保存草稿" | status=draft；前端不可见 | P0 |
| TC-SUPP-F4-009 | 发布 | 点击"发布" | status=published；前端立即可见（配合 TC-SUPP-D-003 缓存失效） | P0 |
| TC-SUPP-F4-010 | 下架 | 已发布点击"下架" | **待确认**：schema 仅有 published/draft，无 archived。实际是改回 draft 还是新增枚举？ | P0 |
| TC-SUPP-F4-011 | 浏览量保护 | 下架后访问 | 匿名/未授权用户访问返回 404 | P0 |
| TC-SUPP-F4-012 | 编辑已发布 | 修改后保存 | views 不重置；updatedAt 刷新 | P1 |

---

## 11. Schema 专项（基于 SCHEMA-DIFF.md 发现的问题）

| 用例 ID | 场景 | 步骤 | 预期结果 | 优先级 |
|--------|------|------|---------|--------|
| TC-SUPP-SCHEMA-001 | operation_logs 溢出 | 模拟插入大量日志接近 Int 上限 | 应当能触发告警或已切换到 BigInt；当前实现为 Int，**需作为已知风险跟踪** | P0 |
| TC-SUPP-SCHEMA-002 | settlements 空值聚合 | DB 存在 total_revenue=NULL 的结算记录 | "总收益" 统计不因 NULL 报错；`COALESCE(total_revenue,0)` | P0 |
| TC-SUPP-SCHEMA-003 | settle 非空约束 | 代码尝试创建 `creator_id=NULL` 的 settlement | 应用层阻断（schema 要求非空）；返回 400 | P0 |
| TC-SUPP-SCHEMA-004 | users vs admin_users 状态类型 | 同时禁用一位创作者和一位管理员 | 两者登录均被阻断；但代码路径不同（ENUM vs Boolean），需两路径都覆盖 | P0 |
| TC-SUPP-SCHEMA-005 | CMS 下架真实语义 | 已发布 CMS 点击下架 | 查库确认 status 的实际落盘值（published/draft/archived），和 PRD §7.3.16 预期对齐 | P0 |
| TC-SUPP-SCHEMA-006 | notifications 简陋字段 | 点击一条通知 | 由于无 target_id，前端如何跳转？**需和开发确认路由策略**（可能靠 type 推断） | P0 |

---

## 执行建议

1. 本文件用例跑通前需先解决：
   - SCHEMA-DIFF §六 列出的 4 项代码修正（特别是 notifications 字段补齐、CMS archived 状态明确）
   - GAPS §一 PRD 内部不一致的产品澄清（尤其命名统一）
2. 推荐执行顺序：
   - 第 01 组（权限粒度）→ 验证角色系统基建
   - 第 11 组（Schema 专项）→ 确认 DB 层边界
   - 第 04 / 05 组（缓存 / 消息）→ 基建验证
   - 第 06 组（安全）→ 上线前必过
   - 其余按优先级
3. 补充用例合并入主文件的时机：待本文件执行稳定后，可按 TC-A-*、TC-C-* 重编号并入对应文件。
