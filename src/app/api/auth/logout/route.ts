import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { clearAuthCookies } from '@/lib/auth'
import { safeHandler } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// Theme 8: logout 写 token_blacklist，防止被盗 token 继续使用
export const POST = safeHandler(async function POST(request: NextRequest) {
  const access = request.cookies.get('access_token')?.value
  const refresh = request.cookies.get('refresh_token')?.value

  const jwtSecret = process.env.JWT_SECRET || 'fallback-dev-secret'
  const secret = new TextEncoder().encode(jwtSecret)

  async function blacklist(token: string | undefined, reason: string) {
    if (!token) return
    try {
      const { payload } = await jwtVerify(token, secret)
      if (!payload.jti || !payload.exp || !payload.sub) return
      const expiresAt = new Date((payload.exp as number) * 1000)
      await prisma.tokenBlacklist.upsert({
        where: { jti: payload.jti as string },
        create: {
          jti: payload.jti as string,
          userId: Number(payload.sub),
          reason,
          expiresAt,
        },
        update: {}, // 已存在则不改
      })
    } catch {
      // token 已过期或无效：无需再 blacklist
    }
  }

  await Promise.all([blacklist(access, 'logout'), blacklist(refresh, 'logout')])
  await clearAuthCookies()

  return NextResponse.json({ code: 200, message: '已退出登录' })
})
