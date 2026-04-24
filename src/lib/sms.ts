import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525'
import * as $OpenApi from '@alicloud/openapi-client'
import * as $Util from '@alicloud/tea-util'
import { prisma } from './prisma'
import { getSetting, SETTING_KEYS } from './system-settings'

interface SmsConfig {
  enabled: boolean
  accessKeyId: string
  accessKeySecret: string
  signName: string
  templateCode: { register: string; resetPassword: string; changePhone: string; changeEmail: string }
  perPhoneDailyLimit: number
  verifyMaxAttempts: number
}

async function loadConfig(): Promise<SmsConfig> {
  const fromDb = await getSetting<Partial<SmsConfig>>(SETTING_KEYS.SMS_CONFIG, {})
  const tc = fromDb.templateCode ?? ({} as Partial<SmsConfig['templateCode']>)
  return {
    enabled: fromDb.enabled ?? !!process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeyId: fromDb.accessKeyId || process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: fromDb.accessKeySecret || process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    signName: fromDb.signName || process.env.ALIYUN_SMS_SIGN_NAME || '',
    templateCode: {
      register: tc.register || process.env.ALIYUN_SMS_TEMPLATE_CODE || '',
      resetPassword: tc.resetPassword || tc.register || process.env.ALIYUN_SMS_TEMPLATE_CODE || '',
      changePhone: tc.changePhone || tc.register || process.env.ALIYUN_SMS_TEMPLATE_CODE || '',
      changeEmail: tc.changeEmail || tc.changePhone || tc.register || process.env.ALIYUN_SMS_TEMPLATE_CODE || '',
    },
    perPhoneDailyLimit: fromDb.perPhoneDailyLimit ?? 10,
    verifyMaxAttempts: fromDb.verifyMaxAttempts ?? 5,
  }
}

function createClient(accessKeyId: string, accessKeySecret: string): Dysmsapi20170525 {
  const config = new $OpenApi.Config({ accessKeyId, accessKeySecret, endpoint: 'dysmsapi.aliyuncs.com' })
  return new Dysmsapi20170525(config)
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export type SmsPurpose = 'register' | 'resetPassword' | 'changePhone' | 'changeEmail'

export async function sendSmsCode(
  phone: string,
  purpose: SmsPurpose = 'register',
): Promise<{ success: boolean; message: string }> {
  const config = await loadConfig()

  // 1 分钟频率限制
  const recentCode = await prisma.smsCode.findFirst({
    where: { phone, createdAt: { gte: new Date(Date.now() - 60 * 1000) } },
  })
  if (recentCode) return { success: false, message: '发送过于频繁，请1分钟后重试' }

  // 同手机号每日上限
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayCount = await prisma.smsCode.count({ where: { phone, createdAt: { gte: todayStart } } })
  if (todayCount >= config.perPhoneDailyLimit) {
    return { success: false, message: `该手机号今日发送已达上限（${config.perPhoneDailyLimit} 次）` }
  }

  const code = generateCode()

  // Dev 模式：未启用 SMS 时 + NODE_ENV=development → 固定码
  if (!config.enabled && process.env.NODE_ENV === 'development') {
    await prisma.smsCode.create({
      data: { phone, code: '123456', purpose, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    })
    return { success: true, message: '开发模式：验证码为 123456' }
  }
  if (!config.enabled) {
    return { success: false, message: '短信服务未配置，请联系管理员' }
  }

  const templateCode = config.templateCode[purpose]
  if (!config.accessKeyId || !config.signName || !templateCode) {
    return { success: false, message: `短信服务缺少配置（${purpose}）` }
  }

  try {
    const client = createClient(config.accessKeyId, config.accessKeySecret)
    const request = new $Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: phone,
      signName: config.signName,
      templateCode,
      templateParam: JSON.stringify({ code }),
    })
    const runtime = new $Util.RuntimeOptions({})
    const response = await client.sendSmsWithOptions(request, runtime)

    if (response.body?.code === 'OK') {
      await prisma.smsCode.create({
        data: { phone, code, purpose, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      })
      return { success: true, message: '验证码已发送' }
    }
    return { success: false, message: response.body?.message || '发送失败' }
  } catch (error) {
    console.error('SMS send error:', error)
    return { success: false, message: '短信服务异常' }
  }
}

export async function verifySmsCode(phone: string, code: string, purpose?: SmsPurpose): Promise<boolean> {
  const record = await prisma.smsCode.findFirst({
    where: { phone, code, purpose: purpose ?? undefined, used: false, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!record) return false
  await prisma.smsCode.update({ where: { id: record.id }, data: { used: true } })
  return true
}

/** 由 test-sms API 调用，发一条真实短信测试配置 */
export async function pingSms(phone: string): Promise<{ success: boolean; message: string }> {
  return sendSmsCode(phone, 'register')
}
