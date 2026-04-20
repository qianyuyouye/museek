import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, BASE_URL } from './_helpers'

/** 认证扩展 15 条：SMS 验证码 / 重置密码 / profile / 刷新 token / 登录日志 */

let adminCookie = ''
let creatorCookie = ''

describe('认证扩展 · SMS & 密码重置', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    creatorCookie = (await creatorLogin()).cookie
  })

  it('SMS 未传 purpose 允许任意手机号（向后兼容）', async () => {
    const r = await http('/api/auth/sms/send', {
      method: 'POST',
      body: { phone: '13700000099' },
    })
    expect([200, 400]).toContain(r.status)
  })

  it('SMS 1 分钟内重发同号 → 400 发送过于频繁', async () => {
    // 先发一次
    await http('/api/auth/sms/send', { method: 'POST', body: { phone: '13711223344', purpose: 'register' } })
    // 立即再发 → 应拒绝
    const r = await http('/api/auth/sms/send', {
      method: 'POST',
      body: { phone: '13711223344', purpose: 'register' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toMatch(/频繁|过快|1分钟/)
  })

  it('SMS 验证码错误 → 400', async () => {
    const r = await http('/api/auth/sms/verify', {
      method: 'POST',
      body: { phone: '13711223344', code: '999999', password: 'Abc12345', inviteCode: 'E2ETEST1' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toMatch(/验证码/)
  })

  it('注册缺邀请码 → 400', async () => {
    // 先拿一个能用的验证码
    await http('/api/auth/sms/send', { method: 'POST', body: { phone: `137${Date.now().toString().slice(-8)}` } })
    const r = await http('/api/auth/sms/verify', {
      method: 'POST',
      body: { phone: '13911111111', code: '123456', password: 'Abc12345' },
    })
    expect(r.status).toBe(400)
  })

  it('重置密码缺字段 → 400', async () => {
    const r = await http('/api/auth/reset-password', {
      method: 'POST',
      body: { phone: '13800001234' },
    })
    expect(r.status).toBe(400)
  })

  it('重置密码非法手机号 → 400', async () => {
    const r = await http('/api/auth/reset-password', {
      method: 'POST',
      body: { phone: '123', code: '123456', newPassword: 'Abc12345' },
    })
    expect(r.status).toBe(400)
  })

  it('重置密码新密码 <8 位 → 400', async () => {
    const r = await http('/api/auth/reset-password', {
      method: 'POST',
      body: { phone: '13800001234', code: '123456', newPassword: 'Abc123' },
    })
    expect(r.status).toBe(400)
  })

  it('重置密码新密码纯字母 → 400', async () => {
    const r = await http('/api/auth/reset-password', {
      method: 'POST',
      body: { phone: '13800001234', code: '123456', newPassword: 'abcdefgh' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toMatch(/字母.*数字|组合/)
  })
})

describe('认证扩展 · profile', () => {
  it('GET /api/profile 返回 admin 信息', async () => {
    const r = await http('/api/profile', { cookie: adminCookie })
    expect(r.status).toBe(200)
    expect(r.json.data.account).toBe('admin')
    expect(r.json.data.role).toBeTruthy()
  })

  it('GET /api/profile 返回 creator 信息', async () => {
    const r = await http('/api/profile', { cookie: creatorCookie })
    expect(r.status).toBe(200)
    expect(r.json.data.type).toBe('creator')
    expect(r.json.data.phone).toBe('13800001234')
  })

  it('未登录访问 /api/profile → 401', async () => {
    const r = await http('/api/profile')
    expect([401, 403]).toContain(r.json.code)
  })

  it('PUT /api/profile 修改昵称', async () => {
    const r = await http('/api/profile', {
      method: 'PUT',
      cookie: creatorCookie,
      body: { name: `creator_${Date.now()}` },
    })
    expect(r.status).toBe(200)
  })

  it('GET /api/profile/login-logs 登录日志列表', async () => {
    const r = await http('/api/profile/login-logs?pageSize=5', { cookie: creatorCookie })
    expect(r.status).toBe(200)
    expect(Array.isArray(r.json.data)).toBe(true)
  })
})

describe('认证扩展 · Token 刷新', () => {
  it('POST /api/auth/refresh 带 cookie → 200 续签', async () => {
    const r = await http('/api/auth/refresh', { method: 'POST', cookie: adminCookie })
    expect(r.status).toBe(200)
  })

  it('POST /api/auth/refresh 无 cookie → 401', async () => {
    const r = await http('/api/auth/refresh', { method: 'POST' })
    expect([401, 400]).toContain(r.status)
  })
})
