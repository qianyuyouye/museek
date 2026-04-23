import { NextRequest } from 'next/server'
import { safeHandler, ok } from '@/lib/api-utils'
import { SETTING_KEYS, getSetting } from '@/lib/system-settings'

export const GET = safeHandler(async function GET(_request: NextRequest) {
  const [serviceAgreement, privacyPolicy, agencyTerms] = await Promise.all([
    getSetting(SETTING_KEYS.SERVICE_AGREEMENT, { content: '', version: '1.0' }),
    getSetting(SETTING_KEYS.PRIVACY_POLICY, { content: '', version: '1.0' }),
    getSetting(SETTING_KEYS.AGENCY_TERMS, { termYears: 3, scope: '全平台', exclusive: true }),
  ])

  return ok({
    serviceAgreement,
    privacyPolicy,
    agencyTerms,
  })
})
