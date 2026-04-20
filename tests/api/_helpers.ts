/**
 * API 测试共用工具：
 * - 登录封装（admin / creator / reviewer）返回 cookie 串，用于后续请求
 * - http() 封装 fetch，自动带 cookie + Origin（过 CSRF 检查）
 * - 要求 dev server 跑在 BASE_URL（默认 http://localhost:3000）
 */

export const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

interface LoginResult {
  cookie: string
  userId?: number
}

async function loginRaw(payload: Record<string, unknown>): Promise<LoginResult> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const setCookie = res.headers.get('set-cookie') ?? ''
  const json = await res.json()
  if (json.code !== 200) {
    throw new Error(`登录失败 ${payload.portal}: ${json.message ?? res.status}`)
  }
  const cookie = setCookie
    .split(',')
    .map((part) => part.trim().split(';')[0])
    .filter((c) => c.startsWith('access_token=') || c.startsWith('refresh_token='))
    .join('; ')
  return { cookie, userId: json.data?.id }
}

// 缓存登录结果避免重复登录触发 IP 限流（10 次/分）
const loginCache = new Map<string, Promise<LoginResult>>()

async function cachedLogin(key: string, payload: Record<string, unknown>): Promise<LoginResult> {
  if (!loginCache.has(key)) loginCache.set(key, loginRaw(payload))
  return loginCache.get(key)!
}

export const adminLogin = () =>
  cachedLogin('admin', { account: 'admin', password: 'Abc12345', portal: 'admin' })
export const creatorLogin = (phone = '13800001234', password = 'Abc12345') =>
  cachedLogin(`creator:${phone}`, { account: phone, password, portal: 'creator' })
export const reviewerLogin = (phone = '13500008888', password = 'Abc12345') =>
  cachedLogin(`reviewer:${phone}`, { account: phone, password, portal: 'reviewer' })

export interface HttpOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  cookie?: string
  origin?: string
  headers?: Record<string, string>
  raw?: boolean  // true → 返回 Response，不尝试 parse json
}

export async function http(path: string, opts: HttpOpts = {}) {
  const { method = 'GET', body, cookie, origin, headers = {}, raw } = opts
  const h: Record<string, string> = { ...headers }
  if (body != null) h['Content-Type'] = 'application/json'
  if (cookie) h['Cookie'] = cookie
  // 同源 Origin（通过 CSRF 中间件）
  h['Origin'] = origin ?? BASE_URL

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: h,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (raw) return res
  const json = await res.json().catch(() => ({ code: res.status }))
  return { status: res.status, json, headers: res.headers }
}

/** 快速判断 HTTP 状态 + body.code */
export function expectOk(r: { status: number; json: { code?: number } }, label = '') {
  if (r.status !== 200 || r.json.code !== 200) {
    throw new Error(`${label}: 期望 200，实际 status=${r.status} code=${r.json.code}`)
  }
}

export function expectCode(r: { status: number; json: { code?: number; message?: string } }, code: number, label = '') {
  if (r.json.code !== code) {
    throw new Error(`${label}: 期望 code=${code}，实际 code=${r.json.code} status=${r.status} message=${r.json.message}`)
  }
}
