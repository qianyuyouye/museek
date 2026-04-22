import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { hashPassword, validatePassword } from '@/lib/password'
import { logAdminAction } from '@/lib/log-action'

type Params = { params: Promise<{ id: string }> }

export const POST = safeHandler(async function POST(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'admin.admins.manage')
  if ('error' in auth) return auth.error

  const { id } = await params
  const adminId = parseInt(id, 10)
  if (isNaN(adminId)) return err('无效的管理员 ID')

  const target = await prisma.adminUser.findUnique({ where: { id: adminId } })
  if (!target) return err('管理员不存在', 404)

  const body = await request.json()
  const { password } = body as { password?: string }
  if (!password) return err('密码不能为空')

  const pwdErr = validatePassword(password)
  if (pwdErr) return err(pwdErr)

  const passwordHash = await hashPassword(password)
  await prisma.adminUser.update({ where: { id: adminId }, data: { passwordHash } })

  await logAdminAction(request, {
    action: 'reset_admin_password',
    targetType: 'admin_user',
    targetId: adminId,
    detail: { account: target.account },
  })
  return ok({ message: '密码已重置' })
})
