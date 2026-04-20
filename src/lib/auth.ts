import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { JwtPayload } from '@/types/auth'

// SECRET 延迟到首次使用时计算，避免 Next.js build 阶段（NODE_ENV=production 但尚未注入 env）收集页面数据时 throw
let _secret: Uint8Array | null = null
function SECRET(): Uint8Array {
  if (_secret) return _secret
  const jwtSecret = process.env.JWT_SECRET
  // build/collect-page-data 阶段 NEXT_PHASE=phase-production-build，跳过强校验
  if (!jwtSecret && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('JWT_SECRET environment variable is required in production')
  }
  _secret = new TextEncoder().encode(jwtSecret || 'fallback-dev-secret')
  return _secret
}
const ADMIN_ACCESS_EXPIRES = '8h'
const USER_ACCESS_EXPIRES = '24h'
const REFRESH_EXPIRES = '7d'

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  const expiresIn = payload.portal === 'admin' ? ADMIN_ACCESS_EXPIRES : USER_ACCESS_EXPIRES
  return new SignJWT({ ...payload } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET())
}

export async function signRefreshToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ sub: payload.sub, portal: payload.portal } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
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
