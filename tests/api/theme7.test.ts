import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, expectOk } from './_helpers'

let adminCookie = ''

describe('Theme 7 fixes', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
  })

  describe('/api/admin/teachers (GAP-ADMIN-006)', () => {
    it('GET 返回 list+total，含 reviewCount/avgTimeSeconds/avgScore/recommendRate', async () => {
      const r = await http('/api/admin/teachers?pageSize=100', { cookie: adminCookie })
      expectOk(r, 'teachers')
      const list = r.json.data.list as Array<Record<string, unknown>>
      expect(Array.isArray(list)).toBe(true)
      expect(typeof r.json.data.total).toBe('number')
      if (list.length > 0) {
        const row = list[0]
        expect(row).toHaveProperty('reviewCount')
        expect(row).toHaveProperty('avgTimeSeconds')
        expect(row).toHaveProperty('avgScore')
        expect(row).toHaveProperty('recommendRate')
      }
    })

    it('GET 只返回 type=reviewer 用户', async () => {
      const r = await http('/api/admin/teachers?pageSize=100', { cookie: adminCookie })
      expectOk(r, 'teachers type')
      const list = r.json.data.list as Array<{ type?: string }>
      expect(list.every((u) => !u.type || u.type === 'reviewer')).toBe(true)
    })
  })

  describe('/api/admin/students 默认 creator (GAP-ADMIN-051)', () => {
    it('不传 type 默认只返回 creator', async () => {
      const r = await http('/api/admin/students?pageSize=100', { cookie: adminCookie })
      expectOk(r, 'students default creator')
      const list = r.json.data.list as Array<{ type: string }>
      expect(list.every((u) => u.type === 'creator')).toBe(true)
    })

    it('显式 type=reviewer 仍可返回评审', async () => {
      const r = await http('/api/admin/students?type=reviewer&pageSize=100', { cookie: adminCookie })
      expectOk(r, 'students explicit reviewer')
      const list = r.json.data.list as Array<{ type: string }>
      expect(list.every((u) => u.type === 'reviewer')).toBe(true)
    })
  })
})
