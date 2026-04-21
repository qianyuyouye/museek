import crypto from 'crypto'
import { getSetting, SETTING_KEYS } from './system-settings'

export interface SignedPutOptions {
  userId: number
  type: 'audio' | 'image'
  ttlSec?: number  // 默认 300（5min）
}

export interface SignedGetOptions {
  userId?: number
  ttlSec?: number  // 默认 3600（1h）
}

export interface SignedPutResult {
  uploadUrl: string
  headers?: Record<string, string>
}

// ── HMAC secret 派生 ────────────────────────────────────────────

let _secret: Buffer | null = null

function getSecret(): Buffer {
  if (_secret) return _secret
  const uploadSecret = process.env.UPLOAD_SECRET
  if (uploadSecret && uploadSecret.length >= 16) {
    _secret = Buffer.from(uploadSecret, 'utf8')
    return _secret
  }
  const jwt = process.env.JWT_SECRET
  if (!jwt) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('UPLOAD_SECRET 或 JWT_SECRET 必须配置（生产环境）')
    }
    _secret = crypto.createHash('sha256').update('dev-upload-secret').digest()
    return _secret
  }
  // 从 JWT_SECRET 派生（域分离）
  _secret = crypto.createHash('sha256').update(jwt + ':upload').digest()
  return _secret
}

function computeSig(parts: Array<string | number>): string {
  const msg = parts.join('|')
  return crypto.createHmac('sha256', getSecret()).update(msg).digest('hex')
}

// ── key 目录 ↔ type 映射 ───────────────────────────────────────

function keyDirMatchesType(key: string, type: 'audio' | 'image'): boolean {
  if (type === 'audio') return key.startsWith('uploads/audio/')
  if (type === 'image') return key.startsWith('uploads/images/')
  return false
}

// ── 存储模式判定 ───────────────────────────────────────────────

async function resolveMode(): Promise<'local' | 'oss'> {
  const cfg = await getSetting<{ mode?: string }>(SETTING_KEYS.STORAGE_CONFIG, {})
  return (cfg.mode as 'local' | 'oss') ?? (process.env.OSS_BUCKET ? 'oss' : 'local')
}

// ── 签名 PUT ───────────────────────────────────────────────────

export async function signPutUrl(key: string, opts: SignedPutOptions): Promise<SignedPutResult> {
  const mode = await resolveMode()
  const ttl = opts.ttlSec ?? 300
  if (mode === 'oss') {
    // @ts-expect-error Task A2 会创建 oss-client
    const { getOssClient } = await import('./oss-client')
    const client = await getOssClient()
    const uploadUrl = client.signatureUrl(key, {
      method: 'PUT',
      expires: ttl,
      'Content-Type': 'application/octet-stream',
    })
    return { uploadUrl, headers: { 'Content-Type': 'application/octet-stream' } }
  }
  // local
  const exp = Math.floor(Date.now() / 1000) + ttl
  const sig = computeSig([key, opts.userId, opts.type, exp])
  const uploadUrl = `/api/upload/local/${key}?exp=${exp}&uid=${opts.userId}&type=${opts.type}&sig=${sig}`
  return { uploadUrl }
}

// ── 签名 GET ───────────────────────────────────────────────────

export async function signGetUrl(key: string, opts: SignedGetOptions = {}): Promise<string> {
  const mode = await resolveMode()
  const ttl = opts.ttlSec ?? 3600
  if (mode === 'oss') {
    // @ts-expect-error Task A2 会创建 oss-client
    const { getOssClient } = await import('./oss-client')
    const client = await getOssClient()
    return client.signatureUrl(key, { method: 'GET', expires: ttl })
  }
  // local
  const exp = Math.floor(Date.now() / 1000) + ttl
  const uid = opts.userId ?? ''
  const sig = computeSig([key, uid, '', exp])
  const uidPart = opts.userId != null ? `&uid=${opts.userId}` : ''
  return `/api/files/${key}?exp=${exp}${uidPart}&sig=${sig}`
}

// ── 验签 PUT ───────────────────────────────────────────────────

export function verifyLocalPutSig(key: string, query: URLSearchParams, currentUserId: number): string | null {
  const expRaw = query.get('exp')
  const uidRaw = query.get('uid')
  const type = query.get('type')
  const sig = query.get('sig') ?? ''
  if (!expRaw || !uidRaw || !type || !sig) return '签名参数缺失'
  const exp = parseInt(expRaw, 10)
  const uid = parseInt(uidRaw, 10)
  if (isNaN(exp) || isNaN(uid)) return '签名参数缺失'
  if (exp < Math.floor(Date.now() / 1000)) return '上传链接已过期'
  if (uid !== currentUserId) return '用户不匹配'
  if (type !== 'audio' && type !== 'image') return '类型无效'
  if (!keyDirMatchesType(key, type)) return '类型与目录不符'
  const expectSig = computeSig([key, uid, type, exp])
  if (sig.length !== 64) return '签名无效'
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectSig, 'hex'))) return '签名无效'
  } catch {
    return '签名无效'
  }
  return null
}

// ── 验签 GET ───────────────────────────────────────────────────

export function verifyLocalGetSig(key: string, query: URLSearchParams): string | null {
  const expRaw = query.get('exp')
  const sig = query.get('sig') ?? ''
  const uidRaw = query.get('uid')
  if (!expRaw || !sig) return '签名参数缺失'
  const exp = parseInt(expRaw, 10)
  if (isNaN(exp)) return '签名参数缺失'
  if (exp < Math.floor(Date.now() / 1000)) return '文件链接已过期'
  const expectSig = computeSig([key, uidRaw ?? '', '', exp])
  if (sig.length !== 64) return '签名无效'
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectSig, 'hex'))) return '签名无效'
  } catch {
    return '签名无效'
  }
  return null
}
