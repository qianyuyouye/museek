import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler } from '@/lib/api-utils'
import { SETTING_KEYS } from '@/lib/system-settings'

/**
 * GET /api/profile/agreements
 * 返回当前用户可见的协议列表（含正文内容和签署状态）
 */
export const GET = safeHandler(async function GET(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId) return err('未登录', 401)

  // 读取三个协议内容
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: [SETTING_KEYS.SERVICE_AGREEMENT, SETTING_KEYS.PRIVACY_POLICY, SETTING_KEYS.AGENCY_TERMS] } },
  })

  function getContent(key: string): string {
    const row = settings.find((s) => s.key === key)
    if (!row) return ''
    const val = row.value as Record<string, unknown> | null
    return (val?.content as string) || ''
  }

  function getVersion(key: string): string {
    const row = settings.find((s) => s.key === key)
    if (!row) return '1.0'
    const val = row.value as Record<string, unknown> | null
    return (val?.version as string) || '1.0'
  }

  if (portal === 'admin') {
    return ok([
      {
        name: '《平台用户服务协议》',
        content: getContent(SETTING_KEYS.SERVICE_AGREEMENT),
        version: getVersion(SETTING_KEYS.SERVICE_AGREEMENT),
        signed: true,
        signedAt: '',
      },
      {
        name: '《隐私政策》',
        content: getContent(SETTING_KEYS.PRIVACY_POLICY),
        version: getVersion(SETTING_KEYS.PRIVACY_POLICY),
        signed: true,
        signedAt: '',
      },
    ])
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { agencySignedAt: true, agencyContract: true },
  })
  if (!user) return err('用户不存在', 404)

  const agencySignedAt = user.agencySignedAt
    ? new Date(user.agencySignedAt).toLocaleDateString('zh-CN')
    : ''

  return ok([
    {
      name: '《平台用户服务协议》',
      content: getContent(SETTING_KEYS.SERVICE_AGREEMENT),
      version: getVersion(SETTING_KEYS.SERVICE_AGREEMENT),
      signed: true,
      signedAt: '',
    },
    {
      name: '《隐私政策》',
      content: getContent(SETTING_KEYS.PRIVACY_POLICY),
      version: getVersion(SETTING_KEYS.PRIVACY_POLICY),
      signed: true,
      signedAt: '',
    },
    {
      name: '《音乐代理发行协议》',
      content: getContent(SETTING_KEYS.AGENCY_TERMS),
      version: getVersion(SETTING_KEYS.AGENCY_TERMS),
      signed: user.agencyContract,
      signedAt: agencySignedAt,
    },
  ])
})
