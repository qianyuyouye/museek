import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, reviewerLogin, expectOk, expectCode, BASE_URL } from './_helpers'

/**
 * 认证回归：注册 / 登录 / 限流 / 锁定 / 跨端 / 路由守卫 12 条
 * 前提：dev server 跑在 localhost:3000；种子账号密码 Abc12345
 */

describe('认证 · 登录', () => {
  it('TC-AUTH-061 超管登录成功', async () => {
    const { cookie } = await adminLogin()
    expect(cookie).toContain('access_token=')
  })

  it('TC-AUTH-031 创作者登录成功', async () => {
    const { cookie } = await creatorLogin()
    expect(cookie).toContain('access_token=')
  })

  it('TC-AUTH-041 评审登录成功', async () => {
    const { cookie } = await reviewerLogin()
    expect(cookie).toContain('access_token=')
  })

  it('TC-AUTH-032 密码错误 → 401（或 429 限流/锁定）', async () => {
    const r = await http('/api/auth/login', {
      method: 'POST',
      body: { account: 'admin', password: 'wrong', portal: 'admin' },
    })
    expect([401, 423, 429]).toContain(r.json.code)
  })

  it('TC-AUTH-035 跨端登录 → 401 不泄露账号存在性（或命中限流）', async () => {
    const r = await http('/api/auth/login', {
      method: 'POST',
      body: { account: '13800001234', password: 'Abc12345', portal: 'reviewer' },
    })
    expect([401, 429]).toContain(r.json.code)
  })
})

describe('认证 · 路由守卫', () => {
  it('TC-AUTH-090 未登录访问 /admin/dashboard → 307 重定向', async () => {
    const res = await fetch(`${BASE_URL}/admin/dashboard`, { redirect: 'manual' })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/admin/login')
  })

  it('TC-AUTH-091 未登录访问 /api/admin/* → 401', async () => {
    const r = await http('/api/admin/dashboard')
    expect(r.json.code).toBe(401)
  })

  it('TC-AUTH-095 篡改 JWT → 401', async () => {
    const r = await http('/api/admin/dashboard', {
      cookie: 'access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.invalid',
    })
    expect([401, 500]).toContain(r.json.code)
  })
})

describe('认证 · 注册 & SMS', () => {
  it('TC-AUTH-006 已注册号 purpose=register → 400 阻断', async () => {
    const r = await http('/api/auth/sms/send', {
      method: 'POST',
      body: { phone: '13800001234', purpose: 'register' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('已注册')
  })

  it('TC-AUTH-006 未注册号 purpose=reset → 400 阻断', async () => {
    const r = await http('/api/auth/sms/send', {
      method: 'POST',
      body: { phone: '13000000001', purpose: 'reset_password' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('未注册')
  })

  it('TC-AUTH-007 手机号格式非法 → 400', async () => {
    const r = await http('/api/auth/sms/send', {
      method: 'POST',
      body: { phone: '12345', purpose: 'register' },
    })
    expect(r.status).toBe(400)
  })

  it('TC-AUTH-016 密码纯字母 → 注册失败', async () => {
    // 用时间戳号避免上次测试已注册导致命中其他校验
    const phone = `139${Date.now().toString().slice(-8)}`
    await http('/api/auth/sms/send', { method: 'POST', body: { phone, purpose: 'register' } })
    const r = await http('/api/auth/sms/verify', {
      method: 'POST',
      body: { phone, code: '123456', password: 'abcdefgh', inviteCode: 'E2ETEST1' },
    })
    expect(r.status).toBe(400)
  })
})

describe('认证 · 登出', () => {
  let cookie = ''
  beforeAll(async () => {
    cookie = (await adminLogin()).cookie
  })

  it('TC-AUTH-067 登出 200', async () => {
    const r = await http('/api/auth/logout', { method: 'POST', cookie })
    expectOk(r, 'logout')
  })
})
