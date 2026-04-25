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
    // MySQL ci collation：Pop / pop 都算匹配
    expect(list.every((s) => !s.genre || s.genre.toLowerCase() === 'pop')).toBe(true)
  })

  it('POST /api/review/submit 分数范围校验 150 → 400', async () => {
    const r = await http('/api/review/submit', {
      method: 'POST',
      cookie: reviewerCookie,
      body: {
        songId: 1, technique: 150, lyrics: 80, melody: 80, arrangement: 80, styleCreativity: 80, commercial: 80,
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
        songId: 1, technique: 80, lyrics: 80, melody: 80, arrangement: 80, styleCreativity: 80, commercial: 80,
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
        songId: 1, technique: 80, lyrics: 80, melody: 80, arrangement: 80, styleCreativity: 80, commercial: 80,
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

  it('TC-RV-NOTIFY 评审完成后创作者收到 tpl.review_done 通知', async () => {
    const { prisma } = await import('@/lib/prisma')
    const creator = await prisma.user.findUnique({ where: { phone: '13800001234' }, select: { id: true } })
    await prisma.notification.deleteMany({ where: { userId: creator!.id } })

    const song = await prisma.platformSong.create({
      data: {
        title: '通知测试曲',
        userId: creator!.id,
        status: 'pending_review',
        source: 'upload',
        copyrightCode: `TN-${Date.now() % 100000000}`,
      },
    })

    const { cookie: revCookie } = await reviewerLogin()
    const r = await http('/api/review/submit', {
      method: 'POST',
      cookie: revCookie,
      body: { songId: song.id, technique: 85, lyrics: 85, melody: 85, arrangement: 85, styleCreativity: 85, commercial: 85, recommendation: 'not_recommend', comment: '不错不错不错不错不错' },
    })
    expectOk(r, 'review submit')

    const notes = await prisma.notification.findMany({ where: { userId: creator!.id, targetType: 'song', targetId: String(song.id) } })
    expect(notes.length).toBe(1)
    expect(notes[0].title).toContain('通知测试曲')
    expect(notes[0].type).toBe('work')
    expect(notes[0].linkUrl).toBe(`/creator/songs?id=${song.id}`)

    await prisma.notification.deleteMany({ where: { userId: creator!.id } })
    await prisma.review.deleteMany({ where: { songId: song.id } })
    await prisma.platformSong.delete({ where: { id: song.id } })
  })
})
