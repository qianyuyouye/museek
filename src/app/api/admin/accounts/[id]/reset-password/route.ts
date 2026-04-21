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
  const auth = await requirePermission(request, 'admin.accounts.manage')
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

  // 自动生成密码回传一次明文，供管理员复制并通过安全渠道下发给用户
  // - 自动生成：返回 password 明文 + 提示 UI 弹框复制（30 秒内）
  // - 管理员指定：不回传（操作者已知原值）
  if (isGenerated && password) {
    return ok({
      generated: true,
      password,
      message: '新密码已生成，请在弹窗内复制后通过安全渠道发送给用户',
    })
  }
  return ok({ generated: false, message: '密码已重置' })
})
