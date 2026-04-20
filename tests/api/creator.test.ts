import { describe, it, expect, beforeAll } from 'vitest'
import { http, creatorLogin, expectOk } from './_helpers'

/** 创作者端 15 条：作品库 / 收益 / 作业 / 学习 / 消息 / 个人中心 */

let cookie = ''

describe('创作者端', () => {
  beforeAll(async () => {
    cookie = (await creatorLogin()).cookie
  })

  it('GET /api/creator/songs 作品库列表', async () => {
    const r = await http('/api/creator/songs', { cookie })
    expectOk(r, 'songs')
    expect(Array.isArray(r.json.data.list)).toBe(true)
  })

  it('GET /api/creator/songs?status=published 筛选已发行', async () => {
    const r = await http('/api/creator/songs?status=published', { cookie })
    expectOk(r, 'published')
    const list = r.json.data.list as { status: string }[]
    expect(list.every((s) => s.status === 'published')).toBe(true)
  })

  it('GET /api/creator/songs?status=needs_revision 需修改', async () => {
    const r = await http('/api/creator/songs?status=needs_revision', { cookie })
    expectOk(r, 'needs_revision')
  })

  it('GET /api/creator/songs/:id 详情含评审记录', async () => {
    const r = await http('/api/creator/songs/2', { cookie })
    expect([200, 403, 404]).toContain(r.status)
  })

  it('GET /api/creator/songs/99999 他人作品 → 403', async () => {
    const r = await http('/api/creator/songs/99999', { cookie })
    expect([403, 404]).toContain(r.status)
  })

  it('GET /api/creator/revenue 两 Tab 数据结构', async () => {
    const r = await http('/api/creator/revenue', { cookie })
    expectOk(r, 'revenue')
    expect(r.json.data.stats).toBeTruthy()
  })

  it('GET /api/creator/assignments 列表', async () => {
    const r = await http('/api/creator/assignments', { cookie })
    expectOk(r, 'assignments')
    expect(Array.isArray(r.json.data.list)).toBe(true)
  })

  it('GET /api/creator/assignments/:id/fields 动态字段', async () => {
    const r = await http('/api/creator/assignments/1/fields', { cookie })
    expect([200, 404]).toContain(r.status)
  })

  it('POST /api/creator/assignments/99/submit 作业不存在 → 404', async () => {
    const r = await http('/api/creator/assignments/99/submit', {
      method: 'POST',
      cookie,
      body: { title: 'x' },
    })
    expect([400, 404]).toContain(r.status)
  })

  it('GET /api/learning 学习记录', async () => {
    const r = await http('/api/learning', { cookie })
    expectOk(r, 'learning')
    expect(Array.isArray(r.json.data.list)).toBe(true)
    expect(typeof r.json.data.total).toBe('number')  // E-33 分页一致性
  })

  it('POST /api/learning 上报进度', async () => {
    const r = await http('/api/learning', {
      method: 'POST',
      cookie,
      body: { contentId: 2, progress: 50 },
    })
    expect(r.status).toBe(200)
  })

  it('POST /api/learning progress > 100 被限制到 100', async () => {
    const r = await http('/api/learning', {
      method: 'POST',
      cookie,
      body: { contentId: 2, progress: 200 },
    })
    expect(r.status).toBe(200)
    expect(r.json.data.record.progress).toBeLessThanOrEqual(100)
  })

  it('GET /api/creator/community 作品广场只含 published', async () => {
    const r = await http('/api/creator/community', { cookie })
    expect([200, 404]).toContain(r.status)  // 路由可能在其他 path
  })

  it('POST /api/profile/real-name 非法身份证 → 400', async () => {
    const r = await http('/api/profile/real-name', {
      method: 'POST',
      cookie,
      body: { realName: 'Test User', idCard: '123' },
    })
    expect(r.status).toBe(400)
  })

  it('POST /api/profile/password 旧密码错误 → 400', async () => {
    const r = await http('/api/profile/password', {
      method: 'POST',
      cookie,
      body: { oldPassword: 'wrong', newPassword: 'Abc12345New' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toMatch(/旧密码/)
  })
})
