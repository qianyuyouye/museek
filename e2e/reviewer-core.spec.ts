import { test, expect } from '@playwright/test'
import { apiLogin, SEED } from './_helpers'

/**
 * 评审端核心页面挂载 5 条
 */

test.beforeEach(async ({ page }) => {
  await apiLogin(page, 'reviewer', SEED.reviewer.account, SEED.reviewer.password)
})

test.describe('评审端页面挂载', () => {
  test('TC-UI-R-001 /review/workbench', async ({ page }) => {
    await page.goto('/review/workbench')
    await expect(page.locator('body')).toContainText(/工作台|评审|待评|统计|绩效/)
  })

  test('TC-UI-R-002 /review/queue 队列', async ({ page }) => {
    await page.goto('/review/queue')
    await expect(page.locator('body')).toContainText(/队列|待评|作品|状态/)
  })

  test('TC-UI-R-003 /review/assess 评审页（可能需要 ?songId）', async ({ page }) => {
    await page.goto('/review/assess')
    // 无 songId 时可能展示提示/空态
    await expect(page.locator('body')).toContainText(/评审|选择|暂无|请|作品/)
  })

  test('TC-UI-R-004 /review/stats', async ({ page }) => {
    await page.goto('/review/stats')
    await expect(page.locator('body')).toContainText(/统计|评审|分数|推荐率|绩效/)
  })

  test('TC-UI-R-005 /review/profile', async ({ page }) => {
    await page.goto('/review/profile')
    await expect(page.locator('body')).toContainText(/个人|资料|姓名|手机/)
  })
})
