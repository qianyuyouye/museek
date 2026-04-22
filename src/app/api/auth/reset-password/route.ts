import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, err, safeHandler, getClientIp } from '@/lib/api-utils'
import { verifySmsCode } from '@/lib/sms'
import { hashPassword, validatePassword } from '@/lib/password'
import { ipRateLimit } from '@/lib/rate-limit'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  // Theme 8: IP 限流 5/min
  if (ip && (await ipRateLimit(ip, 'reset-password', 5, 60 * 1000))) {
    return err('请求过于频繁，请稍后再试', 429)
  }

  const { phone, code, newPassword } = await request.json() as {
    phone?: string
    code?: string
    newPassword?: string
  }

  if (!phone || !code || !newPassword) return err('请填写手机号、验证码和新密码')
  if (!/^1[3-9]\d{9}$/.test(phone)) return err('手机号格式不正确')
  const pwdErr = validatePassword(newPassword)
  if (pwdErr) return err(pwdErr)

  const valid = await verifySmsCode(phone, code, 'resetPassword')
  if (!valid) return err('验证码无效或已过期')

  // 尝试在 user 表查找（创作者/评审）
  const user = await prisma.user.findFirst({ where: { phone } })
  if (user) {
    const passwordHash = await hashPassword(newPassword)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })
    return ok()
  }

  // 尝试在 adminUser 表查找（管理员）
  const admin = await prisma.adminUser.findFirst({ where: { account: phone } })
  if (admin) {
    const passwordHash = await hashPassword(newPassword)
    await prisma.adminUser.update({ where: { id: admin.id }, data: { passwordHash } })
    return ok()
  }

  return err('该手机号未注册')
})
