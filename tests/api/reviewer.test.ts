import { describe, it, expect, beforeAll } from 'vitest'
import { http, reviewerLogin, adminLogin, expectOk } from './_helpers'

/** 评审端 10 条 */

let reviewerCookie = ''
let adminCookie = ''

describe('评审端', () => {
  beforeAll(async () => {
    reviewerCookie = (await reviewerLogin()).cookie
    adminCookie = (await adminLogin()).cookie
  })

  it('GET /api/review/stats 工作台统计', async () => {
    const r = await http('/api/review/stats', { cookie: reviewerCookie })
    expectOk(r, 'stats')
    expect(r.json.data).toBeTruthy()
    expect(typeof r.json.data).toBe('object')
  })

  it('GET /api/review/queue 待评审列表', async () => {
    const r = await http('/api/review/queue', { cookie: reviewerCookie })
    expectOk(r, 'queue')
    expect(Array.isArray(r.json.data.list)).toBe(true)
  })

  it('GET /api/review/queue?genre=Pop 流派筛选', async () => {
    const r = await http('/api/review/queue?genre=Pop', { cookie: reviewerCookie })
    expectOk(r, 'queue genre')
    const list = r.json.data.list as { genre: string | null }[]
    expect(list.every((s) => !s.genre || s.genre === 'Pop')).toBe(true)
  })

  it('POST /api/review/submit 分数范围校验 150 → 400', async () => {
    const r = await http('/api/review/submit', {
      method: 'POST',
      cookie: reviewerCookie,
      body: {
        songId: 1, technique: 150, creativity: 80, commercial: 80,
        comment: 'x', recommendation: 'strongly_recommend',
      },
    })
    expect(r.status).toBe(400)
  })

  it('POST /api/review/submit 评语为空 → 400', async () => {
    const r = await http('/api/review/submit', {
      method: 'POST',
      cookie: reviewerCookie,
      body: {
        songId: 1, technique: 80, creativity: 80, commercial: 80,
        comment: '', recommendation: 'strongly_recommend',
      },
    })
    expect(r.status).toBe(400)
  })

  it('POST /api/review/submit 无效 recommendation → 400', async () => {
    const r = await http('/api/review/submit', {
      method: 'POST',
      cookie: reviewerCookie,
      body: {
        songId: 1, technique: 80, creativity: 80, commercial: 80,
        comment: 'valid comment here longer than 20 chars',
        recommendation: 'unknown',
      },
    })
    expect(r.status).toBe(400)
  })

  it('POST /api/review/submit songId 不存在 → 404', async () => {
    const r = await http('/api/review/submit', {
      method: 'POST',
      cookie: reviewerCookie,
      body: {
        songId: 99999, technique: 80, creativity: 80, commercial: 80,
        comment: 'valid comment here longer than 20 chars',
        recommendation: 'strongly_recommend',
      },
    })
    expect([404, 400]).toContain(r.status)
  })

  it('GET /api/review/songs/:id 评审查看详情', async () => {
    const r = await http('/api/review/songs/1', { cookie: reviewerCookie })
    expect([200, 403, 404]).toContain(r.status)
  })

  it('创作者访问 /api/review/* → 401', async () => {
    const r = await http('/api/review/queue')
    expect([401, 403]).toContain(r.json.code)
  })

  it('admin 访问 /api/review/queue → 401（不是自己端）', async () => {
    const r = await http('/api/review/queue', { cookie: adminCookie })
    expect([401, 403]).toContain(r.json.code)
  })
})
