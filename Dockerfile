# ── Stage 1: 安装依赖 ──
FROM node:20-alpine AS deps
RUN sed -i 's#https\?://dl-cdn.alpinelinux.org#https://mirrors.aliyun.com#g' /etc/apk/repositories \
    && apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
# 跳过 @playwright/test 的 postinstall 浏览器下载（E2E 只在本地/CI 执行，服务器不需要）
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=0
RUN npm config set registry https://registry.npmmirror.com \
    && npm ci

# ── Stage 2: 构建 ──
FROM node:20-alpine AS builder
RUN sed -i 's#https\?://dl-cdn.alpinelinux.org#https://mirrors.aliyun.com#g' /etc/apk/repositories \
    && apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Stage 3: 运行 ──
FROM node:20-alpine AS runner
RUN sed -i 's#https\?://dl-cdn.alpinelinux.org#https://mirrors.aliyun.com#g' /etc/apk/repositories \
    && apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# standalone 构建产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma runtime
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# seed 依赖
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Theme 5: 本地上传落盘目录（生产切 OSS 后此目录空）
RUN mkdir -p storage/uploads/audio storage/uploads/images && chown -R nextjs:nodejs storage

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
