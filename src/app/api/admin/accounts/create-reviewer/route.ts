import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { hashPassword, validatePassword } from '@/lib/password'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.accounts.manage')
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { name, phone, email, groupId, password } = body

  if (!name || !phone || !password) {
    return err('缺少必填字段：name, phone, password')
  }

  const pwdErr = validatePassword(password)
  if (pwdErr) return err(pwdErr)

  const existing = await prisma.user.findUnique({ where: { phone } })
  if (existing) {
    return err('该手机号已被注册')
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.user.create({
    data: {
      name,
      phone,
      email: email || null,
      passwordHash,
      type: 'reviewer',
      ...(groupId
        ? { userGroups: { create: { groupId } } }
        : {}),
    },
    include: {
      userGroups: {
        include: { group: { select: { id: true, name: true } } },
      },
    },
  })

  await logAdminAction(request, {
    action: 'create_reviewer',
    targetType: 'user',
    targetId: user.id,
    detail: { name: user.name, phone: user.phone, groupId: groupId ?? null },
  })
  return ok({
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    type: user.type,
    groups: user.userGroups.map((ug) => ({ id: ug.group.id, name: ug.group.name })),
  })
})
