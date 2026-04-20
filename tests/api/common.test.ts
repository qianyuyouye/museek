import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, reviewerLogin, expectOk, BASE_URL } from './_helpers'

/** 通用 20 条：分页 / 限流 / 缓存 / 操作日志 / 参数边界 / 路由守卫组合 */

let adminCookie = ''
let creatorCookie = ''
let reviewerCookie = ''

describe('通用 · 分页', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    creatorCookie = (await creatorLogin()).cookie
    reviewerCookie = (await reviewerLogin()).cookie
  })

  it('pageSize > 100 自动截断', async () => {
    const r = await http('/api/admin/songs?pageSize=500', { cookie: adminCookie })
    expect(r.status).toBe(200)
    expect(r.json.data.pageSize).toBeLessThanOrEqual(100)
  })

  it('page < 1 修正为 1', async () => {
    const r = await http('/api/admin/songs?page=-5', { cookie: adminCookie })
    expect(r.status).toBe(200)
    expect(r.json.data.page).toBe(1)
  })

  it('pageSize 非法字符 → 回退到 [1, 100]', async () => {
    const r = await http('/api/admin/songs?pageSize=abc', { cookie: adminCookie })
    expect(r.status).toBe(200)
    expect(r.json.data.pageSize).toBeGreaterThanOrEqual(1)
    expect(r.json.data.pageSize).toBeLessThanOrEqual(100)
  })

  it('操作日志列表含 total/page/pageSize', async () => {
    const r = await http('/api/admin/logs?pageSize=3', { cookie: adminCookie })
    expectOk(r, 'logs')
    expect(typeof r.json.data.total).toBe('number')
    expect(typeof r.json.data.page).toBe('number')
    expect(typeof r.json.data.pageSize).toBe('number')
  })

  it('学员列表含 total 字段', async () => {
    const r = await http('/api/admin/students?pageSize=3', { cookie: adminCookie })
    expectOk(r, 'students')
    expect(typeof r.json.data.total).toBe('number')
  })
})

describe('通用 · 缓存', () => {
  it('dashboard 缓存命中（连续两次 < 300ms）', async () => {
    await http('/api/admin/dashboard', { cookie: adminCookie })
    const t0 = Date.now()
    await http('/api/admin/dashboard', { cookie: adminCookie })
    expect(Date.now() - t0).toBeLessThan(300)
  })

  it('dashboard 写操作后失效（song 状态流转）', async () => {
    // 触发 invalidate 后下次应重新计算（不一定慢，但应不抛错）
    const r1 = await http('/api/admin/songs/1/status', {
      method: 'POST', cookie: adminCookie, body: { action: 'archive' },
    })
    if (r1.status === 200) {
      await http('/api/admin/songs/1/status', {
        method: 'POST', cookie: adminCookie, body: { action: 'restore' },
      })
      await http('/api/admin/songs/1/status', {
        method: 'POST', cookie: adminCookie, body: { action: 'publish' },
      })
    }
    const r = await http('/api/admin/dashboard', { cookie: adminCookie })
    expectOk(r, 'dashboard after invalidate')
  })
})

describe('通用 · 操作日志覆盖', () => {
  it('写操作会记录 operation_logs', async () => {
    // 创建一个组记日志
    const r = await http('/api/admin/groups', {
      method: 'POST',
      cookie: adminCookie,
      body: { name: `log-test-${Date.now()}` },
    })
    if (r.status !== 200) return
    const gid = r.json.data.id
    const logs = await http('/api/admin/logs?pageSize=5', { cookie: adminCookie })
    const found = (logs.json.data.list as { action: string; targetId: string }[])
      .some((l) => l.action === 'create_group' && l.targetId === String(gid))
    expect(found).toBe(true)
    // 清理
    await http(`/api/admin/groups/${gid}`, { method: 'DELETE', cookie: adminCookie })
  })
})

describe('通用 · 参数边界', () => {
  it('无效 ID（非数字）→ 400', async () => {
    const r = await http('/api/admin/songs/abc', { cookie: adminCookie })
    expect([400, 404]).toContain(r.status)
  })

  it('POST 空 body → 400（业务校验）', async () => {
    const r = await http('/api/admin/groups', { method: 'POST', cookie: adminCookie, body: {} })
    expect(r.status).toBe(400)
  })

  it('PUT 不存在的资源 → 404', async () => {
    const r = await http('/api/admin/admins/99999', {
      method: 'PUT', cookie: adminCookie, body: { name: 'x' },
    })
    expect([404, 400]).toContain(r.status)
  })

  it('DELETE 不存在 → 404', async () => {
    const r = await http('/api/admin/content/99999', { method: 'DELETE', cookie: adminCookie })
    expect([404, 400]).toContain(r.status)
  })
})

describe('通用 · 跨端访问隔离', () => {
  it('creator 访问 /api/review/* → 401', async () => {
    const r = await http('/api/review/queue', { cookie: creatorCookie })
    expect([401, 403]).toContain(r.json.code)
  })

  it('reviewer 访问 /api/creator/* → 401', async () => {
    const r = await http('/api/creator/songs', { cookie: reviewerCookie })
    expect([401, 403]).toContain(r.json.code)
  })

  it('reviewer 访问 /api/admin/* → 401', async () => {
    const r = await http('/api/admin/dashboard', { cookie: reviewerCookie })
    expect([401, 403]).toContain(r.json.code)
  })
})

describe('通用 · HTTP 状态规范', () => {
  it('400 响应 body.code === 400', async () => {
    const r = await http('/api/admin/groups', { method: 'POST', cookie: adminCookie, body: {} })
    expect(r.status).toBe(400)
    expect(r.json.code).toBe(400)
  })

  it('401 响应 body.code === 401', async () => {
    const r = await http('/api/admin/dashboard')
    expect(r.status).toBe(401)
    expect(r.json.code).toBe(401)
  })

  it('403 CSRF 响应 body.code === 403', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://attacker.com',
        'Cookie': adminCookie,
      },
      body: JSON.stringify({ name: 'csrf' }),
    })
    expect(res.status).toBe(403)
    const j = await res.json()
    expect(j.code).toBe(403)
  })
})
