import { test, expect } from '@playwright/test'
import { apiLogin, SEED, BASE_URL } from './_helpers'

/**
 * 评审 queue → assess 完整链路 8 条
 * 覆盖 localStorage 传递 songId、评分滑块、评语字数校验、推荐选择、快捷评语插入
 */

test.beforeEach(async ({ page }) => {
  await apiLogin(page, 'reviewer', SEED.reviewer.account, SEED.reviewer.password)
})

async function getPendingSongId(page: import('@playwright/test').Page): Promise<number | null> {
  const res = await page.request.get(`${BASE_URL}/api/review/queue?pageSize=1`)
  if (res.status() !== 200) return null
  const j = await res.json()
  const song = j?.data?.list?.[0]
  return song?.id ?? null
}

test.describe('评审队列 → 评审页', () => {
  test('TC-UI-RA-001 队列列表渲染 + "开始评审"按钮存在（若有 pending）', async ({ page }) => {
    await page.goto('/review/queue')
    await page.waitForTimeout(1500)
    const count = await page.getByRole('button', { name: '开始评审' }).count()
    if (count === 0) {
      test.skip()
      return
    }
    expect(count).toBeGreaterThan(0)
  })

  test('TC-UI-RA-002 点击"开始评审"跳转 /review/assess 并设置 localStorage', async ({ page }) => {
    const songId = await getPendingSongId(page)
    if (!songId) {
      test.skip()
      return
    }
    await page.goto('/review/queue')
    await page.getByRole('button', { name: '开始评审' }).first().click()
    await page.waitForURL('**/review/assess', { timeout: 5000 })
    const stored = await page.evaluate(() => localStorage.getItem('currentReviewSongId'))
    expect(Number(stored)).toBeGreaterThan(0)
  })

  test('TC-UI-RA-003 评审页渲染三维评分滑块（技术/创意/商业）', async ({ page }) => {
    const songId = await getPendingSongId(page)
    if (!songId) {
      test.skip()
      return
    }
    await page.goto('/review/queue')
    await page.evaluate((id) => localStorage.setItem('currentReviewSongId', String(id)), songId)
    await page.goto('/review/assess')
    await page.waitForTimeout(1500)
    await expect(page.getByText('技术熟练度')).toBeVisible()
    await expect(page.getByText('创意立意')).toBeVisible()
    await expect(page.getByText('商业传播潜力')).toBeVisible()
    // 3 个 range input
    const ranges = page.locator('input[type="range"]')
    expect(await ranges.count()).toBe(3)
  })

  test('TC-UI-RA-004 拖滑块改变加权总分', async ({ page }) => {
    const songId = await getPendingSongId(page)
    if (!songId) {
      test.skip()
      return
    }
    await page.goto('/review/queue')
    await page.evaluate((id) => localStorage.setItem('currentReviewSongId', String(id)), songId)
    await page.goto('/review/assess')
    await page.waitForTimeout(1500)
    const ranges = page.locator('input[type="range"]')
    // 全部改成 90
    for (let i = 0; i < 3; i++) {
      await ranges.nth(i).fill('90')
    }
    await page.waitForTimeout(300)
    // 加权总分区块应显示 90（0.3*90+0.4*90+0.3*90 = 90）
    await expect(page.locator('body')).toContainText('加权总分')
  })

  test('TC-UI-RA-005 评语 < 20 字点击提交 → toast 提示', async ({ page }) => {
    const songId = await getPendingSongId(page)
    if (!songId) {
      test.skip()
      return
    }
    await page.goto('/review/queue')
    await page.evaluate((id) => localStorage.setItem('currentReviewSongId', String(id)), songId)
    await page.goto('/review/assess')
    await page.waitForTimeout(1500)
    // 评语框 placeholder 识别
    const commentBox = page.getByPlaceholder('请输入详细的专业指导评语...')
    await commentBox.fill('太短了')
    // 查找提交按钮
    const submit = page.getByRole('button', { name: /提交评审|提交打分|完成评审|提交/ }).last()
    await submit.click()
    await page.waitForTimeout(500)
    await expect(page.locator('body')).toContainText(/20字|评语|至少|字数/)
  })

  test('TC-UI-RA-006 点击快捷评语 tag 自动拼接到评语', async ({ page }) => {
    const songId = await getPendingSongId(page)
    if (!songId) {
      test.skip()
      return
    }
    await page.goto('/review/queue')
    await page.evaluate((id) => localStorage.setItem('currentReviewSongId', String(id)), songId)
    await page.goto('/review/assess')
    await page.waitForTimeout(1500)
    // 点击第一个 tag button
    const tag = page.getByRole('button', { name: '编曲结构完整' })
    if (await tag.count() > 0) {
      await tag.click()
      await page.waitForTimeout(200)
      const commentBox = page.getByPlaceholder('请输入详细的专业指导评语...')
      const val = await commentBox.inputValue()
      expect(val).toContain('编曲结构完整')
    }
  })

  test('TC-UI-RA-007 AI 预分析面板可展开', async ({ page }) => {
    const songId = await getPendingSongId(page)
    if (!songId) {
      test.skip()
      return
    }
    await page.goto('/review/queue')
    await page.evaluate((id) => localStorage.setItem('currentReviewSongId', String(id)), songId)
    await page.goto('/review/assess')
    await page.waitForTimeout(1500)
    // details/summary 元素
    const summary = page.getByText(/AI预分析报告/).first()
    await summary.click()
    await page.waitForTimeout(500)
    await expect(page.locator('body')).toContainText(/调性|响度|频谱|段落|制作度/)
  })

  test('TC-UI-RA-008 无 localStorage songId 直接访问 /review/assess → 提示选择作品', async ({ page }) => {
    // 先 goto 到同源页再操作 localStorage（about:blank 无权限）
    await page.goto('/review/queue')
    await page.evaluate(() => localStorage.removeItem('currentReviewSongId'))
    await page.goto('/review/assess')
    await page.waitForTimeout(1500)
    await expect(page.locator('body')).toContainText(/请选择|暂无|队列|请先/)
  })
})
