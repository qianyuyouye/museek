import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, reviewerLogin, expectOk } from './_helpers'

/**
 * 创作者杂项 + 评审分析 + 学习成就 + 头像 15 条
 * 覆盖：/api/profile/avatar, /api/creator/upload, /api/creator/notifications,
 *      /api/learning/achievements, /api/review/songs/:id/analysis
 */

let adminCookie = ''
let creatorCookie = ''
let reviewerCookie = ''

describe('/api/profile/avatar', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    creatorCookie = (await creatorLogin()).cookie
    reviewerCookie = (await reviewerLogin()).cookie
  })

  it('TC-AVT-001 空 avatarUrl → 400', async () => {
    const r = await http('/api/profile/avatar', {
      method: 'POST',
      cookie: creatorCookie,
      body: { avatarUrl: '' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('必填')
  })

  it('TC-AVT-002 超长 avatarUrl → 400', async () => {
    const r = await http('/api/profile/avatar', {
      method: 'POST',
      cookie: creatorCookie,
      body: { avatarUrl: 'https://x.com/' + 'a'.repeat(600) },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('过长')
  })

  it('TC-AVT-003 admin 更新头像 → 200', async () => {
    const r = await http('/api/profile/avatar', {
      method: 'POST',
      cookie: adminCookie,
      body: { avatarUrl: 'https://example.com/avatar.png' },
    })
    expectOk(r, 'admin avatar')
    expect(r.json.data.avatarUrl).toBe('https://example.com/avatar.png')
  })

  it('TC-AVT-004 creator 更新头像 → 200', async () => {
    const r = await http('/api/profile/avatar', {
      method: 'POST',
      cookie: creatorCookie,
      body: { avatarUrl: 'https://example.com/c.png' },
    })
    expectOk(r, 'creator avatar')
  })
})

describe('/api/creator/upload', () => {
  it('TC-UPL-001 缺 title → 400', async () => {
    const r = await http('/api/creator/upload', {
      method: 'POST',
      cookie: creatorCookie,
      body: {},
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('标题')
  })

  it('TC-UPL-002 新建作品 → 200 + copyrightCode', async () => {
    const r = await http('/api/creator/upload', {
      method: 'POST',
      cookie: creatorCookie,
      body: {
        title: `vitest-${Date.now()}`,
        aiTools: ['Suno'],
        genre: 'vitest-genre',
        bpm: 120,
      },
    })
    expectOk(r, 'upload new')
    expect(r.json.data.copyrightCode).toMatch(/^AIMU-\d{4}-\d{6}$/)
  })

  it('TC-UPL-003 非 needs_revision 状态再提交 → 400', async () => {
    // 先创建
    const create = await http('/api/creator/upload', {
      method: 'POST',
      cookie: creatorCookie,
      body: { title: `no-revise-${Date.now()}`, aiTools: ['Suno'] },
    })
    expectOk(create, 'create')
    const id = create.json.data.id
    // 再以 songId 方式提交（此时状态 pending_review）
    const r = await http('/api/creator/upload', {
      method: 'POST',
      cookie: creatorCookie,
      body: { songId: id, title: 're-submit', aiTools: ['Suno'] },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('needs_revision')
  })

  it('TC-UPL-004 他人的 songId 重提 → 403', async () => {
    // 管理员不能以 creator 身份走接口；查任意 id 测权限分支
    const r = await http('/api/creator/upload', {
      method: 'POST',
      cookie: creatorCookie,
      body: { songId: 99999999, title: 'x', aiTools: ['Suno'] },
    })
    expect([403, 404]).toContain(r.status)
  })
})

describe('/api/creator/notifications', () => {
  it('TC-NT-001 GET 列表 + typeCounts', async () => {
    const r = await http('/api/creator/notifications', { cookie: creatorCookie })
    expectOk(r, 'notifications')
    const d = r.json.data
    expect(Array.isArray(d.list)).toBe(true)
    expect(typeof d.unreadCount).toBe('number')
    expect(d.typeCounts).toHaveProperty('all')
    expect(d.typeCounts).toHaveProperty('work')
    expect(d.typeCounts).toHaveProperty('revenue')
    expect(d.typeCounts).toHaveProperty('system')
  })

  it('TC-NT-002 type 筛选只返回该类型', async () => {
    const r = await http('/api/creator/notifications?type=system', { cookie: creatorCookie })
    expectOk(r, 'type filter')
    const list = r.json.data.list as { type: string }[]
    for (const n of list) expect(n.type).toBe('system')
  })

  it('TC-NT-003 PUT all=true 全部标记已读', async () => {
    const r = await http('/api/creator/notifications', {
      method: 'PUT',
      cookie: creatorCookie,
      body: { all: true },
    })
    expectOk(r, 'mark all read')
    // 再查 unreadCount
    const after = await http('/api/creator/notifications', { cookie: creatorCookie })
    expect(after.json.data.unreadCount).toBe(0)
  })

  it('TC-NT-004 PUT 缺 id 且无 all → 400', async () => {
    const r = await http('/api/creator/notifications', {
      method: 'PUT',
      cookie: creatorCookie,
      body: {},
    })
    expect(r.status).toBe(400)
  })

  it('TC-NT-005 admin 访问 → 403', async () => {
    const r = await http('/api/creator/notifications', { cookie: adminCookie })
    expect([401, 403]).toContain(r.json.code)
  })
})

describe('/api/learning/achievements', () => {
  it('TC-ACH-001 返回 6 个徽章 + 统计字段', async () => {
    const r = await http('/api/learning/achievements', { cookie: creatorCookie })
    expectOk(r, 'achievements')
    const d = r.json.data
    expect(Array.isArray(d.badges)).toBe(true)
    expect(d.badges.length).toBe(6)
    expect(typeof d.totalCourses).toBe('number')
    expect(typeof d.maxStreakDays).toBe('number')
    expect(typeof d.totalDurationHours).toBe('number')
    for (const b of d.badges as { earned: boolean; id: string }[]) {
      expect(typeof b.earned).toBe('boolean')
      expect(b.id).toBeTruthy()
    }
  })

  it('TC-ACH-002 admin 访问 → 401', async () => {
    const r = await http('/api/learning/achievements', { cookie: adminCookie })
    expect(r.json.code).toBe(401)
  })
})

describe('/api/review/songs/:id/analysis', () => {
  it('TC-ANL-001 不存在歌曲 → 404', async () => {
    const r = await http('/api/review/songs/99999999/analysis', { cookie: reviewerCookie })
    expect(r.status).toBe(404)
  })

  it('TC-ANL-002 非法 id → 400', async () => {
    const r = await http('/api/review/songs/abc/analysis', { cookie: reviewerCookie })
    expect(r.status).toBe(400)
  })

  it('TC-ANL-003 admin 访问评审 AI 分析 → 401/403', async () => {
    const r = await http('/api/review/songs/1/analysis', { cookie: adminCookie })
    expect([401, 403]).toContain(r.json.code)
  })
})
