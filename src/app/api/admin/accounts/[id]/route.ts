import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { hashPassword, validatePassword } from '@/lib/password'

export const PUT = safeHandler(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.accounts.edit')
  if ('error' in auth) return auth.error

  const { id } = await params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) return err('无效的用户 ID')

  const existing = await prisma.user.findUnique({ where: { id: userId } })
  if (!existing) return err('用户不存在', 404)

  const body = await request.json()
  const { name, phone, email, password } = body as {
    name?: string
    phone?: string
    email?: string
    password?: string
  }

  const data: Record<string, unknown> = {}

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) return err('姓名不能为空')
    data.name = name.trim()
  }

  if (phone !== undefined) {
    if (phone === '' || phone === null) {
      return err('手机号不能为空')
    }
    if (typeof phone !== 'string' || !/^1[3-9]\d{9}$/.test(phone)) return err('手机号格式不正确')
    const phoneExists = await prisma.user.findUnique({ where: { phone } })
    if (phoneExists && phoneExists.id !== userId) return err('该手机号已被其他用户使用')
    data.phone = phone
  }

  if (email !== undefined) {
    if (email === null || email === '') {
      data.email = null
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('邮箱格式不正确')
      data.email = email
    }
  }

  if (password !== undefined) {
    if (password === '' || password === null) {
      // do nothing — skip password change if empty
    } else {
      const pwdErr = validatePassword(password)
      if (pwdErr) return err(pwdErr)
      data.passwordHash = await hashPassword(password)
    }
  }

  if (Object.keys(data).length === 0) return err('无更新字段')

  const updated = await prisma.user.update({ where: { id: userId }, data })

  await logAdminAction(request, {
    action: 'update_account',
    targetType: 'user',
    targetId: userId,
    detail: { name: existing.name, changes: Object.keys(data) },
  }).catch(() => {})

  return ok({
    id: updated.id,
    name: updated.name,
    phone: updated.phone,
    email: updated.email,
  })
})

export const DELETE = safeHandler(async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.accounts.edit')
  if ('error' in auth) return auth.error

  const { id } = await params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) return err('无效的用户 ID')

  const existing = await prisma.user.findUnique({ where: { id: userId } })
  if (!existing) return err('用户不存在', 404)

  // 有作品不允许删除
  const songCount = await prisma.platformSong.count({ where: { userId } })
  if (songCount > 0) return err(`该用户有 ${songCount} 首作品，无法删除`)

  // 有评审记录不允许删除
  const reviewCount = await prisma.review.count({ where: { reviewerId: userId } })
  if (reviewCount > 0) return err(`该用户有 ${reviewCount} 条评审记录，无法删除`)

  // 事务删除所有关联数据
  await prisma.$transaction([
    prisma.userGroup.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.learningRecord.deleteMany({ where: { userId } }),
    prisma.settlement.deleteMany({ where: { creatorId: userId } }),
    prisma.assignmentSubmission.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ])

  await logAdminAction(request, {
    action: 'delete_account',
    targetType: 'user',
    targetId: userId,
    detail: { name: existing.name, phone: existing.phone },
  }).catch(() => {})

  return ok({ message: '账号已删除' })
})
