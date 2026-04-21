import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { hashPassword } from '@/lib/password'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.accounts.manage')
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { name, phone, email, groupId, password } = body as {
    name?: string
    phone?: string
    email?: string
    groupId?: number | null
    password?: string
  }

  if (!name || !phone || !password) {
    return err('缺少必填字段：name, phone, password')
  }

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return err('手机号格式不正确')
  }

  if (password.length < 8) {
    return err('密码长度不能少于 8 位')
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return err('密码强度不足，需同时包含字母与数字')
  }

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
      type: 'creator',
      realNameStatus: 'unverified',
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
    action: 'create_creator',
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
