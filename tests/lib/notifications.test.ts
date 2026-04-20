import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { renderTemplate, getTemplate } from '@/lib/notifications'
import { setSetting, SETTING_KEYS } from '@/lib/system-settings'

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
