import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'

export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId) return err('未登录', 401)

  if (portal === 'admin') {
    return ok([
      { name: '《平台用户服务协议》', signedAt: '', signed: true },
      { name: '《隐私政策》', signedAt: '', signed: true },
    ])
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { agencySignedAt: true, agencyContract: true },
  })
  if (!user) return err('用户不存在', 404)

  // 尝试从 system_settings 读取协议配置
  let serviceAgreementUrl: string | null = null
  let privacyPolicyUrl: string | null = null
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['service_agreement', 'privacy_policy'] } },
    })
    for (const s of settings) {
      const val = s.value as Record<string, unknown> | null
      if (s.key === 'service_agreement' && val && typeof val.url === 'string') serviceAgreementUrl = val.url
      if (s.key === 'privacy_policy' && val && typeof val.url === 'string') privacyPolicyUrl = val.url
    }
  } catch { /* fallback to no URL */ }

  const agencySignedAt = user.agencySignedAt
    ? new Date(user.agencySignedAt).toLocaleDateString('zh-CN')
    : ''

  return ok([
    { name: '《平台用户服务协议》', signedAt: serviceAgreementUrl || '', signed: true },
    { name: '《隐私政策》', signedAt: privacyPolicyUrl || '', signed: true },
    { name: '《音乐代理发行协议》', signedAt: agencySignedAt, signed: user.agencyContract },
  ])
})
