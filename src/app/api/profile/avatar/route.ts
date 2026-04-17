import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'

/** 更新头像：客户端先走 upload/token 直传拿到 fileUrl，再 POST 本接口回写 avatarUrl */
export const POST = safeHandler(async function POST(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId) return err('未登录', 401)

  const body = await request.json()
  const avatarUrl = typeof body?.avatarUrl === 'string' ? body.avatarUrl.trim() : ''
  if (!avatarUrl) return err('avatarUrl 必填')
  if (avatarUrl.length > 500) return err('avatarUrl 过长')

  if (portal === 'admin') {
    await prisma.adminUser.update({ where: { id: userId }, data: { avatarUrl } })
  } else {
    await prisma.user.update({ where: { id: userId }, data: { avatarUrl } })
  }

  return ok({ avatarUrl })
})
