import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, expectOk } from './_helpers'

/**
 * 系统设置 / 发行确认 / ISRC / 学习记录 / 公开内容 17 条
 * 覆盖：/api/admin/settings, /api/admin/publish-confirm,
 *      /api/admin/songs/:id/isrc, /api/learning, /api/content, /api/songs/published
 */

let adminCookie = ''
let creatorCookie = ''

describe('系统设置 /admin/settings', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    creatorCookie = (await creatorLogin()).cookie
  })

  it('TC-SET-001 GET 返回预设 key', async () => {
    const r = await http('/api/admin/settings', { cookie: adminCookie })
    expectOk(r, 'settings')
    const keys = (r.json.data as { key: string }[]).map((s) => s.key)
    expect(keys).toContain('scoring_weights')
    expect(keys).toContain('revenue_rules')
    expect(keys).toContain('ai_tools')
    expect(keys).toContain('genres')
  })

  it('TC-SET-002 PUT 非法 key → 400', async () => {
    const r = await http('/api/admin/settings', {
      method: 'PUT',
      cookie: adminCookie,
      body: { settings: [{ key: 'not_allowed_key', value: 1 }] },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('不允许')
  })

  it('TC-SET-003 PUT settings 非数组 → 400', async () => {
    const r = await http('/api/admin/settings', {
      method: 'PUT',
      cookie: adminCookie,
      body: { settings: 'invalid' },
    })
    expect(r.status).toBe(400)
  })

  it('TC-SET-004 PUT commission_rules 自动别名到 revenue_rules', async () => {
    // 用完整三档数组，保留业务数据形状，避免污染后续测试
    const rulesPayload = [
      { name: '高分激励', creatorRatio: 0.8, platformRatio: 0.2, conditionType: 'min_song_score', conditionValue: 90, priority: 1, enabled: true },
      { name: '量产奖励', creatorRatio: 0.75, platformRatio: 0.25, conditionType: 'min_published_count', conditionValue: 10, priority: 2, enabled: true },
      { name: '默认规则', creatorRatio: 0.7, platformRatio: 0.3, conditionType: 'default', conditionValue: null, priority: 99, enabled: true },
    ]
    const r = await http('/api/admin/settings', {
      method: 'PUT',
      cookie: adminCookie,
      body: { settings: [{ key: 'commission_rules', value: rulesPayload }] },
    })
    expectOk(r, 'alias')
    // 读回确认别名落到 revenue_rules
    const get = await http('/api/admin/settings', { cookie: adminCookie })
    const entry = (get.json.data as { key: string; value: unknown }[])
      .find((s) => s.key === 'revenue_rules')
    expect(entry).toBeTruthy()
    expect(Array.isArray(entry!.value)).toBe(true)
  })

  it('TC-SET-005 PUT scoring_weights 保存', async () => {
    const r = await http('/api/admin/settings', {
      method: 'PUT',
      cookie: adminCookie,
      body: {
        settings: [{ key: 'scoring_weights', value: { technique: 30, creativity: 40, commercial: 30 } }],
      },
    })
    expectOk(r, 'weights')
    // 读回校验
    const get = await http('/api/admin/settings', { cookie: adminCookie })
    const weights = (get.json.data as { key: string; value: { technique: number } }[])
      .find((s) => s.key === 'scoring_weights')
    expect(weights?.value.technique).toBe(30)
  })

  it('TC-SET-006 非管理员访问 → 401/403', async () => {
    const r = await http('/api/admin/settings', { cookie: creatorCookie })
    expect([401, 403]).toContain(r.json.code)
  })
})

describe('发行确认 /admin/publish-confirm', () => {
  it('TC-PUB-001 列表返回 statusCounts', async () => {
    const r = await http('/api/admin/publish-confirm', { cookie: adminCookie })
    expectOk(r, 'publish list')
    expect(typeof r.json.data.statusCounts).toBe('object')
    expect(r.json.data.statusCounts.all).toBeGreaterThanOrEqual(0)
  })

  it('TC-PUB-002 非法 status → 400', async () => {
    const r = await http('/api/admin/publish-confirm?status=invalid_xxx', { cookie: adminCookie })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('状态')
  })

  it('TC-PUB-003 status=all 全量', async () => {
    const r = await http('/api/admin/publish-confirm?status=all', { cookie: adminCookie })
    expectOk(r, 'all')
  })

  it('TC-PUB-004 list 项含 hasRevenue 字段', async () => {
    const r = await http('/api/admin/publish-confirm', { cookie: adminCookie })
    const list = r.json.data.list as { hasRevenue: boolean }[]
    for (const l of list) expect(typeof l.hasRevenue).toBe('boolean')
  })
})

describe('ISRC /admin/songs/:id/isrc', () => {
  it('TC-ISRC-001 不存在歌曲 → 404', async () => {
    const r = await http('/api/admin/songs/99999999/isrc', {
      method: 'POST',
      cookie: adminCookie,
      body: { isrc: 'CN-A01-22-12345' },
    })
    expect(r.status).toBe(404)
  })

  it('TC-ISRC-002 ISRC 为空 → 400', async () => {
    const r = await http('/api/admin/songs/1/isrc', {
      method: 'POST',
      cookie: adminCookie,
      body: { isrc: '' },
    })
    expect([400, 404]).toContain(r.status)
  })
})

describe('学习记录 /learning', () => {
  it('TC-LRN-001 GET 当前创作者学习记录', async () => {
    const r = await http('/api/learning', { cookie: creatorCookie })
    expectOk(r, 'learning')
    expect(Array.isArray(r.json.data.list)).toBe(true)
  })

  it('TC-LRN-002 POST 缺 contentId → 400', async () => {
    const r = await http('/api/learning', {
      method: 'POST',
      cookie: creatorCookie,
      body: {},
    })
    expect(r.status).toBe(400)
  })

  it('TC-LRN-003 POST 不存在 contentId → 404', async () => {
    const r = await http('/api/learning', {
      method: 'POST',
      cookie: creatorCookie,
      body: { contentId: 99999999 },
    })
    expect([400, 404]).toContain(r.status)
  })

  it('TC-LRN-004 admin 访问 creator 专属 → 401', async () => {
    const r = await http('/api/learning', { cookie: adminCookie })
    expect(r.json.code).toBe(401)
  })
})

describe('公开内容 /content + /songs/published', () => {
  // 注：源码 /api/content 与 /api/songs/published 未做 auth 判断（设计本意公开），
  // 但 middleware 当前对所有非白名单路径拦截 401。这里按当前实现断言登录后功能正确，
  // middleware 白名单遗漏 /api/content、/api/songs/published 是范围外 bug，单独列修。

  it('TC-PUB-C-001 /content 带登录 cookie → 只返回 published', async () => {
    const r = await http('/api/content', { cookie: creatorCookie })
    expectOk(r, 'content')
    const list = r.json.data.list as { status: string }[]
    for (const c of list) expect(c.status).toBe('published')
  })

  it('TC-PUB-C-002 /content category 筛选', async () => {
    const r = await http('/api/content?category=AI', { cookie: creatorCookie })
    expectOk(r, 'content cat')
    const list = r.json.data.list as { category: string }[]
    for (const c of list) expect(c.category).toBe('AI')
  })

  it('TC-PUB-C-003 /songs/published 不泄露 phone / idCard', async () => {
    const r = await http('/api/songs/published?pageSize=5', { cookie: creatorCookie })
    expectOk(r, 'songs published')
    const list = r.json.data.list as { likeCount?: number }[]
    for (const s of list) {
      expect(s).toHaveProperty('authorName')
      expect(s).not.toHaveProperty('phone')
      expect(s).not.toHaveProperty('idCard')
    }
  })

  it('TC-PUB-C-004 未登录 /content → 当前 middleware 返回 401', async () => {
    const r = await http('/api/content')
    expect(r.json.code).toBe(401)
  })
})
