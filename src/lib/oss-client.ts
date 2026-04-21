/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSetting, SETTING_KEYS } from './system-settings'

let _client: any | null = null
let _clientKey = ''

interface OssConfig {
  accessKeyId: string
  accessKeySecret: string
  region: string
  bucket: string
}

async function loadOssConfig(): Promise<OssConfig> {
  const fromDb = await getSetting<{ oss?: Partial<OssConfig> }>(SETTING_KEYS.STORAGE_CONFIG, {})
  const oss = fromDb.oss ?? {}
  return {
    accessKeyId: oss.accessKeyId || process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: oss.accessKeySecret || process.env.OSS_ACCESS_KEY_SECRET || '',
    region: oss.region || process.env.OSS_REGION || 'oss-cn-hangzhou',
    bucket: oss.bucket || process.env.OSS_BUCKET || '',
  }
}

export async function getOssClient(): Promise<any> {
  const cfg = await loadOssConfig()
  if (!cfg.accessKeyId || !cfg.bucket) {
    throw new Error('OSS 配置不完整（accessKeyId 或 bucket 缺失）')
  }
  const cacheKey = `${cfg.region}|${cfg.bucket}|${cfg.accessKeyId}`
  if (_client && _clientKey === cacheKey) return _client
  // 动态引入，避免 local 模式冷启动加载 SDK
  const OSSMod: any = await import('ali-oss')
  const OSS = OSSMod.default ?? OSSMod
  _client = new OSS({
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    region: cfg.region,
    bucket: cfg.bucket,
    secure: true,
  })
  _clientKey = cacheKey
  return _client
}
