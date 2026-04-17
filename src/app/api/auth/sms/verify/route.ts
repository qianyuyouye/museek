import { NextRequest, NextResponse } from 'next/server'
import { verifySmsCode } from '@/lib/sms'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { signAccessToken, signRefreshToken, setAuthCookies } from '@/lib/auth'
import type { UserJwtPayload } from '@/types/auth'
import { safeHandler } from '@/lib/api-utils'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const { phone, code, password, inviteCode } = await request.json()

  if (!phone || !code) {
    return NextResponse.json({ code: 400, message: '手机号和验证码不能为空' }, { status: 400 })
  }

  const valid = await verifySmsCode(phone, code)
  if (!valid) {
    return NextResponse.json({ code: 400, message: '验证码错误或已过期' }, { status: 400 })
  }

  let user = await prisma.user.findUnique({ where: { phone } })

  if (!user) {
    if (!password || password.length < 8) {
      return NextResponse.json({ code: 400, message: '密码至少8位' }, { status: 400 })
    }

    if (!inviteCode) {
      return NextResponse.json({ code: 400, message: '邀请码不能为空' }, { status: 400 })
    }

    const group = await prisma.group.findUnique({ where: { inviteCode } })
    if (!group || group.status !== 'active') {
      return NextResponse.json({ code: 400, message: '邀请码无效或已停用' }, { status: 400 })
    }
    const groupId = group.id

    user = await prisma.user.create({
      data: {
        phone,
        passwordHash: await hashPassword(password),
        type: 'creator',
        realNameStatus: 'unverified',
      },
    })

    await prisma.userGroup.create({
      data: { userId: user.id, groupId },
    })
  }

  if (user.status === 'disabled') {
    return NextResponse.json({ code: 403, message: '账号已被禁用' }, { status: 403 })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const payload: UserJwtPayload = {
    sub: user.id,
    type: user.type as 'creator' | 'reviewer',
    phone: user.phone,
    adminLevel: user.adminLevel as 'group_admin' | 'system_admin' | null,
    portal: user.type === 'creator' ? 'creator' : 'reviewer',
  }

  const accessToken = await signAccessToken(payload)
  const refreshToken = await signRefreshToken(payload)
  await setAuthCookies(accessToken, refreshToken, payload.portal)

  return NextResponse.json({
    code: 200,
    message: '登录成功',
    data: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      type: user.type,
      portal: payload.portal,
    },
  })
})
