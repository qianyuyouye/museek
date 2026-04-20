import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler } from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import { hashPassword } from '@/lib/password'

function generatePassword(): string {
  // 保证同时包含字母与数字（否则触发下面的强度校验）
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const all = letters + digits
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  const chars: string[] = [pick(letters), pick(digits)]
  for (let i = 0; i < 8; i++) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
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
  // 兼容前端字段：password / newPassword 均可
  let password = (body as { password?: string; newPassword?: string }).password
    ?? (body as { newPassword?: string }).newPassword

  const isGenerated = !password
  if (isGenerated) {
    password = generatePassword()
  }
  if (!password || password.length < 8) return err('密码长度不能少于 8 位')
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return err('密码必须同时包含字母与数字')
  }

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

  // 安全考量：不直接回传完整明文，而是掩码显示（仅暗示操作成功 + 给操作者粗粒度校对）
  // - 自动生成：返回前 3 位 + '*****'（操作者可通过短信/站内信单独下发真实密码）
  // - 管理员指定：不回传密码（操作者自己知道原值）
  if (isGenerated && password) {
    const masked = password.slice(0, 3) + '*'.repeat(password.length - 3)
    return ok({
      generated: true,
      masked,
      message: '已生成新密码，完整密码请通过短信或其他安全渠道下发给用户',
    })
  }
  return ok({ generated: false, message: '密码已重置' })
})
