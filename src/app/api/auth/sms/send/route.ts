import { NextRequest, NextResponse } from 'next/server'
import { sendSmsCode } from '@/lib/sms'
import { safeHandler } from '@/lib/api-utils'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const { phone } = await request.json()

  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ code: 400, message: '手机号格式不正确' }, { status: 400 })
  }

  const result = await sendSmsCode(phone)
  return NextResponse.json({
    code: result.success ? 200 : 400,
    message: result.message,
  })
})
