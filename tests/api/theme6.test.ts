import { describe, it, expect, beforeAll } from 'vitest'
import { http, adminLogin, creatorLogin, expectOk } from './_helpers'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { fillSongDefaults } from '@/lib/song-defaults'
import { nextCopyrightCode } from '@/lib/copyright-code'

describe('fillSongDefaults helper (GAP-CRTR-004 / GAP-SCHM-005)', () => {
  const user = { realName: '张三', name: 'zhangsan' }

  it('空字段回落 realName', () => {
    const r = fillSongDefaults({ title: '新歌' }, user)
    expect(r.performer).toBe('张三')
    expect(r.lyricist).toBe('张三')
    expect(r.composer).toBe('张三')
    expect(r.albumArtist).toBe('张三')
  })

  it('空 albumName 回落 title', () => {
    const r = fillSongDefaults({ title: '新歌' }, user)
    expect(r.albumName).toBe('新歌')
  })

  it('非空字段保留', () => {
    const r = fillSongDefaults({ title: '新歌', performer: '编曲师' }, user)
    expect(r.performer).toBe('编曲师')
  })

  it('realName 为空时用 name', () => {
    const r = fillSongDefaults({ title: '新歌' }, { realName: null, name: 'zhangsan' })
    expect(r.performer).toBe('zhangsan')
  })

  it('空白字符串视作未填', () => {
    const r = fillSongDefaults({ title: '新歌', performer: '   ' }, user)
    expect(r.performer).toBe('张三')
  })
})

describe('nextCopyrightCode helper (GAP-ADMIN-029)', () => {
  it('返回形如 AIMU-YYYY-NNNNNN', async () => {
    const result = await prisma.$transaction((tx) => nextCopyrightCode(tx))
    expect(result).toMatch(/^AIMU-\d{4}-\d{6}$/)
  })

  it('连续调用递增', async () => {
    const a = await prisma.$transaction((tx) => nextCopyrightCode(tx))
    const b = await prisma.$transaction((tx) => nextCopyrightCode(tx))
    const parseNo = (s: string) => parseInt(s.split('-')[2], 10)
    expect(parseNo(b) - parseNo(a)).toBe(1)
  })

  it('并发 5 次得到互不相同且步长 1 的序号', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => prisma.$transaction((tx) => nextCopyrightCode(tx))),
    )
    const nums = results.map((s) => parseInt(s.split('-')[2], 10)).sort((a, b) => a - b)
    expect(new Set(nums).size).toBe(5)
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i] - nums[i - 1]).toBe(1)
    }
  })
})

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
      try {
        const r = await http(`/api/admin/accounts/${creatorUserId}/reset-password`, {
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
        await restorePassword(creatorUserId)
      }
    })

    it('POST 带 password 参数时不回传明文（管理员已知原值）', async () => {
      try {
        const r = await http(`/api/admin/accounts/${creatorUserId}/reset-password`, {
          method: 'POST',
          body: { password: 'Admin9999' },
          cookie: adminCookie,
        })
        expectOk(r, 'reset-password specified')
        expect(r.json.data.generated).toBe(false)
        expect(r.json.data.password).toBeUndefined()
      } finally {
        await restorePassword(creatorUserId)
      }
    })
  })
  // Patch C tests
  describe('C: /api/creator/upload 默认字段填充（GAP-CRTR-004）', () => {
    it('不传 performer 时 DB 行 performer = user.realName', async () => {
      const user = await prisma.user.findUnique({
        where: { id: creatorUserId },
        select: { realName: true, name: true },
      })
      const expected = (user!.realName?.trim() || user!.name).trim()

      const r = await http('/api/creator/upload', {
        method: 'POST',
        cookie: creatorCookie,
        body: {
          title: '默认 performer 测试',
          aiTools: ['Suno'],
          contribution: 'lead',
          audioUrl: '/uploads/audio/test.mp3',
        },
      })
      expectOk(r, 'upload default performer')
      const id = r.json.data.id
      const song = await prisma.platformSong.findUnique({ where: { id } })
      expect(song?.performer).toBe(expected)
      expect(song?.albumName).toBe('默认 performer 测试')
      await prisma.platformSong.delete({ where: { id } })
    })

    it('传入 performer 时保留', async () => {
      const r = await http('/api/creator/upload', {
        method: 'POST',
        cookie: creatorCookie,
        body: {
          title: '显式 performer 测试',
          aiTools: ['Suno'],
          contribution: 'lead',
          audioUrl: '/uploads/audio/test.mp3',
          performer: '编曲师小王',
          albumName: '专辑 X',
        },
      })
      expectOk(r, 'upload explicit performer')
      const id = r.json.data.id
      const song = await prisma.platformSong.findUnique({ where: { id } })
      expect(song?.performer).toBe('编曲师小王')
      expect(song?.albumName).toBe('专辑 X')
      await prisma.platformSong.delete({ where: { id } })
    })
  })
  describe('C: /api/creator/assignments/:id/submit 默认字段填充', () => {
    it('作业提交不传 performer → DB 行 performer = user.realName', async () => {
      const assignment = await prisma.assignment.findFirst({
        where: { status: 'active', group: { userGroups: { some: { userId: creatorUserId } } } },
        select: { id: true },
      })
      if (!assignment) {
        console.warn('[T-C3] 无 active 作业，跳过')
        return
      }

      // 清残留
      await prisma.assignmentSubmission.deleteMany({
        where: { assignmentId: assignment.id, userId: creatorUserId },
      })

      const user = await prisma.user.findUnique({
        where: { id: creatorUserId },
        select: { realName: true, name: true },
      })
      const expected = (user!.realName?.trim() || user!.name || '').trim()

      const r = await http(`/api/creator/assignments/${assignment.id}/submit`, {
        method: 'POST',
        cookie: creatorCookie,
        body: { title: '作业默认测试', aiTools: ['Suno'] },
      })
      expectOk(r, 'assignment submit default')
      const songId = r.json.data.songId
      const song = await prisma.platformSong.findUnique({ where: { id: songId } })
      expect(song?.performer).toBe(expected)
      expect(song?.albumName).toBe('作业默认测试')
      // cleanup
      await prisma.assignmentSubmission.deleteMany({ where: { assignmentId: assignment.id, userId: creatorUserId } })
      await prisma.platformSong.deleteMany({ where: { id: songId } })
    })
  })
  // Patch D tests
  describe('D: /api/creator/upload copyrightCode 格式（GAP-ADMIN-029）', () => {
    it('POST /creator/upload → copyrightCode 形如 AIMU-YYYY-NNNNNN', async () => {
      const r = await http('/api/creator/upload', {
        method: 'POST',
        cookie: creatorCookie,
        body: { title: 'D1 测试歌', aiTools: ['Suno'], contribution: 'lead', audioUrl: '/uploads/audio/d1.mp3' },
      })
      expectOk(r, 'upload copyrightCode')
      const code = r.json.data.copyrightCode as string
      expect(code).toMatch(/^AIMU-\d{4}-\d{6}$/)
      await prisma.platformSong.delete({ where: { id: r.json.data.id } })
    })

    it('并发 5 次 upload → 5 个 copyrightCode 唯一且步长 1', async () => {
      const reqs = Array.from({ length: 5 }, (_, i) =>
        http('/api/creator/upload', {
          method: 'POST',
          cookie: creatorCookie,
          body: { title: `并发 D2 ${i}`, aiTools: ['Suno'], contribution: 'lead', audioUrl: `/uploads/audio/d2_${i}.mp3` },
        }),
      )
      const results = await Promise.all(reqs)
      const ids = results.map((r) => r.json.data.id as number)
      const codes = results.map((r) => r.json.data.copyrightCode as string)
      const nums = codes.map((c) => parseInt(c.split('-')[2], 10)).sort((a, b) => a - b)
      expect(new Set(nums).size).toBe(5)
      for (let i = 1; i < nums.length; i++) {
        expect(nums[i] - nums[i - 1]).toBe(1)
      }
      await prisma.platformSong.deleteMany({ where: { id: { in: ids } } })
    })
  })
})
