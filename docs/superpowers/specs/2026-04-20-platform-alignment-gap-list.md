# Museek 平台闭环可用性缺口清单（aligned PRD Phase 1 输入）

## 元信息

| 项 | 值 |
|---|---|
| 审计日期 | 2026-04-20 |
| PRD 基准 | v5.2 原型对齐版（`docs/prd_text.txt`，1350 行） |
| 代码基准 HEAD | `308160a`（P2-1 学习进度 + P2-2 操作日志全覆盖 + P2-3 批量下载校验 + 邀请码重生 Dialog 已合并） |
| 审计方法 | 3 个并行 subagent（管理端 / 创作者端+认证+上传 / 评审端+公共+schema）逐文件 Read/Grep，交叉比对 PRD、原型、`traceability-matrix.md`（2026-04-17）、`SCHEMA-DIFF.md`、`FINAL-REPORT.md` |
| 输入参考 | `docs/prd_text.txt` · `docs/AI音乐平台/*.html`（三端原型） · `docs/traceability-matrix.md` · `docs/test-cases/GAPS.md` · `docs/test-cases/SCHEMA-DIFF.md` · `docs/test-cases/runs/2026-04-18/FINAL-REPORT.md` · `docs/fix-plan.md` |
| 产出目标 | 供"能用为第一要求"的对齐 PRD v6.0 输入使用。**本文档不是实施计划，是决策输入** |

## 优先级定义

- **P0**：核心主流程任何断链（上传 → 评审 → 发行 → 结算）+ 全局性启用缺失（如 LLM Key 无配置入口导致 AI 评审整条线不可用）+ 严重安全缺陷
- **P1**：运营功能残缺 + 关键配置缺失 + schema 高风险项
- **P2**：辅助功能残缺 + 体验性问题 + 字段未消费
- **建议砍**：实现/PRD 已描述但业务价值低，建议从 aligned PRD 删除

## 缺口类型

| 类型 | 含义 |
|---|---|
| 断链 | 用户操作后数据流中断 / 下游消费不存在（按钮点了无 API、API 返回后 UI 不更新、状态不流转） |
| 残缺 | 功能能跑但能力不完整（课程无视频、CSV 不检测编码、CMS 缺字段） |
| 配置缺失 | 硬编码/环境变量，管理员无 UI 可配（LLM Key、OSS、SMS、通知模板、发行平台等） |
| 无头入口 | UI 有入口按钮但背后功能未实现、跳 404、或 onClick 为空 |
| PRD 未实现 | PRD 明确要求但代码完全无对应 |
| 代码超前于 PRD | 代码实现了但 PRD 未描述（如 LearningRecord、login_logs、sms_codes、notifications 表） |
| 建议砍 | 代码/PRD 已存在但评估业务价值低 |

---

## Executive Summary

### 总规模（252 项，去重后 ~237 项）

| 端 | 总数 | P0 | P1 | P2 | 建议砍 |
|---|---|---|---|---|---|
| 管理端 | 100 | 12 | 45 | 40 | 3 |
| 创作者端 + 认证 + 上传 | 78 | 12 | 15 | 48 | 3 |
| 评审端 + 公共模块 + schema | 74 | 6 | 29 | 33 | 6 |
| **合计** | **252** | **30** | **89** | **121** | **12** |

详细条目分置于：
- `docs/superpowers/specs/2026-04-20-gap-admin.md`（管理端 100 项）
- `docs/superpowers/specs/2026-04-20-gap-creator.md`（创作者端+认证+上传 78 项）
- `docs/superpowers/specs/2026-04-20-gap-reviewer-common-schema.md`（评审端+公共+schema 74 项）

### 七大 P0 主题（决策重点）

用 30 条 P0 逐项讨论效率低。按根因收敛为 **7 个主题**——搞定这 7 件事，P0 消灭 80%+：

#### 1. 系统配置入口全缺（补一个「系统设置」新 tab 可解决 4 条 P0）

- **LLM Key / Base URL / Model**：AI 评审核心能力，当前只能改 env 重启（`GAP-ADMIN-001 / GAP-LOOP-001`）
- **OSS Bucket/Region/Domain/AccessKey**：同上，生产切换 OSS 需改 env；且 `upload.ts:52` TODO 注释明示 OSS 签名 URL 未接入（`GAP-ADMIN-002 / GAP-LOOP-002 / GAP-LOOP-003`）
- **阿里云 SMS AccessKey/签名/模板**：同上，注册短信生产需环境变量（`GAP-ADMIN-003 / GAP-LOOP-004`）
- **通知模板、批量下载 ZIP 保留时长、邀请链接域名、平台对账外部 API 等**：一堆运营参数散落 env 和硬编码

→ **补齐动作**：`SystemSetting` 表新增「AI 配置」「存储配置」「短信配置」「通知模板」四个 key，settings 页加对应 tab；lib 层改为 DB 优先 + env fallback + 密钥加密

#### 2. 全平台通知触发机制几乎不存在（影响多处 P0/P1）

- `grep prisma.notification.create src/` 仅命中 1 处（管理员手动 notify）
- 评审通过、发行完成、结算打款、实名审核、作业需修改、作业截止提醒——**全部不触发通知**
- 创作者的"消息中心"、"最新动态"、"徽标未读数"永远是空（或者仅管理员主动推送）
- 相关缺口：`GAP-CRTR-001 / GAP-LOOP-005 / GAP-ADMIN-050 / GAP-ADMIN-089 / GAP-CRTR-038`
- **schema 级**：`notifications` 表缺 `target_id / content / link_url` 字段，点击跳转无法实现（`GAP-SCHM-006`）

→ **补齐动作**：抽 `lib/notifications.ts` 封装 `notify(userId, type, title, targetId?, content?, linkUrl?)`；在关键业务动作事务内调用；扩 `Notification` schema；通知模板化（见主题 1）

#### 3. 权限系统真实粒度不对齐（多项 P0，影响多人协作上线）

- `inferPermissionKey` 只映射 3 种 action（view/operate/manage），PRD 权限树用 6 种（view/edit/manage/operate/export/settle），配置了 edit/export/settle 永远不触发（`GAP-ADMIN-004 / GAP-ADMIN-062 / GAP-COMM-001`）
- 侧边栏 permKey 与权限树 key 拼法不一致：`admin.content` vs `admin.cms`、`admin.publish-confirm` vs `admin.publish_confirm`、批量下载复用 `admin.songs.view`——非超管的侧边栏菜单会直接丢失（`GAP-ADMIN-005`）
- 账号权限变更 Modal 提交中文 type "创作者/评审/管理员"，后端 Prisma enum 只接 creator/reviewer，运行时 500（`GAP-ADMIN-007 / GAP-ADMIN-099`）
- `group_admin / system_admin` 的 adminLevel 在 JWT 带上了，但所有 API 按 portal 放行，group_admin 可以跨组访问（`GAP-COMM-003`）

→ **补齐动作**：统一 action 词汇表；所有写路由显式 `requirePermission(request, 'admin.xxx.yyy')`，不再依赖 infer；sidebar 和权限树 key 对齐；group_admin 强制基于 group_id 过滤

#### 4. 发行链路自动化断链（Phase 4→5 整条线卡住）

- `song.status = published` 后不自动创建 distributions 记录，"发行状态确认"的"待提交"tab 永远为空，需管理员手动在矩阵逐平台点 pending（`GAP-ADMIN-028 / GAP-ADMIN-092`）
- 发行渠道 `PLATFORMS` 硬编码 5 个平台，与系统设置「平台管理」tab 的 `platform_configs` 不联动；新增平台不出现在矩阵，反之 CSV 导入非白名单平台 400（`GAP-ADMIN-013 / GAP-ADMIN-079`）
- 对账同步 `sync` 路由不调用外部平台 API，只做内部 settlements JOIN（`GAP-ADMIN-012`）

→ **补齐动作**：publish 动作事务内 `createMany` distributions；PLATFORMS 统一从 SystemSetting 读；`sync` 路由引入 platform adapter 框架

#### 5. 上传安全链不闭环（4 条 P0）

- 本地模式 audioUrl 是 `/uploads/...` 静态路径，任意匿名 GET 可拉（`GAP-CRTR-006 / GAP-LOOP-006`）
- OSS 分支 uploadUrl 拼接 `${domain}/${key}` 无签名，生产 403 或要求 bucket 公共写权限（`GAP-CRTR-007 / GAP-LOOP-002`）
- upload token 无过期时间、不绑定 userId/用途，可复用（`GAP-CRTR-008 / GAP-COMM-018`）
- 文件仅按扩展名校验，不检查 magic bytes；伪装 MP3 的 EXE/含脚本的 SVG 可过（`GAP-CRTR-047 / GAP-LOOP-007`）

→ **补齐动作**：引入 `ali-oss` SDK 用 signatureUrl；音频 GET 走签名 URL（有效期 1h，绑 userId）；upload token 加 expires/scope/HMAC；local PUT 端点 + OSS 回调做 magic bytes 验证

#### 6. 字段契约/字段填充错位（~8 条 P0/P1）

**API 返回字段与前端类型不匹配**（后端给 A，前端读 B，UI 永远显示为空或 undefined）：
- `notification.time` vs `createdAt`（消息中心时间栏显示 undefined，`GAP-CRTR-011`）
- `song.cover` vs `coverUrl`（作品广场永远回落到默认渐变，`GAP-CRTR-016`）
- `song.aiTool` vs `aiTools`（AI 工具列永远空，`GAP-CRTR-020`）
- `song.songTitle/songCover` vs `title/coverUrl`（发行状态确认列空，`GAP-ADMIN-010`）
- `admin/accounts creatorTab.songCount` 硬编码 0（`GAP-ADMIN-100`）
- `reset-password res.data.password` vs `masked`（重置密码始终显示"已生成"无法下发，`GAP-ADMIN-008`）

**核心字段默认值未填充**：
- `performer / lyricist / composer / albumName / albumArtist` PRD 要求默认实名/同标题，schema 无 `@default`，应用层 submit 也未填充（`GAP-SCHM-005 / GAP-CRTR-004`）
- 版权编号 `Math.random()` 随机挑号，不保证 000001/000002 全年唯一递增（`GAP-ADMIN-029`）

→ **补齐动作**：`src/types/api.ts` 全量梳理契约一致性；抽 `lib/song-defaults.ts` 统一处理 fallback；加一版权序号表 SELECT ... FOR UPDATE 自增

#### 7. 核心用户流程功能闭环断链（4 条 P0）

- **"已入库" Tab**：创作者作品库 Tab 请求 `status=in_library`，后端枚举校验直接 400（`GAP-CRTR-002`）
- **汽水音乐 Tab 数据**：API 只返回 qishuiRevenue 总金额，不返回 qishuiDetails 列表，UI 表永远空（`GAP-CRTR-003`）
- **拖拽上传**：PRD §7.1.2 明确要求，代码仅 onClick（`GAP-CRTR-005`）
- **评审绩效页**：`/admin/teachers` 数据口径与 accounts API 不一致，用户档案列表副标题"共 N 名"含评审（`GAP-ADMIN-006 / GAP-ADMIN-051`）

→ **补齐动作**：各为单独的 5-20 行修复，但数量不多

### P0 全表（30 项）

| ID | 主题 | 端/模块 | 标题 | 类型 |
|---|---|---|---|---|
| GAP-ADMIN-001 | 主题1 | 管理端/系统设置 | AI LLM Key/Base URL/Model 无管理端配置入口 | 配置缺失 |
| GAP-ADMIN-002 | 主题1 | 管理端/系统设置 | OSS 凭证/域名无管理端配置入口，且 OSS 直传签名 URL 未实现 | 配置缺失 |
| GAP-ADMIN-003 | 主题1 | 管理端/系统设置 | 阿里云短信 AccessKey/签名/模板码无管理端配置入口 | 配置缺失 |
| GAP-LOOP-001 | 主题1 | 跨端/AI链路 | 同 GAP-ADMIN-001（ai-analysis 从 env 读，无 DB 优先） | 配置缺失 |
| GAP-LOOP-002 | 主题1+5 | 跨端/上传链路 | OSS 生产分支拼 URL 不签名，未接入 ali-oss SDK | 断链+安全 |
| GAP-LOOP-003 | 主题1 | 跨端/上传配置 | OSS 配置无 UI（同 GAP-ADMIN-002） | 配置缺失 |
| GAP-LOOP-004 | 主题1 | 跨端/短信配置 | SMS 配置无 UI（同 GAP-ADMIN-003） | 配置缺失 |
| GAP-ADMIN-004 | 主题3 | 管理端/权限 | inferPermissionKey 词汇不对齐，非超管写权限永远 denied | 断链 |
| GAP-ADMIN-005 | 主题3 | 管理端/侧边栏 | 侧边栏 permKey 与权限树 key 拼法不一致，非超管菜单丢失 | 断链 |
| GAP-ADMIN-062 | 主题3 | 管理端/权限 | action 6 种 vs 推断 3 种（同 GAP-ADMIN-004 根因） | 断链 |
| GAP-ADMIN-007 | 主题6 | 管理端/账号 | 变更权限 Modal 传中文 type，后端 enum 报错 | 断链 |
| GAP-ADMIN-008 | 主题6 | 管理端/账号 | 重置密码前端读 password，后端返回 masked，字段不匹配 | 断链 |
| GAP-ADMIN-009 | 安全 | 管理端/账号 | 创建管理员/评审密码无字母+数字强度校验 | 残缺 |
| GAP-ADMIN-010 | 主题6 | 管理端/发行 | 发行状态列表字段名 songTitle/songCover vs title/coverUrl | 断链 |
| GAP-ADMIN-006 | 主题7 | 管理端/评审绩效 | /teachers 统计与 accounts API 口径不一致 | 残缺 |
| GAP-ADMIN-028 | 主题4 | 管理端/歌曲库 | publish 后不自动创建 distributions | 断链 |
| GAP-LOOP-005 | 主题2 | 跨端/通知链路 | 评审/发行/结算/实名审核全部不触发 notifications | 断链 |
| GAP-CRTR-001 | 主题2 | 创作者端/通知 | 同 GAP-LOOP-005（通知体系未建立） | 断链 |
| GAP-CRTR-002 | 主题7 | 创作者端/作品库 | "已入库" Tab 请求 status=in_library 后端返回 400 | 断链 |
| GAP-CRTR-003 | 主题7 | 创作者端/收益 | 汽水 Tab API 不返回 qishuiDetails 列表，永远空 | 断链 |
| GAP-CRTR-004 | 主题6 | 创作者端/上传 | 表单无 performer/专辑名，schema 默认实名/同标题未实现 | 残缺 |
| GAP-CRTR-005 | 主题7 | 创作者端/上传 | 拖拽上传未实现（PRD §7.1.2 要求） | 残缺 |
| GAP-CRTR-006 | 主题5 | 创作者端/上传 | audio/cover URL 匿名可访问 | 配置缺失+安全 |
| GAP-LOOP-006 | 主题5 | 跨端/上传 | 音频 URL 裸返回，无签名/过期/用户绑定（同 CRTR-006） | 断链+安全 |
| GAP-CRTR-007 | 主题5 | 创作者端/上传 | OSS 分支 uploadUrl 未签名（同 GAP-LOOP-002） | 配置缺失 |
| GAP-CRTR-008 | 主题5 | 创作者端/上传 | upload token 无过期，可无限重用 | 配置缺失 |
| GAP-CRTR-009 | 安全 | 创作者端/认证 | 短信/重置密码/upload token 等 API 无 IP 限流 | 配置缺失 |
| GAP-CRTR-010 | 安全 | 创作者端/注册 | 邀请码无爆破防护（无错误次数/IP 限流） | 配置缺失 |
| GAP-CRTR-011 | 主题6 | 创作者端/通知 | 消息中心 n.time 不存在（API 返 createdAt），显示 undefined | 断链 |
| GAP-CRTR-038 | 主题2 | 创作者端/实名 | 实名审批通过/驳回无消息推送（同 GAP-LOOP-005 子项） | 断链 |

> 说明：GAP-LOOP-001/003/004 与对应 GAP-ADMIN-00x 是同一根因不同角度（运行时链路 vs UI 入口），补齐动作合并。同根因的 GAP-CRTR-006/007/008 与 GAP-LOOP-002/006 属主题 5 同一链路，修一处就解决。

### 独立唯一 P0 数（去重后）：约 18 个

---

## 跨端重复映射表

同一根因多个 agent 识别，补齐时合并处理。

| 根因 / 合并单元 | 相关 GAP ID | 合并处理策略 |
|---|---|---|
| LLM Key 配置 | GAP-ADMIN-001 + GAP-LOOP-001 | 一并补，settings 加 AI tab + lib/ai-analysis 改 DB 优先 |
| OSS 配置 + 签名 URL | GAP-ADMIN-002 + GAP-LOOP-002 + GAP-LOOP-003 + GAP-CRTR-007 | 一并补，接入 ali-oss SDK + settings 加存储配置 tab + signatureUrl 封装 |
| SMS 配置 | GAP-ADMIN-003 + GAP-LOOP-004 | 一并补，settings 加短信配置 tab + lib/sms 改 DB 优先 |
| 通知触发机制 | GAP-CRTR-001 + GAP-LOOP-005 + GAP-ADMIN-050 + GAP-ADMIN-089 + GAP-CRTR-038 + GAP-CRTR-071 + GAP-LOOP-014 + GAP-LOOP-015 + GAP-SCHM-006 | 一并补，抽 lib/notifications + 扩 Notification schema + 各业务动作事务内调用 |
| 权限系统 | GAP-ADMIN-004 + GAP-ADMIN-062 + GAP-COMM-001 | 一并补，inferPermissionKey 补 edit/export/settle + 全路由显式 requirePermission |
| 权限系统 group_admin | GAP-COMM-003 | 单独补（与上合并可选） |
| CSV 解析边界 | GAP-ADMIN-022 + GAP-LOOP-012（总收入校验） / GAP-ADMIN-023 + GAP-LOOP-011（编码检测） | 一并在 revenue/imports 路由补 |
| API 限流 | GAP-CRTR-009 + GAP-LOOP-008 + GAP-LOOP-009 + GAP-ADMIN-093 + GAP-CRTR-059 | 一并补，middleware 统一 ipRateLimit |
| Logout 吊销 | GAP-CRTR-055 + GAP-LOOP-010 + GAP-SCHM-014 | 一并补，加 TokenRevocation 表 + logout 写入 + middleware 校验 |
| 文件上传 MIME | GAP-CRTR-047 + GAP-LOOP-007 | 一并补，local PUT 端点 + OSS 回调 magic bytes 校验 |
| 音频签名 URL | GAP-CRTR-006 + GAP-LOOP-006 | 一并补，用 signatureUrl 改造所有音频 GET |
| CMS 视频/字段 | GAP-ADMIN-068（videoUrl 输入）+ GAP-CRTR-012（无播放）+ GAP-SCHM-009（schema 缺 sections 等）+ GAP-CRTR-013（硬编码） + GAP-ADMIN-069（缺作者/时间/标签）| 一并补，扩 CmsContent schema + 后端 + 管理端 + 创作者端播放器 |
| CMS 下架语义 | GAP-ADMIN-067 + GAP-SCHM-008 | 一并补，unpublish action 写 archived |
| 课程/表单/分成/权限 缓存 | GAP-ADMIN-026 + GAP-ADMIN-041 + GAP-ADMIN-061 + GAP-ADMIN-072 + GAP-COMM-006 + GAP-COMM-007 | 一并补，PRD §10.2 六类 key 系统性落地 |
| 版权编号 | GAP-ADMIN-029 | 加独立 copyright_sequence 表或 SystemSetting + SELECT FOR UPDATE |
| 实名驳回原因 + 通知 | GAP-ADMIN-049 + GAP-ADMIN-050 + GAP-CRTR-038 | 一并补，verify 路由接收 reason + 事务 create Notification |
| Settlement 金额非空 | GAP-SCHM-002 + GAP-SCHM-003 | 一并补 |
| 合同/协议 硬编码 | GAP-ADMIN-052 + GAP-ADMIN-053 + GAP-ADMIN-054 + GAP-CRTR-033 + GAP-CRTR-034 | 一并重构，加协议版本表 + 按实际 settlement 动态展示 |
| 手机号修改流程 | GAP-RVW-018 + GAP-CRTR-030 | 一并补，新增 /api/profile/phone PUT |

### 去重后唯一缺口数 ≈ 237

---

## 用户决策问题

在写 aligned PRD v6.0 之前需要你拍板的 7 个问题：

### 决策 1：P0 按主题批还是按项补？
- A. 按 30 条逐项修（细粒度，审计充分，周期长）
- B. 按 7 个主题收敛修（推荐，一个 PR 解决多条 P0，但 PR 跨端较大）

### 决策 2："通知触发机制"的范围
PRD §7.1.1 / §7.1.6 列的通知类型较宽泛。实际落地要覆盖哪些事件？建议最小集：
- [ ] 评审完成 → work（创作者收）
- [ ] 发行成功/失败 → work（创作者收）
- [ ] 结算生成 → revenue（创作者收）
- [ ] 结算打款 → revenue（创作者收）
- [ ] 实名审核通过/驳回 → system（创作者收）
- [ ] 作业创建/截止提醒 → work（创作者收）
- [ ] 需修改作品进入重审 → work（创作者收）
- 其他？

### 决策 3：权限系统要做到哪步？
- A. 最小可用：统一 action 词汇 + 侧边栏修 key + 显式 requirePermission（P0 收口）
- B. 完整：A + group_admin 基于 group_id 过滤（GAP-COMM-003）+ 6 种粒度全覆盖 e2e 用例
- C. 暂不触碰权限，用超管绕过上线（不推荐）

### 决策 4：发行链路自动化要做多深？
- A. publish 后自动 createMany distributions = pending，管理员在矩阵改状态（最小）
- B. A + 对账 sync 真实接入至少 1 个平台 HTTP 接口（汽水/QQ）
- C. A + 发行平台从 SystemSetting 读，支持动态新增
- 建议 **A + C**（B 需外部 API 文档，滞后）

### 决策 5：CMS 课程视频功能是否纳入 P0？
按 PRD §7.1.6 要求视频播放，用户本次明确提及。当前：
- schema 缺 sections / duration / videoUrl（部分已有）
- 管理端表单缺 videoUrl 输入
- 创作者端播放按钮只切动画
- 学习进度判定是"停留 30 秒 = 100%"

建议：**P1 → P0 升级**（因为是你明确点名的痛点）。你决定。

### 决策 6："建议砍"的 12 项是否全砍？
例如：
- `GAP-ADMIN-032`：管理员 PUT /songs/:id 改歌词/词曲作者——PRD §1.2 评审不可改元数据，管理员语义也矛盾。建议砍或限字段
- `GAP-RVW-013`：评审撤销接口（PRD 未要求）
- `GAP-CRTR-076`：contribution 三档 UI vs schema 两档（前端简化为两档）
- `GAP-SCHM-024`：FormFieldConfig.displayOrder TinyInt 理论溢出（实际不会发生）

要么全砍在 aligned PRD 中体现，要么逐项复核。建议 **全砍，后续若业务需要再新增**。

### 决策 7：aligned PRD v6.0 的产出形式
- A. 全文重写 PRD v6.0（包含所有变更）
- B. 维持 v5.2 + 写一份 PRD patch / changelog（增、改、删分节，最小 diff）
- 建议 **B**（审阅成本低，且 v5.2 本身质量高，大部分章节不变）

---

## 执行建议（B 方案后续步骤）

1. **你先回答 7 个决策**（或者回答关键的 1-4，其他按我建议默认）
2. 我据决策产出 **PRD v5.2 → v6.0 Diff 文档**（重点：新增系统配置章节、通知触发规则章节、权限系统详化、发行自动化流程、CMS schema 扩展等）
3. Diff 文档你 review
4. review 通过后可选转入 implementation plan（`writing-plans` skill），按主题拆 PR

---

## 下一步

请查看三个子文档的详细条目：
- [管理端缺口清单（100 项）](./2026-04-20-gap-admin.md)
- [创作者端+认证+上传缺口清单（78 项）](./2026-04-20-gap-creator.md)
- [评审端+公共+Schema 缺口清单（74 项）](./2026-04-20-gap-reviewer-common-schema.md)

然后回复决策 1-7（或只回复你想override的，其他按建议走）。
