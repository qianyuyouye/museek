# Schema vs PRD 差异报告

对照基线：
- PRD：`docs/prd_text.txt` §4（16 张表）
- 代码：`prisma/schema.prisma`（21 个模型）
- CLAUDE.md：声称"20 张表"

---

## 一、表级差异

### A. PRD §4 列出的 16 张表（全部落地）

| # | PRD 节 | 表名 | Prisma 模型 | 状态 |
|---|--------|------|-------------|------|
| 1 | 4.1 | groups | Group | ✓ |
| 2 | 4.2 | users | User | ✓ |
| 3 | 4.3 | user_groups | UserGroup | ✓ |
| 4 | 4.4 | platform_songs | PlatformSong | ✓（**多 audio_features 字段**） |
| 5 | 4.5 | assignments | Assignment | ✓ |
| 6 | 4.6 | assignment_submissions | AssignmentSubmission | ✓ |
| 7 | 4.7 | reviews | Review | ✓ |
| 8 | 4.8 | form_field_configs | FormFieldConfig | ✓ |
| 9 | 4.9 | song_mappings | SongMapping | ✓ |
| 10 | 4.10 | revenue_imports | RevenueImport | ✓ |
| 11 | 4.11 | revenue_rows | RevenueRow | ✓ |
| 12 | 4.12 | settlements | Settlement | ✓ |
| 13 | 4.13 | admin_roles | AdminRole | ✓ |
| 14 | 4.14 | admin_users | AdminUser | ✓ |
| 15 | 4.15 | distributions | Distribution | ✓ |
| 16 | 4.16 | operation_logs | OperationLog | ✓ |

### B. 代码额外存在但 PRD 未列（6 张）

| # | 表名 | Prisma 模型 | 对应 PRD 功能 | 备注 |
|---|------|-------------|--------------|------|
| 17 | cms_contents | CmsContent | §7.3.16 内容管理 / §7.1.6 课程中心 | PRD 功能提到但未定义表结构 |
| 18 | learning_records | LearningRecord | §7.1.6 我的学习 | 已在 P2-1 实现（commit 91c3c58） |
| 19 | system_settings | SystemSetting | §7.3.17 系统设置 | key-value JSON 存储 |
| 20 | notifications | Notification | §7.1.6 消息中心 / §7.1.1 最新动态 | PRD 提 notifications 表但未定义结构 |
| 21 | sms_codes | SmsCode | §1.3 注册 / §E 重置密码 | 认证基础表 |
| 22 | login_logs | LoginLog | §7.1.6 登录日志 | 创作者/评审端个人中心 |

**结论**：PRD §4 标题"数据模型（15张表）"应修正为 **22 张**（或至少 16 张主数据+6 张支撑）。CLAUDE.md 的 "20 张" 估算偏少。

---

## 二、字段级关键差异（按风险分级）

### 🔴 高风险（需立即对齐）

| 表 | 字段 | PRD 定义 | 代码实现 | 风险 / 建议 |
|----|------|---------|---------|------------|
| operation_logs | id | `BIGINT PK` | `Int @id` | **溢出风险**：Int 最大 21 亿条；高频写入下 5-10 年即可能触顶。建议迁移为 BigInt |
| settlements | total_revenue | `DECIMAL(12,2)`（非空，推算） | `Decimal? @db.Decimal(12,2)` | PRD §4.12 未标 NULLABLE，但推算应当非空；代码允许 NULL，SQL 聚合时需防御性处理 |
| settlements | creator_amount | `DECIMAL(12,2) = total_revenue × creator_ratio` | `Decimal? @db.Decimal(12,2)` | 同上，且 PRD 明确给了计算公式，应当在应用层写入时保证非空 |
| settlements | creator_id | `NOT NULL` | `Int @map("creator_id")` 非空 ✓ | **但** PRD §4.12 规则"仅当 song_mappings.status=confirmed 且 creator_id 非空时生成"——约束在应用层，DB 层无法强制 |

### 🟡 中风险（实现和 PRD 语义有偏差）

| 表 | 字段 | PRD 定义 | 代码实现 | 说明 |
|----|------|---------|---------|-----|
| users | id_card | `VARCHAR(18)` | `VARCHAR(128)` | 代码预留了加密后长度（合理），但 PRD 未体现加密带来的字段膨胀 |
| platform_songs | performer | 默认实名 | 无 `@default` | **未在 DB 层实现默认值**，需应用层写入时填充 real_name；测试用例 TC-C-02-022 需调整描述 |
| platform_songs | lyricist / composer | 默认实名 | 无 `@default` | 同上 |
| platform_songs | album_name | 默认同标题 | 无 `@default` | 同上 |
| platform_songs | album_artist | 默认实名 | 无 `@default` | 同上 |
| platform_songs | score | `TINYINT UNSIGNED (0-255)` | `Int? @db.TinyInt`（-128~127）| Prisma 不支持 UNSIGNED，业务分数 0-100 范围够用，但类型含义不一致 |
| platform_songs | version | `TINYINT` | `Int @db.TinyInt` | 同上 |
| revenue_imports | period | `VARCHAR(50)`（无显式 NULL 标记） | `String? @db.VarChar(50)` | 代码可空，PRD 推算应非空 |
| distributions | platform | `VARCHAR(50)` | `String @db.VarChar(50)` | 两端一致，但 PRD 附录 D 未定义枚举，实现用了自由字符串，**和发行渠道管理的"字段映射配置"联动时需约束** |

### 🟢 低风险 / 改进性差异

| 表 | 字段 | PRD | 代码 | 说明 |
|----|------|-----|------|-----|
| platform_songs | **audio_features** | PRD 无此字段 | `Json?` | 对应 §7.2.3 AI 预分析报告缓存；建议 PRD 补充 |
| Contribution enum | `主导` / `参与` | `lead` / `participant` | ✓ 实现正确，英文枚举+前端 i18n 显示中文 |
| users | admin_level | `ENUM` NULLABLE | `AdminLevel?` | 一致 |
| admin_users | status | `BOOLEAN DEFAULT TRUE` | `Boolean @default(true)` | 一致；但 users.status 用的是 ENUM('active','disabled')，**两张账号表状态字段类型不统一** |
| notifications | 结构 | PRD 未定义 | 代码：userId / type(VARCHAR30) / title / read | 字段较简陋：**缺 target_id（消息关联的目标对象）、缺 content 正文** |

---

## 三、枚举差异汇总

| 枚举 | PRD 附录 D | 代码 | 一致性 |
|------|-----------|------|-------|
| SongStatus | pending_review → needs_revision → reviewed → ready_to_publish → published → archived | 同 | ✓ |
| SongSource | upload / assignment | 同 | ✓ |
| RealNameStatus | unverified / pending / verified / rejected | 同 | ✓ |
| MappingStatus | confirmed / suspect / pending / irrelevant | 同 | ✓ |
| MatchType | auto_exact / auto_fuzzy / manual / none | 同 | ✓ |
| SettleStatus | pending / confirmed / exported / paid / exception | 同 | ✓ |
| DistributionStatus | pending / submitted / live / failed | 同 | ✓ |
| AssignmentStatus | draft / active / closed | 同 | ✓ |
| RowMatchStatus | matched / suspect / unmatched / duplicate / irrelevant | 同 | ✓ |
| UserType | creator / reviewer | 同 | ✓ |
| AdminLevel | group_admin / system_admin | 同 | ✓ |
| FieldType | text / textarea / multi_select | 同 | ✓ |
| Recommendation | strongly_recommend / recommend_after_revision / not_recommend | 同 | ✓ |
| RevenuePlatform | qishui / qq_music / netease / spotify / apple_music / kugou | 同 | ✓ |
| ImportStatus | processing / completed / failed | 同 | ✓ |
| ContentType | video / article | 代码独有 | — |
| ContentStatus | **published / draft** | 代码独有 | ⚠️ 与 PRD §7.3.16 "下架"动作不对应，应补 `archived` |

**注意**：ContentStatus 缺少 `archived` 枚举值，但 PRD §7.3.16 / TC-A-16-009 测试"下架"。**实际下架如何落盘？** 需确认：下架 = status 改 draft？还是新增 archived？

---

## 四、索引差异

代码已落实 PRD §10.1 建议的核心索引：

| 表 | PRD 建议索引 | 代码实际 |
|----|-------------|---------|
| platform_songs | `(user_id, status)` / `(status, created_at)` / `(assignment_id)` | 全部落地 ✓ |
| reviews | `(song_id, version)` / `(reviewer_id, reviewed_at)` | 全部落地 ✓ |
| revenue_rows | `UNIQUE(qishui_song_id, period)` / `(import_id)` / `(match_status)` | 全部落地 ✓ |
| settlements | `(creator_id, settle_status)` / `(qishui_song_id)` | 全部落地 ✓ |
| song_mappings | `UNIQUE(qishui_song_id)` / `(status)` / `(creator_id)` | 全部落地 ✓ |
| assignment_submissions | `UNIQUE(assignment_id, user_id)` / `(assignment_id, status)` | 全部落地 ✓ |
| operation_logs | `(created_at)` / `(operator_id, created_at)` | 全部落地 ✓；但未分区 |

---

## 五、对已有测试用例的影响（修正点）

| 用例 | 原描述 | 修正描述 |
|------|-------|---------|
| TC-C-02-022 | 词作者/曲作者 **默认填充实名** | 改为："提交时后端自动填入 real_name（DB 无 @default，应用层保证）" |
| TC-C-02-023 | 实名为空时字段为空 | 同上：应用层按 real_name 当前值填充，空则为空 |
| J-1~J-3 补充用例 | DB 默认值 | 改为"API 层默认值策略" |
| TC-A-16-009 CMS 下架 | `status=archived` | **与代码不符**：代码无 archived 枚举，实际可能是 status=draft。需和开发确认 |
| TC-A-18-016 | 游标分页支持 10 万条 | **遇溢出风险**：operation_logs.id 是 Int，21 亿条后溢出；建议先迁 BigInt |
| TC-BD-006 未实名阻断打款 | `users.real_name_status≠verified` | 代码已通过枚举约束，用例无需改，但**实现层校验必须显式**（数据库无约束） |

---

## 六、建议的代码/PRD 修正行动

### 需修改 PRD（交给产品）

1. §4 标题"15 张表" → "22 张表"（或主表 16 + 运营 6）
2. §1.4 "26 项" → "31 项"
3. §4.4 补充 `audio_features` 字段说明
4. §4.2 `id_card VARCHAR(18)` → `VARCHAR(128)`（加密后）
5. §4.12 settlements 明确 `total_revenue / creator_amount` 可空性
6. §4.16 operation_logs 明确保留 `BIGINT`
7. 统一命名：作品上传 vs 自由上传、我的收益 vs 收益查询、课程中心 vs 课程学习
8. 补充 notifications / cms_contents / learning_records / login_logs / system_settings 的结构定义

### 需修改代码（交给开发）

1. **operation_logs.id 改为 BigInt**（或现在就改，迁移成本低）
2. **settlements.total_revenue / creator_amount 改为非空**（配合 CHECK 约束）
3. **ContentStatus 补 `archived` 枚举值**，明确下架语义
4. **notifications 表补 target_id / content 字段**，支撑 PRD §7.1.1 动态跳转
5. 在 `@default` 或应用层明确实现 platform_songs 的各"默认实名/同标题"字段填充
6. users.status 与 admin_users.status 类型统一（建议都用 Boolean 或都用 Enum）

---

## 七、下一步

本差异报告完成后：
1. 下个动作：基于修正后的 schema 补 P0 用例 → `05-supplement-p0.md`（已规划 40+ 条）
2. 将 §六 的代码建议做成独立 issue 清单，交开发确认
