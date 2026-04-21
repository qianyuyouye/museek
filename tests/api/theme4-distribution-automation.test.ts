import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { http, adminLogin, creatorLogin, expectOk } from './_helpers'
import { prisma } from '@/lib/prisma'

let adminCookie = ''
let creatorCookie = ''
let creatorId = 0
let songId = 0

const ISRC = `CN-T4A-26-${Date.now().toString().slice(-5)}`
const SUFFIX = Date.now().toString().slice(-6)

describe('Theme 4 · 发行链路自动化', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
    const creator = await creatorLogin()
    creatorCookie = creator.cookie
    creatorId = creator.userId!

    // 确保 creator 已签约 + 实名（publish 校验会卡这两项）
    await prisma.user.update({
      where: { id: creatorId },
      data: { agencyContract: true, realNameStatus: 'verified' },
    })

    // 造一首 reviewed 的歌：直接 DB 插，绕开 upload 流程
    const created = await prisma.platformSong.create({
      data: {
        userId: creatorId,
        title: `theme4-${SUFFIX}`,
        status: 'reviewed',
        source: 'upload',
        copyrightCode: `T4-${SUFFIX}`,
        isrc: ISRC,
      },
    })
    songId = created.id

    // 清理该歌曲上可能遗留的 distribution 记录（rerun 防污染）
    await prisma.distribution.deleteMany({ where: { songId } })
  })

  afterAll(async () => {
    await prisma.distribution.deleteMany({ where: { songId } })
    await prisma.platformSong.delete({ where: { id: songId } }).catch(() => {})
  })

  it('TC-T4-001 publish 成功后自动批量创建 distributions（pending）', async () => {
    const r = await http(`/api/admin/songs/${songId}/status`, {
      method: 'POST',
      cookie: adminCookie,
      body: { action: 'publish' },
    })
    expectOk(r, 'publish')
    expect(r.json.data.distributionsCreated).toBeGreaterThan(0)

    const dists = await prisma.distribution.findMany({ where: { songId } })
    expect(dists.length).toBe(r.json.data.distributionsCreated)
    expect(dists.every((d) => d.status === 'pending')).toBe(true)

    const platforms = new Set(dists.map((d) => d.platform))
    expect(platforms.size).toBe(dists.length) // 无重复
  })

  it('TC-T4-002 /api/admin/distributions 返回的 platforms 驱动矩阵列', async () => {
    const r = await http('/api/admin/distributions', { cookie: adminCookie })
    expectOk(r, 'distributions list')
    const platforms = r.json.data.platforms as string[]
    expect(Array.isArray(platforms)).toBe(true)
    expect(platforms.length).toBeGreaterThan(0)

    // 新建歌曲应在 songs 列表里，matrix 该歌每个平台都有一个 status 值
    const row = r.json.data.matrix?.[songId] as Record<string, string> | undefined
    expect(row).toBeTruthy()
    for (const p of platforms) expect(row![p]).toBeDefined()
  })

  it('TC-T4-003 platform_configs 保存后 /distributions 即时反映新平台', async () => {
    const newPlatform = `测试平台_${SUFFIX}`
    const current = await prisma.systemSetting.findUnique({ where: { key: 'platform_configs' } })
    const snapshot = current?.value ?? null

    try {
      const payload = [
        { name: 'QQ音乐', region: '中国', status: true, mapping: true },
        { name: '网易云音乐', region: '中国', status: true, mapping: true },
        { name: '酷狗音乐', region: '中国', status: true, mapping: false },
        { name: 'Spotify', region: '全球', status: true, mapping: true },
        { name: 'Apple Music', region: '全球', status: true, mapping: false },
        { name: newPlatform, region: '中国', status: true, mapping: false },
      ]
      const put = await http('/api/admin/settings', {
        method: 'PUT',
        cookie: adminCookie,
        body: { settings: [{ key: 'platform_configs', value: payload }] },
      })
      expectOk(put, 'save platform_configs')

      const r = await http('/api/admin/distributions', { cookie: adminCookie })
      expectOk(r, 'distributions after save')
      expect((r.json.data.platforms as string[])).toContain(newPlatform)
    } finally {
      // 恢复 snapshot：通过 API 恢复（触发同样的 invalidate 逻辑），避免后续用例读到新增平台
      await http('/api/admin/settings', {
        method: 'PUT',
        cookie: adminCookie,
        body: { settings: [{ key: 'platform_configs', value: snapshot ?? [] }] },
      }).catch(() => {})
    }
  })

  it('TC-T4-004 POST /distributions/:id 校验未知平台 → 400', async () => {
    const r = await http(`/api/admin/distributions/${songId}`, {
      method: 'POST',
      cookie: adminCookie,
      body: { platform: '不存在的平台', status: 'pending' },
    })
    expect(r.status).toBe(400)
    expect(r.json.message).toContain('平台')
  })

  it('TC-T4-005 revenue imports 接受 legacy key qishui（向后兼容）', async () => {
    const r = await http('/api/admin/revenue/imports', {
      method: 'POST',
      cookie: adminCookie,
      body: { fileName: `legacy-${SUFFIX}.csv`, platform: 'qishui', period: '2026-Q1' },
    })
    expectOk(r, 'legacy import')
    expect(r.json.data.platform).toBe('qishui')
    // 清理
    await prisma.revenueImport.delete({ where: { id: r.json.data.id } }).catch(() => {})
  })
})
