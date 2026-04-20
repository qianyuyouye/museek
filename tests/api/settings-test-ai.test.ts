import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin } from './_helpers'

describe('POST /api/admin/settings/test-ai', () => {
  let adminCookie = ''
  beforeAll(async () => { adminCookie = (await adminLogin()).cookie })

  it('apiKey 为空返回 400', async () => {
    const r = await http('/api/admin/settings/test-ai', {
      method: 'POST',
      cookie: adminCookie,
      body: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' },
    })
    expect(r.status).toBe(400)
  })

  it('无效 baseUrl 返回 ok:false', async () => {
    const r = await http('/api/admin/settings/test-ai', {
      method: 'POST',
      cookie: adminCookie,
      body: { baseUrl: 'http://127.0.0.1:1', apiKey: 'sk-x', model: 'm', timeoutMs: 500 },
    })
    expect(r.status).toBe(200)
    expect((r.json.data as any).ok).toBe(false)
  })

  it('非 admin 返回 401/403', async () => {
    const r = await http('/api/admin/settings/test-ai', {
      method: 'POST',
      body: { baseUrl: 'x', apiKey: 'x', model: 'x' },
    })
    expect([401, 403]).toContain(r.status)
  })
})
