import { NextRequest, NextResponse } from 'next/server'
import { sendSmsCode } from '@/lib/sms'
import { safeHandler } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const { phone, purpose } = await request.json() as { phone: string; purpose?: 'register' | 'reset_password' }

  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ code: 400, message: '手机号格式不正确' }, { status: 400 })
  }

  // 注册场景：手机号已被占用则拒绝发送，避免枚举/骚扰
  // 重置密码场景：手机号必须已注册
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
