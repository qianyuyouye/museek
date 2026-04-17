# Museek — AI 音乐教学与版权代理平台

## 快速开始

### Docker 部署（推荐）

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 修改 MYSQL_ROOT_PASSWORD 和 JWT_SECRET

# 2. 启动
docker compose up -d

# 3. 首次初始化（建表 + 创建管理员账号）
docker compose --profile init run init

# 4. 访问
open http://localhost:3000/admin/login
```

默认管理员：`admin` / `Abc12345`（首次登录后请修改密码）

### 本地开发

```bash
# 安装依赖
npm install

# 配置数据库（需要 MySQL 8.0）
cp .env.example .env
# 编辑 DATABASE_URL

# 初始化数据库
npx prisma db push
npx prisma db seed

# 启动开发服务器
npm run dev
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | MySQL 连接地址 |
| `JWT_SECRET` | 是 | JWT 签名密钥（生产环境必须修改） |
| `MYSQL_ROOT_PASSWORD` | Docker | MySQL root 密码 |
| `AI_API_KEY` | 否 | OpenAI 兼容 API 密钥（AI 预分析功能） |
| `AI_API_BASE_URL` | 否 | API 地址，默认 OpenAI |
| `AI_MODEL` | 否 | 模型名称，默认 gpt-4o-mini |
| `OSS_BUCKET` | 否 | 阿里云 OSS Bucket（配置后文件上传走 OSS） |

## 三端入口

| 端 | 地址 | 说明 |
|---|------|------|
| 管理端 | `/admin/login` | 运营管理后台 |
| 创作者端 | `/creator/login` | 创作者注册/登录 |
| 评审端 | `/review/login` | 评审专家登录 |

## 技术栈

- Next.js 15 + React 19 + TypeScript + Tailwind CSS
- Prisma ORM + MySQL 8.0
- JWT 认证 + HttpOnly Cookie
- Docker 多阶段构建（standalone 模式）
