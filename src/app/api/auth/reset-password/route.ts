import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, err, safeHandler } from '@/lib/api-utils'
import { verifySmsCode } from '@/lib/sms'
import { hashPassword } from '@/lib/password'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const { phone, code, newPassword } = await request.json() as {
    phone?: string
    code?: string
    newPassword?: string
  }

  if (!phone || !code || !newPassword) return err('请填写手机号、验证码和新密码')
  if (!/^1[3-9]\d{9}$/.test(phone)) return err('手机号格式不正确')
  if (newPassword.length < 8) return err('密码长度不能少于 8 位')
  if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return err('密码必须同时包含字母与数字')
  }

  const valid = await verifySmsCode(phone, code)
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
