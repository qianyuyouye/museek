import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler} from '@/lib/api-utils'
import { hashPassword, verifyPassword } from '@/lib/password'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId) return err('未登录', 401)

  const body = await request.json()
  const { oldPassword, newPassword } = body as { oldPassword: string; newPassword: string }

  if (!oldPassword || !newPassword) return err('请填写旧密码和新密码')
  if (newPassword.length < 8) return err('新密码长度不能少于 8 位')
  if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return err('新密码必须同时包含字母与数字')
  }

  if (portal === 'admin') {
    const admin = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    })
    if (!admin) return err('用户不存在', 404)

    const valid = await verifyPassword(oldPassword, admin.passwordHash)
    if (!valid) return err('旧密码错误')

    const passwordHash = await hashPassword(newPassword)
    await prisma.adminUser.update({ where: { id: userId }, data: { passwordHash } })
    return ok()
  }

  // creator / reviewer
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  })
  if (!user) return err('用户不存在', 404)
  if (!user.passwordHash) return err('当前账号未设置密码，请联系管理员')

  const valid = await verifyPassword(oldPassword, user.passwordHash)
  if (!valid) return err('旧密码错误')

  const passwordHash = await hashPassword(newPassword)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } })
  return ok()
})
