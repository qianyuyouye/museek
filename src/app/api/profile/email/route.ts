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

  // 验证发送到当前手机的验证码
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true, email: true } })
  if (!user) return err('用户不存在', 404)

  const valid = await verifySmsCode(user.phone, code, 'changeEmail')
  if (!valid) return err('验证码错误或已过期')

  // 检查邮箱是否已被其他用户使用
  const existing = await prisma.user.findFirst({ where: { email, id: { not: userId } } })
  if (existing) return err('该邮箱已被其他用户使用')

  // 邮箱未变化则跳过
  if (user.email === email) return ok({ email })

  await prisma.user.update({ where: { id: userId }, data: { email } })

  return ok({ email })
})
