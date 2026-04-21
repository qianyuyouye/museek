# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Museek 是一个 AI 音乐教学与版权代理平台，面向音乐教育和创作场景。

## 三端架构

- **管理端** (`/admin/*`) — 运营管理：用户组、内容、作业、歌曲库、收益、发行、系统设置
- **创作者端** (`/creator/*`) — 学生/创作者：上传作品、提交作业、查看收益、学习课程
- **评审端** (`/review/*`) — 评审专家：逐曲评审打分、绩效统计

## 技术栈

- **前端**：Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS
- **后端**：Next.js API Routes + Prisma ORM
- **数据库**：MySQL 8.0
- **认证**：JWT (jose) + HttpOnly Cookie
- **部署**：Docker (standalone 模式)

## 目录结构

```
src/
  app/
    (admin)/admin/        — 管理端 18 个页面
    (creator)/creator/    — 创作者端 10 个页面
    (reviewer)/review/    — 评审端 5 个页面
    (admin-auth)/         — 管理端登录
    (creator-auth)/       — 创作者端登录（含注册）
    (reviewer-auth)/      — 评审端登录
    api/
      admin/              — 管理端 API（42 个路由）
      creator/            — 创作者端 API（6 个路由）
      review/             — 评审端 API（5 个路由）
      auth/               — 认证 API（登录/注册/刷新/短信/重置密码）
      profile/            — 个人中心 API
      songs/              — 公开歌曲接口
      upload/             — 文件上传（token + 本地存储）
      content/            — 公开内容接口
  components/
    admin/                — 管理端共享组件
    auth/                 — 登录表单组件
    layout/               — 侧边栏、进度条、Provider
    ui/                   — shadcn/ui 基础组件
  lib/
    api-utils.ts          — API 工具（鉴权、响应、分页、safeHandler）
    auth.ts               — JWT 签发/验证/Cookie
    prisma.ts             — Prisma 单例
    upload.ts             — 文件上传凭证
    use-api.ts            — 前端 useApi hook + apiCall
    ai-analysis.ts        — AI 预分析（OpenAI 兼容协议）
    audio-extract.ts      — 前端音频特征提取（Web Audio API）
    constants.ts          — 共享常量（状态映射、权限树）
    log-action.ts         — 操作日志记录
  types/
    api.ts                — 前后端共享 API 请求/响应类型
    auth.ts               — JWT Payload 类型
prisma/
  schema.prisma           — 数据模型（20 张表）
  seed.js                 — 种子数据（仅管理员账号）
```

## 核心业务流程

```
创作者上传作品 → 评审打分 → 管理员确认发行 → 发行到各平台 → 收益导入结算
```

### 歌曲状态流转

```
pending_review → ready_to_publish（强推+≥80分）
               → needs_revision（建议修改）
               → reviewed（其他）
ready_to_publish → published（发行校验：签约+实名+ISRC）
published → archived（归档）
archived → reviewed（恢复）
```

## 开发命令

```bash
npm run dev              # 启动开发服务器
npx prisma db push       # 同步 schema 到数据库
npx prisma generate      # 重新生成 Prisma Client
npx prisma db seed       # 运行种子数据（仅管理员）
npx tsx prisma/seed-test-users.ts  # 可选：注入测试用 creator/reviewer + E2ETEST1 邀请码组，配合 vitest 登录（详见脚本注释）
npm run build            # 生产构建
npx tsc --noEmit         # 类型检查
```

## Docker 部署

```bash
docker compose up -d                         # 启动
docker compose --profile init run init       # 首次建表+种子
# 访问 http://localhost:3000
```

默认管理员：`admin` / `Abc12345`

## Theme 5 部署步骤（上传安全链）

**首次部署或升级到 Theme 5+ 时执行**：

1. 配置 env（均可选，缺则自动 fallback）：
   - `UPLOAD_SECRET` — HMAC 密钥；缺失时从 `JWT_SECRET` 派生 `sha256(JWT_SECRET + ":upload")`
   - `STORAGE_ROOT` — 本地模式文件落盘根目录；默认 `./storage`

2. 数据迁移：
   ```bash
   mysql museek < scripts/theme5-cleanup.sql
   ```
   脚本幂等可重跑。剥离历史 `audio_url/cover_url` 的前导 `/`。

3. 本地存储目录：
   - 裸机：`storage/uploads/{audio,images}/` 需写权限
   - Docker：`docker-compose.yml` 已挂 `./storage:/app/storage`（确保宿主机目录存在）

4. 生产建议：切到 OSS 模式（管理端 `/admin/settings` → 存储配置），不再走本地网关

## 环境变量

```env
DATABASE_URL=mysql://user:pass@host:3306/museek
JWT_SECRET=强密钥（生产必须配置）
AI_API_BASE_URL=https://api.openai.com/v1    # 可选
AI_API_KEY=sk-xxx                            # 可选
AI_MODEL=gpt-4o-mini                         # 可选
OSS_BUCKET=                                  # 可选，配了走 OSS 上传
```

## 开发规范

- 前后端 API 请求体类型定义在 `src/types/api.ts`，两端共享，禁止各自定义字段名
- API 统一用 `safeHandler` 包裹，异常返回 500 不泄露堆栈
- 所有 `parseInt` 后必须 `isNaN` 检查
- 管理端鉴权用 `requireAdmin`，创作者/评审端用 `getCurrentUser` + portal 校验
- 文件上传流程：前端获取 token → 直接 PUT 到存储（开发本地/生产 OSS）

## 运行时配置（Batch 1A 起）

以下配置优先从管理端 `/admin/settings` DB 读取（`system_settings` 表），未配置时回落到 env：

- **AI 预分析**：`ai_config.*` → `AI_API_KEY / AI_API_BASE_URL / AI_MODEL`
- **文件存储**：`storage_config.*` → `OSS_BUCKET / OSS_REGION / OSS_DOMAIN / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET`
- **阿里云短信**：`sms_config.*` → `ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET / ALIYUN_SMS_SIGN_NAME / ALIYUN_SMS_TEMPLATE_CODE`
- **通知模板**：`notification_templates` JSON（无 env 对应，仅 DB）

**加密字段**：`apiKey / accessKeySecret / accessKeyId` 三项使用 `ENCRYPTION_KEY` (AES-256-GCM) 加密存 DB，前端只看脱敏值 `sk-****abcd`。

**生产部署建议**：全部用 DB 配置；env 仅保留 `ENCRYPTION_KEY / JWT_SECRET / DATABASE_URL` 三项启动前置。

**备注**：OSS SDK 实际的 signatureUrl 签名调用在 Batch 1B 实施；Batch 1A 只让配置可落库、lib 读取路径切到 DB 优先。

## 通知触发（Theme 2 起）

6 类业务动作在主事务结束后调 `notify(userId, templateKey, vars, targetType?, targetId?)`（`src/lib/notifications.ts`）自动给相关用户发站内通知：

| 场景 | 触发点 | 模板 key | 接收人 |
|---|---|---|---|
| 评审提交 | `/api/review/submit` | `tpl.review_done` / `tpl.song_needs_revision` | 作品创作者 |
| 歌曲发行 | `/api/admin/songs/:id/status` action=publish/archive | `tpl.song_published` / `tpl.song_archived` | 作品创作者 |
| 结算打款 | `/api/admin/revenue/settlements` action=pay | `tpl.settlement_paid` | 每条 settlement 对应创作者 |
| 实名审核 | `/api/admin/students/:id/verify` approve/reject | `tpl.realname_approved` / `tpl.realname_rejected` | 被审核用户 |
| 新作业广播 | `/api/admin/assignments` POST | `tpl.assignment_created` | 组内全部 creator |
| ISRC 绑定 | `/api/admin/songs/:id/isrc` POST | `tpl.isrc_bound` | 作品创作者 |

**契约约定**：
- 调用方**必须自己 try/catch**（`notify` 内部只对模板缺失降级为 null，`prisma.notification.create` 失败会上抛）
- 各调用点 catch 打 `console.error('[notify] <场景> failed:', e)` 便于排障
- 通知失败不回滚主业务（主事务已 commit）

**模板渲染**：优先 DB `notification_templates` 配置（admin settings 可改），fallback `src/lib/notifications.ts` 的 `DEFAULT_TEMPLATES`。

**Notification schema**：`id / userId / type / title / content / targetType / targetId / linkUrl / read / createdAt`。前端 `/creator/notifications` 点击卡片 `router.push(linkUrl)`（Task 10）。

**未覆盖场景（后续 theme）**：作业截止定时提醒（需 cron）、作业提交 → reviewer 通知（缺 reviewer 分配机制）。
