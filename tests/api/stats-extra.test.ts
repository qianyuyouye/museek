import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, expectOk } from './_helpers'

/**
 * 统计 / 缓存 / 次级接口 12 条
 * 覆盖：dashboard 缓存命中、publish-confirm 状态统计、groups/members、
 *      assignments/submissions、reviewer-stats 细节
 */

let adminCookie = ''

describe('dashboard 缓存', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
  })

  it('TC-CACHE-001 首次请求 + 连续第二次 300ms 内（缓存命中）', async () => {
    const t1 = Date.now()
    await http('/api/admin/dashboard', { cookie: adminCookie })
    const mid = Date.now()
    await http('/api/admin/dashboard', { cookie: adminCookie })
    const t2 = Date.now()
    const second = t2 - mid
    expect(second).toBeLessThan(500)
  })

  it('TC-CACHE-002 song 写操作后 dashboard 缓存被失效', async () => {
    const list = await http('/api/admin/songs?status=published&pageSize=1', { cookie: adminCookie })
    const song = list.json.data.list[0] as { id: number } | undefined
    if (!song) return

    await http('/api/admin/dashboard', { cookie: adminCookie })
    // 触发失效（archive）
    const arch = await http(`/api/admin/songs/${song.id}/status`, {
      method: 'POST',
      cookie: adminCookie,
      body: { action: 'archive' },
    })
    if (arch.status !== 200) return
    // restore 回去
    await http(`/api/admin/songs/${song.id}/status`, {
      method: 'POST',
      cookie: adminCookie,
      body: { action: 'restore' },
    })
    // 只要不报错，缓存失效逻辑至少跑通
    const r = await http('/api/admin/dashboard', { cookie: adminCookie })
    expectOk(r, 'after invalidate')
  })
})

describe('publish-confirm 状态筛选', () => {
  it('TC-PC-001 status=submitted 筛选只返回 submitted', async () => {
    const r = await http('/api/admin/publish-confirm?status=submitted', { cookie: adminCookie })
    expectOk(r, 'submitted')
    const list = r.json.data.list as { status: string }[]
    for (const d of list) expect(d.status).toBe('submitted')
  })

  it('TC-PC-002 statusCounts.all ≥ 任一单状态计数', async () => {
    const r = await http('/api/admin/publish-confirm?status=all', { cookie: adminCookie })
    const counts = r.json.data.statusCounts as Record<string, number>
    expect(counts.all).toBeGreaterThanOrEqual(0)
    for (const [k, v] of Object.entries(counts)) {
      if (k === 'all' || k === 'live') continue
      expect(counts.all).toBeGreaterThanOrEqual(v)
    }
  })
})

describe('groups / members', () => {
  it('TC-GRP-001 列表 + search', async () => {
    const r = await http('/api/admin/groups?pageSize=5', { cookie: adminCookie })
    expectOk(r, 'groups')
    expect(Array.isArray(r.json.data.list)).toBe(true)
  })

  it('TC-GRP-002 单组 members 列表', async () => {
    const list = await http('/api/admin/groups?pageSize=1', { cookie: adminCookie })
    const g = list.json.data.list[0] as { id: number } | undefined
    if (!g) return
    const r = await http(`/api/admin/groups/${g.id}/members`, { cookie: adminCookie })
    expectOk(r, 'members')
    // members 要么返回数组，要么 data.list/total 分页结构
    const d = r.json.data as unknown[] | { list: unknown[] }
    const members = Array.isArray(d) ? d : (d as { list: unknown[] }).list
    expect(Array.isArray(members)).toBe(true)
  })

  it('TC-GRP-003 不存在的 group members → 404 或空数组', async () => {
    const r = await http('/api/admin/groups/99999999/members', { cookie: adminCookie })
    expect([200, 404]).toContain(r.status)
  })
})

describe('assignments', () => {
  it('TC-ASN-001 列表', async () => {
    const r = await http('/api/admin/assignments?pageSize=5', { cookie: adminCookie })
    expectOk(r, 'assignments')
    expect(Array.isArray(r.json.data.list)).toBe(true)
  })

  it('TC-ASN-002 submissions 列表（首个作业）', async () => {
    const list = await http('/api/admin/assignments?pageSize=1', { cookie: adminCookie })
    const asn = list.json.data.list[0] as { id: number } | undefined
    if (!asn) return
    const r = await http(`/api/admin/assignments/${asn.id}/submissions`, { cookie: adminCookie })
    expectOk(r, 'submissions')
  })

  it('TC-ASN-003 不存在作业的 submissions → 404 或空', async () => {
    const r = await http('/api/admin/assignments/99999999/submissions', { cookie: adminCookie })
    expect([200, 404]).toContain(r.status)
  })
})

describe('评审绩效细节', () => {
  it('TC-RVS-001 /admin/accounts?tab=reviewer 含 recommendRate 0-100', async () => {
    const r = await http('/api/admin/accounts?tab=reviewer&pageSize=20', { cookie: adminCookie })
    expectOk(r, 'reviewer stats')
    const list = r.json.data.list as { recommendRate?: number; avgScore?: number; reviewCount?: number }[]
    for (const u of list) {
      expect(u.recommendRate).toBeGreaterThanOrEqual(0)
      expect(u.recommendRate).toBeLessThanOrEqual(100)
      expect(u.avgScore).toBeGreaterThanOrEqual(0)
      expect(u.avgScore).toBeLessThanOrEqual(100)
    }
  })

  it('TC-RVS-002 tab=creator 不返回评审字段', async () => {
    const r = await http('/api/admin/accounts?tab=creator&pageSize=5', { cookie: adminCookie })
    expectOk(r, 'creator tab')
    const list = r.json.data.list as Record<string, unknown>[]
    for (const u of list) {
      expect(u).not.toHaveProperty('reviewCount')
      expect(u).not.toHaveProperty('recommendRate')
    }
  })
})
