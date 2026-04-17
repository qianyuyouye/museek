# Museek 修复执行计划

> **生成日期**：2026-04-17  
> **配套文档**：`docs/traceability-matrix.md`（PRD 追踪矩阵）、`docs/prd_text.txt`（v5.2 PRD）  
> **当前基线**：main @ `def25c8`，管理端 92% / 创作者 78% / 评审 55%

本计划把追踪矩阵里 25 项缺口拆成可执行的任务卡。每张卡独立，**新对话中 Claude 读这张卡 + 追踪矩阵即可动手**，不必回看历史对话。

---

## 使用说明

**新对话启动**：复制下方 prompt 到新对话：

```
请按 docs/fix-plan.md 执行 P0 任务 <N>。
先读 docs/traceability-matrix.md 和任务卡，做完后更新追踪矩阵对应条目状态，
commit 但不 push。完成后告诉我下一步建议。
```

**串联执行（一次做完 P0）**：

```
请按 docs/fix-plan.md 顺序执行 P0 任务 1-5，每完成一张卡单独 commit。
遇到计划里标记"需要用户确认"的决策点必须停下问我，不要自行决定。
```

**完成一张卡后**：同步更新 `docs/traceability-matrix.md` 对应行状态（🔴→✅），并在本文件末尾追加 "已完成" 记录。

---

# P0 任务（阻塞核心业务，5 张）

## P0-1 评审端音频播放

**目标**：让评审页能真实试听音频，支持 A-B 循环 + 变速（PRD §7.2.3）。

**涉及文件**：
- `src/app/(reviewer)/review/assess/page.tsx`（主战场）
- `src/app/api/review/songs/[id]/route.ts`（确认返回 `audioUrl`）

**实现思路**：
1. 读 assess 页面，找到"播放按钮 / 速度选择 / A-B 循环"控件（当前为 UI mock）
2. 新建一个 `<AudioPlayer>` 子组件，封装一个 `useRef<HTMLAudioElement>`
3. 暴露 props：`src`, `playbackRate`, `loopRange?: [number, number]`
4. 内部：
   - `<audio ref={audioRef} src={src} preload="metadata" />`
   - 播放/暂停：`audio.play() / .pause()`
   - 进度监听：`ontimeupdate` → 更新当前时间
   - 变速：`audio.playbackRate = rate`
   - A-B 循环：`ontimeupdate` 里判断 currentTime > loopEnd 就 `currentTime = loopStart`
5. 保留原波形 UI（作为可视化装饰），但播放状态绑到真实音频
6. 音频源来自 `song.audioUrl`（API 已返回，不需要改后端）

**用户已决策**：
- ✅ **时间轴标记工具要做**（不延后）：评审时点击波形可打时间点注记，提交评审时随 `reviews.tags` 一起存 JSON。建议字段结构：
  ```json
  { "marks": [{ "t": 23.5, "note": "此处混音偏闷" }, { "t": 67.2, "note": "副歌转调生硬" }] }
  ```
  - UI：波形图下方显示当前标记列表；点击波形触发 prompt 输入备注
  - 后端：`/api/review/submit` 接收 `tags` 即可（schema 已支持 JSON）
- ✅ **波形随播放进度高亮**：用现有 `song.audioFeatures` 的 waveformPeaks 绘制，播放时用 `clipPath` 随 `currentTime/duration` 推进

**验收标准**：
- [ ] 点击播放按钮，真实音频开始播放
- [ ] 选择 0.5x/0.75x/1.25x/1.5x 速度，播放速度变化
- [ ] 点击 A 设置起点、B 设置终点，启用循环后自动回跳
- [ ] 波形随播放进度高亮（已播部分 vs 未播部分颜色区分）
- [ ] 点击波形任意位置弹 prompt 输入注记，列表显示所有标记
- [ ] 标记随评审提交写入 `reviews.tags` JSON
- [ ] 评审提交后音频停止

**预计工作量**：3-4 小时（含时间轴标记）  
**依赖**：无  
**commit 范围**：assess 页面 + 可能新建 `components/review/AudioPlayer.tsx`

---

## P0-2 创作者实名认证入口

**目标**：创作者能在个人中心提交真实姓名 + 身份证号，进入 `pending` 审核状态（PRD §1.3）。

**涉及文件**：
- **新建** `src/app/api/profile/real-name/route.ts`（POST）
- `src/app/(creator)/creator/profile/page.tsx`（替换 mock 按钮为真实表单 Modal）
- `src/lib/api-utils.ts`（可能需要 `getCurrentUser` 已有，确认）

**实现思路**：
1. 后端 `POST /api/profile/real-name`：
   ```ts
   // 接收 { realName, idCard }
   // 校验: realName 长度 2-20, idCard 正则 ^\d{17}[\dX]$
   // 前置: user.realNameStatus === 'unverified' 或 'rejected' 才允许提交
   // 写入: realName, idCard, realNameStatus='pending'
   // 返回: { realNameStatus: 'pending' }
   ```
2. 前端 Modal：
   - 触发按钮改为"提交实名认证"（当 status=unverified/rejected）或"查看认证信息"（其他状态）
   - Modal 字段：真实姓名 input、身份证号 input（前端正则校验）
   - 提交成功后 toast + 刷新用户信息
3. 管理端已有 `/api/admin/students/[id]/verify`（审核通过/驳回），**已打通** — 不需改

4. **身份证号加密存储**（用户决策）：
   - 新建 `src/lib/encrypt.ts`，导出 `encryptIdCard(plain)` / `decryptIdCard(cipher)`
   - 算法：AES-256-GCM（Node `crypto` 内置，不新增依赖）
   - Key 来源：`process.env.ENCRYPTION_KEY`（32 字节 hex，启动时强制校验；未配置则启动报错）
   - 存储格式：`iv(12B) + authTag(16B) + ciphertext` 用 base64 编码成字符串存 `idCard` 字段
   - 管理端读取时在 `/api/admin/students/[id]` 里 decrypt 返回（仅后端处理，避免前端拿到 key）
   - 列表页 `/api/admin/students` 返回脱敏版 `110***1234`（不 decrypt）

5. **新增 env 变量**：`ENCRYPTION_KEY`（32 字节十六进制，示例 `openssl rand -hex 32` 生成）
   - `docker-compose.yml` 和 `.env.example` 都要加
   - 部署时告知用户生成并配置

**用户已决策**：
- ✅ **身份证号加密存储**（AES-256-GCM，需要 ENCRYPTION_KEY 部署变量）
- 是否允许 `verified` 状态后**重新提交**？PRD 未明确。**本卡默认**：不允许（`verified` 按钮 disabled）— 如需重新认证需管理员先驳回

**验收标准**：
- [ ] unverified 创作者能打开 Modal 提交姓名+身份证
- [ ] 提交后 `realNameStatus` 变 pending，数据库 `idCard` 字段为加密字符串（不是明文 18 位数字）
- [ ] 管理端"用户档案详情"能查看**解密后的身份证**（仅详情接口 decrypt）
- [ ] 管理端"用户档案列表"显示脱敏格式 `110***1234`
- [ ] 驳回后创作者能修改并重新提交
- [ ] 未配置 `ENCRYPTION_KEY` 时服务启动报错（明确提示）

**预计工作量**：2.5 小时（含加密工具 + 脱敏逻辑）  
**依赖**：无  
**部署前须知**：生产环境必须先生成并配置 `ENCRYPTION_KEY`，否则身份证提交会失败  
**注意**：这是 PRD §1.3 核心流程 / 打款前置条件，不做完则 Settlement.paid 永远无法触发

---

## P0-3 分成规则三档自动评估

**目标**：生成 Settlement 时按 PRD §6.2 三档规则选比例，而不是固定 70/30。

**涉及文件**：
- `src/app/api/admin/revenue/imports/route.ts`（CSV 导入时生成 settlement 的位置）
- `src/app/api/admin/revenue/mappings/[id]/route.ts`（确认映射时回溯生成，如果 P0-4 先做就合并）
- **可能新建** `src/lib/commission.ts`（规则评估函数，供多处调用）

**实现思路**：
1. 扩展 `system_settings.revenue_rules` 的规则字段格式（用户决策：完全动态）：
   ```json
   [
     {
       "name": "高分激励",
       "creatorRatio": 0.80,
       "platformRatio": 0.20,
       "conditionType": "min_song_score",
       "conditionValue": 90,
       "priority": 1,
       "enabled": true
     },
     {
       "name": "量产奖励",
       "creatorRatio": 0.75,
       "platformRatio": 0.25,
       "conditionType": "min_published_count",
       "conditionValue": 10,
       "priority": 2,
       "enabled": true
     },
     {
       "name": "默认规则",
       "creatorRatio": 0.70,
       "platformRatio": 0.30,
       "conditionType": "default",
       "conditionValue": null,
       "priority": 99,
       "enabled": true
     }
   ]
   ```
   - **支持的 conditionType**（enum）：
     - `default` — 兜底（无条件，最低优先级）
     - `min_song_score` — 作品 `score >= conditionValue` 时命中（需 songId）
     - `min_published_count` — 创作者累计 published 作品数 `>= conditionValue`
   - 后续可扩展（如 `min_total_revenue`、`user_tag_in`）
2. 新建 `src/lib/commission.ts`：
   ```ts
   export async function resolveCommissionRatio(
     prisma: PrismaClient,
     ctx: { creatorId: number; songId?: number | null }
   ): Promise<{ creatorRatio: Decimal; platformRatio: Decimal; ruleName: string }> {
     // 1. 读 system_settings where key='revenue_rules'
     // 2. 过滤 enabled=true，按 priority 升序（数字小=优先级高）
     // 3. 对每条规则逐个评估 conditionType：
     //    - default 始终匹配
     //    - min_song_score: ctx.songId 存在时查 platform_songs.score
     //    - min_published_count: 查 creator 的 published 数
     // 4. 返回第一条匹配的规则（创作者比例/平台比例/名称）
     // 5. 若全部不匹配（异常），返回 { 0.70, 0.30, 'fallback' } 并写操作日志警告
   }
   ```
3. `imports/route.ts` 和后续 P0-4 backfill 里创建 settlement 时，调用 `resolveCommissionRatio` 获取比例
4. **同步更新** `admin/settings/page.tsx` 的 `CommissionTab`：
   - Modal 里把原本的"触发条件（文本）"改为 "条件类型 select + 数值 input"
   - select 选项：默认规则 / 最低作品评分 / 最低已发行作品数
   - 对应 conditionType 字段
   - 列表展示时把 conditionType 反向翻译成中文描述

**PRD 要求（§6.2）三档规则作为种子数据**，seed.js 插入时按上述 JSON 格式。

**边界**：
- revenue_rows 无 platform_song 关联时（只通过 creator_id 映射），`min_song_score` 自动不匹配，跳到下一条规则
- 用户决策 ✅ **完全 DB 驱动**，UI 里改规则立即生效

**需要用户确认**：无（已决策完全动态）

**验收标准**：
- [ ] seed.js 插入 3 条初始规则（按 PRD §6.2）
- [ ] 导入 CSV 时，映射到 score ≥ 90 的歌曲自动按 80/20 生成 settlement
- [ ] 映射到累计发行 ≥ 10 首作者的歌曲按 75/25
- [ ] 其他默认 70/30
- [ ] settings → 分成规则 Modal 能设置 conditionType + conditionValue
- [ ] 修改规则后**立即对下次导入生效**（不需重启服务）

**预计工作量**：3 小时（含 UI 改造）  
**依赖**：无（但 P0-4 回溯生成也需要调用此函数，推荐和 P0-4 连做）

---

## P0-4 映射确认回溯生成结算

**目标**：当 `song_mappings.status` 从 `pending/suspect` 变为 `confirmed` 时，系统自动扫描该 `qishuiSongId` 的历史 `revenue_rows`，为未结算的行批量创建 Settlement（PRD §6.3）。

**涉及文件**：
- `src/app/api/admin/revenue/mappings/[id]/route.ts`（PUT 处理）
- **可能新建** `src/lib/revenue-backfill.ts`（回溯函数）

**实现思路**：
1. 当前 `mappings/[id]` PUT 支持 `action: bind/confirm/reject` 等，修改状态时**只更新 mapping，未触发回溯**
2. 新增回溯函数：
   ```ts
   // src/lib/revenue-backfill.ts
   export async function backfillSettlements(
     prisma: PrismaClient,
     mappingId: number
   ) {
     // 1. 读 mapping：qishuiSongId, creatorId, platformSongId
     // 2. 若 status !== 'confirmed' 或 creatorId === null → 跳过
     // 3. 查 revenue_rows where qishuiSongId 且 matchStatus IN ('suspect','unmatched') 且 无关联 settlement
     // 4. 对每行：
     //    - 调 resolveCommissionRatio(creatorId, platformSongId)
     //    - 创建 Settlement（creatorAmount = totalRevenue * creatorRatio）
     //    - 更新 revenue_rows.mappingId + matchStatus='matched'
     // 5. 返回 { created: N, skipped: N }
   }
   ```
3. mappings/[id] PUT 里在状态变为 confirmed 后调用此函数
4. 同时应用到：CSV 导入后立即创建的 confirmed 映射（P0-3 已在导入流里）

**边界场景（PRD §8）**：
- 若 revenue_rows 已关联其他 settlement（不太可能，unique 约束） → 跳过
- 若 revenue_rows.matchStatus='irrelevant' → 跳过
- 若一个 mapping 对应上百条 revenue_rows → 用 prisma.$transaction 批量

**用户已决策**：
- ✅ **同步执行**：在 PUT 请求里等待回溯完成再返回（可接受 <2s 阻塞）
- 映射**解除**时应该做什么？PRD §8 说"旧 settlement 标记 exception，重新生成新 settlement"。本任务**只做确认→生成**，解除场景延后到 P2

**验收标准**：
- [ ] 先导入一批 CSV 全部 unmatched
- [ ] 在映射管理 UI 手动绑定创作者 → 自动出现 N 条 settlement
- [ ] 日志/返回体显示"已回溯生成 N 条"

**预计工作量**：2.5 小时  
**依赖**：P0-3 必须先做（否则创建 settlement 时 ratio 还是硬编码）

---

## P0-5 打款前实名校验

**目标**：Settlement 标记为 `paid` 时，后端必须校验 `creator.realNameStatus === 'verified'`，否则阻断（PRD §7.3.15）。

**涉及文件**：
- `src/app/api/admin/revenue/settlements/route.ts`（POST action='paid'）

**实现思路**：
1. 读 settlements/route.ts，找到 action=`paid` 或 `mark_paid` 的分支
2. 在更新状态前：
   ```ts
   // 取所有传入的 ids
   const settlements = await prisma.settlement.findMany({
     where: { id: { in: ids } },
     include: { creator: { select: { id: true, name: true, realNameStatus: true } } },
   })
   const unverified = settlements.filter(s => s.creator.realNameStatus !== 'verified')
   if (unverified.length > 0) {
     return err(`${unverified.length} 条记录的创作者未完成实名认证：${unverified.map(s => s.creator.name).join(', ')}`)
   }
   // 允许继续
   ```
3. 前端 `revenue/page.tsx` 的 `SettleTab` 点击"标记打款"时，显示后端返回的详细错误

**验收标准**：
- [ ] 对 `realNameStatus !== 'verified'` 的 settlement 点打款 → 后端 400 + 中文提示
- [ ] 全部 verified 的 settlement → 正常 paid

**预计工作量**：45 分钟  
**依赖**：无（但真实测试依赖 P0-2 能让创作者先变 verified）

---

# P1 任务（功能不完整，7 张，简短版）

## P1-1 评审端歌词/Prompt 读真实数据

**改动**：`review/assess/page.tsx`  
**要点**：删除硬编码 LYRICS_SAMPLE 和 PROMPT_GEN，改从 `song.lyrics / song.styleDesc / song.creationDesc` 读（API 已返回）  
**工时**：30 分钟

## P1-2 评审耗时 durationSeconds

**改动**：`review/assess/page.tsx` + `/api/review/submit/route.ts`  
**要点**：进页面 `useEffect` 记录 `startAt = Date.now()`，submit 时发 `durationSeconds: Math.floor((Date.now()-startAt)/1000)`；后端保存到 `Review.durationSeconds`；`stats/route.ts` 返回均值时计入  
**工时**：45 分钟

## P1-3 CSV 按歌名匹配（§6.1 Step 3）

**改动**：`api/admin/revenue/imports/route.ts` 的 `parseQishuiCsv` 之后  
**要点**：对 `unmatched` 的行，用 `songName` 在 `platform_songs` 做 `findMany({ title: { contains: songName } })`：
- 命中 1 条 → 建映射 (auto_exact, confirmed)，立即生成 settlement
- 命中多条 → 建映射 (auto_fuzzy, suspect)
- 0 条 → 建映射 (none, pending)  
**工时**：1.5 小时

## P1-4 CSV period 保留原始字符串

**改动**：`api/admin/revenue/imports/route.ts`  
**要点**：把 `period = "2026-02"` 改为 `period = "2026/02/01 - 2026/02/28"`（直接存原始字符串）。注意 `@@unique(qishuiSongId, period)` 约束对字符串精确匹配敏感。  
**用户已决策**：✅ **清空历史数据**（`revenue_imports / revenue_rows / settlements` 三表全清，不做迁移）  
**执行步骤**：
1. 先改代码（period 存原始字符串）
2. 部署前在服务器执行：
   ```sql
   DELETE FROM settlements;
   DELETE FROM revenue_rows;
   DELETE FROM revenue_imports;
   ```
3. 或用 Prisma：`await prisma.$transaction([prisma.settlement.deleteMany(), prisma.revenueRow.deleteMany(), prisma.revenueImport.deleteMany()])`
4. 之后重新导入 CSV  
**工时**：20 分钟（代码）+ 清空操作  
**在 P1-3 前做**（避免新老数据混用导致匹配异常）

## P1-5 Creator 重新提交预填

**改动**：`creator/songs/page.tsx` 点击"修改并重新提交"时跳 `/creator/upload?songId=xxx`；`creator/upload/page.tsx` 读 `searchParams.songId`，初始化时调 `/api/creator/songs/${id}` 预填表单  
**工时**：1 小时

## P1-6 Queue 字段名对齐

**改动**：`api/review/queue/route.ts` 或 `review/queue/page.tsx` 二选一  
**要点**：后端返回 `studentName`（更符合 portal 语义），前端同步字段名  
**工时**：15 分钟

## P1-7 创作者头像上传

**改动**：**新建** `api/profile/avatar/route.ts`（POST，复用 upload token 流程） + `creator/profile/page.tsx`  
**要点**：文件选择 → upload/token 获取 URL → 直传 → 回调 POST 更新 `avatarUrl`  
**工时**：1.5 小时

---

# P2 任务（功能补齐/合规，10 张）

> **审计基线**：2026-04-17 P1 全部完成后的交叉验证，整体完成度 ≈ 89%。下面 P2 完成后预计进 95%+。

## P2-1 学习进度表 LearningRecord

**目标**：创作者 "我的学习" 页面从全硬编码改为真实进度追踪（PRD §7.1.6）。

**涉及文件**：
- `prisma/schema.prisma`（新增 `LearningRecord` 模型）
- **新建** `src/app/api/learning/route.ts`（GET 列表 + POST 记录学习）
- **新建** `src/app/api/learning/achievements/route.ts`（GET 徽章+时长汇总）
- `src/app/(creator)/creator/learning/page.tsx`（删硬编码，接真实 API）
- `src/app/(creator)/creator/courses/page.tsx`（课程详情/视频页埋点记录学习）

**Schema 设计**：
```prisma
model LearningRecord {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")
  contentId   Int      @map("content_id")       // 关联 cms_contents
  progress    Int      @default(0) @db.SmallInt // 0-100
  duration    Int      @default(0)              // 累计学习秒数
  completedAt DateTime? @map("completed_at")
  lastViewedAt DateTime @default(now()) @map("last_viewed_at")
  createdAt   DateTime @default(now()) @map("created_at")

  user        User      @relation(fields: [userId], references: [id])
  content     CmsContent @relation(fields: [contentId], references: [id])

  @@unique([userId, contentId])
  @@index([userId, lastViewedAt])
  @@map("learning_records")
}
```

**实现思路**：
1. schema 新增 + `npx prisma db push`
2. 课程详情页进入时 `POST /api/learning { contentId, progress, delta }`（每 30 秒心跳或退出时提交）
3. learning 页 `GET /api/learning/achievements` 返回：总时长、完成课程数、连续学习天数、徽章（完成 N 课、学习 N 小时）
4. 徽章规则写死在后端（最简：5 课 / 10 小时 / 30 课 / 50 小时 / 连续 7 天 / 连续 30 天）

**验收标准**：
- [ ] 进入任意课程详情，后端收到 LearningRecord upsert
- [ ] learning 页总时长/徽章从 API 取（刷新后数据持久）
- [ ] 不同 creator 看到不同数据
- [ ] 未登录创作者 API 返回 401

**预计工作量**：4 小时  
**依赖**：无（独立功能）

---

## P2-2 operation_logs 写操作全覆盖

**目标**：PRD §7.3.18 要求"记录所有写操作"，当前仅 `/api/admin/logs/record` 路由调用 `logAction`，**46 个 admin API 的 CUD 全部没日志**。

**涉及文件**：
- `src/lib/log-action.ts`（确认 signature）
- **批量改**：`src/app/api/admin/**/route.ts` 里所有 POST/PUT/DELETE（约 46 个）

**实现思路**：
1. 在 `api-utils.ts` 或 `log-action.ts` 提供便捷包装 `logWrite(auth, action, targetType, targetId, snapshot?)`
2. 对每个 admin 写路由末尾（成功响应前）追加：
   ```ts
   await logAction({
     userId: auth.userId,
     action: 'delete_song',
     targetType: 'platform_song',
     targetId: song.id,
     detail: { title: song.title, version: song.version },
   })
   ```
3. action 命名表（建议统一）：
   - 用户组：`create_group / update_group / delete_group / regen_invite_code / toggle_group_status`
   - 歌曲：`update_song / delete_song / publish_song / archive_song / restore_song`
   - ISRC：`assign_isrc / import_isrc_csv`
   - 结算：`mark_paid / export_settlement`
   - 映射：`bind_mapping / confirm_mapping / reject_mapping`
   - 账号：`create_admin / update_admin / disable_user / reset_password`
   - 角色：`create_role / update_role / delete_role`
   - 内容：`publish_content / unpublish_content`
   - 设置：`update_system_setting`
4. 批量下载（`admin/batch-download`）单独加一条 `batch_download_songs`

**验收标准**：
- [ ] 任意 CUD 操作后，`operation_logs` 新增记录
- [ ] `/admin/logs` 页面能查到完整操作链
- [ ] detail 字段有关键上下文（不只是 id）

**预计工作量**：6 小时（批量但重复性高）  
**依赖**：无

---

## P2-3 批量下载三条件校验报告

**目标**：PRD §7.3.7 要求下载前校验协议 + 实名 + ISRC，报告文件里红标缺失项，当前只有打包无校验。

**涉及文件**：
- `src/app/api/admin/batch-download/route.ts`（校验逻辑）
- `src/app/(admin)/admin/batch-download/page.tsx`（UI 展示报告预览）

**实现思路**：
1. 打包前对每首歌取 `user.agencyContract / user.realNameStatus / song.isrc` 判断：
   - 三项全满足 → 正常入包
   - 任一缺失 → 入包但在 `validation-report.txt` 标红行
2. report 格式：
   ```
   Museek 批量下载校验报告
   生成时间：2026-04-17 15:30
   
   ==== 通过 (18) ====
   [AIMU-2026-000001] 告白气球 — 张三
   ...
   
   ==== 不合规 (3) ====
   [AIMU-2026-000042] 夜空中最亮的星 — 李四
     ❌ 未签代理协议
     ❌ 未实名认证
   [AIMU-2026-000051] 晴天 — 王五
     ⚠️ ISRC 未申报
   ```
3. 前端下载前在 Modal 里显示预览，让管理员决定是否继续
4. 所有下载动作 `logAction('batch_download_songs', detail={count, unverifiedCount})`

**验收标准**：
- [ ] 下载任意选集，ZIP 内必有 `validation-report.txt`
- [ ] 至少一个缺项的歌曲，报告列出具体缺失项
- [ ] 操作日志记录批量下载
- [ ] UI 在下载前给出不合规歌曲数提示

**预计工作量**：2 小时  
**依赖**：建议和 P2-2 一起做（都要 logAction）

---

## P2-4 手机号修改（验证码流程）

**目标**：创作者/评审个人中心的"更换手机"按钮打通验证码流程，当前只弹 toast。

**涉及文件**：
- **新建** `src/app/api/profile/phone/send-code/route.ts`（给新手机发验证码）
- **新建** `src/app/api/profile/phone/verify/route.ts`（验证并更新）
- `src/app/(creator)/creator/profile/page.tsx` + `src/app/(reviewer)/review/profile/page.tsx`（Modal 表单）
- `src/lib/sms.ts`（复用阿里云 SMS 工具）

**实现思路**：
1. 复用现有注册短信通道（`sms_codes` 表），`scene='change_phone'`
2. 两步流程：
   - Step 1：输入新手机号 → `POST /api/profile/phone/send-code { newPhone }`（校验新号不占用，发送 6 位码）
   - Step 2：输入验证码 → `POST /api/profile/phone/verify { newPhone, code }` → 更新 `user.phone`
3. 原手机不强制二次校验（用户已登录 JWT）
4. 成功后 `logAction('update_phone', detail={old, new})`

**验收标准**：
- [ ] unverified/verified 创作者都可改
- [ ] 新号已被他人占用 → 400
- [ ] 验证码错误 → 400
- [ ] 成功后 `user.phone` 更新，刷新 profile 可见

**预计工作量**：3 小时  
**依赖**：生产需配阿里云 SMS env（`ALIYUN_ACCESS_KEY_ID/SECRET/SIGN_NAME/TEMPLATE_CODE`）

---

## P2-5 CSV 总收入校验 + GBK 编码检测

**目标**：PRD §5.2 要求校验"总收入 = 抖音 + 汽水"，且 Windows 用户常上传 GBK 编码 CSV，当前假设 UTF-8 会乱码。

**涉及文件**：
- `src/app/api/admin/revenue/imports/route.ts`（编码检测 + 校验）
- **可选** `package.json` 新增 `iconv-lite`（不依赖 jschardet，用 BOM + 采样）

**实现思路**：
1. **编码检测**：
   ```ts
   const buf = Buffer.from(await file.arrayBuffer())
   let text: string
   if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
     text = buf.toString('utf8') // UTF-8 BOM
   } else if (looksLikeGBK(buf)) {
     text = iconv.decode(buf, 'gbk')
   } else {
     text = buf.toString('utf8')
   }
   ```
   简单启发：前 1KB 里出现 0x81-0xFE 字节对占比 > 30% 且不符合 UTF-8 序列就当 GBK
2. **总收入校验**：
   ```ts
   if (Math.abs(t - (d + q)) > 0.01) {
     errors.push(`第 ${i+1} 行: 总收入 ${t} ≠ 抖音 ${d} + 汽水 ${q}`)
     continue
   }
   ```
3. 错误行跳过而不是整文件失败，返回 `parseErrors` 给前端展示

**验收标准**：
- [ ] UTF-8 + GBK 两种 CSV 都能正确解析（无乱码）
- [ ] 总收入错行列入 parseErrors，不入库
- [ ] 前端上传后弹框展示 parseErrors 明细

**预计工作量**：2 小时  
**依赖**：`npm i iconv-lite`

---

## P2-6 CMS sections / duration 字段

**目标**：PRD 要求课程内容可分章节，视频有时长，当前 `cms_contents` 只存 title+body。

**涉及文件**：
- `prisma/schema.prisma`（CmsContent 新增 `sections Json?` + `duration Int?`）
- `src/app/api/admin/content/[id]/route.ts`（PUT 接收新字段）
- `src/app/(admin)/admin/content/page.tsx`（编辑器 UI）
- `src/app/(creator)/creator/courses/page.tsx`（播放页展示 sections 目录 + 时长）

**Schema**：
```prisma
sections Json?   // [{ title: string, startAt: number, duration: number }]
duration Int?   // 秒，视频/课程总时长
```

**实现思路**：
1. db push 字段
2. 管理端视频详情编辑器新增"章节列表"表单（可增删行）
3. 创作者课程页左侧列出章节目录，点击跳转到视频 startAt
4. duration 从上传音频/视频文件 metadata 提取（`<video>.duration`）

**验收标准**：
- [ ] 管理员能为视频加 3+ 章节并保存
- [ ] 创作者课程页显示目录和总时长
- [ ] 章节点击 seek 正确

**预计工作量**：1.5 小时  
**依赖**：无

---

## P2-7 OSS 生产签名 URL

**目标**：`lib/upload.ts` 有 `OSS_BUCKET` 分支但**未用 `ali-oss` SDK 生成 signatureUrl**，生产环境会 403。

**涉及文件**：
- `src/lib/upload.ts`（`getOSSToken` 实装）
- `package.json`（`ali-oss` 依赖）

**实现思路**：
```ts
import OSS from 'ali-oss'
const client = new OSS({
  region: process.env.ALIYUN_OSS_REGION!,
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID!,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET!,
  bucket: process.env.ALIYUN_OSS_BUCKET!,
})
const uploadUrl = client.signatureUrl(key, {
  method: 'PUT',
  expires: 300,
  'Content-Type': mimeType,
})
```
注意前端 PUT 时必须用相同的 `Content-Type` header，否则签名不通过。

**验收标准**：
- [ ] 配置 OSS env 后，音频/封面直传到 OSS（bucket 里能看到文件）
- [ ] fileUrl 能 GET 到文件
- [ ] 不配 env 时 fallback 到本地上传

**预计工作量**：2 小时  
**依赖**：`npm i ali-oss`，生产 env 需配齐

---

## P2-8 邀请码改后端生成

**目标**：`admin/groups/page.tsx` 第 280/555 行用 `Math.random().toString(36)` 在客户端生成邀请码，不安全（碰撞/可预测）。

**涉及文件**：
- `src/app/api/admin/groups/[id]/regen-code/route.ts`（**新建** 或合并到现有 PUT）
- `src/app/(admin)/admin/groups/page.tsx`

**实现思路**：
1. 后端用 `crypto.randomBytes(6).toString('base64url').slice(0, 8).toUpperCase()` 生成
2. 数据库校验唯一，冲突则重试 3 次
3. 前端"重新生成"按钮改调 `POST /api/admin/groups/:id/regen-code` 返回新码
4. 创建新组时也走后端

**验收标准**：
- [ ] 前端无 `Math.random` 生成邀请码代码
- [ ] 连续点 3 次，后端生成 3 个不同码
- [ ] 操作 `logAction('regen_invite_code')`（和 P2-2 合并）

**预计工作量**：1 小时  
**依赖**：建议和 P2-2 一起

---

## P2-9 Creator revenue 时间戳动态化

**目标**：`creator/revenue/page.tsx` 第 174-176 行硬编码"数据更新于 2026-04-10 / 下次更新 2026-07-10"，应读最近一次 RevenueImport 时间。

**涉及文件**：
- `src/app/api/creator/revenue/route.ts`（响应新增 `lastImportAt` + `nextEstimatedImport`）
- `src/app/(creator)/creator/revenue/page.tsx`

**实现思路**：
1. 后端查 `revenue_imports` 的 `max(importedAt)`（全平台或关联当前 creator 的均可）
2. 下次预计 = 上次 + 90 天（或从 system_settings 配一个 `revenue_import_cycle_days`）
3. 前端 `new Date(lastImportAt).toLocaleDateString('zh-CN')`

**验收标准**：
- [ ] 页面显示真实上次导入时间
- [ ] 再次导入新 CSV 后，页面数字更新
- [ ] 从未导入时显示"尚无收益数据"

**预计工作量**：1 小时  
**依赖**：无

---

## P2-10 发行状态 sync 外部对账

**目标**：`admin/publish-confirm` 的 `sync` action 目前始终返回 mock，需对接汽水平台 OpenAPI。

**涉及文件**：
- `src/app/api/admin/publish-confirm/sync/route.ts`（或现有 action 入口）
- **新建** `src/lib/qishui-client.ts`（封装汽水 HTTP 调用 + 鉴权）

**实现思路**：
1. **先停**：用户需提供汽水 OpenAPI 文档或 Mock Server（当前无外部数据源）
2. 完成后的实装：
   - `lib/qishui-client.ts` 封装 token 刷新、HTTP 调用
   - sync 批量拉取最近 7 天发行状态，对比本地 `distributions.status` 更新
   - 差异写入 `distributions.syncNote` 并 `logAction('sync_distribution')`

**验收标准**：
- [ ] 接入文档后真实 fetch 而非 mock
- [ ] UI 按钮能拉到本地-远端差异列表
- [ ] 网络/鉴权失败给明确错误

**预计工作量**：2 小时（假设文档齐全）+ 文档对接期  
**依赖**：⚠️ **需用户提供汽水 OpenAPI 文档**，否则暂不动

---

# P3 任务（精细化/体验，6 项）

工时各 ≤ 1.5 小时，顺序随意。

## P3-1 作品广场分享改真实 clipboard
**改动**：`creator/community/page.tsx:240` `onClick` 把 `showToast('已复制')` 改成 `navigator.clipboard.writeText(url).then(() => showToast(...))`  
**工时**：20 分钟

## P3-2 songs 退回/下架按钮暴露
**改动**：`admin/songs/page.tsx` 详情 Modal 根据状态加按钮：`ready_to_publish|reviewed` → 退回 needs_revision；`published` → 下架到 reviewed  
**后端**：`/api/admin/songs/[id]/status` 已支持 action，不需改  
**工时**：1 小时

## P3-3 评审列表时间格式化
**改动**：`review/queue/page.tsx` 第 83 行 `{v as string}` 改 `new Date(v as string).toLocaleString('zh-CN')`  
**工时**：10 分钟

## P3-4 登录速率限制
**改动**：**新建** `src/lib/rate-limit.ts`（内存滑窗或 redis）+ `/api/auth/login` 接入：同 IP 1 分钟 5 次失败锁 10 分钟  
**工时**：1.5 小时

## P3-5 ENCRYPTION_KEY 写入 .env.example + docker-compose.yml
**改动**：两份文件都加 `ENCRYPTION_KEY=`（注释说明 `openssl rand -hex 32`），README 部署章节加一句提示  
**工时**：15 分钟

## P3-6 字段为空提示文案统一
**改动**：三端搜 `'-'` 和"未填写"占位符，统一改为具体提示（如"创作者未填写"）；P1-1 已覆盖部分  
**工时**：30 分钟

---

**P2 工时合计**：≈ 24.5 小时（P2-10 依赖外部文档可推后）  
**P3 工时合计**：≈ 4 小时

**推荐一次会话做完的组合**：
- 会话 D（~8h）：P2-1 + P2-2 + P2-3 — 学习表 + 日志覆盖 + 下载报告，完成率到 95%+
- 会话 E（~6h）：P2-4 + P2-5 + P2-8 + P2-9 — 手机号 + CSV 健壮性 + 小项
- 会话 F（~4h）：P2-6 + P2-7 + P3 全部 — CMS 扩展 + OSS 接通 + 体验精修
- 会话 G：P2-10 — 待汽水文档

---

# 依赖与执行顺序建议

```
P0-2 (实名入口) ─────┐
                     ├─> 能完整测试 ─┐
P0-1 (音频播放)      │              │
                     ▼              │
P0-3 (分成三档) ─> P0-4 (回溯生成) ─┼─> P0-5 (打款阻断)
                                    │        │
P1-4 (period 原始)───────────┐     │        │
                              ▼     │        │
P1-3 (名称匹配) ─> 完整收益流 ─────┘        │
                                             ▼
                              (管理端整体联调收敛到 95%+)
```

**已执行会话回顾**：
- 会话 A（~4h）：P0-1 + P0-2 ✅
- 会话 B（~5h）：P0-3 + P0-4 + P0-5 ✅
- 会话 C（~4h）：P1-1 到 P1-7 ✅

**待执行会话**：P2/P3 组合见上文"P2 任务"章节末尾。

---

# 执行规范

1. **每张卡单独 commit**：commit message 格式 `fix(P0-<n>): <目标简述>`
2. **commit 后不 push**（除非用户显式要求）
3. **每张卡做完后同步更新追踪矩阵**（`docs/traceability-matrix.md` 对应行状态）
4. **需要用户确认的决策点必须停下**，不自行选择
5. **对验收标准勾选**，不要声称完成但实际未验证

---

# 已完成记录

（执行过程中追加）

- [x] P0-1 评审端音频播放 — commit `039272b`（2026-04-17）
- [x] P0-2 创作者实名认证入口 — commit `f22170b`（2026-04-17）
- [x] P0-3 分成规则三档自动评估 — commit `65adc2d`（2026-04-17）
- [x] P0-4 映射确认回溯生成结算 — commit `a84f376`（2026-04-17）
- [x] P0-5 打款前实名校验 — commit `00637df`（2026-04-17）
- [x] P1-4 CSV period 原始字符串 — commit `5d5bfdb`（2026-04-17，配套 `scripts/clear-revenue.ts` 待部署执行）
- [x] P1-3 CSV 按歌名匹配 — commit `ead3b5d`（2026-04-17）
- [x] P1-1 评审页读真实 lyrics/Prompt/creationDesc — commit `aa18604`（2026-04-17）
- [x] P1-2 评审耗时 durationSeconds — commit `ef59abf`（2026-04-17）
- [x] P1-5 创作者重新提交预填（update-in-place + version++） — commit `d61bf4d`（2026-04-17）
- [x] P1-6 queue 字段名 studentName 对齐 — commit `2959bfe`（2026-04-17）
- [x] P1-7 创作者头像上传 — commit `8bc37e6`（2026-04-17）
- [x] P2-1 学习进度表 LearningRecord — commit `91c3c58`（2026-04-17）
- [x] P2-2 operation_logs 写操作全覆盖 — commit pending（2026-04-17）

---

*本计划会随执行进度更新。如果发现新的 P0/P1 漏项，直接追加任务卡。*
