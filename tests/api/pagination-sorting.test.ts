import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, expectOk } from './_helpers'

/**
 * 分页 / 排序 / 筛选组合 15 条
 * 验证 parsePagination 容错、边界值处理、组合筛选
 */

let adminCookie = ''

describe('分页边界', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
  })

  it('TC-PAG-001 page=0 → 回退到 page=1', async () => {
    const r = await http('/api/admin/students?page=0&pageSize=5', { cookie: adminCookie })
    expectOk(r, 'page=0')
    expect(r.json.data.page).toBe(1)
  })

  it('TC-PAG-002 page=-5 → 回退到 page=1', async () => {
    const r = await http('/api/admin/students?page=-5&pageSize=5', { cookie: adminCookie })
    expectOk(r, 'page=-5')
    expect(r.json.data.page).toBe(1)
  })

  it('TC-PAG-003 pageSize=abc → 默认 20', async () => {
    const r = await http('/api/admin/students?pageSize=abc', { cookie: adminCookie })
    expectOk(r, 'pageSize abc')
    expect(r.json.data.pageSize).toBe(20)
  })

  it('TC-PAG-004 pageSize=200 → 裁剪到 100', async () => {
    const r = await http('/api/admin/students?pageSize=200', { cookie: adminCookie })
    expectOk(r, 'pageSize huge')
    expect(r.json.data.pageSize).toBe(100)
  })

  it('TC-PAG-005 pageSize=0 → 裁剪到 1（最小）', async () => {
    const r = await http('/api/admin/students?pageSize=0', { cookie: adminCookie })
    expectOk(r, 'pageSize 0')
    expect(r.json.data.pageSize).toBe(1)
  })

  it('TC-PAG-006 page=999 超过总页数 → 空 list 但仍 200', async () => {
    const r = await http('/api/admin/students?page=9999&pageSize=10', { cookie: adminCookie })
    expectOk(r, 'page overflow')
    expect(r.json.data.list.length).toBe(0)
  })

  it('TC-PAG-007 page 非整数（小数）→ 回退', async () => {
    const r = await http('/api/admin/students?page=1.5', { cookie: adminCookie })
    expectOk(r, 'decimal page')
    expect(r.json.data.page).toBe(1)
  })

  it('TC-PAG-008 page=null 字面 → 默认', async () => {
    const r = await http('/api/admin/students?page=null', { cookie: adminCookie })
    expectOk(r, 'null page')
    expect(r.json.data.page).toBe(1)
  })
})

describe('筛选组合', () => {
  it('TC-FIL-001 songs 多筛选叠加：status + genre + aiTool + minScore + maxScore', async () => {
    const r = await http(
      '/api/admin/songs?status=published&genre=Pop&aiTool=Suno&minScore=80&maxScore=100&pageSize=10',
      { cookie: adminCookie },
    )
    expectOk(r, 'multi filter')
    expect(Array.isArray(r.json.data.list)).toBe(true)
  })

  it('TC-FIL-002 search 前缀/子串双向匹配', async () => {
    const r1 = await http('/api/admin/songs?search=测试', { cookie: adminCookie })
    const r2 = await http('/api/admin/songs?search=AIMU', { cookie: adminCookie })
    expectOk(r1, 'cn search')
    expectOk(r2, 'en search')
  })

  it('TC-FIL-003 非法 status 返回 400', async () => {
    const r = await http('/api/admin/songs?status=not_exist', { cookie: adminCookie })
    expect(r.status).toBe(400)
  })

  it('TC-FIL-004 userId 非法 → 400', async () => {
    const r = await http('/api/admin/songs?userId=abc', { cookie: adminCookie })
    expect(r.status).toBe(400)
  })

  it('TC-FIL-005 groups 列表 search', async () => {
    const r = await http('/api/admin/groups?search=组', { cookie: adminCookie })
    expectOk(r, 'group search')
  })

  it('TC-FIL-006 students realNameStatus=unverified 返回只含 unverified', async () => {
    const r = await http('/api/admin/students?realNameStatus=unverified&pageSize=50', { cookie: adminCookie })
    expectOk(r, 'unverified')
    const list = r.json.data.list as { realNameStatus: string }[]
    for (const u of list) expect(u.realNameStatus).toBe('unverified')
  })

  it('TC-FIL-007 orderBy createdAt desc（默认排序）', async () => {
    const r = await http('/api/admin/students?pageSize=5', { cookie: adminCookie })
    const list = r.json.data.list as { createdAt: string }[]
    for (let i = 1; i < list.length; i++) {
      // 新的在前
      expect(new Date(list[i - 1].createdAt).getTime())
        .toBeGreaterThanOrEqual(new Date(list[i].createdAt).getTime())
    }
  })
})
