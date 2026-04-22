import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler, getClientIp } from '@/lib/api-utils'
import { verifySmsCode } from '@/lib/sms'
import { ipRateLimit } from '@/lib/rate-limit'
import { logAdminAction } from '@/lib/log-action'

/**
 * 更换手机号：要求用户当前已登录（creator / reviewer），提交旧手机 + 旧验证码 + 新手机 + 新验证码。
 * 双验证码都通过后才改库；新手机号不可重复。
 */

export const POST = safeHandler(async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (ip && (await ipRateLimit(ip, 'change-phone', 5, 60 * 1000))) {
    return NextResponse.json({ code: 429, message: '请求过于频繁，请稍后再试' }, { status: 429 })
  }

  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal === 'admin' || !portal) return err('未登录', 401)

  const body = await request.json()
  const { oldPhone, oldCode, newPhone, newCode } = body as {
    oldPhone: string
    oldCode: string
    newPhone: string
    newCode: string
  }

  if (!oldPhone || !oldCode || !newPhone || !newCode) {
    return err('旧手机号、新手机号及两套验证码均为必填')
  }
  if (!/^1[3-9]\d{9}$/.test(oldPhone)) return err('旧手机号格式不正确')
  if (!/^1[3-9]\d{9}$/.test(newPhone)) return err('新手机号格式不正确')
  if (oldPhone === newPhone) return err('新手机号不能与旧手机号相同')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return err('用户不存在', 404)
  if (user.phone !== oldPhone) return err('旧手机号与当前账号不匹配')

  // 新手机号不可被他人占用
  const occupied = await prisma.user.findUnique({ where: { phone: newPhone }, select: { id: true } })
  if (occupied && occupied.id !== userId) return err('新手机号已被其他账号使用')

  // 分别验证两套验证码
  const oldOk = await verifySmsCode(oldPhone, oldCode, 'changePhone')
  if (!oldOk) return err('旧手机号验证码错误或已过期')
  const newOk = await verifySmsCode(newPhone, newCode, 'changePhone')
  if (!newOk) return err('新手机号验证码错误或已过期')

  await prisma.user.update({ where: { id: userId }, data: { phone: newPhone } })

  try {
    await logAdminAction(request, {
      action: 'change_phone',
      targetType: 'user',
      targetId: userId,
      detail: { from: oldPhone, to: newPhone, portal },
    })
  } catch {
    /* 日志失败不阻断主业务 */
  }

  return ok({ phone: newPhone })
})
