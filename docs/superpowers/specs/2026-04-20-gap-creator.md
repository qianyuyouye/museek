# 创作者端 + 认证 + 上传缺口清单（78 项）

> 这是主清单 `2026-04-20-platform-alignment-gap-list.md` 的子文档。
> 上下文、优先级定义、跨端重复映射表见主清单。

## 主索引表

| ID | 模块 | 缺口标题 | 类型 | 优先级 | 页面/API |
|----|----|---------|------|-------|---------|
| GAP-CRTR-001 | 通知 | 评审/发行/结算/实名审核完成均未主动产生通知（全局断链） | 断链 | P0 | 全部 admin 写接口 |
| GAP-CRTR-002 | 作品库 | "已入库" Tab 请求 `status=in_library` 后端返回 400 | 断链 | P0 | `api/creator/songs/route.ts:16` |
| GAP-CRTR-003 | 收益 | 汽水音乐 Tab 数据表永远空：API 未返回 `qishuiDetails` 列表 | 断链 | P0 | `api/creator/revenue/route.ts:98-111` |
| GAP-CRTR-004 | 上传 | 自由上传表单无 performer/专辑名/专辑歌手，DB 默认实名未实现 | 残缺 | P0 | `creator/upload/page.tsx`+`api/creator/upload/route.ts` |
| GAP-CRTR-005 | 上传 | 拖拽上传未实现（PRD §7.1.2 "支持拖拽/点击"），仅 onClick | 残缺 | P0 | `creator/upload/page.tsx:449-503` |
| GAP-CRTR-006 | 上传 | audio/cover URL 为 public/ 静态直链，任何匿名 GET 都能拿到 | 配置缺失+安全 | P0 | `lib/upload.ts:42-48` + `api/upload/local/*` |
| GAP-CRTR-007 | 上传 | OSS 分支用拼接 URL 而非 SDK signatureUrl，生产 403 | 配置缺失 | P0 | `lib/upload.ts:51-65` |
| GAP-CRTR-008 | 认证 | 上传 token 无过期时间，任意用户拿到后可无限次用 | 配置缺失 | P0 | `lib/upload.ts`+`api/upload/token/route.ts` |
| GAP-CRTR-009 | 认证 | 短信/重置密码/upload/token 等 API 无 IP 限流（仅 login 做了） | 配置缺失 | P0 | `api/auth/sms/send`+`api/auth/reset-password`+`api/upload/token` |
| GAP-CRTR-010 | 注册 | 邀请码无爆破防护（无错误次数限制、无限流） | 配置缺失 | P0 | `api/auth/sms/verify/route.ts:36-39` |
| GAP-CRTR-011 | 通知 | 前端消息中心 `n.time` 不存在（API 返回 `createdAt`），时间栏显示 undefined | 断链 | P0 | `creator/notifications/page.tsx:154` vs API `createdAt` |
| GAP-CRTR-012 | 课程 | 视频课程无真实播放能力（播放按钮仅切换 SVG 动画），无 video URL 字段 | 残缺 | P1 | `creator/courses/page.tsx:176-191`+schema `CmsContent` |
| GAP-CRTR-013 | 课程 | sections/duration/level/readTime 按 contentId 硬编码，管理端无法编辑 | 残缺 | P1 | `creator/courses/page.tsx:30-43` |
| GAP-CRTR-014 | 学习 | courses 学习进度判定为"停留 30 秒打开即 100%"，非真实播放进度 | 残缺 | P1 | `creator/courses/page.tsx:103-133` |
| GAP-CRTR-015 | 作品广场 | 分享按钮仅 toast 提示"链接已复制"，未调 `navigator.clipboard.writeText` | 残缺 | P1 | `creator/community/page.tsx:239-241` |
| GAP-CRTR-016 | 作品广场 | `song.cover` 期望 Emoji，API 返回 `coverUrl`（URL），渐变背景永远 fallback | 断链 | P1 | `creator/community/page.tsx:118` vs `api/songs/published` |
| GAP-CRTR-017 | 作品广场 | 搜索/筛选完全缺失，仅 3 个硬编码 Tab | 残缺 | P2 | `creator/community/page.tsx` |
| GAP-CRTR-018 | 作品库 | 卡片列表 `s.cover` 未返回；创作者 songs API 也不返回，卡片 cover 显示 undefined | 断链 | P1 | `api/creator/songs/route.ts:56-73` |
| GAP-CRTR-019 | 作品库 | 列表 API 不返回 lyricist/composer/aiTool/audioUrl，需先点详情才拉到 | 残缺 | P2 | 同上 |
| GAP-CRTR-020 | 作品库 | API 返回 `aiTools` 数组，前端按 `aiTool`（单数）访问，AI 工具永远空 | 断链 | P1 | `creator/songs/page.tsx:19,233` |
| GAP-CRTR-021 | 作品库 | `published` 状态缺"归档后恢复到 in_library" Tab 语义与 PRD §7.1.4 不符 | 残缺 | P2 | `creator/songs/page.tsx:58-66` |
| GAP-CRTR-022 | 作业提交 | 已提交作业无"重新提交"入口按钮（即便后端支持 needs_revision） | 断链 | P1 | `creator/assignments/page.tsx:507-543` |
| GAP-CRTR-023 | 作业提交 | `needs_revision` 作业前端按"已提交"展示，看不到修改入口 | 断链 | P1 | 同上 |
| GAP-CRTR-024 | 作业提交 | BPM 传字符串 "abc" 时 `parseInt` 返回 NaN 未校验，Prisma 写入报错 | 残缺 | P2 | `api/creator/assignments/[id]/submit/route.ts:72,117` |
| GAP-CRTR-025 | 作业提交 | 提交失败（后端 4xx）仅 toast "message"，不标记表单哪个字段错 | 残缺 | P2 | 同上 |
| GAP-CRTR-026 | 收益 | 数据更新时间戳硬编码 "2026-04-10 10:00 / 下次更新 2026-07-10" | 残缺 | P2 | `creator/revenue/page.tsx:174-178` |
| GAP-CRTR-027 | 收益 | 表格标题"平台分发收益明细 - 2026-Q1"固定字符串 | 残缺 | P2 | `creator/revenue/page.tsx:208` |
| GAP-CRTR-028 | 收益 | 播放量 `plays` 硬编码 0，创作者列表永远显示"0" | 残缺 | P2 | `api/creator/revenue/route.ts:45` |
| GAP-CRTR-029 | 收益 | 汽水 Tab 无月份切换/筛选（PRD §7.1.5 "时间筛选"） | 残缺 | P2 | `creator/revenue/page.tsx:248-291` |
| GAP-CRTR-030 | 个人中心 | "更换手机"按钮无 onClick handler，死按钮 | 无头入口 | P1 | `creator/profile/page.tsx:294` |
| GAP-CRTR-031 | 个人中心 | "更换邮箱"打开的是 editModal（含姓名字段），非独立验证流程 | 残缺 | P2 | `creator/profile/page.tsx:308` |
| GAP-CRTR-032 | 个人中心 | 入职时间 `2026-01-10` 硬编码（应取 `user.createdAt`） | 残缺 | P2 | `creator/profile/page.tsx:339` |
| GAP-CRTR-033 | 个人中心 | 平台用户服务协议+隐私政策 `signedAt` 硬编码 `2026-01-10` | 残缺 | P2 | `creator/profile/page.tsx:17-20` |
| GAP-CRTR-034 | 个人中心 | 代理协议"分成比例/期限/范围"均硬编码，未从 system_settings 读 | 残缺 | P2 | `creator/profile/page.tsx:22-29,697-716` |
| GAP-CRTR-035 | 个人中心 | 邮箱为空时显示 "null"/空白（新注册 email 字段默认空） | 残缺 | P2 | `creator/profile/page.tsx:306` |
| GAP-CRTR-036 | 个人中心 | 实名 `verified` 状态下表单只读展示，无"申请修改"入口 | 残缺 | P2 | `creator/profile/page.tsx:630-657` |
| GAP-CRTR-037 | 个人中心 | 登录日志无分页（后端 take:10 固定，前端无"更多"） | 残缺 | P2 | `api/profile/login-logs/route.ts:14` |
| GAP-CRTR-038 | 个人中心 | 实名审核通过/驳回 无消息推送（PRD §E-2 要求含驳回原因） | 断链 | P0 | `api/admin/students/[id]/verify/route.ts:33-46` |
| GAP-CRTR-039 | 注册 | 3 个协议 Checkbox（服务/隐私/代理发行）vs PRD §1.3 只要求 1 个"同意用户协议" | 残缺 | P2 | `components/auth/login-form.tsx:395-409` |
| GAP-CRTR-040 | 注册 | 代理发行协议 Checkbox 不必选（前端 `agreeMusic` 未进校验），UI 误导 | 残缺 | P2 | `components/auth/login-form.tsx:167-170,405-408` |
| GAP-CRTR-041 | 注册 | 邀请码已注册手机号走 sms/send 返回 400，但前端原文仅通用 error 条 | 残缺 | P2 | `components/auth/login-form.tsx:124` |
| GAP-CRTR-042 | 注册 | 注册成功后直接跳首页未 toast 提示"请去完成实名认证" | 残缺 | P2 | `components/auth/login-form.tsx:187` |
| GAP-CRTR-043 | 上传 | AI 工具单选（sel box）而非多选（PRD §2 Phase2 "AI工具（多选）"） | 残缺 | P2 | `creator/upload/page.tsx:569-577` |
| GAP-CRTR-044 | 上传 | `contribution` 前端 3 选项（主导/协作/编辑），后端只有 lead/participant，"编辑" 入库时被吞 | 残缺 | P2 | `creator/upload/page.tsx:55-59,377` |
| GAP-CRTR-045 | 上传 | Step 2 校验"创作过程说明 ≥30 字"，PRD §4.4 定为可选字段 | 残缺 | P2 | `creator/upload/page.tsx:330,345-348` |
| GAP-CRTR-046 | 上传 | Step 1 支持封面 .webp，但不校验 1:1 比例 | 残缺 | P2 | `lib/upload.ts:5` |
| GAP-CRTR-047 | 上传 | 文件仅按扩展名校验，未检查 MIME 魔术字节（SVG 含脚本/EXE 伪装通过） | 配置缺失 | P1 | `lib/upload.ts:28-38` |
| GAP-CRTR-048 | 上传 | PRD §7.1.2 要求"显示波形和时长"；Step 3 为 SVG 假动画+"3:24 / 3:24" 硬编码 | 残缺 | P2 | `creator/upload/page.tsx:68-109` |
| GAP-CRTR-049 | 上传 | `audio_features` 提取完全在浏览器做，后端未校验 audioUrl 与 features 匹配 | 残缺 | P2 | `lib/audio-extract.ts`+`api/creator/upload/route.ts:83` |
| GAP-CRTR-050 | 短信 | 开发环境固定 "123456" 且未用 env 开关，生产若漏配 env 将跑开发分支 | 配置缺失 | P1 | `lib/sms.ts:33-42` |
| GAP-CRTR-051 | 短信 | sms/send 单位 1 分钟只允许 1 次，但无同手机号单日上限，可刷爆 | 配置缺失 | P1 | `lib/sms.ts:20-28` |
| GAP-CRTR-052 | 短信 | sms/verify 验证码错误无次数锁定（session 级无 attempt 记录） | 配置缺失 | P1 | `lib/sms.ts:67-85`+`api/auth/sms/verify/route.ts` |
| GAP-CRTR-053 | 短信 | 短信签名/模板 env 未配置后 `ALIYUN_ACCESS_KEY_ID` 存在时将直接异常 | 配置缺失 | P2 | `lib/sms.ts:44-63` |
| GAP-CRTR-054 | 认证 | 重置密码允许管理员账号同样重置，跨端风险 | 残缺 | P2 | `api/auth/reset-password/route.ts:32-38` |
| GAP-CRTR-055 | 认证 | logout 不写 `lastLogoutAt`，账号禁用时仍能用已签发 access_token 直到过期 | 残缺 | P2 | `api/auth/logout/route.ts` |
| GAP-CRTR-056 | 认证 | 5 次失败锁定基于内存 Map，重启进程 / 多实例失效 | 配置缺失 | P2 | `lib/rate-limit.ts:8-9` |
| GAP-CRTR-057 | 认证 | 前端 errorCount 在客户端计数，关闭页面重开即重置，"锁定"仅 UI 幻觉 | 残缺 | P2 | `components/auth/login-form.tsx:83,134,152` |
| GAP-CRTR-058 | 认证 | 登出 `window.confirm` 与其他模块自定义 Dialog 风格不一致 | 残缺 | P2 | `components/layout/sidebar.tsx:27` |
| GAP-CRTR-059 | 公开接口 | `/api/songs/published` 公开无限流，可被爬虫批量拉 | 配置缺失 | P1 | `middleware.ts:22-23`+`api/songs/published/route.ts` |
| GAP-CRTR-060 | 公开接口 | `/api/content` 公开接口返回所有 cms 字段（含 createdBy/updatedAt），建议收敛 | 残缺 | P2 | `api/content/route.ts:15-23` |
| GAP-CRTR-061 | 点赞 | 前端 `likedSongs` 仅本地 Set，切换 Tab/刷新即丢失；未从 API 拉当前用户已点赞列表 | 断链 | P1 | `creator/community/page.tsx:182,209-237` |
| GAP-CRTR-062 | 点赞 | 前端 `liked: currentlyLiked` 传但后端不读 body.liked，API 契约不一致 | 残缺 | P2 | `creator/community/page.tsx:222` vs `api/songs/[id]/like/route.ts:21-53` |
| GAP-CRTR-063 | 点赞 | 后端按 userId_songId 唯一幂等，但无刷频率限制 | 配置缺失 | P2 | `api/songs/[id]/like/route.ts` |
| GAP-CRTR-064 | 首页 | 学习进度单位为"N/M 课程"，`learnedCourses` 只看 completedAt 非空，部分进度不计入 | 残缺 | P2 | `creator/home/page.tsx:148-150` |
| GAP-CRTR-065 | 首页 | "最新动态"展示 `n.createdAt.split('T')[0]` 仅日期，和消息中心展示格式不一 | 残缺 | P2 | `creator/home/page.tsx:295-299` |
| GAP-CRTR-066 | 首页 | 热门课程默认按 `createdAt desc` 拉，PRD §7.1.1 要求按 views 倒序 | 残缺 | P2 | `api/content/route.ts:18` |
| GAP-CRTR-067 | 首页 | 未完成作业提示卡仅显示 `active && !submitted`，`needs_revision` 未置顶 | 残缺 | P2 | `creator/home/page.tsx:141-144` |
| GAP-CRTR-068 | 通用 | 所有 `parseInt` 有 isNaN 检查（合规），但作业 BPM、头像上传 size 等未检查 | 残缺 | P2 | 多点 |
| GAP-CRTR-069 | 重提流程 | 作业重新提交 API 重置 version + 清空 score/comment；不更新 copyrightCode 对应 updatedAt | 残缺 | P2 | `api/creator/assignments/[id]/submit/route.ts:59-91` |
| GAP-CRTR-070 | 重提流程 | 作业重提分支未同步更新 `submissionCount`（首次提交 +1，重提仍 +1 会虚高） | 残缺 | P2 | 同上 |
| GAP-CRTR-071 | 重提流程 | 自由上传重提 API 正确校验，但未发送"已重新进入评审"通知 | 断链 | P2 | `api/creator/upload/route.ts:38-62` |
| GAP-CRTR-072 | 密码 | profile/password `newPassword !== oldPassword` 检查缺失，允许新旧相同 | 残缺 | P2 | `api/profile/password/route.ts:13-17` |
| GAP-CRTR-073 | 密码 | 修改密码成功未清理其他会话/token（其他设备仍可用旧 token） | 残缺 | P2 | 同上 |
| GAP-CRTR-074 | 实名 | real-name API 通过后 idCard 加密已存，但实名被驳回后再次提交覆盖旧 idCard，无历史追溯 | 残缺 | P2 | `api/profile/real-name/route.ts:39-46` |
| GAP-CRTR-075 | 作品库 | 详情 `distributions` API 从 publish 状态写入，但 archived/已撤销作品 distributions 不会自动清理 | 残缺 | P2 | `api/creator/songs/[id]/route.ts:33-40` |
| GAP-CRTR-076 | 建议砍 | `contribution` 三档 UI（主导/协作/编辑）与 PRD 枚举两档（主导/参与）不一致 — 建议前端精简为 2 档 | 建议砍 | — | `creator/upload/page.tsx:55-59` |
| GAP-CRTR-077 | 建议砍 | profile PLATFORM_AGREEMENTS 硬编码 — 建议后端 /api/profile/agreements 替代 | 建议砍 | — | `creator/profile/page.tsx:17-20` |
| GAP-CRTR-078 | 建议砍 | courses VIDEO_DETAILS/ARTICLE_DETAILS 硬编码 — 改 cms_contents 增 sections JSON 字段 | 建议砍 | — | `creator/courses/page.tsx:30-43` |

## 详细条目（按优先级分组）

### P0 级（12 项）

#### GAP-CRTR-001: 评审/发行/结算/实名审核完成均未主动产生通知（全局断链）
- **类型**: 断链
- **所在**: `src/app/api/admin/**/*.ts`（批量）：`api/admin/songs/[id]/status/route.ts`、`api/admin/students/[id]/verify/route.ts`、`api/admin/revenue/settlements/*`、`api/review/submit/route.ts`
- **PRD 对应**: §7.1.1 "最新动态来自 notifications"；§E-1 评审通过/发行/结算/实名审核四类消息
- **当前状态**: 全平台只有 `api/admin/students/[id]/notify/route.ts:31` 一处 `prisma.notification.create`（管理员手动"提醒"），其余业务动作零触发
- **PRD 要求**: 评审完成→type=work 通知；发行完成→type=work；结算状态变更→type=revenue；实名审核结果→type=system
- **证据**: `grep -rn "prisma\.notification" api/` 仅命中 notify 路由
- **补齐动作**: 在 song_publish/review_submit/settlement_pay/verify_approve/verify_reject 处事务内插入 `notification.create`

#### GAP-CRTR-002: "已入库" Tab 请求 `status=in_library` 后端返回 400
- **类型**: 断链
- **所在**: `src/app/(creator)/creator/songs/page.tsx:58-66,159`；`src/app/api/creator/songs/route.ts:16-18`
- **PRD 对应**: §7.1.4 "已入库 Tab 实际合并展示 reviewed/ready_to_publish/archived 三种状态"
- **当前状态**: 前端构造 `/api/creator/songs?status=in_library`；后端只放行 SongStatus 枚举 6 值，命中 `return err('无效的状态值')`
- **补齐动作**: 后端识别 `status=in_library` 时改为 `status: { in: ['reviewed','ready_to_publish','archived'] }`

#### GAP-CRTR-003: 汽水音乐 Tab 数据表永远空
- **类型**: 断链
- **所在**: `src/app/(creator)/creator/revenue/page.tsx:138-139,251-282`；`src/app/api/creator/revenue/route.ts:98-111`
- **PRD 对应**: §7.1.5 "Tab 2 汽水音乐收益 展示按月收益明细"
- **当前状态**: API 仅返回 `qishuiRevenue`（总金额 number），不返回 `qishuiDetails` 列表；前端按 `data?.qishuiDetails` 取 list 永远 undefined
- **补齐动作**: 在 route.ts 新增 `qishuiDetails: { list: [...revenueRows], total }`，由 `prisma.revenueRow.findMany({ where: { mapping: { creatorId } } })` 填充

#### GAP-CRTR-004: 自由上传表单无 performer/专辑名/专辑歌手字段
- **类型**: 残缺
- **所在**: `src/app/(creator)/creator/upload/page.tsx` 全表单；`src/app/api/creator/upload/route.ts:23,68-88`
- **PRD 对应**: §4.4 platform_songs.performer/lyricist/composer/album_name/album_artist 默认实名/同标题；§7.3.7 批量下载需这些字段
- **当前状态**: 前端表单仅录 lyricist/composer，无 performer/albumName/albumArtist；API 不接收/填充默认值；DB 允许 NULL
- **补齐动作**: POST /api/creator/upload 入库前 `performer ??= user.realName; lyricist ??= user.realName; composer ??= user.realName; albumName ??= title; albumArtist ??= user.realName`

#### GAP-CRTR-005: 拖拽上传未实现
- **类型**: 残缺
- **所在**: `src/app/(creator)/creator/upload/page.tsx:449-503`；`src/app/(creator)/creator/assignments/page.tsx:300-327`
- **PRD 对应**: §7.1.2 Step1 "支持拖拽/点击"
- **当前状态**: 上传区块只有 `onClick={() => audioRef.current?.click()}`，无 `onDragOver`/`onDrop` 处理
- **补齐动作**: 为拖拽区容器补 `onDragOver={e=>e.preventDefault()}` + `onDrop={e=>{e.preventDefault();handleFileUpload(e.dataTransfer.files[0],'audio')}}`

#### GAP-CRTR-006: audio/cover URL 匿名可访问
- **类型**: 配置缺失 + 安全
- **所在**: `src/lib/upload.ts:42-48`；`public/uploads/` 目录
- **PRD 对应**: §10.5 "音频文件访问需鉴权（签名URL，有效期1小时）"
- **当前状态**: 本地模式 fileUrl = `/${key}`（如 `/uploads/audio/xxx.mp3`），写入 `public/uploads/`，Next.js 静态资源任意 GET 无鉴权
- **补齐动作**: 改用 `/api/upload/local/[...path]` 的 GET 分支（加登录校验 + 签名），或添加专用 `/api/files/[...path]` 签名鉴权路由

#### GAP-CRTR-007: OSS 分支用拼接 URL 而非 SDK signatureUrl
- **类型**: 配置缺失
- **所在**: `src/lib/upload.ts:51-65`
- **当前状态**: 代码有 `// TODO: 用阿里云 OSS SDK 生成预签名 PUT URL` 注释，实际 uploadUrl 是 `${domain}/${key}` 直拼，生产 OSS 会 403
- **补齐动作**: 引入 `ali-oss`，`client.signatureUrl(key, { method: 'PUT', expires: 300, 'Content-Type': ... })`

#### GAP-CRTR-008: 上传 token 无过期
- **类型**: 配置缺失
- **所在**: `src/lib/upload.ts:1-74`；`src/app/api/upload/token/route.ts`
- **PRD 对应**: §10.5 "签名URL，有效期1小时"
- **当前状态**: `createUploadToken` 返回的是固定 URL，无 expires 字段；本地模式下 uploadUrl 不变，可被他人重放
- **补齐动作**: 生成 HMAC 签名 + ts，OSS 分支走 SDK 自带 expires；local 模式 PUT 拦截验时间戳

#### GAP-CRTR-009: 短信/重置密码/upload/token 等 API 无 IP 限流
- **类型**: 配置缺失
- **所在**: `api/auth/sms/send/route.ts`、`api/auth/sms/verify/route.ts`、`api/auth/reset-password/route.ts`、`api/upload/token/route.ts`
- **PRD 对应**: §10.6 "同一IP每分钟最多60次API调用；登录接口每IP每分钟最多10次"
- **当前状态**: 只有 `api/auth/login/route.ts:35-38` 调用 `ipRateLimit`，其余写入端点无调用
- **补齐动作**: 在 sms/send、sms/verify、reset-password、upload/token 头部加 `ipRateLimit(ip, 'sms_send', 5, 60_000)` 等

#### GAP-CRTR-010: 邀请码无爆破防护
- **类型**: 配置缺失
- **所在**: `src/app/api/auth/sms/verify/route.ts:32-39`
- **PRD 对应**: §4.1 "邀请码 VARCHAR(20) UNIQUE"；GAPS §I-7
- **当前状态**: 输入任意 inviteCode，未找到组返回 400；但无单 IP/手机号错误次数限制，可脚本枚举
- **补齐动作**: 对 `inviteCode 无效` 计数到 IP + phone 维度，超 5 次/小时锁定

#### GAP-CRTR-011: 消息中心时间栏显示 undefined
- **类型**: 断链
- **所在**: `src/app/(creator)/creator/notifications/page.tsx:154`；`src/app/api/creator/notifications/route.ts:33-39`
- **当前状态**: 前端 interface `Notification.time: string`，使用 `{n.time} | {TYPE_LABEL}`；API 返回 `createdAt` 字段，无 `time`。UI 显示 `undefined | 作品动态`
- **补齐动作**: API `time: n.createdAt.toISOString()`，或前端改用 `n.createdAt`

#### GAP-CRTR-038: 实名审核通过/驳回 无消息推送
- **类型**: 断链
- **所在**: `src/app/api/admin/students/[id]/verify/route.ts:33-51`
- **PRD 对应**: §7.3.4 实名"通过/驳回/提醒"；§E-2 驳回后"消息含原因"
- **当前状态**: 更新 realNameStatus 后只调 logAdminAction，不 create Notification
- **补齐动作**: 事务追加 `notification.create({ data: { userId, type:'system', title: action==='approve'? '实名认证已通过' : '实名认证被驳回，请修改后重新提交' } })`

### P1 级（15 项）

#### GAP-CRTR-012: 视频课程无真实播放能力
- **类型**: 残缺
- **所在**: `creator/courses/page.tsx:176-191`；`prisma/schema.prisma` CmsContent 模型
- **补齐动作**: schema 加 `videoUrl String?` + CMS 新建界面加上传字段；前端用 `<video controls src>` 播放

#### GAP-CRTR-013: 课程 sections/duration 按 ID 硬编码
- **补齐动作**: schema 加 `sections Json?`、`duration String?`、`level String?` 到 CmsContent，后端 API 返回，前端直接用

#### GAP-CRTR-014: courses 学习进度判定不合理
- **补齐动作**: 视频进度用 `video.ontimeupdate` 取 `currentTime/duration`；图文用滚动百分比

#### GAP-CRTR-015: 分享未调 clipboard
- **补齐动作**: `await navigator.clipboard.writeText(${location.origin}/s/${song.copyrightCode})` 后再 toast

#### GAP-CRTR-016: 作品广场 cover 字段不匹配
- **补齐动作**: 前端把 `song.coverUrl` 作为 `<img>` 源；无上传图片时才用 genre/title hash 选 Emoji

#### GAP-CRTR-018: 作品库卡片 cover/audioUrl 字段缺失
- **补齐动作**: API list map 补返回 `coverUrl/audioUrl/lyricist/composer/performer`

#### GAP-CRTR-020: AI 工具字段单复数不一致
- **补齐动作**: 前端改为 `(s.aiTools ?? []).join('/')` 或 `s.aiTools?.[0]`

#### GAP-CRTR-022/023: 作业已提交无重新提交入口
- **补齐动作**: assignments API 返回 submission.status；前端若 `status==='needs_revision'` 改按钮为"修改并重新提交"

#### GAP-CRTR-030: "更换手机"按钮无 onClick handler
- **补齐动作**: 后端新增 `POST /api/profile/phone`（旧手机验证码 + 新手机验证码），前端打开 Modal 两步验证流程

#### GAP-CRTR-047: 仅按扩展名校验文件
- **补齐动作**: 在 `api/upload/local/[...path]` PUT 处读 buffer 头 4 字节，校对 MP3/WAV/PNG/JPEG 魔术数

#### GAP-CRTR-050/051/052: 短信验证码错误/发送/验证无锁定
- **补齐动作**: SmsCode 表加 attempts 字段；sms/verify 错误递增 ≥5 次锁定 phone 15 分钟；同手机号每日发送次数 ≤10

#### GAP-CRTR-059: /api/songs/published 公开接口无限流
- **补齐动作**: middleware 对 PUBLIC_PATHS 仍调用 `ipRateLimit(ip, 'public', 60, 60_000)`

#### GAP-CRTR-061: 点赞状态刷新丢失
- **补齐动作**: GET /api/songs/published 附带 `likedByMe: boolean`（登录时查 likeRecord），或单独 `/api/songs/my-likes` 返回 Set

### P2 级（48 项）

GAP-CRTR-017, 019, 021, 024~029, 031~037, 039~046, 048~049, 053~058, 060, 062~075。

关键主题聚合：
- **profile 硬编码清理**：入职时间、协议 signedAt、代理协议内容、表格标题（一波 P2）
- **上传能力细节**：AI 工具多选、contribution 枚举对齐、创作过程说明可选、封面 1:1 校验、真实波形
- **注册体验**：协议 Checkbox 数量对齐、已注册手机号提示清晰、实名引导 toast
- **重提流程细节**：submissionCount 不重复 +1、重提后通知
- **session 安全**：内存 rate-limit 切 Redis、logout token 吊销
- **首页体验**：needs_revision 置顶、热门课程按 views、格式统一

### 建议砍（3 项）

#### GAP-CRTR-076: contribution 三档 UI vs 两档 schema
- 建议 UI 简化为 2 档与 schema 对齐

#### GAP-CRTR-077: profile PLATFORM_AGREEMENTS 硬编码
- 建议后端 `/api/profile/agreements` 返回，后续协议版本升级才灵活

#### GAP-CRTR-078: courses VIDEO_DETAILS/ARTICLE_DETAILS 硬编码对象
- 改 CmsContent schema 增 JSON 字段

## 审计结论要点

1. **全平台通知机制仅 1 处写入点** —— 最严重的 PRD 闭环缺失。评审通过、发行、结算打款、实名审核、作业截止提醒、重提进入评审全部不触发 notifications
2. **上传全链路安全 4 项不及格**：URL 匿名可访 / OSS 分支假 URL / token 无时效 / MIME 不校验
3. **创作者端约一半残缺在"硬编码"**：课程 sections/duration、入职时间、协议条款、收益时间戳、分享文本
4. **字段契约不一致**：notification.time vs createdAt、song.cover vs coverUrl、song.aiTool vs aiTools、revenue qishuiDetails 缺失
5. **重提流程**：后端支持 needs_revision 重提，但前端作业页完全没有入口（按"已提交"处理），PRD §7.1.3 闭环未达成
