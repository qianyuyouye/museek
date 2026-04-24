import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'
import { verifySmsCode } from '@/lib/sms'

export const PUT = safeHandler(async function PUT(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal === 'admin') return err('未登录', 401)

  const body = await request.json()
  const { email, code } = body as { email?: string; code?: string }

  if (!email || !code) return err('邮箱和验证码均为必填')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('邮箱格式不正确')

  // 先查用户信息
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true, email: true } })
  if (!user) return err('用户不存在', 404)

  // 邮箱未变化则跳过，无需验码
  if (user.email === email) return ok({ email })

  // 再查邮箱是否已被其他用户使用（在验码之前拦截，避免浪费验证码）
  const existing = await prisma.user.findFirst({ where: { email, id: { not: userId } } })
  if (existing) return err('该邮箱已被其他用户使用')

  // 验证发送到当前手机的验证码
  const valid = await verifySmsCode(user.phone, code, 'changeEmail')
  if (!valid) return err('验证码错误或已过期')

  await prisma.user.update({ where: { id: userId }, data: { email } })

  return ok({ email })
})
