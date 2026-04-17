import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) {
    throw new Error('ENCRYPTION_KEY 未配置。请在环境变量中设置 32 字节十六进制字符串（openssl rand -hex 32）')
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('ENCRYPTION_KEY 必须为 64 位十六进制字符（32 字节）')
  }
  cachedKey = Buffer.from(hex, 'hex')
  return cachedKey
}

/** 启动时校验 key 是否可用；在应用启动处调用可提前暴露配置错误 */
export function assertEncryptionKey(): void {
  getKey()
}

/** AES-256-GCM 加密，输出 base64(iv | tag | ciphertext) */
export function encryptIdCard(plain: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

/** 解密；非本算法加密的输入会抛错 */
export function decryptIdCard(cipherText: string): string {
  const key = getKey()
  const buf = Buffer.from(cipherText, 'base64')
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('密文长度不合法')
  }
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ct = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(ct), decipher.final()])
  return plain.toString('utf8')
}

/** 脱敏：18 位身份证号 → 前 3 + *** + 后 4 */
export function maskIdCard(plain: string): string {
  if (plain.length < 7) return '***'
  return plain.slice(0, 3) + '***' + plain.slice(-4)
}
