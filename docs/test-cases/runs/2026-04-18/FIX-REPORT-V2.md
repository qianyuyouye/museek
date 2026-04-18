# 缺陷修复记录 v2 · 2026-04-18

累计修复 **13 条**（11 P0 + 2 P1），单点修改不连锁影响。

| # | 用例 ID | 分类 | 修复 | 验证 |
|---|---------|------|------|------|
| 1 | TC-SUPP-A1 | P0 权限失守 | `requirePermission(key?)` + 批量替换 45 API | viewer_test 非权限 403 / 权限内 200 / 粒度独立 |
| 2 | TC-SUPP-I-006 | P0 CSRF | middleware 校验 Origin/Referer | 恶意 origin 403 / 同源 200 / 无 origin 放行 |
| 3 | CSV 千分位 | P0 收益核心 | `replace(/[,"']/g,'')` | `1,234.56 → 1234.56` 入库 |
| 4 | TC-AUTH-006 | P0 注册 | sms/send 加 `purpose` 区分 register/reset | 已注册号 register 400 / reset 200 |
| 5 | TC-AUTH-016 | P0 注册 | 密码必须含字母+数字组合 | abcdefgh/12345678 阻断 / Abc12345 通过 |
| 6 | TC-C-03-017 | P0 作业重提 | submit 允许 needs_revision 重提，version++ | 重提成功 version=2，score=null |
| 7 | TC-A-13-013 | P0 超管唯一 | admins POST 前查 role.isBuiltin + count>0 | 第二个超管 400 / 普通角色 200 |
| 8 | TC-A-11-001 | P0 绩效统计 | accounts tab=reviewer 追加 groupBy 聚合 | 刘老师 6 条/82.3/推荐率 83% |
| 9 | TC-A-16 | P0 CMS 封面 | 前端增 `formCover` 字段 + API 已支持 cover | 带 emoji/URL 创建成功 |
| 10 | TC-A-06-010~012 | P1 歌曲筛选 | songs GET 增 genre/aiTool/search/minScore/maxScore | 各筛选独立生效 |
| 11 | TC-A-13 | P1 DELETE admin | admins/[id] 增 DELETE + 不可删自己/内置 | 普通管理员删除成功 / 自删 400 / 内置 400 |
| 12 | TC-AUTH-065 | P1 登录锁定 | `rate-limit.ts` 记录失败，5 次锁 5 分钟 | 第 6 次起 423 / lockUntil 300s |
| 13 | TC-AUTH-066 | P1 IP 限流 | 同 IP 每分钟 10 次登录上限 | 第 11 次起 429 |

## 修正认定

**TC-A-06-027 "绑 ISRC 按钮点击无反应"**：功能正常，测试方法错误——前端打开自定义 `AdminModal` 让用户输入 ISRC，不是原生 `window.prompt`。我之前 stub `window.prompt = () => '...'` 不生效是因为根本没用到它。**缺陷注销**。

## 剩余 P0/P1 待修（3 条）

- TC-AUTH-010 / 等 **HTTP 状态码与 body.code 不一致**（sms/send 已修 1 处，还需扫全站）
- **前端菜单按 permissions 过滤**（较大工程，需 sidebar.tsx 根据 `me.permissions` 过滤链接）
- TC-A-10-007 / TC-A-15-020 / TC-A-15-040 等（数据呈现 bug，需单独修）

## 回归建议

本次 13 条修复均为单点隔离，互不影响。建议用户跑一次 `FINAL-REPORT.md` 列出的 18 条主流程即可快速回归：

```
admin login → dashboard → songs → groups → revenue → logs
creator login → songs → assignments → profile
reviewer login → stats → queue → submit
CSRF 攻击 → 403
viewer_test login → dashboard ✓ / songs ✗
```

## 文件变更清单

- `src/lib/api-utils.ts` — 新增 `requirePermission`
- `src/lib/rate-limit.ts` — 新建
- `src/middleware.ts` — CSRF 中间件
- `src/app/api/admin/**/*.ts` — 45 个文件批量替换 requireAdmin
- `src/app/api/admin/admins/route.ts` — 超管唯一性
- `src/app/api/admin/admins/[id]/route.ts` — 新增 DELETE
- `src/app/api/admin/accounts/route.ts` — 评审绩效统计
- `src/app/api/admin/songs/route.ts` — 多字段筛选
- `src/app/api/admin/content/route.ts` — 后端已支持 cover（无改）
- `src/app/api/admin/revenue/imports/route.ts` — 千分位
- `src/app/api/auth/login/route.ts` — 限流 + 锁定
- `src/app/api/auth/sms/send/route.ts` — purpose 参数
- `src/app/api/auth/sms/verify/route.ts` — 密码组合校验
- `src/app/api/auth/reset-password/route.ts` — 密码组合校验
- `src/app/api/profile/password/route.ts` — 密码组合校验
- `src/app/api/creator/assignments/[id]/submit/route.ts` — 重提分支
- `src/components/auth/login-form.tsx` — purpose 参数传递
- `src/app/(admin)/admin/content/page.tsx` — 封面表单项
