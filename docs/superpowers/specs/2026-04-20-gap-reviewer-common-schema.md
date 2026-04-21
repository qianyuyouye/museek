# 评审端 + 公共模块 + Schema 缺口清单（74 项）

> 这是主清单 `2026-04-20-platform-alignment-gap-list.md` 的子文档。
> 上下文、优先级定义、跨端重复映射表见主清单。

## ID 前缀约定

- `GAP-LOOP-*`: 跨端闭环链路（AI / 上传 / 通知 / 短信 / 操作日志）
- `GAP-RVW-*`: 评审端专属
- `GAP-COMM-*`: 公共 lib / middleware / 中间件
- `GAP-SCHM-*`: Prisma schema / Prisma 相关

## 主索引表

| ID | 模块 | 缺口标题 | 类型 | 优先级 | 页面/API/Schema |
|----|----|---------|------|-------|-----------------|
| GAP-LOOP-001 | AI 分析链路 | LLM Key / Base URL / Model 三项无管理端配置入口 | 配置缺失 | P0 | src/lib/ai-analysis.ts:51-53 + src/app/api/admin/settings/route.ts:8-16 |
| GAP-LOOP-002 | OSS 生产上传链路 | OSS 生产分支拼 URL 不签名，未接入 ali-oss SDK | 断链+安全 | P0 | src/lib/upload.ts:51-65 |
| GAP-LOOP-003 | OSS 生产配置 | OSS Bucket / Region / Domain / AccessKey 无管理端 UI 入口 | 配置缺失 | P0 | src/lib/upload.ts + admin/settings |
| GAP-LOOP-004 | 阿里云 SMS 配置 | AccessKey / 签名 / 模板四项无管理端 UI 入口 | 配置缺失 | P0 | src/lib/sms.ts:6-13 + admin/settings |
| GAP-LOOP-005 | 通知触发链路 | 评审通过/发行/结算/实名审核全部不写 notifications | 断链 | P0 | src/app/api/review/submit + songs/status + revenue/settlements + students/verify |
| GAP-LOOP-006 | 音频签名 URL | audioUrl 返回裸 URL，无签名/过期/用户绑定 | 断链+安全 | P0 | src/app/api/review/queue/route.ts:43 + songs/[id] |
| GAP-LOOP-007 | 文件上传 MIME 校验 | 只校验扩展名，不校验 magic bytes | 残缺+安全 | P1 | src/lib/upload.ts:28-39 |
| GAP-LOOP-008 | SMS 全局限流 | /api/auth/sms/send 无 IP 限流，只有 60s/号 | 残缺 | P1 | src/app/api/auth/sms/send/route.ts |
| GAP-LOOP-009 | 全局 API 限流 | PRD §10.6 要求 60 次/min/IP，只有登录 10 次/min | 残缺 | P1 | src/middleware.ts + src/lib/rate-limit.ts |
| GAP-LOOP-010 | refresh token 吊销 | logout 不加黑名单，被窃取后仍可续签 | 安全 | P1 | src/app/api/auth/logout/route.ts |
| GAP-LOOP-011 | CSV 编码检测 | parseCSV 假设 UTF-8，GBK/UTF-16 乱码 | 残缺 | P1 | src/lib/csv.ts + src/app/api/admin/revenue/imports/route.ts |
| GAP-LOOP-012 | CSV 总收入列校验 | PRD §5.2 要求 total=douyin+qishui，代码 fallback 即填 | 残缺 | P2 | src/app/api/admin/revenue/imports/route.ts:95 |
| GAP-LOOP-013 | 前端 CSV 注入 | downloadCSV 不转义 `=/+/-/@` 单元格 | 安全 | P2 | src/lib/export.ts:7-10 |
| GAP-LOOP-014 | 注册欢迎通知 | sms/verify 新建用户不写站内欢迎消息 | 残缺 | P2 | src/app/api/auth/sms/verify/route.ts |
| GAP-LOOP-015 | 作业提交通知 | 提交成功/需修改后不通知创作者 | 残缺 | P2 | src/app/api/creator/assignments/[id]/submit |
| GAP-RVW-001 | 评审/assess | 未读取也不展示 performer / lyricist / composer / albumName | 字段未消费 | P1 | src/app/(reviewer)/review/assess/page.tsx + src/app/api/review/songs/[id]/route.ts |
| GAP-RVW-002 | 评审/assess | AI 分析面板不传 audioFeatures，自身 API 内部读 | 残缺 | P2 | src/app/(reviewer)/review/assess/page.tsx:28-60 |
| GAP-RVW-003 | 评审/assess | 评审中途退出/刷新，评分/评语/marks 丢失（无草稿） | 残缺 | P1 | src/app/(reviewer)/review/assess/page.tsx |
| GAP-RVW-004 | 评审/assess | 评审上下文用 localStorage，跨标签页/隐私窗口/清缓存丢失 | 残缺 | P2 | queue/page.tsx:51 + assess/page.tsx:119 |
| GAP-RVW-005 | 评审时间轴标记 | marks 写入 reviews.tags 后，创作者端无处消费 | 断链 | P1 | AudioPlayer + creator/songs/page.tsx |
| GAP-RVW-006 | 评审/assess AudioPlayer | bars 是 Math.random 装饰，非真实波形下采样 | 残缺 | P2 | src/components/review/AudioPlayer.tsx:46-49 |
| GAP-RVW-007 | 评审/stats | history.duration 固定显示 "-"，未用 durationSeconds | 字段未消费 | P2 | src/app/(reviewer)/review/stats/page.tsx:222 |
| GAP-RVW-008 | 评审/stats | 标题"2026年3月"硬编码 | 残缺 | P2 | src/app/(reviewer)/review/stats/page.tsx:233 |
| GAP-RVW-009 | 评审/stats | 历史记录无分页，全量返回至前端 | 残缺 | P1 | src/app/api/review/stats/route.ts:18 |
| GAP-RVW-010 | 评审/queue | 无分页控件（API 支持，UI 不展示） | 残缺 | P2 | src/app/(reviewer)/review/queue/page.tsx |
| GAP-RVW-011 | 评审/queue | 流派筛选在 API 做精确匹配，与创作者自由填写的不一致 | 残缺 | P2 | src/app/api/review/queue/route.ts:16-18 |
| GAP-RVW-012 | 评审/queue | 不展示来源标签（作业/自由上传），PRD §7.2.2 要求 | 残缺 | P2 | queue/page.tsx 列定义 |
| GAP-RVW-013 | 评审/submit | 提交无撤销接口；PRD 未要求但也未禁止 | 无头入口 | 建议砍 | src/app/api/review/submit/route.ts |
| GAP-RVW-014 | 评审/submit | ratings 为 0-100 合法，但界面滑块默认值 75/80/70 非居中，可能引导 | 体验 | 建议砍 | assess/page.tsx:136 |
| GAP-RVW-015 | 评审/submit | tags 字段存 `{quick, marks}` 对象，type schema 只写 `string[]` | 类型不一致 | P2 | src/types/api.ts:37 + submit/route.ts:84 |
| GAP-RVW-016 | 评审/workbench | 快捷入口"进入评审列表"文案 vs 按钮"开始评审"不一致 | 体验 | 建议砍 | workbench/page.tsx:291 |
| GAP-RVW-017 | 评审/workbench | avgDuration 从秒直除 60 取整，无个人对比维度 | 残缺 | 建议砍 | workbench/page.tsx:178 |
| GAP-RVW-018 | 评审/profile | 手机号修改按钮存在但无验证码流程 | 无头入口 | P1 | review/profile/page.tsx:141-143 |
| GAP-RVW-019 | 评审端路由 | ReviewerSidebar onLogout 空函数，点击无事 | 断链 | P1 | src/components/layout/reviewer-sidebar.tsx:17 |
| GAP-RVW-020 | 评审端 layout | layout.tsx 无 route guard，无角色权限过滤 | 残缺 | 建议砍 | src/app/(reviewer)/layout.tsx |
| GAP-COMM-001 | api-utils / requirePermission | `isBuiltin=true` 自动全通，seed 只建一个超管，非内置角色未测试实际粒度 | 残缺 | P1 | src/lib/api-utils.ts:56 |
| GAP-COMM-002 | middleware CSRF | 缺 origin 且缺 referer 时直接放行 | 残缺 | P1 | src/middleware.ts:54-58 |
| GAP-COMM-003 | middleware portal 映射 | group_admin / system_admin 未与 portal 挂钩，adminLevel 只是装饰 | 残缺 | P1 | src/middleware.ts + src/types/auth.ts:7 |
| GAP-COMM-004 | middleware matcher | matcher 覆盖所有非 `_next/static` 路径，限流未覆盖 | 残缺 | P2 | src/middleware.ts:111 |
| GAP-COMM-005 | rate-limit | 内存实现，Next standalone 多进程/多实例失效 | 残缺 | P1 | src/lib/rate-limit.ts |
| GAP-COMM-006 | cache | 内存 TTL 缓存，多实例失效；PRD §10.2 按 key 设计的 6 类缓存都未落地 | 残缺 | P1 | src/lib/cache.ts + PRD §10.2 |
| GAP-COMM-007 | cache 失效触发 | dashboard 以外所有缓存 key 从未 set/invalidate | 残缺 | P1 | src/lib/cache.ts 调用方 |
| GAP-COMM-008 | log-action | `logAdminAction` 的 operatorId 直接从 header `x-user-id` 取，评审/创作者写操作不会走这里 | 残缺 | P2 | src/lib/log-action.ts:36-39 |
| GAP-COMM-009 | log-action | 日志失败仅 console，不入独立重试队列（PRD §10.4） | 残缺 | P2 | src/lib/log-action.ts:61-64 |
| GAP-COMM-010 | ai-analysis | 无超时 AbortController；OpenAI 卡死会阻塞整条评审页 | 残缺 | P1 | src/lib/ai-analysis.ts:96-108 |
| GAP-COMM-011 | ai-analysis | 响应未缓存，同一 songId 每次访问重算 Token | 残缺 | P2 | src/app/api/review/songs/[id]/analysis |
| GAP-COMM-012 | ai-analysis 降级 | 生产环境 AI_API_KEY 缺失时仍返回 mock "-"，未给管理员告警 | 残缺 | P1 | src/lib/ai-analysis.ts:55-58 |
| GAP-COMM-013 | sanitize | 基于正则，不覆盖 SVG data URI / CSS expression / mutation XSS，CMS 富文本风险 | 安全 | P2 | src/lib/sanitize.ts:7-14 |
| GAP-COMM-014 | encrypt | ENCRYPTION_KEY 无管理端 UI，生产仅环境变量；密钥轮换无流程 | 配置缺失 | P1 | src/lib/encrypt.ts:11-19 |
| GAP-COMM-015 | auth fallback secret | JWT_SECRET 缺失且 NEXT_PHASE=phase-production-build 时用 `fallback-dev-secret`，build 产物一旦错误使用将爆 | 安全 | P1 | src/lib/auth.ts:11-14 + middleware.ts:9-12 |
| GAP-COMM-016 | 评审 portal 无注册入口 | accounts API 需核验 create-reviewer 强制 type=reviewer | 残缺 | P2 | src/app/api/admin/accounts/create-reviewer/route.ts |
| GAP-COMM-017 | login-logs portal 字段 | LoginLog.userId 无外键，admin/user 同表 id 混淆 | schema 残缺 | P2 | prisma/schema.prisma LoginLog |
| GAP-COMM-018 | upload token 鉴权 | token 仅 `getCurrentUser` 检查，未限制文件用途或绑定 songId | 安全 | P2 | src/app/api/upload/token/route.ts |
| GAP-COMM-019 | upload/local 生产禁用 | 正确返回 404，但未清理 uploads 旧文件（无 GC） | 残缺 | P2 | src/app/api/upload/local/[...path]/route.ts |
| GAP-COMM-020 | audio-extract | 前端 DFT 简化实现 2048 点单段采样，长音频特征偏差大 | 残缺 | P2 | src/lib/audio-extract.ts:96-112 |
| GAP-COMM-021 | format 时区 | formatDateTime 用本地 `getFullYear` 等，服务端/客户端渲染时区漂移 | 残缺 | P2 | src/lib/format.ts:6-12 |
| GAP-COMM-022 | use-api silent 标记 | 默认 loading 首帧短暂闪烁 | 体验 | P2 | src/lib/use-api.ts:30 |
| GAP-COMM-023 | agency-pdf | 未检查；管理端 PDF 生成是否真实 | 需要核实 | P2 | src/lib/agency-pdf.ts |
| GAP-COMM-024 | commission.ts fallback | 所有规则都不匹配时只 console.warn + 用 70/30 兜底，无报警 | 残缺 | P2 | src/lib/commission.ts:170-175 |
| GAP-COMM-025 | revenue-backfill 并发 | createMany 用 skipDuplicates，同 revenue_row 若被两次并发回溯将静默跳过 | 残缺 | P2 | src/lib/revenue-backfill.ts:89-95 |
| GAP-SCHM-001 | operation_logs.id | 已 BigInt，但 detail Json 可能超 MySQL JSON 限制，无字段长度 guard | 残缺 | P2 | prisma/schema.prisma:474 + log-action.ts |
| GAP-SCHM-002 | settlements.totalRevenue | `Decimal @default(0)` 但代码写入时若 row.totalRevenue 异常会留 0，PRD 要求计算值 | 残缺 | P1 | schema.prisma:386 + revenue-backfill.ts:77 |
| GAP-SCHM-003 | settlements.creatorAmount | 同上 | 残缺 | P1 | schema.prisma:390 |
| GAP-SCHM-004 | users.status vs admin_users.status | 一个 Enum 一个 Boolean，代码多处需双轨判断 | 类型不一致 | P2 | schema.prisma:50 vs 436 |
| GAP-SCHM-005 | platform_songs 默认实名/同标题字段 | 五字段无 DB 默认值，应用层也未填充 | 残缺 | P1 | schema.prisma:111-118 + submit routes |
| GAP-SCHM-006 | notifications 表结构 | 缺 `target_id`、`content`、`link_url` 字段，PRD §7.1.1 要求消息跳转 | schema 残缺 | P1 | schema.prisma:551-561 |
| GAP-SCHM-007 | notifications.type | VARCHAR(30) 无枚举约束 | 残缺 | P2 | schema.prisma:554 |
| GAP-SCHM-008 | cms_contents.ContentStatus | 枚举已有 `archived`，但 unpublish API 写的是 `draft` | 语义不对齐 | P1 | schema.prisma:535-539 + content/[id]/publish/route.ts:27 |
| GAP-SCHM-009 | cms_contents 字段 | 缺 sections / duration / tags / author，PRD §7.1.6 课程详情要求 | 残缺 | P2 | schema.prisma:490-509 |
| GAP-SCHM-010 | audio_features JSON | 评审端 analysis 读取，但写入路径只在 creator/upload 一处；assignment 提交不走 | 断链 | P2 | schema.prisma:123 + assignments submit |
| GAP-SCHM-011 | distributions.platform | VarChar(50) 自由字符串，未与系统设置平台清单联动 | 残缺 | P2 | schema.prisma:452 |
| GAP-SCHM-012 | sms_codes.purpose 缺失 | 无 purpose 字段，register/reset_password 共享同一条码 | schema 残缺 | P2 | schema.prisma:564-574 |
| GAP-SCHM-013 | seed.ts vs seed.js 分叉 | npm run seed 执行 seed.ts 不含 revenue_rules 初始化，docker init 用 seed.js 含 | 配置不一致 | P1 | prisma/seed.ts vs seed.js |
| GAP-SCHM-014 | sessions / token_blacklist 表缺失 | logout 不 revoke，refresh 被盗无法吊销 | schema 残缺 | P1 | 无对应 model |
| GAP-SCHM-015 | LoginLog 外键缺失 | userId 无 FK，实际跨 users/admin_users 两表 id 空间 | schema 残缺 | P2 | schema.prisma:577-587 |
| GAP-SCHM-016 | ReviewMark 表缺失 | reviews.tags 存 JSON 内 marks 数组，非关系化，无法跨评审聚合/对比 | 残缺 | P2 | schema.prisma:228-229 |
| GAP-SCHM-017 | LearningRecord.progress | SmallInt 默认 0 但无上限约束（0-100 需应用层保证） | 残缺 | P2 | schema.prisma:516 |
| GAP-SCHM-018 | AssignmentSubmission.submittedAt | Nullable，PRD §4.6 推算应非空 | 残缺 | P2 | schema.prisma:201 |
| GAP-SCHM-019 | LikeRecord 无 PRD 对照 | 代码实现点赞，PRD §4 未定义，likeCount 存歌曲表同时 likeRecord 唯一索引冗余 | 残缺 | P2 | schema.prisma:131 + 590-598 |
| GAP-SCHM-020 | platform_songs.score TinyInt | 允许 -128~127，但业务分数 0-100，无 CHECK 约束 | 残缺 | P2 | schema.prisma:128 |
| GAP-SCHM-021 | operation_logs 分区 | PRD §10.1 建议 operator_id/created_at 分区，schema 只普通索引 | 性能 | P2 | schema.prisma:484-486 |
| GAP-SCHM-022 | assignments.submissionCount 无触发器 | 无自动同步（仅应用层） | 残缺 | P2 | schema.prisma:176 |
| GAP-SCHM-023 | Assignment.deadline 过期无拒收 | 与 PRD §4.5 一致，但无应用层校验 | 残缺 | P2 | schema.prisma:173 |
| GAP-SCHM-024 | FormFieldConfig.displayOrder TinyInt | 字段数>127 溢出（用户组字段数理论上限） | 残缺 | 建议砍 | schema.prisma:259 |
| GAP-SCHM-025 | SongMapping 软删除缺失 | PRD §8 "映射解除→软删除→exception" 要求，schema 无 `deleted_at` | 残缺 | P1 | schema.prisma:274-294 |

## 详细条目（按优先级分组）

### P0 级（6 项）

#### GAP-LOOP-001: LLM Key / Base URL / Model 三项无管理端配置入口
- **类型**: 配置缺失
- **所在**: `src/lib/ai-analysis.ts:51-53`（env 硬读）；`src/app/api/admin/settings/route.ts:8-16`（PRESET_KEYS 无 AI 配置）；`src/app/(admin)/admin/settings/page.tsx`（无 AI tab）
- **PRD 对应**: §7.2.3 评审 AI 预分析 + §7.3.17 系统设置 5 子模块
- **当前状态**: `AI_API_BASE_URL / AI_API_KEY / AI_MODEL` 仅 `process.env.*` 读取，未配置时返回 `DEFAULT_RESULT = { summary: '暂无分析数据' }`。整个管理端系统设置页没有 AI tab
- **证据**: `src/lib/ai-analysis.ts:51-58`；`src/app/api/admin/settings/route.ts:8-16` 的 PRESET_KEYS 白名单不含 AI
- **补齐动作**: PRESET_KEYS 新增 `ai_config = { baseUrl, apiKey, model, enabled }`（apiKey 加密）；settings 页加 AI tab；`analyzeSong` 优先读 DB 再读 env；mock fallback 只在 dev 生效

#### GAP-LOOP-002: OSS 生产分支拼 URL 不签名，未接入 ali-oss SDK
- **类型**: 断链 + 安全
- **所在**: `src/lib/upload.ts:51-65`
- **PRD 对应**: §10.5 文件存储规范
- **当前状态**: `getOSSToken` 直接返回 `${domain}/${key}` 作为 uploadUrl，注释 `// TODO: 用阿里云 OSS SDK 生成预签名 PUT URL`。生产若设 `OSS_BUCKET` 走这条分支必须 bucket 开公共写权限，或直接 403 失败。`package.json` 未依赖 `ali-oss`
- **补齐动作**: 加依赖 `ali-oss`，实现 `signatureUrl(key, { method: 'PUT', expires: 300 })`；读取 OSS 配置来源于 system_settings；加 `getSignedAudioUrl(key, userId)` 辅助函数

#### GAP-LOOP-003: OSS Bucket / Region / Domain / AccessKey 无管理端 UI 入口
- **类型**: 配置缺失
- **所在**: `src/lib/upload.ts:55-57`；`admin/settings/page.tsx`
- **补齐动作**: 与 GAP-LOOP-001 同策略，加入 `storage_config` 系统设置，包含 `accessKeyId / accessKeySecret / bucket / region / domain`（secret 加密）

#### GAP-LOOP-004: 阿里云 SMS AccessKey / 签名 / 模板四项无管理端 UI 入口
- **类型**: 配置缺失
- **所在**: `src/lib/sms.ts:6-13, 47-48`
- **当前状态**: 四字段全 env 读；生产未配置导致 `sendSmsCode` catch 入走 `return { success: false, message: '短信服务异常' }`；dev 模式才返回固定码 `123456`
- **补齐动作**: settings 加"短信服务"tab；`createClient` 优先读 DB；未配置时返回 `{ success: false, message: '短信服务未配置，请联系管理员' }`

#### GAP-LOOP-005: 评审通过 / 发行 / 结算 / 实名审核全部不写 notifications
- **类型**: 断链
- **所在**: `src/app/api/review/submit/route.ts` / `src/app/api/admin/songs/[id]/status/route.ts` / `src/app/api/admin/revenue/settlements/route.ts` / `src/app/api/admin/students/[id]/verify/route.ts`
- **PRD 对应**: §7.1.1 最新动态 / §7.1.6 消息中心 / §7.3.4 实名审核"推送消息"
- **当前状态**: `prisma.notification.create` 全仓库只在 1 处出现（管理员主动通知），核心业务流程全部静默
- **补齐动作**: 封装 `notify(userId, type, title, targetId?, content?)` 工具；在各业务动作事务内写入通知

#### GAP-LOOP-006: 音频 URL 裸返回，无签名/过期/绑定用户
- **类型**: 断链 + 安全
- **所在**: `src/app/api/review/queue/route.ts:43`；`src/app/api/review/songs/[id]/route.ts:28`；`src/app/api/admin/songs/route.ts`
- **PRD 对应**: §10.5 "音频文件访问需鉴权（签名URL，有效期1小时），防止盗链"
- **当前状态**: API 直接返回 `audioUrl` 字符串，开发环境是 `/public` 静态路径（未登录也能访问），生产若 OSS 公共读则任何人都可爬取
- **补齐动作**: GET 音频的 API 返回前用 `ali-oss signatureUrl(key, { expires: 3600 })` 签名；本地开发加 `/api/audio/[...key]` 中间层校验登录 + portal

### P1 级（29 项）

#### GAP-LOOP-007: 文件上传只校验扩展名，不校验 magic bytes
- **补齐动作**: local PUT 端点加 magic bytes 检查（MP3 `FF FB`/`ID3`、WAV `RIFF`、PNG `89 50 4E 47`、JPG `FF D8 FF`）；OSS 模式加回调验签

#### GAP-LOOP-008: SMS 发送无 IP 限流
- **补齐动作**: sms/send 调用 `ipRateLimit(ip, 'sms_send', 5, 60 * 1000)`

#### GAP-LOOP-009: 全局 API 限流未实施
- **补齐动作**: middleware 对所有 `/api/*` 加 `ipRateLimit(ip, 'api', 60, 60000)`；敏感接口单独更严

#### GAP-LOOP-010: logout 不吊销 refresh token
- **补齐动作**: 新增 `TokenRevocation` 表（jti + userId + revokedAt）或基于 Redis 黑名单；logout 写入；middleware 验证 JWT 时检查

#### GAP-LOOP-011: CSV 编码检测缺失（GBK 乱码）
- **补齐动作**: 加 `chardet` 检测 + `iconv-lite` 转码

#### GAP-RVW-001: 评审端不展示 performer / lyricist / composer / albumName
- **类型**: 字段未消费
- **所在**: `src/app/(reviewer)/review/assess/page.tsx`；`src/app/api/review/songs/[id]/route.ts:23-43`
- **补齐动作**: API 补 `albumName / albumArtist`；assess 页面元数据区块展示词作/曲作/演唱者

#### GAP-RVW-003: 评审中途退出无草稿，表单丢失
- **补齐动作**: 给 scores/comment/marks 加 useEffect 持久化到 `localStorage` key `review_draft_{songId}`；submit 成功后清除；页面挂载时 restore

#### GAP-RVW-005: 评审时间轴标记写入后创作者无处消费
- **所在**: `src/app/api/review/submit/route.ts:84`（写入 reviews.tags）；`src/app/(creator)/creator/songs/page.tsx:38-39`（只读 comment）
- **补齐动作**: creator/songs 详情区块解析 `review.tags.marks`，在 Waveform 上叠加竖线

#### GAP-RVW-009: 评审 /stats history 无分页全量返回
- **补齐动作**: 分两接口：统计聚合（aggregate）和历史列表（分页）

#### GAP-RVW-018: 评审个人中心手机号修改按钮无实际流程
- **补齐动作**: 同创作者端，接 `/api/auth/sms/send?purpose=change_phone` + `/api/profile/phone` PUT

#### GAP-RVW-019: ReviewerSidebar onLogout 空函数
- **补齐动作**: 调用 `/api/auth/logout` + router.push('/review/login')（参考 admin/creator sidebar）

#### GAP-COMM-001: isBuiltin 超管自动全通，非内置角色粒度无覆盖测试
- **补齐动作**: inferPermissionKey 补全 `edit/export/settle`；seed 创建一个测试的 "运营角色" 含部分权限以验证；补 e2e 用例

#### GAP-COMM-002: CSRF 中间件缺 origin 且缺 referer 时放行
- **当前状态**: 条件 `if ((origin && !originOk) || (!origin && referer && !refererOk))`，即"origin 不存在且 referer 也不存在"放行。curl 默认可绕过
- **补齐动作**: 改为 "origin 或 referer 必须至少有一个且合法"；同时豁免 GET/HEAD/OPTIONS

#### GAP-COMM-003: adminLevel（group_admin/system_admin）未生效
- **所在**: `src/types/auth.ts:7`；全部 API
- **补齐动作**: group_admin 访问 /admin/* 接口时校验 user.userGroups ∩ target.groups 非空；或从路径解析 groupId 做过滤

#### GAP-COMM-005: 限流内存实现多实例失效
- **补齐动作**: 接 Redis；或至少在登录/SMS 场景用 DB + UNIQUE 窗口锁

#### GAP-COMM-006/007: PRD §10.2 六类缓存全部未实现，失效触发无覆盖
- **补齐动作**: commission rules 加缓存 + 修改系统设置时 invalidate；role.permissions 改动时 invalidate `role:permissions:{id}`

#### GAP-COMM-010: AI 分析无超时控制
- **补齐动作**: 加 `AbortSignal.timeout(10000)`；失败降级 DEFAULT_RESULT

#### GAP-COMM-012: 生产环境 AI Key 缺失时静默降级
- **补齐动作**: `NODE_ENV=production && !apiKey` 时写 operation_logs 或 system_alert；前端展示"AI 分析未配置"明确提示

#### GAP-COMM-014: ENCRYPTION_KEY 无管理端 UI，密钥轮换无流程
- **补齐动作**: settings 不展示密钥但展示"密钥已配置"指示；提供 `--old-key --new-key` 双密钥重加密脚本

#### GAP-COMM-015: JWT_SECRET 构建阶段 fallback
- **补齐动作**: 把 env 读取从 build-time 剥离到 runtime SECRET() 每次校验；缓存前先检查 env 真实非空

#### GAP-SCHM-002/003: settlements.totalRevenue / creatorAmount 语义应非空
- **补齐动作**: 应用层写入 creatorAmount 前断言 > 0 或 rows count 计算逻辑正确；加 SQL CHECK

#### GAP-SCHM-005: performer/lyricist/composer/albumName/albumArtist 默认值未填充
- **补齐动作**: submit 里 `performer ?? user.realName`，`albumName ?? title` 等

#### GAP-SCHM-006: notifications 缺 target_id / content / link_url
- **补齐动作**: 加 `content String? @db.Text`、`targetType String?`、`targetId String?`、`linkUrl String? @db.VarChar(500)`

#### GAP-SCHM-008: CMS 下架写 draft 而不是 archived
- **补齐动作**: unpublish → archived；UI 状态列区分"草稿/已发布/已下架"

#### GAP-SCHM-013: seed.ts vs seed.js 分叉
- **补齐动作**: 删除 seed.js 或让 seed.ts 复用同逻辑（import commission.DEFAULT_REVENUE_RULES + upsert）

#### GAP-SCHM-014: sessions / token_blacklist 表缺失
- **补齐动作**: 加 `TokenRevocation { jti, userId, portal, revokedAt, expiresAt }`

#### GAP-SCHM-025: SongMapping 软删除字段缺失
- **补齐动作**: 加 `deletedAt DateTime?` + `replacedById Int?`；映射 unbind 走软删流程

### P2 级（33 项）

GAP-LOOP-012/013/014/015；GAP-RVW-002/004/006/007/008/010/011/012/015；GAP-COMM-004/008/009/011/013/016/017/018/019/020/021/022/023/024/025；GAP-SCHM-001/004/007/009/010/011/012/015/016/017/018/019/020/021/022/023。

关键主题聚合：
- **CSV 边界**：总收入校验、CSV 注入转义
- **注册/作业通知**：欢迎消息、作业提交/需修改
- **评审体验**：AI 分析缓存/重算、真实波形绘制、stats 列 duration、queue 分页/源标签/流派 mapping
- **日志完善**：评审端写操作日志、日志失败重试
- **schema 细节**：sms_codes.purpose、LoginLog 外键、LikeRecord 冗余、cms_contents 扩字段、audio_features 写入覆盖面

### 建议砍（6 项）

#### GAP-RVW-013: 评审提交撤销接口
- PRD 未要求；建议在 PRD 明确"不允许撤销"，测试用例移除

#### GAP-RVW-014: 评审滑块默认值 75/80/70
- 产品决策，不值得 P 级

#### GAP-RVW-016: 快捷入口文案不一致
- workbench "开始评审" vs PRD "进入评审列表"——微调

#### GAP-RVW-017: avgDuration 维度单一
- 现有统计足够

#### GAP-RVW-020: reviewer layout 无 route guard
- middleware 已拦 portal≠reviewer

#### GAP-SCHM-024: FormFieldConfig.displayOrder TinyInt
- 单组字段 >127 概率极低
