import { NextRequest, NextResponse } from 'next/server'
import { sendSmsCode } from '@/lib/sms'
import { safeHandler, getClientIp } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { ipRateLimit } from '@/lib/rate-limit'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  // Theme 8: IP 限流 5/min（防刷接口）
  if (ip && (await ipRateLimit(ip, 'sms-send', 5, 60 * 1000))) {
    return NextResponse.json({ code: 429, message: '请求过于频繁，请稍后再试' }, { status: 429 })
  }

  const { phone, purpose } = await request.json() as {
    phone: string
    purpose?: 'register' | 'reset_password' | 'change_phone'
  }

  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ code: 400, message: '手机号格式不正确' }, { status: 400 })
  }

  // 注册场景：手机号已被占用则拒绝发送，避免枚举/骚扰
  // 重置密码场景：手机号必须已注册
  // 更换手机号场景：绕过存在性判断（/api/profile/phone 会双验证码校验）
  if (purpose === 'register' || purpose === 'reset_password') {
    const exists = await prisma.user.findUnique({ where: { phone }, select: { id: true } })
    if (purpose === 'register' && exists) {
      return NextResponse.json({ code: 400, message: '该手机号已注册' }, { status: 400 })
    }
    if (purpose === 'reset_password' && !exists) {
      return NextResponse.json({ code: 400, message: '该手机号未注册' }, { status: 400 })
    }
  }

  const result = await sendSmsCode(phone)
  return NextResponse.json({
    code: result.success ? 200 : 400,
    message: result.message,
  }, { status: result.success ? 200 : 400 })
})
