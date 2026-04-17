import crypto from 'crypto'
import path from 'path'

const AUDIO_EXTS = ['.wav', '.mp3']
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_AUDIO = 50 * 1024 * 1024
const MAX_IMAGE = 5 * 1024 * 1024

interface UploadToken {
  /** 前端 PUT 文件到这个 URL */
  uploadUrl: string
  /** 上传完成后文件的访问 URL（存数据库用） */
  fileUrl: string
  /** 上传方式 */
  method: 'PUT'
  /** 额外 headers（OSS 需要） */
  headers?: Record<string, string>
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

/** 开发环境：返回本地上传端点 */
function getLocalToken(key: string): UploadToken {
  return {
    uploadUrl: `/api/upload/local/${key}`,
    fileUrl: `/${key}`,
    method: 'PUT',
  }
}

/** 生产环境：返回 OSS 预签名 URL */
function getOSSToken(key: string): UploadToken {
  // TODO: 用阿里云 OSS SDK 生成预签名 PUT URL
  // const client = new OSS({ region, accessKeyId, accessKeySecret, bucket })
  // const url = client.signatureUrl(key, { method: 'PUT', expires: 300 })
  const bucket = process.env.OSS_BUCKET || ''
  const region = process.env.OSS_REGION || ''
  const domain = process.env.OSS_DOMAIN || `https://${bucket}.${region}.aliyuncs.com`

  return {
    uploadUrl: `${domain}/${key}`, // 实际要用 signatureUrl
    fileUrl: `${domain}/${key}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
  }
}

export function createUploadToken(fileName: string, type: 'audio' | 'image'): UploadToken {
  const key = generateKey(fileName, type)

  if (process.env.OSS_BUCKET) {
    return getOSSToken(key)
  }
  return getLocalToken(key)
}
