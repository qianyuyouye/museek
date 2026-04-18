# 测试执行最终报告 · 2026-04-18（终版）

**测试基准**：`docs/test-cases/*.md`（820 条）+ PRD v5.2
**工具**：Playwright MCP + curl + MySQL 直连 + Prisma db push 修复
**账号**：admin/Abc12345、张小明 13800001234、刘老师 13500008888（统一 Abc12345）

---

## 执行统计

| 模块 | 用例 | 通过 ✅ | 缺陷 ❌ | 偏差 ⚠️ |
|------|-----|---------|---------|---------|
| 00-common-auth | 44 | 30 | 4 | 4 |
| 01-creator | 105 | 94 | 2 | 6 |
| 02-reviewer | 54 | 50 | 0 | 2 |
| 03-admin 核心 | 160 | 118 | 7 | 19 |
| 收益 CSV E2E | 22 | 19 | 1 | 2 |
| 安全 | 14 | 10 | 1 | 3 |
| 权限粒度 | 8 | 0 | 1 | 0 |
| 性能+分页 | 8 | 8 | 0 | 0 |
| 作业 E2E | 14 | 10 | 2 | 2 |
| 实名/禁用/协议 | 14 | 14 | 0 | 0 |
| ISRC/发行/归档 | 12 | 10 | 0 | 2 |
| 系统设置/CMS/角色 | 22 | 18 | 2 | 2 |
| 映射/跨批次/irrelevant | 9 | 9 | 0 | 0 |
| 文件上传安全 | 6 | 6 | 0 | 0 |
| **合计** | **492** | **396** | **20** | **42** |

**通过率**：396/492 = **81%**
**覆盖率**：492/820 = **60%**

---

## ❌ 20 个实现缺陷

### 🔴 P0 致命（3 条，上线前必修）

| # | 用例 | 描述 | 建议修复 |
|---|------|------|---------|
| 1 | TC-SUPP-A1 | **权限系统形同虚设**：`requireAdmin` 仅校验 portal，不看 role.permissions。viewer_test 可访问所有管理 API | 把 `requireAdmin` 改成 `requirePermission(key)`，按 role.permissions 校验 |
| 2 | TC-SUPP-I-006 | **CSRF 未防护**：恶意 Origin 跨域 POST 成功创建组 | 加 Origin/Referer 校验中间件 或 CSRF token |
| 3 | CSV 千分位 | **收益 99% 丢失**：`"1,234.56"` 入库为 `1.00` | `parseFloat(v.replace(/,/g,''))` |

### 🟠 P0 核心业务（7 条）

| # | 用例 | 描述 |
|---|------|------|
| 4 | TC-AUTH-006 | 已注册手机号仍可 `sms/send` 200 |
| 5 | TC-AUTH-016 | 密码 `abcdefgh` 纯字母能注册（缺字母+数字组合） |
| 6 | TC-A-06-027 | "绑 ISRC" UI 按钮点击无反应（API 正常） |
| 7 | TC-A-11-001 | 管理端 /teachers 统计全 0（DB 实际 5 条；评审端自己看正常） |
| 8 | TC-A-16 | CMS 新建表单缺"封面"字段（PRD §7.3.16） |
| 9 | TC-C-03-017 | `needs_revision` 作业不能重提：`submit/route.ts:47` 无条件阻断"不允许重复提交" |
| 10 | TC-A-13-013 | **超管唯一性未防**：直接 POST 成功创建第 2 个超管 |

### 🟡 P1 重要（7 条）

| # | 用例 | 描述 |
|---|------|------|
| 11 | TC-AUTH-065 | 无错误次数锁定 |
| 12 | TC-AUTH-066 | 无 IP 限流（PRD §10.6 10 次/分） |
| 13 | TC-AUTH-010 | HTTP 200 + body.code=400 不一致 |
| 14 | TC-A-15-020 | `?status=all` 后端 400，前端拿不到映射列表 |
| 15 | TC-A-15-040 | 多维统计 抖音+汽水 ≠ 合计 |
| 16 | TC-A-06-010~012 | 歌曲库搜索/流派/AI工具筛选**后端未实现** |
| 17 | TC-A-13 | DELETE /admin/admins/{id} 路由缺失（405），管理员创建后无法删 |

### 🟢 P2 体验/非关键（3 条）

| # | 用例 | 描述 |
|---|------|------|
| 18 | TC-BD-015 | 并发评审同首作品：一条 200 + 一条 **500**（应 400/409） |
| 19 | TC-A-16 | CMS `status=archived`（非法枚举）返回 500（应 400） |
| 20 | TC-C-04 | 波形 SVG `<rect height=-1.3>` 负值 console 持续报错 |

---

## ⚠️ 42 个偏差（需对齐）

### A. PRD 文档错误（7）
1. §1.4 "26 项" → 实际 31 项（8+5+18）
2. §4 "15 张表" → 实际 22 张
3. §7.3.15 "5 模块" → 实际 6 Tab
4. §4.4 contribution 中文引号写法
5. 命名混用：作品上传/自由上传、我的收益/收益查询、评审绩效/老师绩效
6. TC-AUTH-035 预期文案"账号与端不匹配"；实际"账号或密码错误"（更安全）
7. TC-C-07-007 防刷要求未在 PRD 明确

### B. UI 交互（14）
8. 后端 4xx 前端无 toast（组名空/邀请码冲突/发行阻断/CMS 空提交）
9. 登出 3s 二次确认（PRD 未描述）
10. ISO 时间未本地化（发行时间、创建时间、作业截止、ISRC 回填时间等 7+ 处）
11. 运营看板卡片未按 PRD 分栏
12. 用户档案"共 4 名创作者"混入评审账号
13. 管理端"评审绩效"标题叫"老师绩效"
14. operation_logs action 中英混用（song_publish vs 确认发行）
15. 超管权限数显示"0 项"易误导
16. 首页 4/4 vs 我的学习 0/0 语义冲突
17. 评审加权总分 UI 75.5 vs DB 76 不一致
18. 批量下载 Tab 用 combobox
19. 管理端"忘记密码？联系超级管理员"纯文本无链接
20. 重置密码返回明文（需要安全考量）
21. 作品广场 Tab 名略异

### C. 数据一致性（10）
22. 待评审列表/批量下载 AI 工具列空
23. 映射 bind 不自动 confirm（需二次 action=confirm）
24. 评审 duration_seconds 未记录（0.0h）
25. 注册 3 个协议 Checkbox vs PRD 1 个
26. learning_records 表初始未建（`prisma db push` 遗漏），已修复
27. CMS 下架是 status=draft（无 archived 枚举）
28. CMS 新建类型视频时未有独立 URL 字段
29. 分成规则 API 字段：`revenue_rules` vs UI 称 `commission_rules`
30. 密码强度仅校验长度
31. 重置密码 API 字段是 `password` 不是 `newPassword`（前后不一致）

### D. 接口规范（8）
32. /api/admin/songs 查询不支持 genre/search/aiTool 筛选
33. /api/admin/revenue/mappings?status=all 400（应接受 "all"）
34. /api/admin/contracts 不存在（前端直接生成 CSV）
35. DELETE /api/admin/admins/{id} 未实现
36. 验证码 HTTP 200 + body 400 (多处)
37. /api/admin/isrc 单独路由不存在（用 /api/admin/songs/:id/isrc）
38. 上传 token body 字段命名差异（fileSize/type vs kind）
39. 评审提交撤销（revoke）未实现（PRD 也没要求）

### E. 其他（3）
40. 身份证 DB 种子 NULL，通过 API 创建才加密
41. XSS DB 存原始 HTML（React 转义安全）
42. 某些列表接口无 `total` 字段结构

---

## ✅ 已跑通的完整主链路（15 条）

1. **评审→发行闭环**：91 分强推→ready_to_publish→三条件校验→published→operation_logs
2. **状态机全 4 链**：pending→reviewed/ready_to_publish；ready→published；published→archive→restore(reviewed)；needs_revision 阻断 publish
3. **CSV 4 行导入**：3 match + 1 unmatched + 跨批次 duplicate（除千分位 bug）
4. **映射 pending→bind→confirm 回溯**：新增 1 条历史 settlement
5. **结算 4 步流转**：pending→confirmed→exported→paid
6. **未实名阻断打款**：明确提示创作者姓名
7. **分成比例 3 规则应用**：91→80%、83→70% 老规则、83→60% 新规则
8. **规则不追溯**：历史结算比例不变，新 settlement 用新规则
9. **用户组 + 邀请码 + 注册 API**：E2ETEST1 组 + 4 创作者注册
10. **水平越权阻断**：张小明访问他人作品 403
11. **对账同步**：autoConfirmed=3
12. **权限系统正面项**：SQL 注入参数化、XSS React 转义、路由 307、伪造 JWT 401、跨端 401
13. **分页边界**：pageSize>100→100, page<1→1
14. **性能 SLA**：作品库 <100ms、看板 <400ms
15. **身份证 AES-256-GCM 加密**：明文→64 字节密文
16. **文件上传校验**：格式/大小/未登录全部生效
17. **操作日志覆盖 28 种 action**：P2-2 承诺达成
18. **Session 超时 + Token 刷新**：过期 401、refresh 续签

---

## 关键建议

### 🔴 立即修（上线前必过）
1. **权限系统 API 级校验**（`requirePermission` 替代 `requireAdmin`）
2. **CSRF 防护**（中间件 + CSRF token）
3. **CSV 千分位解析**（1 行代码）
4. **超管唯一性**（POST /admins 前判断 roleId=1 只剩 1 位时阻断）
5. **密码强度字母+数字**
6. **作业重提条件**（`if (existing.status !== 'needs_revision') return err`）

### 🟠 业务修复
7. **管理端评审绩效统计查询**修 bug（DB 有数据 UI 显示 0）
8. **绑 ISRC 前端按钮**修触发
9. **已注册手机号 sms/send 阻断**
10. **CMS 封面字段** + **非法 status 改 400**

### 🟡 PRD 同步
11. 7 条 PRD 文档错误批量修正
12. 命名统一（作品上传/我的收益/评审绩效）

### 🟢 UI 通用改进
13. 全局 toast 组件处理后端 4xx
14. 时间本地化工具函数
15. 运营看板分栏

---

## 剩余未测（约 330 条，40% 未覆盖）

主要在：
- 作业深度（动态字段类型 / version++ / 成员列表）
- ISRC 完整申报 → 回填 Excel 批量
- 发行渠道矩阵交互（UI 单元格点击）
- CMS 富文本编辑器 / 视频上传
- 用户档案详情完整操作
- 查询多条件组合（搜索+筛选+排序）
- 大数据量游标分页（operation_logs 10 万条）
- 性能压测 / 限流压力
- 异常恢复（导入失败回滚、幂等重试）
- E2E Phase 5 对账同步完整（含无数据 30 天异常队列）
- 前端所有 UI 交互（tab 切换、表单 onBlur）

建议下一轮**先修 P0 再回归**，而不是继续覆盖 —— 边改代码边重测更稳。

---

## 相关文档

- 测试用例总表：`docs/test-cases/*.md`（820 条）
- 遗漏清单：`docs/test-cases/GAPS.md`
- Schema 差异：`docs/test-cases/SCHEMA-DIFF.md`
- 执行流水：`docs/test-cases/runs/2026-04-18/run-log.md`
- 本报告：`docs/test-cases/runs/2026-04-18/FINAL-REPORT.md`
