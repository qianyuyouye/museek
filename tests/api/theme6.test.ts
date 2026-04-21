import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, expectOk } from './_helpers'
import { prisma } from '@/lib/prisma'

let adminCookie = ''
let creatorCookie = ''
let creatorUserId = 0

describe('Theme 6 field-contract + defaults + copyright', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    const login = await creatorLogin()
    creatorCookie = login.cookie
    creatorUserId = login.userId!
  })

  it('beforeAll smoke: admin/creator cookie 可用', async () => {
    expect(adminCookie).toContain('access_token=')
    expect(creatorCookie).toContain('access_token=')
    expect(creatorUserId).toBeGreaterThan(0)
  })

  // Patch B1 & B2 tests
  describe('B1: /api/admin/accounts songCount (GAP-ADMIN-100)', () => {
    it('GET /api/admin/accounts?tab=creator 每条 list 项含 songCount 数字', async () => {
      const r = await http('/api/admin/accounts?tab=creator&pageSize=50', { cookie: adminCookie })
      expectOk(r, 'accounts creator tab')
      const list = r.json.data.list as Array<{ type: string; songCount: number }>
      expect(list.length).toBeGreaterThan(0)
      expect(list.every((u) => typeof u.songCount === 'number')).toBe(true)
    })

    it('songCount 与 platformSong 关联表真实计数一致', async () => {
      const r = await http('/api/admin/accounts?tab=creator&pageSize=100', { cookie: adminCookie })
      const list = r.json.data.list as Array<{ id: number; songCount: number }>
      // 任选一位有作品的 creator 交叉校验
      const firstWithSongs = list.find((u) => u.songCount > 0)
      if (!firstWithSongs) return
      const actual = await prisma.platformSong.count({ where: { userId: firstWithSongs.id } })
      expect(firstWithSongs.songCount).toBe(actual)
    })
  })
  // Patch C tests
  // Patch D tests
})
