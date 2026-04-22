import crypto from 'crypto'
import path from 'path'
import { signPutUrl } from './signature'

const AUDIO_EXTS = ['.wav', '.mp3']
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_AUDIO = 50 * 1024 * 1024
const MAX_IMAGE = 5 * 1024 * 1024

export interface UploadTokenResult {
  uploadUrl: string
  key: string
  method: 'PUT'
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

export async function createUploadToken(
  fileName: string,
  type: 'audio' | 'image',
  userId: number,
  portal: string,
): Promise<UploadTokenResult> {
  const key = generateKey(fileName, type)
  const signed = await signPutUrl(key, { userId, portal, type })
  return {
    uploadUrl: signed.uploadUrl,
    key,
    method: 'PUT',
    headers: signed.headers,
  }
}
