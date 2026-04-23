# 批11（Theme 18）：3 条 GAP 实施计划

## Context
批11 是决策批次，用户决定"影响使用则实施，否则保留"。12 条 GAP 中有 3 条影响使用，其余已实施或可保留。本计划实施这 3 条。

---

## 1. GAP-ADMIN-032：歌曲编辑入口

**问题**：PUT `/api/admin/songs/[id]` 已存在，但前端无编辑入口，评审端也无法修改元数据。

**变更**：
- `src/app/(admin)/admin/songs/page.tsx` — 在操作列加「编辑」按钮，弹出编辑 modal（复用已有的 EditingCell 模式或新建 modal）
- `src/app/api/admin/songs/[id]/route.ts` — 对齐 v6.0 PRD 字段白名单：
  - 允许：`genre, bpm, lyrics, lyricist, composer, performer, albumName, albumArtist, creationDesc, aiTools`
  - 移除：`title, styleDesc, contribution`（PRD v6.0 不允许）
  - 加入 `aiTools`
  - 操作日志 action 改为 `edit_song_meta`，记录 before/after diff

---

## 2. GAP-CRTR-076：contribution 两档对齐

**问题**：UI 显示 3 档（主导/协作/编辑），但 schema 只有 2 档（lead/participant），"协作"和"编辑"映射到同一值。

**变更**：
- `src/app/(creator)/creator/upload/page.tsx` — CONTRIBUTIONS 从 3 个改为 2 个：
  - `主导` → `lead`
  - `参与` → `participant`（替代原来模糊的"协作/编辑"合并）
- 删除 `contributionMap` 间接映射，直接用 value 对应 enum
- `src/app/api/creator/upload/route.ts` — 加 contribution 值校验（只接受 `lead` 或 `participant`）

---

## 3. GAP-RVW-020：评审端 layout route guard

**问题**：评审端 layout 无客户端防护，完全依赖 middleware。middleware 若被跳过则页面裸奔。

**变更**：
- `src/app/(reviewer)/layout.tsx` — 加 `useEffect` 客户端守卫：
  - 调 `/api/profile/me` 或检查 cookie
  - 未登录则 `window.location.href = '/review/login'`
  - 已登录但 portal !== 'reviewer' 则 redirect 到首页
- 参照 creator/admin 已有模式（如有），保持一致

---

## 验证
1. `npx tsc --noEmit` 通过
2. 管理员 songs 页面能看到「编辑」按钮，修改后保存生效
3. 创作者上传页 contribution 只显示 2 个选项
4. 评审端未登录时访问 /review/* 自动跳登录页
5. Baseline 测试无回归
