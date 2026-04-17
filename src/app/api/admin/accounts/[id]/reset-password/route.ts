import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ok, err, safeHandler } from '@/lib/api-utils'
import { hashPassword } from '@/lib/password'

export const POST = safeHandler(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) return err('无效的用户 ID')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return err('用户不存在', 404)

  const body = await request.json()
  const { password } = body

  if (!password) return err('缺少必填字段：password')
  if (password.length < 8) return err('密码长度不能少于 8 位')

  const passwordHash = await hashPassword(password)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  })

  return ok()
})
