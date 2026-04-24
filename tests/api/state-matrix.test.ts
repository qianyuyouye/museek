import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, expectOk } from './_helpers'

/**
 * 歌曲状态机完整非法转移矩阵 12 条
 * ACTION_TRANSITIONS 合法对照：
 *   publish:      ready_to_publish | reviewed                        → published
 *   reject:       pending_review   | reviewed | ready_to_publish     → needs_revision
 *   archive:      published                                          → archived
 *   restore:      archived                                           → reviewed
 *   review_done:  pending_review                                     → reviewed
 */

let adminCookie = ''

async function findSong(status: string): Promise<number | null> {
  const r = await http(`/api/admin/songs?status=${status}&pageSize=1`, { cookie: adminCookie })
  const s = r.json.data.list[0] as { id: number } | undefined
  return s?.id ?? null
}

async function tryAction(id: number, action: string) {
  return http(`/api/admin/songs/${id}/status`, {
    method: 'POST',
    cookie: adminCookie,
    body: { action },
  })
}

describe('状态机 · 非法转移拒绝', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
  })

  it('TC-SM-001 非法 action 字符串 → 400', async () => {
    const r = await http('/api/admin/songs/1/status', {
      method: 'POST',
      cookie: adminCookie,
      body: { action: 'yolo' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('无效')
  })

  it('TC-SM-002 pending_review 直接 archive → 400', async () => {
    const id = await findSong('pending_review')
    if (!id) return
    const r = await tryAction(id, 'archive')
    expect(r.status).toBe(400)
  })

  it('TC-SM-003 pending_review 直接 publish → 400', async () => {
    const id = await findSong('pending_review')
    if (!id) return
    const r = await tryAction(id, 'publish')
    expect(r.status).toBe(400)
  })

  it('TC-SM-004 pending_review 直接 restore → 400', async () => {
    const id = await findSong('pending_review')
    if (!id) return
    const r = await tryAction(id, 'restore')
    expect(r.status).toBe(400)
  })

  it('TC-SM-005 reviewed 直接 archive → 400', async () => {
    const id = await findSong('reviewed')
    if (!id) return
    const r = await tryAction(id, 'archive')
    expect(r.status).toBe(400)
  })

  it('TC-SM-006 needs_revision 直接 archive → 400', async () => {
    const id = await findSong('needs_revision')
    if (!id) return
    const r = await tryAction(id, 'archive')
    expect(r.status).toBe(400)
  })

  it('TC-SM-007 needs_revision 直接 review_done → 400', async () => {
    const id = await findSong('needs_revision')
    if (!id) return
    const r = await tryAction(id, 'review_done')
    expect(r.status).toBe(400)
  })

  it('TC-SM-008 published 直接 review_done → 400', async () => {
    const id = await findSong('published')
    if (!id) return
    const r = await tryAction(id, 'review_done')
    expect(r.status).toBe(400)
  })

  it('TC-SM-009 archived 直接 publish → 400（必须先 restore）', async () => {
    const id = await findSong('archived')
    if (!id) return
    const r = await tryAction(id, 'publish')
    expect(r.status).toBe(400)
  })

  it('TC-SM-010 archived 直接 reject → 400', async () => {
    const id = await findSong('archived')
    if (!id) return
    const r = await tryAction(id, 'reject')
    expect(r.status).toBe(400)
  })

  it('TC-SM-011 歌曲不存在 → 404', async () => {
    const r = await tryAction(99999999, 'publish')
    expect(r.status).toBe(404)
  })

  it('TC-SM-012 发行校验缺失两要素返回具体原因', async () => {
    // 构造一首 reviewed 状态但未签/未实名的候选（ISRC 校验已移除）
    const list = await http('/api/admin/songs?status=reviewed&pageSize=50', { cookie: adminCookie })
    const songs = list.json.data.list as { id: number; agencyContract: boolean; realNameStatus: string }[]
    const candidate = songs.find((s) => !s.agencyContract || s.realNameStatus !== 'verified')
    if (!candidate) return
    const r = await tryAction(candidate.id, 'publish')
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('发行条件')
  })
})
