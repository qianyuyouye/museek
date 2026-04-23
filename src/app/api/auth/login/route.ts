import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { signAccessToken, signRefreshToken } from '@/lib/auth'
import type { UserJwtPayload, AdminJwtPayload } from '@/types/auth'
import { safeHandler, getClientIp } from '@/lib/api-utils'
import { ipRateLimit, recordLoginFailure, isAccountLocked, clearLoginFailure } from '@/lib/rate-limit'

function setResponseCookies(response: NextResponse, accessToken: string, refreshToken: string, portal?: string) {
  const accessMaxAge = portal === 'admin' ? 60 * 60 * 8 : 60 * 60 * 24
  response.cookies.set('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: accessMaxAge,
  })
  response.cookies.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export const POST = safeHandler(async function POST(request: NextRequest) {
  const { account, password, portal } = await request.json()

  if (!account || !password || !portal) {
    return NextResponse.json({ code: 400, message: '账号、密码和端类型不能为空' }, { status: 400 })
  }

  // IP 限流：每分钟最多 10 次登录尝试（PRD §10.6）
  const ip = getClientIp(request)
  if (ip && (await ipRateLimit(ip, 'login', 10, 60 * 1000))) {
    return NextResponse.json({ code: 429, message: '登录过于频繁，请稍后再试' }, { status: 429 })
  }
  // 账号锁定：连续失败 5 次锁定 5 分钟
  const lockedFor = await isAccountLocked(account)
  if (lockedFor > 0) {
    return NextResponse.json({ code: 423, message: `账号已暂时锁定，请 ${lockedFor} 秒后重试` }, { status: 423 })
  }

  if (portal === 'admin') {
    const admin = await prisma.adminUser.findUnique({
      where: { account },
      include: { role: true },
    })

    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      await recordLoginFailure(account)
      return NextResponse.json({ code: 401, message: '账号或密码错误' }, { status: 401 })
    }

    if (!admin.status) {
      return NextResponse.json({ code: 403, message: '账号已被禁用' }, { status: 403 })
    }

    await clearLoginFailure(account)

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || ''

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: clientIp,
      },
    }).catch(() => {})

    await prisma.loginLog.create({
      data: {
        userId: admin.id,
        portal: 'admin',
        ip: clientIp,
        userAgent: request.headers.get('user-agent') || null,
      },
    }).catch(() => {})

    const payload: AdminJwtPayload = {
      sub: admin.id,
      account: admin.account,
      roleId: admin.roleId,
      portal: 'admin',
    }

    const accessToken = await signAccessToken(payload)
    const refreshToken = await signRefreshToken(payload)
    const response = NextResponse.json({
      code: 200,
      message: '登录成功',
      data: {
        id: admin.id,
        account: admin.account,
        name: admin.name,
        roleName: admin.role.name,
        portal: 'admin',
      },
    })
    setResponseCookies(response, accessToken, refreshToken, 'admin')
    return response
  }

  if (portal === 'reviewer') {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ phone: account }, { email: account }],
        type: 'reviewer',
      },
    })

    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      await recordLoginFailure(account)
      return NextResponse.json({ code: 401, message: '账号或密码错误' }, { status: 401 })
    }

    if (user.status === 'disabled') {
      return NextResponse.json({ code: 403, message: '账号已被禁用' }, { status: 403 })
    }

    await clearLoginFailure(account)

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    await prisma.loginLog.create({
      data: {
        userId: user.id,
        portal: 'reviewer',
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    })

    const payload: UserJwtPayload = {
      sub: user.id,
      type: 'reviewer',
      phone: user.phone,
      adminLevel: user.adminLevel as 'group_admin' | 'system_admin' | null,
      portal: 'reviewer',
    }

    const accessToken = await signAccessToken(payload)
    const refreshToken = await signRefreshToken(payload)
    const response = NextResponse.json({
      code: 200,
      message: '登录成功',
      data: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        type: 'reviewer',
        portal: 'reviewer',
      },
    })
    setResponseCookies(response, accessToken, refreshToken, 'reviewer')
    return response
  }

  if (portal === 'creator') {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ phone: account }, { email: account }],
        type: 'creator',
      },
    })

    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      await recordLoginFailure(account)
      return NextResponse.json({ code: 401, message: '账号或密码错误' }, { status: 401 })
    }

    if (user.status === 'disabled') {
      return NextResponse.json({ code: 403, message: '账号已被禁用' }, { status: 403 })
    }

    await clearLoginFailure(account)

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    await prisma.loginLog.create({
      data: {
        userId: user.id,
        portal: 'creator',
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    })

    const payload: UserJwtPayload = {
      sub: user.id,
      type: 'creator',
      phone: user.phone,
      adminLevel: user.adminLevel as 'group_admin' | 'system_admin' | null,
      portal: 'creator',
    }

    const accessToken = await signAccessToken(payload)
    const refreshToken = await signRefreshToken(payload)
    const response = NextResponse.json({
      code: 200,
      message: '登录成功',
      data: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        type: 'creator',
        portal: 'creator',
      },
    })
    setResponseCookies(response, accessToken, refreshToken, 'creator')
    return response
  }

  return NextResponse.json({ code: 400, message: '无效的 portal 参数' }, { status: 400 })
})
