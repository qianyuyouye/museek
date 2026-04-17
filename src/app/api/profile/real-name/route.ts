import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'
import { encryptIdCard } from '@/lib/encrypt'

const NAME_RE = /^[\u4e00-\u9fa5·\s]{2,20}$|^[A-Za-z\s]{2,40}$/
const ID_CARD_RE = /^\d{17}[\dXx]$/

export const POST = safeHandler(async function POST(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId) return err('未登录', 401)
  if (portal === 'admin') return err('管理员无需实名认证')

  const body = await request.json()
  const realName = typeof body?.realName === 'string' ? body.realName.trim() : ''
  const idCard = typeof body?.idCard === 'string' ? body.idCard.trim().toUpperCase() : ''

  if (!NAME_RE.test(realName)) {
    return err('真实姓名格式不正确（2-20 个中文或 2-40 个英文字符）')
  }
  if (!ID_CARD_RE.test(idCard)) {
    return err('身份证号格式不正确（18 位，末位可为 X）')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { realNameStatus: true },
  })
  if (!user) return err('用户不存在', 404)
  if (user.realNameStatus === 'verified') {
    return err('已认证通过，如需修改请联系管理员驳回')
  }
  if (user.realNameStatus === 'pending') {
    return err('认证申请已提交，正在审核中')
  }

  const cipher = encryptIdCard(idCard)

  await prisma.user.update({
    where: { id: userId },
    data: {
      realName,
      idCard: cipher,
      realNameStatus: 'pending',
    },
  })

  return ok({ realNameStatus: 'pending' })
})
