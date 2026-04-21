import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, expectOk } from './_helpers'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'

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
  describe('B2: reset-password 返回明文（GAP-ADMIN-008）', () => {
    // 测试会把目标 creator 密码改掉，跑完用 prisma 直接恢复成 Abc12345，避免影响后续测试登录
    async function restorePassword(userId: number) {
      const hash = await hashPassword('Abc12345')
      await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } })
    }

    it('POST /admin/accounts/:id/reset-password 自动生成时返回 data.password 8+ 位明文', async () => {
      const listRes = await http('/api/admin/accounts?tab=creator&pageSize=1', { cookie: adminCookie })
      const target = (listRes.json.data.list as Array<{ id: number }>)[0]
      expect(target).toBeTruthy()

      try {
        const r = await http(`/api/admin/accounts/${target.id}/reset-password`, {
          method: 'POST',
          body: {},
          cookie: adminCookie,
        })
        expectOk(r, 'reset-password generated')
        expect(r.json.data.generated).toBe(true)
        expect(typeof r.json.data.password).toBe('string')
        expect((r.json.data.password as string).length).toBeGreaterThanOrEqual(8)
        expect(/[A-Za-z]/.test(r.json.data.password)).toBe(true)
        expect(/\d/.test(r.json.data.password)).toBe(true)
      } finally {
        await restorePassword(target.id)
      }
    })

    it('POST 带 password 参数时不回传明文（管理员已知原值）', async () => {
      const listRes = await http('/api/admin/accounts?tab=creator&pageSize=1', { cookie: adminCookie })
      const target = (listRes.json.data.list as Array<{ id: number }>)[0]

      try {
        const r = await http(`/api/admin/accounts/${target.id}/reset-password`, {
          method: 'POST',
          body: { password: 'Admin9999' },
          cookie: adminCookie,
        })
        expectOk(r, 'reset-password specified')
        expect(r.json.data.generated).toBe(false)
        expect(r.json.data.password).toBeUndefined()
      } finally {
        await restorePassword(target.id)
      }
    })
  })
  // Patch C tests
  // Patch D tests
})
