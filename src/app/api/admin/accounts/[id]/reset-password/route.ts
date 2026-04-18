import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { hashPassword } from '@/lib/password'

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

export const POST = safeHandler(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) return err('无效的用户 ID')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return err('用户不存在', 404)

  const body = await request.json().catch(() => ({}))
  let password = (body as { password?: string }).password

  if (!password) {
    password = generatePassword()
  }
  if (password.length < 8) return err('密码长度不能少于 8 位')

  const passwordHash = await hashPassword(password)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  })

  await logAdminAction(request, {
    action: 'reset_password',
    targetType: 'user',
    targetId: userId,
    detail: { name: user.name, phone: user.phone },
  })
  return ok({ password })
})
