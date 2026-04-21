# 用户回归时反馈的 3 个问题（Batch 1A 验收期间，2026-04-20）

补充到 `platform-alignment-gap-list.md`（252 清单）。已对照 `gap-admin.md` / `gap-creator.md`，标注是否命中现有 GAP 或需新建。

---

## 1. 管理端内容管理：视频类型无上传框 + 内容区无富文本

**用户原话：** "创建内容如果选择了视频分类是无法上传的目前只有图文，但是下面也不是富文本编辑窗口"

**命中已有 GAP：**
- `GAP-ADMIN-068`（P1，残缺）— 创建/编辑表单缺 `videoUrl` 输入（schema 已有字段，API 已支持）
  - 位置：`admin/content/page.tsx:344-407`
  - 补齐动作：类型=video 时显示"视频 URL"input
- `GAP-ADMIN-069`（P2，残缺）— 新建/编辑内容无「作者/发布时间/标签/摘要」字段（PRD §7.3.16）

**新增（未在清单）：**
- 用户额外提"不是富文本编辑窗口"。当前 `<textarea>` 写 plain text 到 `cms_contents.content`。
  - 建议：是否引入富文本（TipTap / Markdown + preview）需 PRD 明确。schema 可能需从 `Text` 改结构（html/json）。**暂不在 P0/P1 范围，先登记**。

---

## 2. 合同台账：三协议 tab 无模板上传/编辑入口

**用户原话：** "合同台账几个对应签署的文档没有对应上传和编辑文档的地方"

**命中已有 GAP（3 条 P2）：**
- `GAP-ADMIN-052`（P2）— 协议版本硬编码 `v1.0`，无版本管理表/字段
- `GAP-ADMIN-054`（P2）— 用户服务协议/隐私政策 Tab 没有独立签署字段，复用 `agencyContract` 导致三 Tab 数据一样
- `GAP-ADMIN-055`（P2）— 无下载/预览 PDF 入口

**新增（未在清单）：**
- **合同模板 CRUD 完全缺失**：
  - schema 无 `contract_templates` / `user_agreements` 表
  - admin 无法上传/编辑 3 类协议（代理发行 / 用户服务 / 隐私政策）模板 PDF 或正文
  - 用户签约时不记录签的是哪一版（无 version_signed 字段）
- 建议：合并成新 GAP `GAP-ADMIN-NEW-CONTRACT-TEMPLATES`，优先级 **P1**（治理/合规相关，比 UI 残缺重）

---

## 3. 总管理员后台：创作者端无创建入口

**用户原话：** "总管理员后台可以创建用户，可以给三个端都创建"

**命中已有 GAP：** 无（gap-admin.md / gap-creator.md 都未记录）

**新增：**
- `GAP-ADMIN-NEW-CREATE-CREATOR`（建议 P1，无头入口 / 功能缺）
- 现状：
  - admin ✅ `POST /api/admin/admins` + `/admin/admins` UI
  - reviewer ✅ `POST /api/admin/accounts/create-reviewer` + `/admin/accounts` reviewer tab 创建按钮
  - **creator ❌ 无 API，无 UI**，只能走自助注册（手机号 + 短信码 + 邀请码 4 要素）
- 补齐动作：
  1. 新增 `POST /api/admin/accounts/create-creator`（参考 `create-reviewer`，必填 name/phone/password/groupId）
  2. `admin/accounts/page.tsx:333` 条件从 `tab === 'reviewer'` 放开到两 tab，加 creator 创建 Modal
- 影响：admin 目前无法代新用户开户 / 批量拉新 / 客服代建

---

## 后续处理建议

- **#1 的 videoUrl 部分（GAP-ADMIN-068）+ #3（创建 creator）** 都是一小时级独立 fix，建议并入主题 2（通知）或主题 3（权限）的 batch plan 顺手做；
- **#2（合同模板管理）** 需先补 schema（contract_templates + user_agreements）+ 定义 PRD 行为（是否版本升级后强制重签），建议独立 plan；
- **#1 的富文本** 纯 PRD 决策项，等 v6.0 明确。
