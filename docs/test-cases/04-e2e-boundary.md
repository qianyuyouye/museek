# 端到端流程 & 边界场景测试用例

覆盖 PRD §2（七阶段生命周期）、§3（状态机）、§6（收益导入算法）、§8（边界场景）。
这部分用例跨多端、跨多表，验证各模块协作后的整体闭环。

## 通用约定

- 每个 E2E 用例含明确的**起点状态 → 终点状态**，中间所有副作用均需校验
- 失败要有快速定位信息：提供受影响的表 + 字段 + 典型 SQL

---

## A. 端到端：自由上传闭环（Phase 2→3→4→5→6→7）

**起点**：创作者账号 ready，实名 unverified，未签协议。
**终点**：作品 `published`，创作者能看到汽水收益（有则）。

| 用例 ID | 节点 | 步骤 | 预期结果 |
|--------|------|------|---------|
| TC-E2E-001 | 前置：实名 | 创作者提交实名 → 管理员审核通过 | `real_name_status=verified` |
| TC-E2E-002 | 前置：签协议 | 个人中心签代理协议 | `agency_contract=true` |
| TC-E2E-003 | Phase 2 上传 | 3 步上传提交 | `platform_songs` 新增；状态 `pending_review`；版权编号 `AIMU-YYYY-NNNNNN` |
| TC-E2E-004 | Phase 3 评审 | 评审员强推 + 85 分 | `status=ready_to_publish`；`score=85`；新增 reviews 记录 |
| TC-E2E-005 | Phase 4 ISRC | 管理员在 ISRC 管理提交申报 → 回填 | `platform_songs.isrc` 填充 |
| TC-E2E-006 | Phase 4 发行 | 歌曲库管理点"确认发行" | 三条件校验通过 → `status=published`；operation_logs `song.publish` |
| TC-E2E-007 | Phase 5 确认上架 | 发行状态确认页 → 手动确认 / 对账同步 | distributions 相应平台 `status=live` |
| TC-E2E-008 | Phase 6 收益导入 | 管理员上传含本歌 CSV | `revenue_rows` 新增；自动/人工映射 confirmed；`settlements` 生成 |
| TC-E2E-009 | Phase 6 结算状态流转 | confirmed → exported → paid | 打款前校验实名（已过），推进到 `paid` |
| TC-E2E-010 | Phase 7 创作者看到 | 创作者端"我的收益" | Tab 1 看到平台结算；Tab 2 看到汽水明细（无 qishui_song_id 字段） |

---

## B. 端到端：作业闭环

| 用例 ID | 节点 | 步骤 | 预期结果 |
|--------|------|------|---------|
| TC-E2E-020 | 管理员建作业 | 选组、填标题、截止日期、⚙️ 表单配置 | `assignments` 新增 `status=active`；`form_field_configs` 更新 |
| TC-E2E-021 | 创作者首页提示 | 有未提交作业 | 首页置顶未完成作业卡 |
| TC-E2E-022 | 创作者提交 | 作业页提交 | `platform_songs` 新增 `source=assignment, assignment_id`；`assignment_submissions` 新增；`submission_count+=1` |
| TC-E2E-023 | 评审流程 | 评审"建议修改" | 歌曲 → `needs_revision`；学员端可见 |
| TC-E2E-024 | 重新提交 | 创作者重提 | `assignment_submissions` 更新（不新增），UNIQUE(assignment_id,user_id) 生效；`platform_songs.version+=1`, score 清空；旧 reviews 保留 |
| TC-E2E-025 | 再次评审 | 强推+85 | 直接 `ready_to_publish`；reviews 记录 version=2 |
| TC-E2E-026 | 后续发行 | 同 TC-E2E-005~007 | 同上 |

---

## C. 端到端：映射回溯

背景：先收到收益，后提交作品（PRD §8）

| 用例 ID | 节点 | 步骤 | 预期结果 |
|--------|------|------|---------|
| TC-E2E-030 | 先导入 CSV | 包含 `qishui_song_id=7604694...` 名为"测试歌" | `revenue_rows` 新增；无匹配 → 映射 `(none, pending)` |
| TC-E2E-031 | 创作者随后上传 | 歌名"测试歌" | 作品入库 |
| TC-E2E-032 | 管理员关联 | 映射管理→待匹配→点击"关联作品"选该作品 | 映射 `status=confirmed`, `match_type=manual`, `creator_id` 自动填 |
| TC-E2E-033 | 回溯触发 | 观察 settlements | 历史 `revenue_rows` 批量生成 `settlements`；`match_status` 由 `unmatched` → `matched` |
| TC-E2E-034 | 分成比例 | 查看生成的 settlement | 按当前规则评估（默认 70/30，或按实际评分/累计） |
| TC-E2E-035 | 创作者查收益 | 创作者端刷新 | 平台分发收益 Tab 1 显示新生成的结算 |

---

## D. 端到端：发行三条件阻断

| 用例 ID | 节点 | 步骤 | 预期结果 |
|--------|------|------|---------|
| TC-E2E-040 | 缺协议 | 作品 `ready_to_publish`，创作者未签协议，管理员点发行 | Toast "发行失败：未签署代理发行协议"；状态不变 |
| TC-E2E-041 | 创作者签协议后 | 重试发行 | 若实名/ISRC 有，则成功 |
| TC-E2E-042 | 缺实名 | 协议已签但未实名 | Toast "发行失败：未完成实名认证" |
| TC-E2E-043 | 实名审核通过后 | 重试发行 | 若 ISRC 有，则成功 |
| TC-E2E-044 | 缺 ISRC | 协议/实名齐全，ISRC 为空 | Toast "请先绑定 ISRC 码" |
| TC-E2E-045 | ISRC 回填后 | 重试发行 | 成功 `published` |
| TC-E2E-046 | 三者全缺 | 均缺 | 按顺序提示（或合并提示）；状态不变 |

---

## E. 端到端：归档与恢复

| 用例 ID | 节点 | 步骤 | 预期结果 |
|--------|------|------|---------|
| TC-E2E-050 | 已发行归档 | 管理员点"归档" | `status=archived`；创作者端"已入库"Tab 仍可见；作品广场不展示 |
| TC-E2E-051 | 归档卡片角标 | 创作者端查看 | 角标"已归档"（非"已入库"） |
| TC-E2E-052 | 归档后收益 | 检查 settlements | 不受影响，既有/新生成均正常 |
| TC-E2E-053 | 恢复 | 管理员点"恢复" | `status=reviewed`；创作者端角标变回 |
| TC-E2E-054 | 恢复后再发行 | 歌曲库管理点"手动发行" | 校验三条件 → `published` |

---

## F. 端到端：映射解除与重新关联

| 用例 ID | 节点 | 步骤 | 预期结果 |
|--------|------|------|---------|
| TC-E2E-060 | 映射已 confirmed | 已有 settlement（未打款） | 初始状态 |
| TC-E2E-061 | 解除映射 | 管理员点"解除" | 映射软删除；相关 `settlements.status=exception` |
| TC-E2E-062 | 重新关联到新创作者 | 新建映射 | 新 settlement 按新创作者生成；旧 exception 需人工处理 |
| TC-E2E-063 | 已打款的历史 | 查看已 paid settlement | 不变（不追溯），保持历史 |

---

## G. 端到端：分成比例规则优先级

| 用例 ID | 场景 | 作品最新 total_score | 创作者累计发行 | 预期 creator_ratio |
|--------|------|---------------------|---------------|------------------|
| TC-E2E-070 | 高分激励 | 92 | 3 | 0.80 |
| TC-E2E-071 | 量产奖励 | 75 | 12 | 0.75 |
| TC-E2E-072 | 默认 | 70 | 5 | 0.70 |
| TC-E2E-073 | 高分+量产 | 95 | 15 | 0.80（高分优先级最高） |
| TC-E2E-074 | 边界：刚好 90 分 | 90 | 2 | 0.80 |
| TC-E2E-075 | 边界：刚好 10 首 | 70 | 10 | 0.75 |
| TC-E2E-076 | 规则调整不追溯 | 设置中改默认为 60/40，查看已生成 | 老结算仍 0.70 |

---

## H. 边界场景（PRD §8）

| 用例 ID | 场景 | 步骤 | 预期结果 |
|--------|------|------|---------|
| TC-BD-001 | 先有收益后有提交 | 导入 CSV 时 qishui_song_id 未匹配 → 创作者后续提交 → 管理员手动关联 | 回溯生成历史结算 |
| TC-BD-002 | 汽水歌名与平台歌名不一致 | CSV 中歌名"M1 - Demo"，平台歌名"Demo" | 首次未命中 `pending`；管理员手动匹配；下次导入自动命中 |
| TC-BD-003 | 不属于本平台的歌曲 | CSV 含无关 qishui_song_id | 管理员标记 `irrelevant`；后续导入自动跳过 |
| TC-BD-004 | 一首歌多月收益 | 同 qishui_song_id 不同 period | 映射表一条；多条 revenue_rows 均生成 settlement |
| TC-BD-005 | 同名歌曲不同创作者 | CSV 歌名匹配出两条平台作品 | `suspect`；等待人工确认，不自动生成 settlement |
| TC-BD-006 | 创作者未实名 | 生成 settlement；尝试打款 | 阻断于 `paid` 状态；管理员提示先审实名 |
| TC-BD-007 | 创作者账号禁用 | 已生成 settlement；尝试打款 | status 停在 confirmed/exported，不推进 paid |
| TC-BD-008 | 跨批次重复行 | 不同批次相同 `(qishui_song_id, period)` | UNIQUE 约束生效，第二批次标 `duplicate` |
| TC-BD-009 | 评审总分刚好 80 分 + 强推 | 总分=80，strongly_recommend | 进 `ready_to_publish`（含 80） |
| TC-BD-010 | 评审总分 79 + 强推 | 总分=79 | 进 `reviewed`（不进 ready_to_publish） |
| TC-BD-011 | 同作业重复提交 | 直连接口 2 次 | UNIQUE(assignment_id,user_id) 生效，第二次更新非新增 |
| TC-BD-012 | 发行时 ISRC 未绑 | 点确认发行 | 阻断 toast；不写发行记录 |
| TC-BD-013 | 结算金额为 0 | CSV total_revenue=0 | 仍生成 settlement；status=confirmed；不触发打款 |
| TC-BD-014 | 映射解除后重新关联 | 见 TC-E2E-060~063 | 旧 settlement exception；新 settlement 重新生成 |
| TC-BD-015 | 并发评审同一首 | 两位评审同时提交 | 后者返回冲突；仅一条 reviews 记录；状态流转幂等 |
| TC-BD-016 | CSV 编码 GBK | 上传 GBK 编码文件 | 自动识别，正确解析中文歌名 |
| TC-BD-017 | CSV 包装数字超长 | `="76046947..."`（20 位） | 正确去除包装，入库 VARCHAR(30) 无截断 |
| TC-BD-018 | CSV 总收入校验异常 | col7 ≠ col5+col6 | 标记异常行，导入报告提示，不阻塞其他行 |
| TC-BD-019 | 已发行作品评审异常 | 已 published 再打开评审（异常路径） | 阻断或返回 404 |
| TC-BD-020 | 禁用管理员登录 | admin_users.status=false 持有 token | 下次请求 401，立即踢出 |
| TC-BD-021 | 跨年版权编号 | 2026-12-31 23:59 提交 1 条，2027-01-01 00:01 提交 1 条 | 编号年份切换，NNNNNN 重新从 000001 开始 |
| TC-BD-022 | 创作者删除后日志 | 创作者账号逻辑删除后查看 operation_logs | `operator_name` 冗余字段仍显示 |
| TC-BD-023 | 超管降权 | 尝试删除或降级唯一超管 | 阻断，至少保留一位 |
| TC-BD-024 | 权限即时生效 | 修改某管理员角色权限后，在该管理员页面上点击无权菜单 | 下次请求 403，菜单隐藏（前端可能需刷新） |
| TC-BD-025 | Session 并发挤占 | multi_login=false，两处登录 | 后登录挤掉前，前 session 下次请求 401 |

---

## I. 性能与 SLA（PRD §10）

| 用例 ID | 场景 | 步骤 | 预期结果 |
|--------|------|------|---------|
| TC-BD-030 | 普通查询 | 作品库 20 条列表 | 响应 < 200ms |
| TC-BD-031 | 复杂统计 | 运营看板首次访问 | 响应 < 1s；缓存后 < 100ms |
| TC-BD-032 | CSV 导入 | 1000 行 | 异步任务 < 30s 完成 |
| TC-BD-033 | 批量下载大文件 | 勾选 100 首，触发打包 | 后台异步；完成推送；URL 有效期 24h |
| TC-BD-034 | 分页游标 | operation_logs 10 万条第 1000 页 | 使用游标分页，无 OFFSET 退化 |
| TC-BD-035 | 登录限流 | 单 IP 每分钟 11 次登录 | 返回 429 |
| TC-BD-036 | API 限流 | 同 IP 每分钟 61 次 | 返回 429 |
| TC-BD-037 | 音频签名 URL | 过期 URL 访问 | 403 | 

---

## J. 数据隔离

| 用例 ID | 场景 | 步骤 | 预期结果 |
|--------|------|------|---------|
| TC-BD-040 | 创作者看他人作品 | 构造他人 songId 访问 /creator/songs/:id | 403 或 404 |
| TC-BD-041 | 创作者看他人收益 | 构造接口参数 | 响应过滤为空 |
| TC-BD-042 | 评审看不到元数据编辑 | 评审端查看 | 无编辑按钮；接口 403 |
| TC-BD-043 | 非超管看操作日志 | 普通管理员 role 无 `admin.logs.view` | 菜单隐藏，接口 403 |
| TC-BD-044 | 汽水 ID 对创作者不可见 | 抓包 Tab 2 收益接口响应 | 响应体不含 `qishui_song_id` |
| TC-BD-045 | 跨组作业 | 创作者访问不属组的作业 ID | 接口过滤 |

---

## 执行顺序建议

1. 先跑 `00-common-auth.md` 建立基础账号
2. 跑 `03-admin.md` 的"用户组管理"创建组+邀请码
3. 跑 `01-creator.md` 注册+上传
4. 跑 `02-reviewer.md` 评审
5. 跑 `03-admin.md` 剩余模块
6. 最后跑本文件 E2E 验证闭环

运行记录建议保存至 `docs/test-cases/runs/YYYY-MM-DD/`。
