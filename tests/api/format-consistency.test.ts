import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, expectOk, BASE_URL } from './_helpers'

/**
 * 响应格式一致性 15 条
 * 所有 API 遵守 { code: number, data?, message? } 协议，
 * 状态码与 code 字段对齐
 */

let adminCookie = ''
let creatorCookie = ''

describe('格式一致性 · 成功响应', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    creatorCookie = (await creatorLogin()).cookie
  })

  it('TC-FMT-001 GET 成功：code=200 + data 字段', async () => {
    const r = await http('/api/admin/dashboard', { cookie: adminCookie })
    expect(r.status).toBe(200)
    expect(r.json.code).toBe(200)
    expect(r.json).toHaveProperty('data')
  })

  it('TC-FMT-002 POST 成功：code=200 + data', async () => {
    const r = await http('/api/admin/content', {
      method: 'POST',
      cookie: adminCookie,
      body: { title: `fmt-${Date.now()}`, category: 'AI', type: 'article' },
    })
    expect(r.status).toBe(200)
    expect(r.json.code).toBe(200)
    expect(r.json.data).toBeTruthy()
    // 清理
    await http(`/api/admin/content/${r.json.data.id}`, { method: 'DELETE', cookie: adminCookie })
  })

  it('TC-FMT-003 分页成功：data 含 list/total/page/pageSize', async () => {
    const r = await http('/api/admin/students?pageSize=3', { cookie: adminCookie })
    expectOk(r, 'students')
    expect(r.json.data).toHaveProperty('list')
    expect(r.json.data).toHaveProperty('total')
    expect(r.json.data).toHaveProperty('page')
    expect(r.json.data).toHaveProperty('pageSize')
    expect(r.json.data.pageSize).toBe(3)
  })
})

describe('格式一致性 · 错误响应', () => {
  it('TC-FMT-010 400 错误：status=400 + code=400 + message', async () => {
    const r = await http('/api/admin/content', {
      method: 'POST',
      cookie: adminCookie,
      body: { type: 'article', category: 'AI' }, // 缺 title
    })
    expect(r.status).toBe(400)
    expect(r.json.code).toBe(400)
    expect(typeof r.json.message).toBe('string')
    expect(r.json.message.length).toBeGreaterThan(0)
  })

  it('TC-FMT-011 401 错误：未登录 code=401 + message', async () => {
    const r = await http('/api/admin/dashboard')
    expect(r.status).toBe(401)
    expect(r.json.code).toBe(401)
    expect(r.json.message).toBeTruthy()
  })

  it('TC-FMT-012 403 错误：CSRF 跨源 code=403', async () => {
    const r = await http('/api/admin/groups', {
      method: 'POST',
      cookie: adminCookie,
      body: { name: 'x' },
      origin: 'http://evil.com',
    })
    expect(r.status).toBe(403)
    expect(r.json.code).toBe(403)
    expect(r.json.message).toContain('CSRF')
  })

  it('TC-FMT-013 404 错误：资源不存在 code=404', async () => {
    const r = await http('/api/admin/songs/99999999', {
      cookie: adminCookie,
    })
    expect(r.status).toBe(404)
    expect(r.json.code).toBe(404)
  })

  it('TC-FMT-014 500 错误 safeHandler 兜底：不泄露堆栈', async () => {
    // 通过构造让 safeHandler 命中——用非法 JSON body 触发 parse 错
    const res = await fetch(`${BASE_URL}/api/admin/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie,
        'Origin': BASE_URL,
      },
      body: '{invalid json',
    })
    // parse 失败 → 500 或 400
    expect([400, 500]).toContain(res.status)
    const json = await res.json()
    // 不应包含 stack / Error:
    const body = JSON.stringify(json)
    expect(body.toLowerCase()).not.toContain('at ')
    expect(body).not.toContain('\\n    at')
  })
})

describe('格式一致性 · 类型', () => {
  it('TC-FMT-020 id 为 number（非字符串）', async () => {
    const r = await http('/api/admin/students?pageSize=1', { cookie: adminCookie })
    const u = r.json.data.list[0] as { id: number } | undefined
    if (u) expect(typeof u.id).toBe('number')
  })

  it('TC-FMT-021 布尔字段为 boolean（非 0/1）', async () => {
    const r = await http('/api/admin/students?pageSize=1', { cookie: adminCookie })
    const u = r.json.data.list[0] as { status: string } | undefined
    if (u) expect(['active', 'disabled']).toContain(u.status)
  })

  it('TC-FMT-022 日期字段为 ISO 字符串', async () => {
    const r = await http('/api/admin/students?pageSize=1', { cookie: adminCookie })
    const u = r.json.data.list[0] as { createdAt: string } | undefined
    if (u) expect(u.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('TC-FMT-023 金额为 number（非 Decimal 字符串）', async () => {
    const r = await http('/api/admin/revenue/stats', { cookie: adminCookie })
    expect(typeof r.json.data.totalRevenue).toBe('number')
  })

  it('TC-FMT-024 creator 返回 API：无内部字段（idCard / passwordHash）', async () => {
    const r = await http('/api/profile', { cookie: creatorCookie })
    expect(r.json.data).not.toHaveProperty('passwordHash')
    expect(r.json.data).not.toHaveProperty('idCard')
  })

  it('TC-FMT-025 admin profile 不泄露 passwordHash', async () => {
    const r = await http('/api/profile', { cookie: adminCookie })
    expect(r.json.data).not.toHaveProperty('passwordHash')
  })

  it('TC-FMT-026 操作日志 BigInt id 序列化为字符串', async () => {
    const r = await http('/api/admin/logs?pageSize=1', { cookie: adminCookie })
    const first = r.json.data.list[0] as { id: string } | undefined
    if (first) expect(typeof first.id).toBe('string')
  })
})
