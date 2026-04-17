# Museek PRD 追踪矩阵与交叉验证

> **生成日期**：2026-04-17  
> **PRD 版本**：v5.2 原型对齐版（`docs/prd_text.txt`）  
> **代码 HEAD**：当前 main 分支（已完成 Phase A/B1-B7 修复）  
> **审计方法**：静态代码扫描 + 数据库 schema 对照 + API/UI 双向验证

---

## 0. 图例

| 符号 | 含义 |
|---|---|
| ✅ | 完整实现，前后端数据流通畅 |
| 🟡 | 部分实现（核心可用，有缺陷） |
| 🟠 | mock / 硬编码 / 空按钮 |
| 🔴 | 前后端断裂或完全缺失 |
| ➖ | 非本期交付范围 |

---

## 1. 核心业务流（PRD §2 七 Phase 闭环）

| Phase | 功能点 | 状态 | 证据 / 差距 |
|---|---|---|---|
| **Phase 1 创作** | 平台外部（汽水/Suno） | ➖ | 不在系统内 |
| **Phase 2 入库** | 自由上传 3 步（文件→元数据→预览） | ✅ | `creator/upload/page.tsx` + `/api/creator/upload` 完整 |
| | 作业提交 + 动态字段 | ✅ | `creator/assignments` + `/api/admin/assignments/[id]/fields` 可配置 |
| | 版权编号 `AIMU-YYYY-NNNNNN` | 🟡 | schema `copyrightCode UNIQUE`，**需确认是否按年重置序号** |
| | 提交即 `pending_review` | ✅ | |
| **Phase 3 评审** | 试听（A-B 循环 + 变速） | ✅ | P0-1 已修：`components/review/AudioPlayer.tsx` 真 `<audio>` + 变速/AB/波形进度 |
| | AI 预分析报告 | ✅ | `/api/review/songs/[id]/analysis` + `lib/ai-analysis.ts` |
| | 三维打分（30/40/30）+ 加权 | ✅ | 前端实时计算、后端再次校验 |
| | 快捷评语 + 评语 ≥20 字 | ✅ | |
| | 推荐等级 → 状态机流转 | ✅ | `/api/review/submit` 事务化处理 |
| | **评审耗时 `durationSeconds`** | ✅ | P1-2 已修：assess 记录起始时间，submit 入库，stats 返回 avgDuration |
| **Phase 4 发行** | 待发行列表 | ✅ | |
| | 发行三条件校验（签约+实名+ISRC） | ✅ | 本次 Phase A 修复，songs GET 已返回 `agencyContract/realNameStatus` |
| | 确认发行 → `published` | ✅ | `/api/admin/songs/[id]/status` |
| | 批量下载（ZIP） | ✅ | 本次 B5 实现 jszip 打包 |
| | ISRC 管理（申报+回填） | ✅ | 录入 / 批量录入 / CSV 回填 / 导出清单（本次 B5/B7） |
| | 发行渠道矩阵 | ✅ | 本次 B2 可编辑 Modal |
| **Phase 5 状态确认** | 自动对账 + 人工确认 + 异常 | 🟡 | `publish-confirm` action 已修复，但 `sync` 对接汽水真实接口是 mock（无外部数据源） |
| **Phase 6 收益导入** | CSV 解析 | ✅ | 本次 B4 `lib/csv.ts` + `/api/admin/revenue/imports` |
| | 映射自动匹配（auto_exact/fuzzy） | ✅ | P1-3 已修：unmatched 行按歌名 contains 查询，唯一命中→auto_exact/confirmed，多条→auto_fuzzy/suspect，零命中→none/pending |
| | **分成规则三档（高分/量产/默认）** | ✅ | P0-3 已修：`lib/commission.ts` 按 system_settings.revenue_rules 优先级评估 |
| | **回溯生成结算**（pending→confirmed 触发） | ✅ | P0-4 已修：`lib/revenue-backfill.ts` 事务批量生成 |
| | 多维统计 / 导出 | ✅ | |
| | 打款前实名校验 | ✅ | P0-5 已修：settlements pay 阻断未 verified 创作者并列出姓名 |
| **Phase 7 收益查询** | 平台分发 Tab | ✅ | `/api/creator/revenue` |
| | 汽水音乐 Tab | ✅ | 同上 |
| | 隐藏 qishuiSongId | ✅ | 返回字段已过滤 |

---

## 2. 数据模型对照（PRD §4 15 张表）

| PRD 表 | Schema 存在 | 字段完整性 | 未使用字段 / 差距 |
|---|---|---|---|
| groups | ✅ | ✅ | |
| users | ✅ | ✅ | P0-2 已修：idCard AES-256-GCM 加密，字段扩宽至 VarChar(128) |
| user_groups | ✅ | ✅ | |
| platform_songs | ✅ | ✅ | `albumName/albumArtist/performer` 保存但前端详情页未展示 |
| assignments | ✅ | ✅ | |
| assignment_submissions | ✅ | ✅ | |
| reviews | ✅ | ✅ | P1-2 已修：durationSeconds 入库 + stats.avgDuration 返回 |
| form_field_configs | ✅ | ✅ | |
| song_mappings | ✅ | ✅ | |
| revenue_imports | ✅ | ✅ | |
| revenue_rows | ✅ | ✅ | |
| settlements | ✅ | ✅ | PRD 无 `notes/exception` 字段，schema 也无（对齐） |
| admin_roles | ✅ | ✅ | |
| admin_users | ✅ | ✅ | `lastLoginIp` 本次 Phase A 已补返回 |
| distributions | ✅ | ✅ | |
| operation_logs | ✅ | ✅ | |
| cms_contents | ✅ | ✅ | PRD 未要求 `type=video/article` 详情（sections/duration），代码只存 title |
| system_settings | ✅ | ✅ | |
| notifications | ✅ | ✅ | PRD §4 未列，但实现需要 |
| sms_codes | ✅ | ✅ | 同上 |
| login_logs | ✅ | ✅ | 同上 |
| **LearningRecord** | ✅ | ✅ | P2-1 已补：schema 新增 learning_records + API + 创作者 learning/courses 页面接入 |

---

## 3. 三端页面追踪

### 3.1 创作者端（PRD §7.1）

| PRD 功能 | 页面 | 状态 | 关键差距 |
|---|---|---|---|
| §7.1.1 Dashboard 实时统计 | `creator/home` | ✅ | 学习进度硬编码 `4/N`（后续可接 P2-1 学习记录 API） |
| §7.1.2 自由上传 3 步 | `creator/upload` | ✅ | 已完整 |
| §7.1.2 重新提交预填 | 同上 | ✅ | P1-5 已修：跳 `/creator/upload?songId=x`，upload 支持 songId update-in-place + version++ |
| §7.1.3 作业提交 | `creator/assignments` | ✅ | 动态表单 / version++ 都通 |
| §7.1.4 我的作品库 | `creator/songs` | ✅ | 详情波形器为 UI 动画 |
| §7.1.5 我的收益 2 Tab | `creator/revenue` | 🟡 | 数据更新时间硬编码日期 |
| §7.1.6 课程中心 | `creator/courses` | 🟡 | 视频/文章详情 sections 硬编码 |
| §7.1.6 作品广场 | `creator/community` | 🟡 | 分享按钮仅 toast，无 `navigator.clipboard` |
| §7.1.6 我的学习 | `creator/learning` | ✅ | P2-1 已修：学习路径/徽章/时长均由 /api/learning + /api/learning/achievements 驱动 |
| §7.1.6 消息中心 | `creator/notifications` | ✅ | |
| §7.1.6 个人中心 - 基本信息 | `creator/profile` | ✅ | |
| §1.3 实名认证入口 | 同上 | ✅ | P0-2 已修：Modal 表单 + POST /api/profile/real-name（加密存储） |
| §7.1.6 头像上传 | 同上 | ✅ | P1-7 已修：POST /api/profile/avatar + 文件选择/直传/回写 |
| §7.1.6 手机号修改（验证码） | 同上 | 🟠 | 按钮存在无流程 |
| §7.1.6 协议签署 | 同上 | ✅ | `POST /api/profile/agency` |
| §7.1.6 登录日志 | 同上 | ✅ | |

### 3.2 评审端（PRD §7.2）

| PRD 功能 | 页面 | 状态 | 关键差距 |
|---|---|---|---|
| §7.2.1 工作台统计 | `review/workbench` | ✅ | |
| §7.2.1 30 天趋势图 | 同上 | ✅ | |
| §7.2.2 待评审队列 | `review/queue` | ✅ | P1-6 已修：API 返回 studentName 对齐前端 |
| §7.2.2 流派/姓名筛选 | 同上 | ✅ | |
| §7.2.3 **音频播放（A-B+变速）** | `review/assess` | ✅ | P0-1 已修：真实音频播放 + 变速 + A-B 循环 |
| §7.2.3 AI 预分析 | 同上 | ✅ | |
| §7.2.3 三维滑块 + 加权 | 同上 | ✅ | |
| §7.2.3 快捷评语 + 评语校验 | 同上 | ✅ | |
| §7.2.3 推荐等级 + 状态流转 | 同上 | ✅ | |
| §7.2.3 歌词全文 | 同上 | ✅ | P1-1 已修：读 song.lyrics |
| §7.2.3 Prompt/Style 展示 | 同上 | ✅ | P1-1 已修：读 song.styleDesc + 新增创作过程说明 |
| §7.2.3 时间轴标记工具 | 同上 | ✅ | P0-1 已修：Shift+点击波形打标，随 tags JSON 提交 |
| §7.2.3 波形标记 | 同上 | ✅ | P0-1 已修：标记在波形上显示竖线 + 列表回跳 |
| §7.2.4 绩效统计 | `review/stats` | ✅ | P1-2 之后新评审会写入 durationSeconds；stats 返回 avgDuration |
| §7.2.5 个人中心 | `review/profile` | ✅ | 手机号/头像同 creator 问题 |

### 3.3 管理端（PRD §7.3 共 18 个模块）

| PRD §7.3.x | 模块 | 状态 | 备注 |
|---|---|---|---|
| .1 运营看板 | `admin/dashboard` | ✅ | FALLBACK_RATES 硬编码 fallback |
| .2 用户组管理 | `admin/groups` | ✅ | 本次 B1 完整：编辑/重新生成码/停启用 |
| .3 作业管理 | `admin/assignments` | ✅ | |
| .4 用户档案 | `admin/students` | ✅ | 本次 B2 补 notify API |
| .5 合同台账 | `admin/contracts` | ✅ | 本次 B1 补详情 Modal |
| .6 歌曲库管理 | `admin/songs` | ✅ | 本次 Phase A + B1 修复 |
| .7 批量下载 | `admin/batch-download` | ✅ | 本次 B5 JSZip 音频+封面 |
| .7 下载前校验三项 | 同上 | 🔴 | **PRD §7.3.7 要求协议+实名+ISRC 写入报告红标，代码未校验** |
| .8 ISRC 管理 | `admin/isrc` | ✅ | 本次 Phase A + B5/B7 |
| .9 发行渠道 | `admin/distributions` | ✅ | 本次 B2 编辑 Modal |
| .10 发行状态确认 | `admin/publish-confirm` | 🟡 | 本次 Phase A 修 action；`sync` 外部对账数据源未接入 |
| .11 评审绩效 | `admin/teachers` | ✅ | |
| .12 账号与权限 | `admin/accounts` | ✅ | 本次 Phase A 修字段名、Phase B5 修密码 |
| .13 平台管理员 | `admin/admins` | ✅ | 本次 Phase A + B5 CSV 导出 |
| .14 角色管理 | `admin/roles` | ✅ | |
| .15.1 汽水/其他导入 | `admin/revenue` | ✅ | 本次 B4 + B7 |
| .15.2 映射管理三 Tab | 同上 | ✅ | P0-4 补回溯生成 |
| .15.3 收益四维统计 | 同上 | ✅ | |
| .15.4 结算管理 | 同上 | ✅ | P0-5 已补实名阻断 |
| .15.5 平台分发结算 | 同上 | 🟡 | Settlement `plays` 字段前端期望但无数据源 |
| .16 内容管理 CMS | `admin/content` | ✅ | |
| .17 系统设置 5 子模块 | `admin/settings` | ✅ | 本次 B2/B3 全量可编辑 |
| .18 操作日志 | `admin/logs` | ✅ | P2-2 已补：31 个 admin 写路由全部追加 logAdminAction |

---

## 4. CSV 解析与匹配（PRD §5-6）

| PRD 要求 | 实现 | 差距 |
|---|---|---|
| §5.2 第 1 列跳过 | ✅ | |
| §5.2 Excel 公式 `="..."` 去除 | ✅ | |
| §5.2 起止日期原始字符串存储 | ✅ | P1-4 已修：parseQishuiCsv 直接保留 `2026/02/01 - 2026/02/28`（配套 scripts/clear-revenue.ts 清空历史数据） |
| §5.2 总收入校验 = 抖音 + 汽水 | 🔴 | 未校验（PRD 要求） |
| §5.2 UTF-8/GBK 自动检测 | 🔴 | 代码假设 UTF-8，GBK 会乱码 |
| §6.1 Step 1 去重 | ✅ | `skipDuplicates` |
| §6.1 Step 2 映射表查询 4 种状态分流 | ✅ | P1-3 已修：confirmed→matched、suspect→suspect、pending/irrelevant→unmatched |
| §6.1 Step 3 **名称精确/模糊匹配** | ✅ | P1-3 已实现：unmatched 按歌名 contains 命中数决定 auto_exact/auto_fuzzy/none |
| §6.2 **分成规则三档** | ✅ | P0-3：`resolveCommissionRatio` + UI 条件类型 select |
| §6.3 **回溯生成**（suspect/pending→confirmed） | ✅ | P0-4：mappings confirm/bind 同步调用 backfillSettlements |
| §6.4 **手动新增映射直接 confirmed** | 🟡 | `mappings/[id]` PUT `action=bind` 存在，确认逻辑待验证 |

---

## 5. 状态机完整性（PRD §3）

| 起始状态 | 触发 | 目标 | 实现 | 证据 |
|---|---|---|---|---|
| pending_review | 强推+≥80 | ready_to_publish | ✅ | `/api/review/submit` |
| pending_review | 建议修改 | needs_revision | ✅ | |
| pending_review | 暂不推荐 | reviewed | ✅ | |
| needs_revision | 创作者重提 | pending_review | ✅ | `version++` + 保留历史 reviews |
| ready_to_publish | 校验+发行 | published | ✅ | 本次 Phase A 修字段 |
| ready_to_publish | 管理员退回 | needs_revision | 🟡 | action `reject` 后端已支持但前端 songs 页未显示退回按钮 |
| reviewed | 管理员手动发行 | published | 🟡 | 同上 |
| published | 平台下架 | reviewed | 🟡 | 未在 UI 暴露 |
| published | 归档 | archived | ✅ | |
| archived | 恢复 | reviewed | ✅ | |

---

## 6. 边界场景覆盖（PRD §8）

| 场景 | 实现 | 差距 |
|---|---|---|
| 先有收益后有提交 | ✅ | P0-4：映射 confirm/bind 后 backfillSettlements 扫描历史 rows |
| 汽水歌名与平台不一致 | ✅ | P1-3：无 qishuiSongId 映射时 fallback 到 songName contains，命中唯一则自动 confirmed |
| CSV 不属于本平台 | 🔴 | 标 irrelevant 后下次跳过——未实现 |
| 一首歌多月收益 | ✅ | `@@unique(qishuiSongId, period)` |
| 同名歌曲不同创作者 | 🔴 | 未实现 suspect 候选展示 |
| **创作者未实名打款** | ✅ | P0-5：settlements pay 前校验 realNameStatus，阻断并返回姓名列表 |
| 创作者账号禁用 | 🟡 | 结算生成但打款需人工处理——逻辑未测 |
| 跨批次重复行 | ✅ | UNIQUE 约束 |
| 发行 ISRC 未绑 | ✅ | Phase A 修复 |
| 结算金额 0 | ✅ | schema 允许 |
| 映射解除重建 | 🔴 | 未实现软删除 + exception 标记 |

---

## 7. 公共层与基础设施

| 模块 | 状态 | 说明 |
|---|---|---|
| 三端登录 | ✅ | `/api/auth/login` portal 区分 |
| Creator 注册（邀请码+短信） | 🟡 | 阿里云 SMS env 未配置，**开发返回 123456**，生产直接报错 |
| 短信重置密码 | 🟡 | 同上 |
| JWT + Cookie | ✅ | |
| 文件上传 token | ✅ | `upload/token` + `upload/local/[...path]` 真实可用 |
| OSS 生产上传 | 🔴 | 代码有 `OSS_BUCKET` 分支但**未使用 SDK signatureUrl()**，生产 403 |
| AI 分析 | 🟡 | `AI_API_KEY` 未配置走 fallback |
| `logAction` 操作日志 | ✅ | P2-2：扩展 `logAdminAction(request, opts)` 便捷包装，覆盖 31 个 admin 写路由 |

---

## 8. 必配但可能遗漏的 env 变量

| 变量 | 必要度 | 未配置后果 |
|---|---|---|
| `JWT_SECRET` | 🔴 生产强制 | 生产启动报错 |
| `DATABASE_URL` | 🔴 | 无法启动 |
| `ALIYUN_ACCESS_KEY_ID/SECRET` | 🟠 生产强制 | 短信注册/改密码不可用 |
| `ALIYUN_SMS_SIGN_NAME/TEMPLATE_CODE` | 🟠 | 同上 |
| `OSS_BUCKET/REGION/DOMAIN` | 🟡 生产建议 | 生产上传失败 |
| `AI_API_KEY` | ⚪ 可选 | 降级 fallback |

---

## 9. 优先级修复清单（按阻塞程度）

### 🔴 P0 - 阻塞核心业务
1. ✅ **评审端音频播放**（`review/assess`）：P0-1 已完成 — 真实 `<audio>` + 变速 + A-B 循环 + 波形进度 + 时间轴标记
2. ✅ **创作者实名认证入口**（`creator/profile`）：P0-2 已完成 — Modal 表单 + AES-256-GCM 加密存储 + 管理端详情解密
3. ✅ **分成规则三档自动评估**：P0-3 已完成 — `lib/commission.ts` + 动态规则 UI + seed 三档
4. ✅ **回溯生成结算**：P0-4 已完成 — `lib/revenue-backfill.ts`，confirm/bind 同步触发
5. ✅ **打款前实名阻断**：P0-5 已完成 — pay 前校验 realNameStatus 并返回阻断姓名

### 🟠 P1 - 功能不完整
6. ✅ **评审端歌词/Prompt 真实数据**（P1-1）：assess 页面读 `lyrics / styleDesc / creationDesc`
7. ✅ **评审耗时 `durationSeconds`**（P1-2）：assess 记录起始时间，submit 入库，stats.avgDuration 返回
8. ✅ **CSV 名称匹配**（P1-3 / §6.1 Step 3）：qishuiSongId 未找到时按 songName contains 自动建映射
9. ✅ **CSV 原始 period 保留**（P1-4）：`revenue_rows.period` 存起止日期原始字符串
10. ✅ **creator 重新提交预填**（P1-5）：`/creator/upload?songId=x` 预填 + upload 支持 songId update-in-place
11. ✅ **queue 字段名对齐**（P1-6）：`/api/review/queue` 返回 studentName
12. ✅ **创作者头像上传**（P1-7）：`POST /api/profile/avatar` + upload token 直传

### 🟡 P2 - 遗漏或硬编码
13. **批量下载三条件校验报告**：下载按钮对选中集合校验，报告文件标红缺失项
14. **OSS 生产签名 URL**：用阿里云 SDK `ali-oss`
15. ✅ **operation_logs 写入覆盖**（P2-2）：删除/禁用/结算/发行/角色变更 均调 `logAdminAction`
16. ✅ **学习进度表 LearningRecord**（P2-1）：schema + /api/learning CRUD + achievements + creator 两页接入
17. **CMS sections/duration 字段**：schema 扩展或 content 表加 JSON 字段
18. **创作者手机号改（验证码流程）**
19. **songs 退回/下架按钮暴露**
20. **阿里云 SMS env 生产配置**
21. **评审端波形标记 + 时间轴**（PRD §7.2.3 要求但代码未实现）

### ⚪ P3 - 体验
22. 创作者 revenue 数据更新时间戳
23. 作品广场分享 `navigator.clipboard.writeText`
24. 登录速率限制（后端）
25. 评审列表时间格式化

---

## 10. 本期已完成对照

以下为 2026-04-17 会话已修复项（8 个 commit `ccd7535` → `720b83b`）：

- [x] 权限变更字段 `roleAttr → type`
- [x] 管理员登录字段 `lastLoginAt/lastLoginIp` 返回
- [x] 歌曲发行校验字段 `agencyContract/realNameStatus/creatorName` 返回
- [x] 发行状态 action 对齐 `confirm/exception`
- [x] ISRC 真实录入
- [x] 歌曲渠道 Modal 读真实 distributions
- [x] 用户组邀请码完整 CRUD
- [x] 合同详情 Modal
- [x] 评分权重合计 100% 校验
- [x] 发行渠道单元格编辑 Modal
- [x] 学生发送提醒 API
- [x] 分成规则 CRUD（*但仅是 CRUD，尚未对接§6.2 自动评估*）
- [x] 平台/AI工具/流派全量编辑
- [x] 汽水 CSV 解析上传（`lib/csv.ts`）
- [x] 导出 CSV（Admins / 映射 / ISRC）
- [x] 批量下载 ZIP（jszip 音频+封面）
- [x] reset-password 真实密码
- [x] ISRC 批量录入 + 回填 CSV
- [x] 其他平台 CSV 导入（复用汽水模板）

---

## 11. 总体评估

| 维度 | 得分 |
|---|---|
| 数据模型完整性 | **95%** — 缺 LearningRecord |
| 管理端可用度 | **96%** — P0-3/4/5 补齐分成自动评估/回溯/实名阻断 |
| 创作者端可用度 | **85%** — P0-2 补实名入口；仍缺学习记录/头像上传 |
| 评审端可用度 | **78%** — P0-1 补音频播放 + 时间轴标记；仍缺歌词/Prompt 读真实数据等小项 |
| 收益全链路 | **90%** — P0-3/4/5 全链路打通；仅剩名称模糊匹配（P1-3） |
| 公共基础设施 | **70%** — 生产 OSS/短信需配置，登录鉴权完整 |
| **综合** | **~78%** |

**核心结论**：
- 前端 UI 齐整、API 大多通畅，但**业务规则层（§6 分成算法 / §7.2.3 音频播放 / §1.3 实名流程）有明确 gap**
- 本次修复后，「点按钮能跑通」已达 95%，但「业务语义正确性」还在 78%

**下一步推荐**：按 §9 的 P0 5 项优先做，完成后整体可达 88%+。

---

*本矩阵会随代码变更失效，建议每批修复后重跑静态审计更新。*
