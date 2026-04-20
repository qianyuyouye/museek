import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { getSetting, setSetting, getSettingMasked, SETTING_KEYS } from '@/lib/system-settings'

describe('system-settings lib', () => {
  beforeEach(async () => {
    await prisma.systemSetting.deleteMany({
      where: { key: { in: Object.values(SETTING_KEYS) } },
    })
  })

  it('setSetting + getSetting 明文字段往返一致', async () => {
    await setSetting(SETTING_KEYS.AI_CONFIG, {
      enabled: true,
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-12345',
      model: 'gpt-4o-mini',
      timeoutMs: 10000,
    })
    const value = await getSetting(SETTING_KEYS.AI_CONFIG, {})
    expect(value).toMatchObject({
      enabled: true,
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-12345',
      model: 'gpt-4o-mini',
    })
  })

  it('setSetting 对加密字段加密存储', async () => {
    await setSetting(SETTING_KEYS.AI_CONFIG, {
      enabled: true,
      apiKey: 'sk-secret-should-be-encrypted',
    })
    const raw = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEYS.AI_CONFIG },
    })
    // DB 中应该是 base64 密文，不是明文
    expect(JSON.stringify(raw?.value)).not.toContain('sk-secret-should-be-encrypted')
  })

  it('getSettingMasked 对加密字段脱敏', async () => {
    await setSetting(SETTING_KEYS.AI_CONFIG, {
      apiKey: 'sk-1234567890abcdef',
    })
    const masked = await getSettingMasked(SETTING_KEYS.AI_CONFIG)
    expect(masked).toMatchObject({ apiKey: expect.stringMatching(/^sk-\*+[a-z0-9]{4}$/) })
  })

  it('getSetting 未写过时返回 defaultValue', async () => {
    const val = await getSetting(SETTING_KEYS.SMS_CONFIG, { enabled: false })
    expect(val).toEqual({ enabled: false })
  })

  it('setSetting 合并补丁：只传部分字段时不覆盖其他字段', async () => {
    await setSetting(SETTING_KEYS.AI_CONFIG, {
      baseUrl: 'https://a.com',
      apiKey: 'sk-aaa',
      model: 'm1',
    })
    await setSetting(SETTING_KEYS.AI_CONFIG, { model: 'm2' }) // 仅改 model
    const v = await getSetting(SETTING_KEYS.AI_CONFIG, {})
    expect(v).toMatchObject({ baseUrl: 'https://a.com', apiKey: 'sk-aaa', model: 'm2' })
  })
})
