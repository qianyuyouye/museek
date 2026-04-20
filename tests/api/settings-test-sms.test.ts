import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin } from './_helpers'

describe('POST /api/admin/settings/test-sms', () => {
  let adminCookie = ''
  beforeAll(async () => { adminCookie = (await adminLogin()).cookie })

  it('phone 格式错误返回 400', async () => {
    const r = await http('/api/admin/settings/test-sms', {
      method: 'POST',
      cookie: adminCookie,
      body: { phone: 'abc' },
    })
    expect(r.status).toBe(400)
  })

  it('phone 合法时返回 pingSms 结果（dev 模式 success:true）', async () => {
    const r = await http('/api/admin/settings/test-sms', {
      method: 'POST',
      cookie: adminCookie,
      body: { phone: '13800009999' },
    })
    expect(r.status).toBe(200)
    expect((r.json.data as any).success).toBeDefined()
  })

  it('非 admin 返回 401/403', async () => {
    const r = await http('/api/admin/settings/test-sms', {
      method: 'POST',
      body: { phone: '13800009999' },
    })
    expect([401, 403]).toContain(r.status)
  })
})
