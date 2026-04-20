import { test, expect } from '@playwright/test'
import { apiLogin, SEED } from './_helpers'

/**
 * 创作者端核心页面挂载 10 条
 */

test.beforeEach(async ({ page }) => {
  await apiLogin(page, 'creator', SEED.creator.account, SEED.creator.password)
})

test.describe('创作者端页面挂载', () => {
  test('TC-UI-C-001 /creator/home', async ({ page }) => {
    await page.goto('/creator/home')
    await expect(page.locator('body')).toContainText(/创作|作品|上传|收益|学习|欢迎/)
  })

  test('TC-UI-C-002 /creator/upload', async ({ page }) => {
    await page.goto('/creator/upload')
    await expect(page.locator('body')).toContainText(/上传|标题|AI|曲风|提交/)
  })

  test('TC-UI-C-003 /creator/songs', async ({ page }) => {
    await page.goto('/creator/songs')
    await expect(page.locator('body')).toContainText(/作品|状态|审核|评审/)
  })

  test('TC-UI-C-004 /creator/assignments', async ({ page }) => {
    await page.goto('/creator/assignments')
    await expect(page.locator('body')).toContainText(/作业|提交|截止|班级/)
  })

  test('TC-UI-C-005 /creator/courses', async ({ page }) => {
    await page.goto('/creator/courses')
    await expect(page.locator('body')).toContainText(/课程|学习|视频|文章/)
  })

  test('TC-UI-C-006 /creator/learning', async ({ page }) => {
    await page.goto('/creator/learning')
    await expect(page.locator('body')).toContainText(/学习|进度|时长|徽章|成就/)
  })

  test('TC-UI-C-007 /creator/community', async ({ page }) => {
    await page.goto('/creator/community')
    await expect(page.locator('body')).toContainText(/社区|广场|作品|点赞|发布/)
  })

  test('TC-UI-C-008 /creator/revenue', async ({ page }) => {
    await page.goto('/creator/revenue')
    await expect(page.locator('body')).toContainText(/收益|结算|金额|状态/)
  })

  test('TC-UI-C-009 /creator/notifications', async ({ page }) => {
    await page.goto('/creator/notifications')
    await expect(page.locator('body')).toContainText(/消息|通知|未读|全部/)
  })

  test('TC-UI-C-010 /creator/profile', async ({ page }) => {
    await page.goto('/creator/profile')
    await expect(page.locator('body')).toContainText(/个人|资料|实名|密码|手机/)
  })
})
