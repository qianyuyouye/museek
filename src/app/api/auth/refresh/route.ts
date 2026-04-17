import { NextResponse } from 'next/server'
import { verifyToken, signAccessToken, setAuthCookies, getRefreshTokenFromCookies, signRefreshToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safeHandler } from '@/lib/api-utils'

export const POST = safeHandler(async function POST() {
  const refreshToken = await getRefreshTokenFromCookies()
  if (!refreshToken) {
    return NextResponse.json({ code: 401, message: 'refresh token 不存在' }, { status: 401 })
  }

  try {
    const payload = await verifyToken(refreshToken)

    // 检查用户当前状态，被禁用则拒绝续签，并重新组装完整 payload
    let fullPayload: Parameters<typeof signAccessToken>[0]

    if (payload.portal === 'admin') {
      const admin = await prisma.adminUser.findUnique({ where: { id: Number(payload.sub) } })
      if (!admin || !admin.status) {
        return NextResponse.json({ code: 401, message: '账号已被禁用' }, { status: 401 })
      }
      fullPayload = {
        sub: admin.id,
        account: admin.account,
        roleId: admin.roleId,
        portal: 'admin' as const,
      }
    } else {
      const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } })
      if (!user || user.status === 'disabled') {
        return NextResponse.json({ code: 401, message: '账号已被禁用' }, { status: 401 })
      }
      fullPayload = {
        sub: user.id,
        type: user.type as 'creator' | 'reviewer',
        phone: user.phone,
        adminLevel: user.adminLevel as 'group_admin' | 'system_admin' | null,
        portal: payload.portal as 'creator' | 'reviewer',
      }
    }

    const newAccessToken = await signAccessToken(fullPayload)
    const newRefreshToken = await signRefreshToken(fullPayload)
    await setAuthCookies(newAccessToken, newRefreshToken, fullPayload.portal)
    return NextResponse.json({ code: 200, message: 'token 已续签' })
  } catch {
    return NextResponse.json({ code: 401, message: 'refresh token 已过期' }, { status: 401 })
  }
})
