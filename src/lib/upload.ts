import crypto from 'crypto'
import path from 'path'
import { getSetting, SETTING_KEYS } from './system-settings'

const AUDIO_EXTS = ['.wav', '.mp3']
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_AUDIO = 50 * 1024 * 1024
const MAX_IMAGE = 5 * 1024 * 1024

interface UploadToken {
  uploadUrl: string
  fileUrl: string
  method: 'PUT'
  headers?: Record<string, string>
}

interface StorageConfig {
  mode: 'local' | 'oss'
  oss: {
    accessKeyId: string
    accessKeySecret: string
    region: string
    bucket: string
    domain: string
  }
  signedUrlTtlSec: number
  uploadTokenTtlSec: number
  zipRetainHours: number
}

async function loadStorageConfig(): Promise<StorageConfig> {
  const fromDb = await getSetting<Partial<StorageConfig>>(SETTING_KEYS.STORAGE_CONFIG, {})
  const oss = fromDb.oss ?? {} as Partial<StorageConfig['oss']>
  const mode = fromDb.mode ?? (process.env.OSS_BUCKET ? 'oss' : 'local')
  return {
    mode: mode as 'local' | 'oss',
    oss: {
      accessKeyId: oss.accessKeyId || process.env.OSS_ACCESS_KEY_ID || '',
      accessKeySecret: oss.accessKeySecret || process.env.OSS_ACCESS_KEY_SECRET || '',
      region: oss.region || process.env.OSS_REGION || 'oss-cn-hangzhou',
      bucket: oss.bucket || process.env.OSS_BUCKET || '',
      domain: oss.domain || process.env.OSS_DOMAIN || '',
    },
    signedUrlTtlSec: fromDb.signedUrlTtlSec ?? 3600,
    uploadTokenTtlSec: fromDb.uploadTokenTtlSec ?? 300,
    zipRetainHours: fromDb.zipRetainHours ?? 24,
  }
}

function generateKey(originalName: string, type: 'audio' | 'image'): string {
  const ext = path.extname(originalName).toLowerCase() || (type === 'audio' ? '.mp3' : '.jpg')
  const hash = crypto.randomBytes(8).toString('hex')
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const dir = type === 'audio' ? 'audio' : 'images'
  return `uploads/${dir}/${date}_${hash}${ext}`
}

export function validateUpload(fileName: string, fileSize: number, type: 'audio' | 'image'): string | null {
  const ext = path.extname(fileName).toLowerCase()
  const allowedExts = type === 'audio' ? AUDIO_EXTS : IMAGE_EXTS
  if (!allowedExts.includes(ext)) {
    return `不支持的文件类型 ${ext}，允许: ${allowedExts.join(', ')}`
  }
  const maxSize = type === 'audio' ? MAX_AUDIO : MAX_IMAGE
  if (fileSize > maxSize) {
    return `文件过大 ${(fileSize / 1024 / 1024).toFixed(1)}MB，最大 ${maxSize / 1024 / 1024}MB`
  }
  return null
}

function getLocalToken(key: string): UploadToken {
  return {
    uploadUrl: `/api/upload/local/${key}`,
    fileUrl: `/${key}`,
    method: 'PUT',
  }
}

/**
 * OSS 上传 Token（过渡版）
 *
 * Batch 1A：仅返回基于 DB 配置的占位 URL，未做 signatureUrl 真实签名。
 * Batch 1B：接入 ali-oss SDK，调用 `client.signatureUrl(key, {method:'PUT', expires:300})`。
 */
function getOSSToken(key: string, config: StorageConfig): UploadToken {
  const { bucket, region, domain } = config.oss
  const base = domain || `https://${bucket}.${region}.aliyuncs.com`
  return {
    uploadUrl: `${base}/${key}`, // TODO(Batch-1B): 替换为 signatureUrl 签名
    fileUrl: `${base}/${key}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
  }
}

export async function createUploadToken(fileName: string, type: 'audio' | 'image'): Promise<UploadToken> {
  const key = generateKey(fileName, type)
  const config = await loadStorageConfig()

  if (config.mode === 'oss') {
    if (!config.oss.bucket || !config.oss.accessKeyId) {
      throw new Error('OSS 模式已启用但配置不完整（bucket 或 accessKeyId 缺失）')
    }
    return getOSSToken(key, config)
  }
  return getLocalToken(key)
}

/** 用于 UI 层快速判断当前存储模式 */
export async function getCurrentStorageMode(): Promise<'local' | 'oss'> {
  const config = await loadStorageConfig()
  return config.mode
}
