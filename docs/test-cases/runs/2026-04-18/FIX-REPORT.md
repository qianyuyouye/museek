# 缺陷修复记录 · 2026-04-18

已修复 3 条 P0 致命缺陷 + 回归通过。

---

## 修复 1：P0 权限系统形同虚设

### 问题
`requireAdmin(request)` 仅校验 `portal='admin'`，不检查 role.permissions。任何管理员绕过权限树直接访问所有 API。

### 修复
**新增** `requirePermission(request, key?)` 到 `src/lib/api-utils.ts`：
- 校验 portal='admin'
- 查询 admin_users + role.permissions
- `role.isBuiltin=true`（超管）直接放行
- 否则检查 `permissions[key]===true`
- key 省略时按 URL + HTTP method 自动推断：`admin.{module}.{view|operate|manage}`

**批量替换** 45 个 admin API 文件：
- `requireAdmin(request)` → `await requirePermission(request)`（自动推断 key）
- groups/route.ts 保留手工精细 key（view / manage 示例）

### 验证
| 场景 | 结果 |
|------|------|
| admin 超管访问任意 API | ✅ 200（isBuiltin 绕过） |
| viewer_test（仅 dashboard.view + revenue.view + groups.view）访问 dashboard | ✅ 200 |
| viewer_test 访问 songs | ✅ 403 `无权限：admin.songs.view` |
| viewer_test GET groups | ✅ 200 |
| viewer_test POST groups | ✅ 403 `无权限：admin.groups.manage` |
| viewer_test DELETE groups | ✅ 403 |
| viewer_test 访问 revenue/settlements | ✅ 200（有 revenue.view） |

### 遗留
- 自动推断只分 view/operate/manage 3 级，PRD 的 edit/export/settle 粒度暂未细化
- 前端菜单仍全显示，待前端按 permissions 过滤（未修复）

---

## 修复 2：P0 CSRF 未防护

### 问题
恶意 `Origin: http://attacker.com` 跨域携带 cookie POST 接口成功创建用户组。

### 修复
在 `src/middleware.ts` 中增加：
- 对所有 API 的写方法（POST/PUT/PATCH/DELETE）校验 Origin/Referer
- 同源白名单：`http(s)://{host}`
- 不同源则返回 403 "CSRF 检查失败：来源不可信"
- curl/Postman 等无 Origin/Referer 的工具请求不阻断（便于 API 调试）

### 验证
| 场景 | 结果 |
|------|------|
| 恶意 `Origin: attacker.com` POST /admin/groups | ✅ 403 `CSRF 检查失败：来源不可信` |
| 同源 `Origin: localhost:3000` POST | ✅ 200 |
| 无 Origin（curl 默认）POST | ✅ 200（允许，不影响 API 调试） |
| 所有 GET 请求 | ✅ 200（不拦截读操作） |

### 遗留
- 生产部署时需确认 `host` header 可信（可能需配置反向代理）
- 浏览器请求默认自动带 Origin，跨站点场景会被正确拦截
- 如有跨子域名需求需扩展白名单

---

## 修复 3：P0 CSV 千分位解析丢精度

### 问题
CSV 中 `"1,234.56"` 被 `parseFloat` 解析为 `1.00`，`"2,024.00"` → `2.00`，收益丢失 99%。

### 修复
`src/app/api/admin/revenue/imports/route.ts` 第 86-88 行：
```ts
// 修复前
const d = parseFloat(douyin) || 0

// 修复后
const toNum = (s: string) => parseFloat(s.replace(/[,"']/g, '')) || 0
const d = toNum(douyin)
```
去除千分位逗号 + 两端引号后再 parseFloat。

### 验证
| 输入 CSV | 修复前 | 修复后 |
|---------|--------|--------|
| `"1,234.56"` | 1.00 | **1234.56** ✅ |
| `"2,024.00"` | 2.00 | **2024.00** ✅ |
| `"789.44"` | 789.44 | 789.44 ✅ |
| `"100.00"` | 100.00 | 100.00 ✅ |

导入批次 `totalRevenue` 与单行 `total_revenue` 金额完全正确。

---

## 回归测试（3 端主流程全绿）

| 端 | 接口 | HTTP |
|----|------|------|
| admin | login / dashboard / songs / students / settlements / logs / roles | 200 × 7 |
| creator | login / my-songs / assignments / profile | 200 × 4 |
| reviewer | login / stats / queue | 200 × 3 |
| 安全 | 恶意 Origin POST | 403 ✅ |

---

## 下一批建议修复（P0/P1 剩余）

1. TC-AUTH-006 已注册号继续发验证码（单文件修复）
2. TC-AUTH-016 密码缺字母+数字组合校验（单文件修复）
3. TC-C-03-017 `needs_revision` 作业不能重提（`submit/route.ts:47` 改一个判断）
4. TC-A-13-013 超管唯一性（创建 admin 时校验 roleId=1 只允许 1 位）
5. TC-A-11-001 管理端评审绩效统计全 0（查询 bug）
6. TC-A-06-027 "绑 ISRC" 按钮前端无反应（前端修复）
7. TC-A-16 CMS 新建表单补封面字段
8. TC-AUTH-065 / 066 登录锁定 + IP 限流
9. 前端菜单按 permissions 过滤
10. DELETE /api/admin/admins/{id} 路由实现
11. 歌曲库搜索/流派/AI工具筛选后端实现

每条都是**单点修复**，不会连锁影响。继续做这些只需批量修改，修完后按 FINAL-REPORT.md 对应用例回归即可。
