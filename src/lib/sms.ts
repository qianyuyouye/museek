import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525'
import * as $OpenApi from '@alicloud/openapi-client'
import * as $Util from '@alicloud/tea-util'
import { prisma } from './prisma'

function createClient(): Dysmsapi20170525 {
  const config = new $OpenApi.Config({
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
    endpoint: 'dysmsapi.aliyuncs.com',
  })
  return new Dysmsapi20170525(config)
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function sendSmsCode(phone: string): Promise<{ success: boolean; message: string }> {
  const recentCode = await prisma.smsCode.findFirst({
    where: {
      phone,
      createdAt: { gte: new Date(Date.now() - 60 * 1000) },
    },
  })
  if (recentCode) {
    return { success: false, message: '发送过于频繁，请1分钟后重试' }
  }

  const code = generateCode()

  if (process.env.NODE_ENV === 'development' && !process.env.ALIYUN_ACCESS_KEY_ID) {
    await prisma.smsCode.create({
      data: {
        phone,
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })
    return { success: true, message: '开发模式：验证码为 123456' }
  }

  try {
    const client = createClient()
    const request = new $Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: phone,
      signName: process.env.ALIYUN_SMS_SIGN_NAME,
      templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE,
      templateParam: JSON.stringify({ code }),
    })
    const runtime = new $Util.RuntimeOptions({})
    const response = await client.sendSmsWithOptions(request, runtime)

    if (response.body?.code === 'OK') {
      await prisma.smsCode.create({
        data: { phone, code, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      })
      return { success: true, message: '验证码已发送' }
    }
    return { success: false, message: response.body?.message || '发送失败' }
  } catch (error) {
    console.error('SMS send error:', error)
    return { success: false, message: '短信服务异常' }
  }
}

export async function verifySmsCode(phone: string, code: string): Promise<boolean> {
  const record = await prisma.smsCode.findFirst({
    where: {
      phone,
      code,
      used: false,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) return false

  await prisma.smsCode.update({
    where: { id: record.id },
    data: { used: true },
  })

  return true
}
