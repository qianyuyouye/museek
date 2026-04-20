import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, reviewerLogin, expectOk } from './_helpers'

/**
 * Dashboard / 收益统计 / 评审统计 / 操作日志 16 条
 * 覆盖：/api/admin/dashboard, /api/admin/revenue/stats,
 *      /api/admin/revenue/creators, /api/review/stats, /api/admin/logs
 */

let adminCookie = ''
let reviewerCookie = ''

describe('仪表盘 /admin/dashboard', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    reviewerCookie = (await reviewerLogin()).cookie
  })

  it('TC-DASH-001 返回 stats 完整字段', async () => {
    const r = await http('/api/admin/dashboard', { cookie: adminCookie })
    expectOk(r, 'dashboard')
    const s = r.json.data.stats
    const keys = ['totalCreators', 'totalReviewers', 'totalUsers', 'totalSongs',
      'songsFromUpload', 'songsFromAssignment', 'pendingReview', 'published',
      'publishRate', 'totalRevenue', 'groupCount']
    for (const k of keys) expect(s).toHaveProperty(k)
  })

  it('TC-DASH-002 rates 为 4 项转化率', async () => {
    const r = await http('/api/admin/dashboard', { cookie: adminCookie })
    const rates = r.json.data.rates as { label: string; v: number }[]
    expect(rates.length).toBe(4)
    for (const x of rates) {
      expect(typeof x.v).toBe('number')
      expect(x.v).toBeGreaterThanOrEqual(0)
      expect(x.v).toBeLessThanOrEqual(100)
    }
  })

  it('TC-DASH-003 trend.months/values 数组等长', async () => {
    const r = await http('/api/admin/dashboard', { cookie: adminCookie })
    const { months, values } = r.json.data.trend as { months: string[]; values: number[] }
    expect(Array.isArray(months)).toBe(true)
    expect(months.length).toBe(values.length)
  })

  it('TC-DASH-004 stats.publishRate = round(published/total*1000)/10', async () => {
    const r = await http('/api/admin/dashboard', { cookie: adminCookie })
    const { totalSongs, published, publishRate } = r.json.data.stats
    const expected = totalSongs > 0 ? Math.round((published / totalSongs) * 1000) / 10 : 0
    expect(publishRate).toBe(expected)
  })

  it('TC-DASH-005 未登录 → 401', async () => {
    const r = await http('/api/admin/dashboard')
    expect(r.json.code).toBe(401)
  })
})

describe('收益统计 /admin/revenue/stats', () => {
  it('TC-REV-S-001 返回 byCreator/bySong/byMonth 三个聚合', async () => {
    const r = await http('/api/admin/revenue/stats', { cookie: adminCookie })
    expectOk(r, 'revenue stats')
    const d = r.json.data
    expect(Array.isArray(d.byCreator)).toBe(true)
    expect(Array.isArray(d.bySong)).toBe(true)
    expect(Array.isArray(d.byMonth)).toBe(true)
    expect(typeof d.totalRevenue).toBe('number')
    expect(typeof d.creatorCount).toBe('number')
  })

  it('TC-REV-S-002 byCreator 按 totalRevenue 倒序', async () => {
    const r = await http('/api/admin/revenue/stats', { cookie: adminCookie })
    const byCreator = r.json.data.byCreator as { totalRevenue: number }[]
    for (let i = 1; i < byCreator.length; i++) {
      expect(byCreator[i - 1].totalRevenue).toBeGreaterThanOrEqual(byCreator[i].totalRevenue)
    }
  })

  it('TC-REV-S-003 total = sum(douyin+qishui) 一致性', async () => {
    const r = await http('/api/admin/revenue/stats', { cookie: adminCookie })
    const { totalRevenue, douyinRevenue, qishuiRevenue } = r.json.data
    // 允许 0.5 元浮点误差
    expect(Math.abs(totalRevenue - (douyinRevenue + qishuiRevenue))).toBeLessThan(0.5)
  })
})

describe('创作者下拉 /admin/revenue/creators', () => {
  it('TC-REV-C-001 返回 active creator 列表', async () => {
    const r = await http('/api/admin/revenue/creators', { cookie: adminCookie })
    expectOk(r, 'creators')
    const list = r.json.data.creators as { id: number; name: string; phone: string }[]
    expect(list.length).toBeGreaterThan(0)
    for (const c of list) {
      expect(typeof c.id).toBe('number')
      expect(c.phone).toMatch(/^\d{11}$/)
    }
  })
})

describe('评审统计 /review/stats', () => {
  it('TC-R-S-001 本人评审历史 + stats', async () => {
    const r = await http('/api/review/stats', { cookie: reviewerCookie })
    expectOk(r, 'review stats')
    const s = r.json.data.stats
    expect(typeof s.totalCount).toBe('number')
    expect(typeof s.avgScore).toBe('number')
    expect(s.recommendRate).toBeGreaterThanOrEqual(0)
    expect(s.recommendRate).toBeLessThanOrEqual(100)
    expect(Array.isArray(r.json.data.history)).toBe(true)
  })

  it('TC-R-S-002 管理员访问评审接口 → 401/403（middleware 或 handler 拦截）', async () => {
    const r = await http('/api/review/stats', { cookie: adminCookie })
    expect([401, 403]).toContain(r.json.code)
  })

  it('TC-R-S-003 未登录 → 401 或 403', async () => {
    const r = await http('/api/review/stats')
    expect([401, 403]).toContain(r.json.code)
  })
})

describe('操作日志 /admin/logs', () => {
  it('TC-LOG-001 列表 + 分页', async () => {
    const r = await http('/api/admin/logs?pageSize=5', { cookie: adminCookie })
    expectOk(r, 'logs')
    expect(r.json.data.list.length).toBeLessThanOrEqual(5)
    expect(typeof r.json.data.total).toBe('number')
  })

  it('TC-LOG-002 按 actionType 筛选', async () => {
    const r = await http('/api/admin/logs?actionType=create_content', { cookie: adminCookie })
    expectOk(r, 'logs filter')
    const list = r.json.data.list as { action: string }[]
    for (const l of list) expect(l.action).toBe('create_content')
  })

  it('TC-LOG-003 search 匹配 operatorName / action', async () => {
    const r = await http('/api/admin/logs?search=admin', { cookie: adminCookie })
    expectOk(r, 'logs search')
    expect(Array.isArray(r.json.data.list)).toBe(true)
  })

  it('TC-LOG-004 startDate > endDate 空结果不 500', async () => {
    const r = await http('/api/admin/logs?startDate=2099-01-01&endDate=2000-01-01', { cookie: adminCookie })
    expectOk(r, 'logs date')
    expect(r.json.data.list.length).toBe(0)
  })

  it('TC-LOG-005 id 序列化为字符串（BigInt）', async () => {
    const r = await http('/api/admin/logs?pageSize=1', { cookie: adminCookie })
    if (r.json.data.list.length > 0) {
      expect(typeof r.json.data.list[0].id).toBe('string')
    }
  })
})
