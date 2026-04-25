# Theme 6: 字段契约对齐 + 歌曲默认填充 + 版权序号原子递增 Design

## 元信息

| 项 | 值 |
|---|---|
| 设计日期 | 2026-04-21 |
| 设计者 | superpowers:brainstorming |
| PRD 基准 | v5.2 对齐版 + `2026-04-20-platform-alignment-gap-list.md`「主题 6」 |
| 状态 | 待用户 review |
| 下一步 | 通过后用 superpowers:writing-plans 产出实施计划 |

## 背景

PRD v5.2 对齐版列出 30 条 P0，收敛为 7 主题。主题 1/2/3/4/7 已完成。剩余主题 5（上传安全链）+ 主题 6（字段契约错位）。本设计只覆盖**主题 6**，主题 5 另起一轮 brainstorm。

主题 6 根因是"后端返 A，前端读 B"导致 UI 显示 undefined / 硬编码 0 / 随机序号，9 条独立 bug 共通"数据到位即恢复"，不需要新架构、不动权限/通知。

## 目标与范围

### In-Scope

覆盖 Gap 清单 9 个 ID，合并后 8 行（GAP-CRTR-004 与 GAP-SCHM-005 同根因，一行处理）：

| ID | 端/模块 | 症状 | 修复方向 |
|---|---|---|---|
| GAP-CRTR-011 | creator/通知中心 | `n.time` 不存在 → 时间列 undefined | 前端读 `createdAt` |
| GAP-CRTR-016 | creator/community | `song.cover` 不存在 → 广场卡片回落默认渐变 | 前端读 `coverUrl` |
| GAP-CRTR-020 | creator/songs | `song.aiTool` 不存在 → AI 工具列永远空 | 前端读 `aiTools` |
| GAP-ADMIN-010 | admin/publish-confirm | `songTitle/songCover` 不存在 | 前端读 `title/coverUrl` |
| GAP-ADMIN-008 | admin/accounts 重置密码 | 前端读 `data.password`，后端返 `masked` | 后端改返 `password` 明文一次 + 管理员弹框复制 |
| GAP-ADMIN-100 | admin/accounts creator tab | API 不返 `songCount` → UI fallback 0 | 后端 `_count: { songs: true }` 补真值 |
| GAP-CRTR-004 / GAP-SCHM-005 | creator/upload + assignments | 表单无 performer/album 输入、服务端不兜底 | 表单增 5 输入 + `fillSongDefaults` helper |
| GAP-ADMIN-029 | admin/songs publish action | `Math.random()` 选号不保证年度唯一递增 | 新增 `copyright_sequences` 表 + `nextCopyrightCode(tx)` |

### Out-of-Scope

- 主题 5（上传安全链）：另起 spec
- 非本次列表中的其他可选字段默认值
- UI/UX 样式调整（只让数据回到位，不动布局）
- 权限/通知/发行 schema 变更（其他主题已覆盖）

### 成功标准

1. 下列每条单独有集成测试或静态断言通过：C/D 有集成测试，A/B 的纯前端字段别名用 `grep` 静态断言
2. 现有测试全绿（尤其 `tests/api/songs.test.ts` / `tests/api/theme4.test.ts` / `tests/api/theme7.test.ts` 不 regress）
3. 创作者作品库 AI 工具列、广场封面、消息中心时间列、发行状态确认标题/封面列不再显示 undefined
4. 作品编号年度连续递增：`T-D2` 并发 5 次 publish 得到 5 个互不相同且步长 1 的序号

## 架构：4 个独立 patch

按职责切开，每 patch 独立 commit，之间无强依赖（最后统跑一次集成测试）。

### Patch A — 前端字段名对齐（4 处）

纯前端改动，每处 1-3 行：

| 文件 | 改点 |
|---|---|
| `src/app/(creator)/creator/notifications/page.tsx` | `n.time` → `n.createdAt`（格式化渲染保留） |
| `src/app/(creator)/creator/community/page.tsx` | `song.cover` → `song.coverUrl` |
| `src/app/(creator)/creator/songs/page.tsx` | `song.aiTool` → `song.aiTools?.join(', ')` |
| `src/app/(admin)/admin/publish-confirm/page.tsx` | `songTitle/songCover` → `title/coverUrl` |

### Patch B — 后端补真值（2 处）

**B1（GAP-ADMIN-100）**：`src/app/api/admin/accounts/route.ts`

- `prisma.user.findMany` 的 `include` 加 `_count: { select: { songs: true } }`
- `list.map` 末尾追加 `songCount: u._count.songs`
- 注意：此字段只对 `tab === 'creator'` 或未过滤 tab 场景有语义；reviewer/admin 用户的 `_count.songs` 理论总是 0（不会产生混淆）

**B2（GAP-ADMIN-008）**：`src/app/api/admin/accounts/[id]/reset-password/route.ts`

当前路由区分两种情况，前端只读 `data.password`，两种都拿不到：

| 场景 | 当前返回 | 修复后返回 |
|---|---|---|
| 自动生成（body 无 password） | `{ generated: true, masked: 'Ab*****', message: '...单独下发' }` | `{ generated: true, password: plaintext, message: '请复制后通过安全渠道发送给用户' }` |
| 管理员指定（body 传 password） | `{ generated: false, message: '密码已重置' }` | 不变 |

- `masked` 字段移除（或保留做兼容层，但前端不读）
- `logAdminAction` 不写明文、不写 masked（仅写 `{ name, phone }`，现状保持）
- 安全折衷：管理员重置后一次性明文回传 → UI 弹框提示"30 秒内复制"，后续不可再次查看。与 PRD v5.2 §3 管理员重置即刻下发流程一致

### Patch C — 歌曲字段默认值（helper + 表单）

**新增 `src/lib/song-defaults.ts`**（~25 行）：

```typescript
import type { User } from '@prisma/client'

export interface SongSubmitLike {
  title: string
  performer?: string | null
  lyricist?: string | null
  composer?: string | null
  albumName?: string | null
  albumArtist?: string | null
}

type UserLike = Pick<User, 'realName' | 'name'>

export function fillSongDefaults<T extends SongSubmitLike>(body: T, user: UserLike): T {
  const fallbackName = (user.realName?.trim() || user.name).trim()
  return {
    ...body,
    performer: body.performer?.trim() || fallbackName,
    lyricist: body.lyricist?.trim() || fallbackName,
    composer: body.composer?.trim() || fallbackName,
    albumName: body.albumName?.trim() || body.title,
    albumArtist: body.albumArtist?.trim() || fallbackName,
  }
}
```

> 注：项目 `User` 模型的登录名字段是 `name`（见 `prisma/schema.prisma`），`realName` 为实名认证后填写。未实名时 fallback 到 `name`；发行校验强制要求实名（现有逻辑）。

**在 2 个 route 入口调用**：

- `src/app/api/creator/upload/route.ts` POST 路由（创作者独立上传；`/api/creator/songs` 只有 GET）：解析 body 后先 `fillSongDefaults(body, user)` 再 create
- `src/app/api/creator/assignments/[id]/submit/route.ts` POST 路由：同上

**前端 2 个表单** 补 5 个输入框（放在「高级信息」折叠区，默认折叠，点开后 `useEffect` 预填）：

- `src/app/(creator)/creator/upload/page.tsx`
- `src/app/(creator)/creator/assignments/page.tsx`

未实名用户表单 placeholder 展示 `用户名`，后端 fallback 同步用 `user.name`。发行时现有"实名校验"阻断，不在此修。

### Patch D — 版权序号原子递增

**新增 Prisma model**（`prisma/schema.prisma`）：

```prisma
model CopyrightSequence {
  year      Int      @id             // 2026
  counter   Int      @default(0)
  updatedAt DateTime @updatedAt

  @@map("copyright_sequences")
}
```

**新增 `src/lib/copyright-code.ts`**（~25 行）：

```typescript
import type { Prisma } from '@prisma/client'

export async function nextCopyrightCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear()
  // 1) 首次本年未初始化时兜底建行；IGNORE 保证幂等
  await tx.$executeRaw`INSERT IGNORE INTO copyright_sequences (year, counter, updatedAt) VALUES (${year}, 0, NOW())`
  // 2) 行锁 + 读取
  const rows = await tx.$queryRaw<{ counter: number }[]>`SELECT counter FROM copyright_sequences WHERE year = ${year} FOR UPDATE`
  const next = rows[0].counter + 1
  // 3) 自增落盘
  await tx.$executeRaw`UPDATE copyright_sequences SET counter = ${next} WHERE year = ${year}`
  return `AIMU-${year}-${String(next).padStart(6, '0')}`  // AIMU-2026-000001
}
```

**调用点更正**：经 writing-plans 阶段源码复核，版权号实际在**上传时**生成，不在 publish 时。两处 `generateCopyrightCode()` 函数（使用 `Math.random` + 查重循环）分别位于：

- `src/app/api/creator/upload/route.ts:6-16` — 独立上传分支
- `src/app/api/creator/assignments/[id]/submit/route.ts:6-16` — 作业提交分支

两处都替换为 `await nextCopyrightCode(tx)`，并把 generate 调用移入各自已有的 `$transaction` 内（upload 路由目前 create 不在 tx，需要顺手包一层；submit 路由已有 tx，复用）。

**DB 字段名更正**：Song 表字段为 `copyrightCode`（String，形如 `AIMU-2026-000001`），不是 `copyrightNo`。helper 返回值需带 `AIMU-` 前缀。

## 数据流

### 版权号生成（并发安全）

```
管理员点"确认发行"
  ↓ POST /api/admin/songs/:id/status action=publish
  ↓ prisma.$transaction(async tx => {
      ├─ 校验 签约/实名/ISRC（已存在）
      ├─ copyrightNo = await nextCopyrightCode(tx)
      │     ├─ INSERT IGNORE {year, counter:0}    // 本年行不存在时兜底
      │     ├─ SELECT counter FROM ... FOR UPDATE  // 行锁
      │     ├─ UPDATE counter = counter + 1
      │     └─ return `2026000001`
      ├─ song.update status=published, copyrightNo
      ├─ distribution.createMany  (Theme 4 已存在)
      └─ commit  // 行锁释放
    })
  ↓ notify(creator, tpl.song_published)  (Theme 2 已存在)
```

并发两条 publish：第二条在 `SELECT ... FOR UPDATE` 阻塞至第一条 commit，随即得到 +1，零竞态。

### 字段默认填充

```
POST /api/creator/songs   body = { title: '新歌', lyricist: '' }
  ↓ getCurrentUser → { name, realName }
  ↓ fillSongDefaults(body, user)
      → body.lyricist = realName ?? name
      → body.albumName = body.title
  ↓ prisma.song.create({ data: body })
```

纯函数、无 I/O、幂等。

## 完整文件清单

### 修改（12 个）

| 文件 | Patch | 改动量 |
|---|---|---|
| `src/app/(creator)/creator/notifications/page.tsx` | A | 1 行 |
| `src/app/(creator)/creator/community/page.tsx` | A | 1 行 |
| `src/app/(creator)/creator/songs/page.tsx` | A | 1-2 行 |
| `src/app/(admin)/admin/publish-confirm/page.tsx` | A | 2-3 行 |
| `src/app/api/admin/accounts/route.ts` | B1 | +5 行 `_count` 接入 |
| `src/app/api/admin/accounts/[id]/reset-password/route.ts` | B2 | 返回体改字段 + 日志脱敏保留 |
| `src/app/api/creator/upload/route.ts` | C+D | +helper + 替换 generateCopyrightCode |
| `src/app/(creator)/creator/upload/page.tsx` | C | +5 Input + useEffect 预填 |
| `src/app/(creator)/creator/assignments/page.tsx` | C | +5 Input + useEffect 预填 |
| `src/app/api/creator/assignments/[id]/submit/route.ts` | C+D | +helper + 替换 generateCopyrightCode |
| `prisma/schema.prisma` | D | +8 行 model |

### 新建（3 个）

- `src/lib/song-defaults.ts` — fillSongDefaults helper (~25 行)
- `src/lib/copyright-code.ts` — nextCopyrightCode(tx) helper (~25 行)
- `tests/api/theme6.test.ts` — 集成测试 (~200 行)

## 测试策略

集成测试跑在 dev server 上（复用 Theme 7 风格），新建 `tests/api/theme6.test.ts`。

| 用例 | 断言 |
|---|---|
| T-A3 | GET /api/creator/songs list 每条 `aiTools` 为数组（回归锁定） |
| T-B1 | GET /api/admin/accounts?tab=creator 响应里该 creator 的 `songCount ≥ 1`（预先建 1 首） |
| T-B2 | POST /api/admin/accounts/:id/reset-password 响应 `data.password` 为 8 位明文（非 masked） |
| T-C1 | POST /api/creator/songs body 不传 performer → DB 行 `performer = user.realName` |
| T-C2 | POST /api/creator/songs body 不传 albumName → DB 行 `albumName = body.title` |
| T-C3 | POST /api/creator/songs body 传 `performer='编曲师'` → DB 行保留 `'编曲师'` |
| T-C4 | POST /api/creator/assignments/:id/submit 空 performer → 同 T-C1 兜底 |
| T-C5 | user.realName 为空的账号 submit → `performer = user.name` |
| T-D1 | POST /creator/upload 创建一首歌 → song.copyrightCode 形如 `^AIMU-2026-\d{6}$` |
| T-D2 | 并发 upload 5 首（Promise.all）→ 5 个 copyrightCode 互不相同且彼此步长 1 |

**A 的 4 条纯前端字段别名不做集成测试**（需要浏览器渲染），改用静态 grep 断言：PR 合并前确认以下返回空：

- `grep -rn "n\.time\b" src/app/(creator)/creator/notifications`
- `grep -rn "song\.cover\b" src/app/(creator)/creator/community`（`cover` 后面不跟 `Url` 的命中）
- `grep -rn "song\.aiTool\b" src/app/(creator)/creator/songs`（`aiTool` 后面不跟 `s`）
- `grep -rn "songTitle\|songCover" src/app/(admin)/admin/publish-confirm`

## 错误处理

- `fillSongDefaults`：纯函数无抛错；入参 title 已被上层校验非空
- `nextCopyrightCode`：在 `$transaction` 内，任何 SQL 失败回滚整个 publish（与现状等价，无 regress）
- B2 reset-password：`safeHandler` 已包裹，改返回字段名不影响异常分支
- B1 accounts list：`_count.songs` 失败在 Prisma 层会被 findMany 整体抛；safeHandler 捕获 500，现有日志保留

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| `copyright_sequences` 表并发压测未真实跑过，INSERT IGNORE + FOR UPDATE 在 MySQL 8 某些隔离级别下组合是否一致 | T-D2 用 `Promise.all` 并发 5 次验证；必要时改 `INSERT ... ON DUPLICATE KEY UPDATE counter = counter + 1` 单语句原子化 |
| B2 重置密码明文从 API 返回，存在被 XSS 截获风险 | 现状已是如此（前端读 data.password），仅字段名对齐；XSS 防护另案由主题 5 覆盖 |
| Patch C 表单新加输入对现有 AI 预分析/自动填充链路的影响 | 预填仅在字段为空时生效（`useEffect` 判空），用户已填不覆盖；集成测试 T-C3 覆盖"传入保留"场景 |
| `CopyrightSequence` 表初次部署需 `prisma db push` | Docker 部署已有 init profile（`prisma/seed.js`），本 patch 只是追加一张小表，无破坏性迁移 |

## 后续

- 本设计通过后，用 superpowers:writing-plans 产出实施计划 `docs/superpowers/plans/2026-04-21-theme6-field-contract.md`
- 实施时按 Patch A→B→C→D 顺序提交；也可 A/B 并行（彼此无依赖），C/D 串行（D 有 schema 改动，独立一次 push）
- 主题 6 合并后启动主题 5 的 brainstorm
