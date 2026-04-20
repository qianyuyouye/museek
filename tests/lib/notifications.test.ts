import { describe, it, expect, beforeEach, beforeAll, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { renderTemplate, getTemplate } from '@/lib/notifications'
import { setSetting, SETTING_KEYS } from '@/lib/system-settings'
import { notify } from '@/lib/notifications'

describe('notifications renderTemplate', () => {
  beforeEach(async () => {
    await prisma.systemSetting.deleteMany({ where: { key: SETTING_KEYS.NOTIFICATION_TEMPLATES } })
  })

  it('渲染简单占位', async () => {
    const r = await renderTemplate('tpl.review_done', { songTitle: '夏日告别', score: 85, songId: '123' })
    expect(r?.title).toBe('评审完成：《夏日告别》')
    expect(r?.content).toContain('85 分')
    expect(r?.linkUrl).toBe('/creator/songs?id=123')
    expect(r?.type).toBe('work')
  })

  it('管理员覆盖模板后渲染按新文案', async () => {
    await setSetting(SETTING_KEYS.NOTIFICATION_TEMPLATES, {
      'tpl.review_done': { type: 'work', title: '自定义：{songTitle}', content: '分数 {score}', linkUrl: '/custom' },
    } as any)
    const r = await renderTemplate('tpl.review_done', { songTitle: 'X', score: 90 })
    expect(r?.title).toBe('自定义：X')
  })

  it('未知 templateKey 返回 null', async () => {
    const r = await renderTemplate('tpl.nonexistent' as any, {})
    expect(r).toBeNull()
  })

  it('占位符未提供变量时保留原样', async () => {
    const r = await renderTemplate('tpl.review_done', { songTitle: 'X' })
    expect(r?.content).toContain('{score}')
  })
})

describe('notify() 业务触发', () => {
  let userId = 0
  beforeAll(async () => {
    const u = await prisma.user.findUnique({ where: { phone: '13800001234' }, select: { id: true } })
    if (!u) throw new Error('未 seed creator 13800001234')
    userId = u.id
    await prisma.notification.deleteMany({ where: { userId } })
  })
  afterEach(async () => {
    await prisma.notification.deleteMany({ where: { userId } })
  })

  it('tpl.review_done 渲染变量并创建 notification', async () => {
    const n = await notify(userId, 'tpl.review_done', { songTitle: '测试曲', score: 88, songId: 42 })
    expect(n).not.toBeNull()
    expect(n!.type).toBe('work')
    expect(n!.title).toContain('测试曲')
    expect(n!.content).toContain('88')
    expect(n!.linkUrl).toBe('/creator/songs?id=42')
  })

  it('targetType/targetId 参数落库', async () => {
    const n = await notify(userId, 'tpl.song_published', { songTitle: 'X', songId: 99 }, 'song', 99)
    expect(n!.targetType).toBe('song')
    expect(n!.targetId).toBe('99')
  })

  it('不存在的 template key 返回 null 而非抛错', async () => {
    const n = await notify(userId, 'tpl.not_exist' as never, {})
    expect(n).toBeNull()
  })

  it('tpl.isrc_bound 模板存在且正常渲染', async () => {
    const n = await notify(userId, 'tpl.isrc_bound', { songTitle: 'Y', isrc: 'CN-XXX-26-00001', songId: 7 })
    expect(n).not.toBeNull()
    expect(n!.title).toContain('Y')
    expect(n!.content).toContain('CN-XXX-26-00001')
  })
})
