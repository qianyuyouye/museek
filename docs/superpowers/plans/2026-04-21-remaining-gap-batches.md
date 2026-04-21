# Museek 剩余缺口批次计划

## 元信息

| 项 | 值 |
|---|---|
| 制定日期 | 2026-04-21 |
| 基准 HEAD | 52e5973 (Theme 1-7 + 部署补丁完成) |
| 依据 | `2026-04-20-platform-alignment-gap-list.md` 主清单 + 3 个子清单 |
| 状态 | 已完成 P0 30/30 中的 27 条（7 主题覆盖），剩 3 条 P0（安全类，批 1 收尾） |
| 累计估时 | 32-43 小时 (~5-7 个工作日) |

## 优先级分组

| 批次 | 主题 | 条目数 | 优先级 | 估时 |
|---|---|---|---|---|
| 批 1 | Theme 8 安全加固 | 10 | P0 3 + P1 7 | 3-4h |
| 批 2 | Theme 9 CMS 富文本 + 视频 + 课程 | 11 | P1 6 + P2 5 | 4-6h |
| 批 3 | Theme 10 评审深度 | 9 | P1 7 + P2 2 | 4-5h |
| 批 4 | Theme 11 收益管理完整化 | 10 | P1 8 + P2 2 | 4-5h |
| 批 5 | Theme 12 Profile + 合同硬编码清理 | 14 | P1 3 + P2 10 + 建议砍 1 | 3-4h |
| 批 6 | Theme 13 发行 + ISRC 完整化 | 7 | P1 6 + P2 1 | 2-3h |
| 批 7 | Theme 14 用户组 + 账号 + 作业 + 设置 | 25 | P1 11 + P2 14 | 4-5h |
| 批 8 | Theme 15 公共 lib 完整化 | 15 | P1 5 + P2 10 | 3-4h |
| 批 9 | Theme 16 schema 细节清理 | 13 | P1 7 + P2 6 | 2-3h |
| 批 10 | Theme 17 批量下载 + 杂项 P2 | 10 | P1 1 + P2 9 | 3-4h |
| 批 11 | Theme 18 建议砍决策 | 12 | 决策题 | 0.5h |

---

## 批 1 · Theme 8 安全加固（消灭最后 3 条 P0 + 安全链）

| ID | 优先级 | 内容 | 补齐动作 |
|---|---|---|---|
| GAP-ADMIN-009 | **P0** | 创建管理员/评审密码无强度校验 | 抽 `validatePassword(p)` helper（≥8 + 字母 + 数字）；api/admin/admins + api/admin/accounts/create-reviewer + reset-password 三处接入 |
| GAP-CRTR-009 / GAP-LOOP-008 / GAP-LOOP-009 / GAP-ADMIN-093 | **P0** | 短信/重置密码/upload-token API 无 IP 限流 | middleware 统一 `ipRateLimit`；全写路径 60/min/IP |
| GAP-CRTR-010 | **P0** | 邀请码爆破防护 | `sms/verify` 对 `inviteCode 无效` 计数；>5 次/小时 锁 IP+phone |
| GAP-CRTR-050 / 051 / 052 | P1 | SMS 锁定 + 每日上限 + 验证码错误次数锁 | SmsCode 表加 attempts 字段；verify 错误递增 ≥5 次锁 phone 15min；发送每日 ≤10 |
| GAP-CRTR-055 / GAP-LOOP-010 / GAP-SCHM-014 | P1 | logout 不 revoke，refresh 被盗继续续签 | 新增 `TokenBlacklist` 表；logout 写入；middleware 校验 |
| GAP-COMM-002 | P1 | CSRF 补：origin 和 referer 都缺失时拒绝 | middleware.ts 加入 denied 分支 |
| GAP-COMM-005 | P1 | rate-limit 内存实现，多实例失效 | 可选：迁 DB（rate_limits 表）或 Redis；至少文档注明 |
| GAP-COMM-015 | P1 | JWT fallback-dev-secret build 时 silent | `npm run build` 时检测到 fallback 输出大字警告 |

---

## 批 2 · Theme 9 CMS 富文本 + 视频 + 课程

| ID | 优先级 | 内容 |
|---|---|---|
| GAP-ADMIN-068 | P1 | CMS 新建/编辑表单补 videoUrl 输入（type=video 时必填） |
| GAP-CRTR-012 | P1 | creator/courses 视频播放用 `<video controls src={videoUrl}>` |
| GAP-CRTR-013 / GAP-CRTR-078 | P1 | sections/duration/level schema 落地 + 前端消费 |
| GAP-CRTR-014 | P1 | 视频进度用 `video.ontimeupdate`，图文滚动百分比 |
| GAP-ADMIN-067 / GAP-SCHM-008 | P1 | unpublish action 写 archived，删除 draft 兜底 |
| GAP-ADMIN-069 | P2 | CMS 补「作者/发布时间/标签/摘要」字段 |
| GAP-ADMIN-070 / 071 | P2 | 列表删除按钮 + error toast |
| GAP-SCHM-009 | P2 | CmsContent 加 sections/duration/tags/author 字段 |
| GAP-ADMIN-072 | P2 | courses 30min cache |
| 关联决策 | — | 富文本库选型：TipTap vs Lexical vs 手搓 textarea + Markdown |

---

## 批 3 · Theme 10 评审深度

| ID | 优先级 | 内容 |
|---|---|---|
| GAP-RVW-001 | P1 | assess 页展示 performer/lyricist/composer/albumName |
| GAP-RVW-003 | P1 | 评审草稿：切换/刷新前保存 ratings/comment/marks 到 DB |
| GAP-RVW-005 | P1 | 评审时间轴 marks 在创作者端详情页回显 |
| GAP-RVW-009 | P1 | review/stats 历史记录分页 |
| GAP-RVW-018 | P1 | 评审端手机号修改验证码流程（复用批 1） |
| GAP-RVW-019 | P1 | ReviewerSidebar onLogout 接入真实 logout |
| GAP-CRTR-022 / 023 | P1 | 作业 needs_revision 前端"修改并重新提交"入口 |
| GAP-RVW-002 / 004 / 006 / 010 / 011 / 012 | P2 | 评审上下文 DB 持久化、真实波形下采样、queue 分页、筛选、来源标签 |

---

## 批 4 · Theme 11 收益管理完整化

| ID | 优先级 | 内容 |
|---|---|---|
| GAP-ADMIN-015 | P1 | revenue/stats 返回 songCount/periodCount/userCount/songs 真值 |
| GAP-ADMIN-016 | P1 | Settlement plays 字段接 RevenueRow 明细 |
| GAP-ADMIN-018 / 019 | P1 | 映射管理「解除映射」+「手动新增映射」UI |
| GAP-ADMIN-022 / GAP-LOOP-012 | P1 | CSV 校验 col7 = col5 + col6 |
| GAP-ADMIN-023 / GAP-LOOP-011 | P1 | CSV 编码检测（iconv-lite），GBK/UTF-16 转 UTF-8 |
| GAP-ADMIN-025 | P1 | CSV 导入批次 DELETE 回滚接口 + UI |
| GAP-ADMIN-063 | P1 | dashboard totalRevenue 改算法：平台总收入 = row.totalRevenue sum |
| GAP-ADMIN-064 | P1 | period 排序从字典改时间序（字符串转 Date）|
| GAP-ADMIN-089 | P1 | 结算 pay 后通知创作者（Theme 2 漏网） |
| GAP-ADMIN-090 / 091 | P2 | 打款渠道字段 + 强制已导出检查 |

---

## 批 5 · Theme 12 Profile + 合同硬编码清理

| ID | 优先级 | 内容 |
|---|---|---|
| GAP-CRTR-030 | P1 | 更换手机：onClick 实现 + `POST /api/profile/phone`（旧+新手机验证码） |
| GAP-ADMIN-053 | P1 | 合同分成比例从实际 settlement 或规则读，去硬编码 70/30 |
| GAP-ADMIN-057 | P1 | admins 表单加"修改密码"入口 + reset-password 路由 |
| GAP-CRTR-031 | P2 | 更换邮箱独立流程（而非复用 editModal） |
| GAP-CRTR-032 / 033 | P2 | 入职时间从 user.createdAt；协议 signedAt 从 agency_contracts |
| GAP-CRTR-034 / GAP-CRTR-077 | P2 | 代理协议条款从 system_settings；`/api/profile/agreements` API 化 |
| GAP-CRTR-035 | P2 | 邮箱为空时显示空串而非 "null" |
| GAP-CRTR-036 | P2 | 实名 verified 态下"申请修改"入口 |
| GAP-CRTR-037 | P2 | 登录日志分页（加 pageSize 参数） |
| GAP-ADMIN-052 | P2 | 合同版本管理表（agency_contract_versions） |
| GAP-ADMIN-054 | P2 | 用户服务协议/隐私政策独立 Tab 数据 |
| GAP-ADMIN-055 | P2 | 合同台账加 PDF 下载/预览按钮（复用 agency-pdf） |
| GAP-ADMIN-056 | P2 | admins 列表「删除管理员」按钮 |
| GAP-ADMIN-058 | P2 | admins CSV 导出时间本地化 |

---

## 批 6 · Theme 13 发行 + ISRC 完整化

| ID | 优先级 | 内容 |
|---|---|---|
| GAP-ADMIN-013 / GAP-ADMIN-079 | P1 | PLATFORMS 常量下线，全从 `platform_configs` DB 读；RevenuePlatform enum 同步 |
| GAP-ADMIN-014 | P1 | distribution edit Modal 加 url 字段 |
| GAP-ADMIN-027 | P1 | published → reviewed 下架入口（按钮调 reject action） |
| GAP-ADMIN-030 | P1 | ISRC 格式 `^CN-[A-Z0-9]{3}-\d{2}-\d{5}$` + 唯一性校验 |
| GAP-ADMIN-011 | P1 | publish-confirm `data_confirmed` 枚举对齐 schema |
| GAP-ADMIN-012 | P1 | 对账同步 `sync` 路由引入 platform adapter 框架（至少接口定义） |
| GAP-ADMIN-033 | P2 | ISRC 申报中字段 schema + 统计 |
| GAP-ADMIN-034 | P2 | ISRC 时长从 audio_features 读 |
| GAP-ADMIN-035 | P2 | ISRC 批量录入改 textarea/表格，弃 window.prompt |

---

## 批 7 · Theme 14 用户组 + 账号 + 作业 + 设置

| ID | 优先级 | 内容 |
|---|---|---|
| GAP-ADMIN-036 | P1 | 作业 draft 状态支持（保存为草稿） |
| GAP-ADMIN-037 | P1 | 作业关闭/删除 UI 入口 |
| GAP-ADMIN-038 | P1 | 作业状态筛选（进行中/已截止/草稿） |
| GAP-ADMIN-039 | P1 | submissionCount/totalMembers 成员加入后触发刷新 |
| GAP-ADMIN-045 | P1 | 组成员「设置/取消组管理员」按钮 |
| GAP-ADMIN-077 | P1 | 系统设置"评分规则"要求推荐等级字段持久化 |
| GAP-ADMIN-078 | P1 | 分成规则保存「至少保留一条 default」校验 |
| GAP-ADMIN-080 | P1 | 报表字段映射 UI（而非 boolean） |
| GAP-ADMIN-083 | P1 | 通知模板管理（在 Theme 1/2 基础上补完整 CRUD） |
| GAP-ADMIN-061 | P1 | 角色权限更新 invalidate cache |
| GAP-ADMIN-073 | P1 | logs 前端 action 下拉英文对齐后端 |
| GAP-ADMIN-059 / 060 | P2 | 角色名 ≤8 字后端校验 + 唯一性 |
| GAP-ADMIN-040 / 041 | P2 | per-assignment 字段配置 + 10min cache |
| GAP-ADMIN-042 / 046 | P2 | 用户组删除按钮 + 组名表单（弃 window.prompt） |
| GAP-ADMIN-043 / 044 | P2 | 邀请码 8 位 + 邀请链接域名 env |
| GAP-ADMIN-047 | P2 | Group.adminUserId 读写接口 |
| GAP-ADMIN-074 / 075 / 076 | P2 | logs 目标名展示 + operator_id 筛选 + x-user-name header 注入 |
| GAP-ADMIN-081 / 082 | P2 | 评语模板编辑（不只是增删） + AI 工具/流派编辑 |
| GAP-ADMIN-084 | P2 | 批量下载 ZIP 保留时长配置 |

---

## 批 8 · Theme 15 公共 lib 完整化

| ID | 优先级 | 内容 |
|---|---|---|
| GAP-COMM-001 | P1 | 权限粒度非超管实测（新建非内置角色覆盖矩阵） |
| GAP-COMM-003 | P1 | group_admin / system_admin 与 portal 挂钩，adminLevel 做 route guard |
| GAP-COMM-006 / 007 | P1 | 6 类 cache key 系统落地（revenue_rules/courses/form_config 等）+ invalidate |
| GAP-COMM-010 | P1 | ai-analysis 加 AbortController 超时（5s） |
| GAP-COMM-012 | P1 | prod AI_API_KEY 缺失时告警（而非 silent mock） |
| GAP-COMM-014 | P1 | ENCRYPTION_KEY 管理端 UI + 密钥轮换流程 |
| GAP-COMM-004 | P2 | middleware matcher 精细化 |
| GAP-COMM-008 / 009 | P2 | logAdminAction 对创作者/评审用户适配 + 失败重试 |
| GAP-COMM-011 | P2 | AI 分析响应缓存（同 songId 30min） |
| GAP-COMM-013 | P2 | sanitize 升级 DOMPurify（CMS 富文本保障） |
| GAP-COMM-016 | P2 | reviewer 注册 portal 入口校验 |
| GAP-COMM-017 | P2 | LoginLog userId FK 补 |
| GAP-COMM-018 / 019 | P2 | upload token 绑 songId；upload 老文件 GC |
| GAP-COMM-020 | P2 | audio-extract 长音频优化 |
| GAP-COMM-021 | P2 | formatDateTime 显式时区 |
| GAP-COMM-022 | P2 | use-api silent 标记 |

---

## 批 9 · Theme 16 schema 细节清理

| ID | 优先级 | 内容 |
|---|---|---|
| GAP-SCHM-002 / 003 | P1 | settlements.totalRevenue / creatorAmount 写入保障，去掉 0 兜底 |
| GAP-SCHM-005 | P1 | platform_songs 默认实名/同标题（已在 Theme 6 实现 helper，schema 加 @default 补强） |
| GAP-SCHM-006 | P1 | notifications 加 target_id / content / link_url 字段（Theme 2 已扩，批 9 确认完整） |
| GAP-SCHM-008 | P1 | cms_contents.ContentStatus 使用对齐（批 2 会一并修） |
| GAP-SCHM-013 | P1 | seed.ts vs seed.js 分叉消除，统一一份 |
| GAP-SCHM-001 | P2 | operation_logs.detail 长度 guard |
| GAP-SCHM-004 | P2 | users.status Enum vs admin_users.status Boolean 对齐 |
| GAP-SCHM-007 / 020 | P2 | notifications.type 枚举约束；score TinyInt CHECK 0-100 |
| GAP-SCHM-010 | P2 | audio_features 在作业提交路径也写入 |
| GAP-SCHM-011 | P2 | distributions.platform 与 platform_configs FK |
| GAP-SCHM-012 | P2 | sms_codes 加 purpose 字段（register/reset_password 分开） |
| GAP-SCHM-015 | P2 | LoginLog.userId + portal 双列，跨用户/管理员表 |
| GAP-SCHM-016 | P2 | ReviewMark 关系化（从 reviews.tags JSON 拆出独立表） |
| GAP-SCHM-017 / 018 / 022 / 023 | P2 | LearningRecord.progress CHECK 0-100 + AssignmentSubmission.submittedAt NOT NULL + submissionCount 触发器 + deadline 应用层校验 |
| GAP-SCHM-019 / 021 | P2 | LikeRecord PRD 对照 + operation_logs 分区 |

---

## 批 10 · Theme 17 批量下载 + 杂项 P2

| ID | 优先级 | 内容 |
|---|---|---|
| GAP-ADMIN-085 | P1 | 批量下载 ZIP 迁到后端（避免前端 OOM，>100MB 直接 crash） |
| GAP-ADMIN-017 | P2 | 收益表格标题硬编码"Q1" 改动态 |
| GAP-ADMIN-031 | P2 | 歌曲详情页 + 编辑入口 |
| GAP-ADMIN-048 | P2 | 用户档案总收益千分位 |
| GAP-ADMIN-050 | P2 | 实名驳回/通过通知（Theme 2 可能漏） |
| GAP-ADMIN-051 | P2 | students 副标题「共 N 名创作者」语义 |
| GAP-ADMIN-065 / 066 | P2 | 转化率文案对齐 + 卡片跳转带 tab 筛选 |
| GAP-ADMIN-074 / 075 / 076 | P2 | logs 目标名 + operator 筛选 + header 注入 |
| GAP-ADMIN-086 / 087 / 088 | P2 | 批量下载分页 + PDF 进度 + 选中数提示 |
| GAP-ADMIN-094 / 095 | P2 | 时间格式化 + window.prompt 彻底清理 |
| GAP-ADMIN-098 | P2 | 管理端登录日志查询入口 |
| GAP-LOOP-013 | P2 | CSV 注入防护（公式前缀转义） |
| GAP-LOOP-014 / 015 | P2 | 注册欢迎 + 作业提交通知（Theme 2 补齐） |

---

## 批 11 · Theme 18 建议砍决策（不动代码，纯决策）

需你拍板：**实施** 或 **从 aligned PRD v6.0 移除**。

- GAP-ADMIN-032: PUT songs 允许改元数据（与 PRD §1.2 语义冲突）
- GAP-ADMIN-096: 操作日志导出按钮
- GAP-ADMIN-097: GlobalToast 统一替换各页自实现
- GAP-CRTR-076: contribution 三档 UI vs 两档 schema（建议改两档）
- GAP-CRTR-077: PLATFORM_AGREEMENTS API 化
- GAP-CRTR-078: VIDEO_DETAILS/ARTICLE_DETAILS schema 化（批 2 可能一并）
- GAP-RVW-013: 评审提交撤销接口
- GAP-RVW-014: 滑块默认值居中（体验）
- GAP-RVW-016: 文案"进入评审列表" vs "开始评审" 对齐
- GAP-RVW-017: avgDuration 个人对比维度
- GAP-RVW-020: 评审端 layout route guard
- GAP-SCHM-024: FormFieldConfig.displayOrder TinyInt 溢出

---

## 推荐执行顺序

```
批 1 (3-4h)  ← P0 收尾，优先
批 2 (4-6h)  ← CMS 富文本/视频（用户明确想要）
批 3 (4-5h)  ← 评审深度（运营价值高）
批 4 (4-5h)  ← 收益管理（结算闭环）
批 11 (0.5h) ← 建议砍决策（避免后续批次重复讨论）
批 5 (3-4h)
批 6 (2-3h)
批 7 (4-5h)
批 8 (3-4h)
批 9 (2-3h)
批 10 (3-4h)
```

**总计**：32-43 小时 ≈ 5-7 个工作日

---

## 工作流

每批独立按 superpowers 三步走：
1. `superpowers:brainstorming` — 对齐范围 + 关键决策
2. `superpowers:writing-plans` — TDD plan
3. `superpowers:subagent-driven-development` — 派 subagent 执行

每批完成后 push + 更新本文档的完成状态。
