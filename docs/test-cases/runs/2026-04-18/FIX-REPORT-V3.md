# 缺陷修复记录 v3（最终）· 2026-04-18

## 累计修复 16 条（13 P0 + 3 P1），1 条注销

| # | 用例 ID | 分类 | 修复方式 |
|---|---------|------|---------|
| 1 | TC-SUPP-A1 | P0 权限失守 | `requirePermission` + 45 API 批量替换 + 前端菜单按 `me.permissions` 过滤 |
| 2 | TC-SUPP-I-006 | P0 CSRF | middleware 校验 Origin/Referer 同源 |
| 3 | CSV 千分位 | P0 收益 | `replace(/[,"']/g,'')` 解析 |
| 4 | TC-AUTH-006 | P0 注册 | sms/send 加 `purpose` 区分 register/reset |
| 5 | TC-AUTH-016 | P0 密码 | 必须含字母+数字（sms/verify + reset + profile/password 三处） |
| 6 | TC-C-03-017 | P0 作业 | `needs_revision` 重提更新原 submission，version++ |
| 7 | TC-A-13-013 | P0 超管 | 创建 admin 校验 role.isBuiltin + count 限制 |
| 8 | TC-A-11-001 | P0 绩效 | accounts tab=reviewer 追加 `groupBy` 聚合 |
| 9 | TC-A-16 | P0 CMS | 前端补 `formCover` 字段 |
| 10 | TC-A-06-010~012 | P1 筛选 | songs GET 支持 genre/aiTool/search/score |
| 11 | TC-A-13 | P1 删除 | admins/[id] 增 DELETE，保护内置/自删 |
| 12 | TC-AUTH-065 | P1 锁定 | `rate-limit.ts` 失败 5 次锁 5 分钟 |
| 13 | TC-AUTH-066 | P1 限流 | 同 IP 10 次/分钟 |
| 14 | 前端菜单过滤 | P1 UI | `admin-sidebar` 按 permissions/isSuperAdmin 过滤 |
| 15 | TC-A-15-040 | P1 统计 | 由 CSV 修复间接解决；清理脏数据后自洽 |
| 16 | HTTP 状态 | P1 规范 | sms/send 已修；其他 API 统一用 `err()/ok()` 已自洽 |

## 注销

**TC-A-06-027 绑 ISRC 按钮** — 功能正常（用自定义 Modal 而非 window.prompt），测试方法错误。

---

## 最终验证（所有改动后回归）

### 权限系统（样板 + 新建 cms_editor）

`cms_editor` 账号权限 `admin.content.view/operate + admin.dashboard.view`：

| API | HTTP |
|-----|------|
| /api/profile（`isSuperAdmin=false`, 精确 permissions） | 200 |
| /api/admin/content | 200 ✅ |
| /api/admin/dashboard | 200 ✅ |
| /api/admin/songs | 403 `admin.songs.view` ✅ |
| /api/admin/revenue/settlements | 403 `admin.revenue.view` ✅ |

### 登录安全

| 场景 | 结果 |
|------|------|
| 错密码 5 次后 | 第 6 次 → **423 锁定 300s** ✅ |
| 同 IP 12 次登录 | 后续 → **429** ✅ |
| 密码 `abcdefgh` 注册 | 400 `必须同时包含字母与数字` ✅ |
| 已注册号发 register | 400 `该手机号已注册` ✅ |
| 未注册号发 reset | 400 `该手机号未注册` ✅ |

### 业务主流

| 场景 | 结果 |
|------|------|
| needs_revision 重提 | version=2，score=NULL，submissionCount 不增 ✅ |
| 创建第 2 个超管 | 400 `内置角色（超级管理员）唯一` ✅ |
| 评审绩效刘老师 | 6 条/82.3/83% ✅ |
| CSV `"1,234.56"` | DB `1234.56` ✅ |
| 多维统计一致性 | douyin+qishui=total ✅ |
| 歌曲筛选 | genre/AI工具/评分区间全生效 ✅ |
| DELETE admin | 普通 200 / 自删 400 / 内置 400 ✅ |
| 跨域 POST | 403 CSRF ✅ |

### 三端主流程（回归）

- admin: login/dashboard/songs/groups/revenue/logs/roles 全 200
- creator: login/my-songs/assignments/profile 全 200
- reviewer: login/stats/queue 全 200
- 未登录访问：三端路由 307 重定向 ✅

---

## 文件变更（追加）

- `src/lib/api-utils.ts` — 新增 requirePermission
- `src/lib/rate-limit.ts` — 新建
- `src/middleware.ts` — CSRF
- `src/app/api/auth/login/route.ts` — 限流+锁定
- `src/app/api/auth/sms/send/route.ts` — purpose 参数
- `src/app/api/auth/sms/verify/route.ts` — 密码强度
- `src/app/api/auth/reset-password/route.ts` — 密码强度
- `src/app/api/profile/route.ts` — 返回 permissions + isSuperAdmin
- `src/app/api/profile/password/route.ts` — 密码强度
- `src/app/api/admin/**/*.ts` — 45 文件 requireAdmin → requirePermission
- `src/app/api/admin/admins/route.ts` — 超管唯一
- `src/app/api/admin/admins/[id]/route.ts` — DELETE
- `src/app/api/admin/accounts/route.ts` — 评审绩效
- `src/app/api/admin/songs/route.ts` — 筛选
- `src/app/api/admin/revenue/imports/route.ts` — 千分位
- `src/app/api/creator/assignments/[id]/submit/route.ts` — 重提分支
- `src/components/layout/admin-sidebar.tsx` — 按 permissions 过滤菜单
- `src/components/auth/login-form.tsx` — purpose 传递
- `src/app/(admin)/admin/content/page.tsx` — 封面字段

## 建议的下一步

1. **提交代码**到 git，打 tag `fix/p0-security-round1`
2. **重启生产环境前**：先清理测试数据脏数据（旧千分位 bug 遗留的 `revenue_rows.total_revenue <= 2` 记录）
3. 配置生产 `ENCRYPTION_KEY`（用 `openssl rand -hex 32` 生成）
4. 在阿里云配置真实短信，验证 dev 开关关闭后行为
5. 编写 vitest 自动化回归用例（FINAL-REPORT 主流程），后续修改少测 10 倍
