import { NextRequest, NextResponse } from 'next/server'
import { verifySmsCode } from '@/lib/sms'
import { prisma } from '@/lib/prisma'
import { hashPassword, validatePassword } from '@/lib/password'
import { signAccessToken, signRefreshToken, setAuthCookies } from '@/lib/auth'
import type { UserJwtPayload } from '@/types/auth'
import { safeHandler, getClientIp } from '@/lib/api-utils'
import {
  ipRateLimit,
  recordSmsVerifyFailure,
  isSmsVerifyLocked,
  clearSmsVerifyFailure,
  recordInviteCodeFailure,
  isInviteCodeLocked,
} from '@/lib/rate-limit'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  // Theme 8: IP 限流 20/min
  if (ip && (await ipRateLimit(ip, 'sms-verify', 20, 60 * 1000))) {
    return NextResponse.json({ code: 429, message: '请求过于频繁，请稍后再试' }, { status: 429 })
  }

  const { phone, code, password, inviteCode, agreeMusic } = await request.json()

  if (!phone || !code) {
    return NextResponse.json({ code: 400, message: '手机号和验证码不能为空' }, { status: 400 })
  }

  // Theme 8: 验证码错误 5 次锁 15min
  const lockedFor = await isSmsVerifyLocked(phone)
  if (lockedFor > 0) {
    return NextResponse.json({ code: 423, message: `验证码错误过多，请 ${lockedFor} 秒后重试` }, { status: 423 })
  }

  // 邀请码校验前置（避免无效邀请码消耗验证码）
  if (!inviteCode) {
    return NextResponse.json({ code: 400, message: '邀请码不能为空' }, { status: 400 })
  }
  // Theme 8: 邀请码爆破防护
  if (ip && (await isInviteCodeLocked(ip, phone))) {
    return NextResponse.json({ code: 423, message: '邀请码错误次数过多，请 1 小时后重试' }, { status: 423 })
  }
  const group = await prisma.group.findUnique({ where: { inviteCode } })
  if (!group || group.status !== 'active') {
    if (ip) await recordInviteCodeFailure(ip, phone)
    return NextResponse.json({ code: 400, message: '邀请码无效或已停用' }, { status: 400 })
  }

  const valid = await verifySmsCode(phone, code, 'register')
  if (!valid) {
    await recordSmsVerifyFailure(phone)
    return NextResponse.json({ code: 400, message: '验证码错误或已过期' }, { status: 400 })
  }
  await clearSmsVerifyFailure(phone)

  let user = await prisma.user.findUnique({ where: { phone } })

  if (!user) {
    const pwdErr = validatePassword(password)
    if (pwdErr) {
      return NextResponse.json({ code: 400, message: pwdErr }, { status: 400 })
    }
    const groupId = group.id

    user = await prisma.user.create({
      data: {
        phone,
        passwordHash: await hashPassword(password),
        type: 'creator',
        realNameStatus: 'unverified',
        ...(agreeMusic ? { agencyContract: true, agencySignedAt: new Date() } : {}),
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
