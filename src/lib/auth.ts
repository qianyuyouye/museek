import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { JwtPayload } from '@/types/auth'

// SECRET 延迟到首次使用时计算，避免 Next.js build 阶段（NODE_ENV=production 但尚未注入 env）收集页面数据时 throw
let _secret: Uint8Array | null = null
let _warnedFallback = false
function SECRET(): Uint8Array {
  if (_secret) return _secret
  const jwtSecret = process.env.JWT_SECRET
  // build/collect-page-data 阶段 NEXT_PHASE=phase-production-build，跳过强校验
  if (!jwtSecret && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('JWT_SECRET environment variable is required in production')
  }
  if (!jwtSecret && !_warnedFallback) {
    console.warn('\n[auth] ⚠️  JWT_SECRET 未设置，正在使用 fallback-dev-secret（仅开发环境可用，生产禁止）')
    _warnedFallback = true
  }
  _secret = new TextEncoder().encode(jwtSecret || 'fallback-dev-secret')
  return _secret
}

/** 生成 12 字节随机 jti（Base64URL 编码 16 字符，放进 JWT 用于 blacklist 定位） */
function generateJti(): string {
  const bytes = new Uint8Array(12)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  // Base64URL 编码（替换 + / = 为 - _ 空）
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const ADMIN_ACCESS_EXPIRES = '8h'
const USER_ACCESS_EXPIRES = '24h'
const REFRESH_EXPIRES = '7d'

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  const expiresIn = payload.portal === 'admin' ? ADMIN_ACCESS_EXPIRES : USER_ACCESS_EXPIRES
  return new SignJWT({ ...payload } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setJti(generateJti())
    .setExpirationTime(expiresIn)
    .sign(SECRET())
}

export async function signRefreshToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ sub: payload.sub, portal: payload.portal } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setJti(generateJti())
    .setExpirationTime(REFRESH_EXPIRES)
    .sign(SECRET())
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, SECRET())
  return payload as unknown as JwtPayload
}

export async function setAuthCookies(accessToken: string, refreshToken: string, portal?: string) {
  const accessMaxAge = portal === 'admin' ? 60 * 60 * 8 : 60 * 60 * 24
  const cookieStore = await cookies()
  cookieStore.set('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: accessMaxAge,
  })
  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function clearAuthCookies() {
  const cookieStore = await cookies()
  cookieStore.delete('access_token')
  cookieStore.delete('refresh_token')
}

export async function getTokenFromCookies(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get('access_token')?.value
}

export async function getRefreshTokenFromCookies(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get('refresh_token')?.value
}
