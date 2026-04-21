# Museek 剩余修复 — 新会话接手文档

## 一句话

Theme 1-8 已完成（37/30 P0 + 若干 P1）。剩余 **10 批 ~210 条 P1/P2/建议砍**。
用**档 1 快速模式**（跳过 brainstorming + subagent，直接写代码 commit）全部做完预计 **18-22 小时**（2-3 天强度）。

---

## 给新会话的启动指令（复制这段给 Claude）

```
Museek 平台修复继续。我要求档 1 模式：跳过 brainstorming / writing-plans / subagent 派发，直接写代码 + commit + push。每批开始前给我一句话说明要做什么，做完发简短总结就行。不要问决策问题，按业界最佳实践和项目已有模式做。

先读 docs/superpowers/plans/2026-04-21-HANDOFF-remaining-batches.md 和 docs/superpowers/plans/2026-04-21-remaining-gap-batches.md，然后从「批 2 Theme 9 CMS 富文本 + 视频」开始做起，顺序执行到批 11。

每批做完立刻 push 到 origin/main，继续下一批，中途只在：
1. 跑测试出新 regression（不在已知列表里）
2. 遇到真正需要决策的（比如富文本库选型）
这两种情况停下问我。其他一律直接做。
```

---

## 项目当前状态（HEAD = c43d8cf）

### 已完成 8 个主题

| Theme | 内容 | 状态 |
|---|---|---|
| 1 | 系统配置入口（AI/OSS/SMS） | ✅ |
| 2 | 通知触发机制 + 模板 | ✅ |
| 3 | 权限 6 action 词汇表 + 侧边栏对齐 | ✅ |
| 4 | 发行链路自动化（publish 自动 createMany） | ✅ |
| 5 | 上传安全链（HMAC 签名 + /api/files + magic-bytes） | ✅ |
| 6 | 字段契约 + fillSongDefaults + 版权序号原子递增 | ✅ |
| 7 | in_library、汽水 details、拖拽、teachers API | ✅ |
| 8 | 密码强度 + 限流 DB + CSRF 严格 + TokenBlacklist + 邀请码爆破 | ✅ |

### 测试状态

- theme5/theme6/theme7/theme8 测试全绿
- 全量回归 478/487 passed
- **已知 pre-existing 失败 6 条**（下 session 若遇见此 6 条不是 regression，别被误导）：
  1. `admin-groups-assignments TC-ASN-NOTIFY` — Theme 2 模板 race
  2. `creator POST /api/learning contentId=2 → 404` ×2 — seed 数据问题
  3. `songs 状态机 archive→restore` — 状态枚举
  4. `songs 作业重新提交` ×2 — TC-C-03-017
- 其他任何新失败都是 regression，必须停下修

### 关键运行时约束

```bash
# dev server 启动（必须带 TEST_MODE=1 否则全局 60/min/IP 限流会卡死整轮测试）
cd D:/Project/museek
TEST_MODE=1 PORT=3001 npm run dev

# 测试
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/theme8.test.ts
TEST_BASE_URL=http://localhost:3001 npx vitest run tests/api/  # 全量回归

# 类型检查
npx tsc --noEmit

# ⚠️ 不要在 dev server 运行期间跑 npm run build，会污染 .next/
# 如果误跑了：kill 3001 进程 → rm -rf .next → TEST_MODE=1 PORT=3001 npm run dev 重启

# 3000 端口被别的项目占，museek 固定 3001
```

### 直接 main 工作（用户授权）

不创 worktree，不开 PR，直接在 main 分支 commit + push。每批独立 commit。

---

## 剩余 10 批执行指南

详细条目见 `docs/superpowers/plans/2026-04-21-remaining-gap-batches.md`。
这里给**每批的一句话动作描述 + 关键文件**，直接干活不要再 brainstorm。

### 批 2：Theme 9 CMS 富文本 + 视频（~4-6h）

**任务**：CMS `new/edit` 表单补 videoUrl 输入 + 富文本编辑器（TipTap）+ 视频真实播放 + courses 硬编码字段 schema 化。

**关键文件**：
- `src/app/(admin)/admin/content/page.tsx` — 表单加 videoUrl input（type=video 时必填）、content 字段换 TipTap
- `src/app/(creator)/creator/courses/page.tsx` — 视频用 `<video src={videoUrl}>`，移除 VIDEO_DETAILS 硬编码
- `prisma/schema.prisma` — CmsContent 加 `sections Json?`, `duration String?`, `level String?`, `author String?`, `tags String?`
- `src/app/api/admin/content/route.ts` — 支持新字段
- `src/app/api/admin/content/[id]/publish/route.ts` — unpublish 写 archived 而非 draft
- `src/lib/sanitize.ts` — 升级到 DOMPurify（考虑富文本 XSS）

**决策**：富文本用 `@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/extension-image`（业界标准，npm install 即可）。插入图片走 `/api/upload/token` → `/api/files/...` 签名 URL。

**覆盖 GAP**：067/068/069/070/071/072 + CRTR-012/013/014/078 + SCHM-008/009

### 批 3：Theme 10 评审深度（~4-5h）

**任务**：评审 assess 页展示完整元数据 + 草稿保存 + marks 时间轴创作者端回显 + stats 分页 + reviewer 手机号/logout。

**关键文件**：
- `src/app/(reviewer)/review/assess/page.tsx` — 展示 performer/lyricist/composer/albumName；切走前 POST 草稿到新 `review_drafts` 表
- `src/app/api/review/drafts/route.ts` — 新建（GET/POST，按 userId+songId 唯一）
- `prisma/schema.prisma` — 新 `ReviewDraft` 表
- `src/app/(creator)/creator/songs/page.tsx` — 详情页 AudioPlayer 补 marks 时间轴（读 reviews[0].tags.marks）
- `src/app/api/review/stats/route.ts` — history 补分页
- `src/components/layout/reviewer-sidebar.tsx:17` — onLogout 接入真实 /api/auth/logout
- `src/app/(reviewer)/review/profile/page.tsx` — 手机号修改接 Theme 11 的 POST /api/profile/phone
- `src/app/(creator)/creator/assignments/page.tsx` — 作业 needs_revision 加"修改并重新提交"按钮

**覆盖 GAP**：RVW-001/003/005/009/018/019 + CRTR-022/023

### 批 4：Theme 11 收益管理完整化（~4-5h）

**任务**：stats 多维、Settlement plays、映射解除+新增、CSV 编码检测 + 总收入校验 + 回滚、dashboard 语义、结算 pay 通知。

**关键文件**：
- `src/app/api/admin/revenue/stats/route.ts` — 补 songCount/periodCount/userCount/songs 聚合
- `src/app/api/admin/revenue/settlements/route.ts` — plays = revenue_rows.playCount sum；pay 后触发 `tpl.settlement_paid` 通知（Theme 2 的 notify）
- `src/app/api/admin/revenue/mappings/[id]/route.ts` — DELETE action 解除
- `src/app/api/admin/revenue/mappings/route.ts` — POST 支持手动创建
- `src/app/(admin)/admin/revenue/page.tsx` — 映射管理加按钮
- `src/app/api/admin/revenue/imports/route.ts` — `iconv-lite` 解码 + col7 校验 + 批次 id 返回
- `src/app/api/admin/revenue/imports/[id]/route.ts` — DELETE 回滚（删 revenue_rows + 重算 settlements）
- `src/app/api/admin/dashboard/route.ts` — totalRevenue = row.totalRevenue sum；period 排序 by Date

**覆盖 GAP**：ADMIN-015/016/018/019/022/023/025/063/064/089/090/091 + LOOP-011/012

### 批 5：Theme 12 Profile + 合同硬编码清理（~3-4h）

**任务**：更换手机号完整流程 + 合同硬编码清理 + admins 改密。

**关键文件**：
- `src/app/api/profile/phone/route.ts` — 新建（POST，双手机号验证码）
- `src/app/(creator)/creator/profile/page.tsx` — 更换手机 onClick 接入；入职时间 `user.createdAt`；协议 signedAt 从 agency_contracts；agreements 从 settings 读
- `src/app/(reviewer)/review/profile/page.tsx` — 手机号同上
- `src/app/api/admin/admins/[id]/reset-password/route.ts` — 新建
- `src/app/(admin)/admin/admins/page.tsx` — 编辑表单加"修改密码"入口
- `src/app/api/admin/contracts/route.ts` + `src/app/(admin)/admin/contracts/page.tsx` — 分成比例从 settlement 历史读；协议版本 stub
- `src/app/api/profile/agreements/route.ts` — 新建返 settings 里的协议 URL

**覆盖 GAP**：CRTR-030/031/032/033/034/035/036/037 + RVW-018 + ADMIN-052/053/054/055/056/057/058 + CRTR-077

### 批 6：Theme 13 发行 + ISRC（~2-3h）

**任务**：PLATFORMS 从 DB 读、distribution URL、published 下架、ISRC 校验、外部对账适配器骨架。

**关键文件**：
- `src/app/api/admin/distributions/route.ts` + `[songId]/route.ts` + `src/app/(admin)/admin/distributions/page.tsx` — PLATFORMS 从 `platform_configs` 读；edit Modal 加 url 字段
- `src/app/api/admin/songs/[id]/status/route.ts` — 新增 action=`unpublish` → `reject` → `status=reviewed`
- `src/app/(admin)/admin/songs/page.tsx` — published tab 加"下架到作品库"按钮
- `src/app/api/admin/songs/[id]/isrc/route.ts` — 格式 `^CN-[A-Z0-9]{3}-\d{2}-\d{5}$` + 唯一性
- `src/app/api/admin/publish-confirm/sync/route.ts` — 加 adapter interface（`fetchPlatformRevenue(platform, period)` stub）
- `prisma/schema.prisma` — RevenuePlatform enum 从 platform_configs 动态化（`String @db.VarChar(50)` 替换 enum）

**覆盖 GAP**：ADMIN-011/012/013/014/027/030/033/034/035/079

### 批 7：Theme 14 用户组 + 账号 + 作业 + 设置（~4-5h）

**任务**：作业 draft/关闭/筛选、组管理员切换、logs 对齐、各设置项 CRUD 完整化。

**关键文件**：
- `src/app/api/admin/assignments/route.ts` + `[id]/route.ts` + `src/app/(admin)/admin/assignments/page.tsx` — status=draft 入口；UI 加关闭删除按钮、状态筛选
- `src/app/api/admin/groups/[id]/members/route.ts` — 新 PUT action=set-admin/unset-admin
- `src/app/(admin)/admin/groups/page.tsx` — 组管理员切换按钮；删除按钮；组名改成 Modal（弃 prompt）
- `src/app/api/admin/logs/route.ts` + `src/app/(admin)/admin/logs/page.tsx` — action 下拉英文对齐
- `src/app/(admin)/admin/settings/page.tsx` + `src/app/api/admin/settings/route.ts` — 评分推荐等级持久化；分成 default 校验；报表字段映射 UI；通知模板 CRUD；评语模板编辑

**覆盖 GAP**：ADMIN-036/037/038/039/040/041/042/043/044/045/046/047/059/060/061/073/074/075/076/077/078/080/081/082/083/084

### 批 8：Theme 15 公共 lib 完整化（~3-4h）

**任务**：权限真实粒度、cache 6 类 key、AI 超时/缓存、sanitize 升级、ENCRYPTION_KEY UI。

**关键文件**：
- `src/lib/api-utils.ts` — requirePermission 非内置角色路径补测；group_admin portal 挂钩（lib/group-admin.ts 新建）
- `src/lib/cache.ts` — 补 invalidate 链，所有 6 类 key 在 mutation 时触发
- `src/lib/ai-analysis.ts` — AbortController 5s 超时；prod AI_API_KEY 缺失 `console.error` + DB 留 warn record
- `src/app/api/review/songs/[id]/analysis/route.ts` — 响应 cache 30min
- `src/lib/sanitize.ts` — 引 isomorphic-dompurify，替换手写正则
- `src/app/(admin)/admin/settings/page.tsx` — ENCRYPTION_KEY tab（生成 + 轮换流程）
- `src/lib/format.ts` — formatDateTime 显式 Asia/Shanghai

**覆盖 GAP**：COMM-001/003/004/006/007/008/009/010/011/012/013/014/016/017/018/019/020/021/022

### 批 9：Theme 16 schema 细节（~2-3h）

**任务**：settlement 金额保障、platform_songs 默认 @default、notifications 字段（已在 Theme 2 扩）、seed 分叉消除、schema 约束收紧。

**关键文件**：
- `prisma/schema.prisma` — platform_songs 5 字段加 `@default`（schema 层兜底 helper 冗余）；score `@db.TinyInt` → 加应用层 CHECK；sms_codes 加 `purpose @db.VarChar(20) @default("register")`；LoginLog + portal；AssignmentSubmission.submittedAt 非空
- `prisma/seed.js` vs `seed.ts` — 统一到 seed.js 一份
- `src/lib/revenue-backfill.ts` — settlement 金额写入失败时 throw 而非 0 兜底
- `scripts/theme9-schema-migration.sql` — 老数据 fill default

**覆盖 GAP**：SCHM-001~023 除已做的

### 批 10：Theme 17 批量下载 + 杂项 P2（~3-4h）

**任务**：批量下载后端化、硬编码文案清理、logs 完善、CSV 注入防护。

**关键文件**：
- `src/app/api/admin/songs/batch-download/route.ts` — 改为后端 streaming zip（archiver 库，Node 标准）
- `src/app/(admin)/admin/batch-download/page.tsx` — 改为调后端 + 下载链接
- `src/lib/export.ts:7-10` — `=/+/-/@` 单元格前缀加 `'` 转义
- 其他 P2 硬编码 grep + 替换（日期、"2026-Q1"、头像 size 等）

**覆盖 GAP**：ADMIN-017/031/048/050/051/058/065/066/074/075/076/085/086/087/088/094/095/098 + LOOP-013/014/015

### 批 11：Theme 18 建议砍决策（~0.5h）

**纯决策**，不动代码。问用户 12 条：
- GAP-ADMIN-032/096/097
- GAP-CRTR-076/077/078
- GAP-RVW-013/014/016/017/020
- GAP-SCHM-024

每条两选一：实施 / 从 PRD 移除。全收到答复后写一条 commit 记录决策。

---

## 执行节奏建议

1. 每批开始前：`git status` 确认 clean，`git log -3` 确认 HEAD
2. 每批结束：跑 `npx vitest run tests/api/themeN.test.ts`（若新写了测试文件）+ 全量冒烟 `npx vitest run tests/api/theme5.test.ts tests/api/theme6.test.ts tests/api/theme7.test.ts tests/api/theme8.test.ts` 确认前几批不坏
3. push 后立刻进下一批
4. 遇到以下情况停下问用户：
   - 新 regression（不在已知 6 条内）
   - 富文本库选型（批 2）
   - PLATFORMS 改成动态后，老数据的 enum 值如何迁移（批 6）
   - 建议砍决策（批 11）

---

## 资产清单

- Gap 清单：`docs/superpowers/specs/2026-04-20-platform-alignment-gap-list.md`
- 子清单：`docs/superpowers/specs/2026-04-20-gap-{admin,creator,reviewer-common-schema}.md`
- 批次计划：`docs/superpowers/plans/2026-04-21-remaining-gap-batches.md`
- Theme 1-8 spec + plan：`docs/superpowers/{specs,plans}/2026-04-21-theme*-*.md`
- 测试 helper：`tests/api/_helpers.ts`（adminLogin/creatorLogin/reviewerLogin/http/expectOk/expectCode/BASE_URL）
- 测试 seed：`npx tsx prisma/seed-test-users.ts`（注入 13800001234/13500008888 + 邀请码 E2ETEST1）

---

## 约定

- commit 信息用中文，前缀 `feat(themeN)`/`refactor(themeN)`/`fix(themeN)`/`chore(themeN)`
- 无 Co-Authored-By 尾注（用户明确要求简洁 commit）
- 不开 PR，直接 main push
- 每批独立提交，不合并（便于 git bisect）
