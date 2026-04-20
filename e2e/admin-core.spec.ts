import { test, expect } from '@playwright/test'
import { apiLogin, SEED } from './_helpers'

/**
 * 管理端核心页面渲染 12 条
 * 覆盖：仪表盘/歌曲库/学员/角色/平台管理员/内容/发行/收益/日志 页面挂载
 */

test.beforeEach(async ({ page }) => {
  await apiLogin(page, 'admin', SEED.admin.account, SEED.admin.password)
})

test.describe('管理端页面挂载', () => {
  test('TC-UI-A-001 /admin/dashboard 渲染看板卡片', async ({ page }) => {
    await page.goto('/admin/dashboard')
    // 等主要统计词出现（"创作者"、"作品"、"发行" 等关键字至少命中一个）
    await expect(page.locator('body')).toContainText(/创作者|作品|发行|收益/)
  })

  test('TC-UI-A-002 /admin/songs 渲染作品列表筛选栏', async ({ page }) => {
    await page.goto('/admin/songs')
    await expect(page.locator('body')).toContainText(/歌曲|作品|状态|筛选/)
  })

  test('TC-UI-A-003 /admin/students 渲染学员表格', async ({ page }) => {
    await page.goto('/admin/students')
    await expect(page.locator('body')).toContainText(/学员|姓名|手机|实名/)
  })

  test('TC-UI-A-004 /admin/roles 渲染角色列表', async ({ page }) => {
    await page.goto('/admin/roles')
    await expect(page.locator('body')).toContainText(/角色|权限/)
  })

  test('TC-UI-A-005 /admin/admins 渲染平台管理员列表', async ({ page }) => {
    await page.goto('/admin/admins')
    await expect(page.locator('body')).toContainText(/管理员|账号/)
  })

  test('TC-UI-A-006 /admin/content 渲染内容管理', async ({ page }) => {
    await page.goto('/admin/content')
    await expect(page.locator('body')).toContainText(/内容|文章|视频|发布/)
  })

  test('TC-UI-A-007 /admin/distributions 渲染发行矩阵', async ({ page }) => {
    await page.goto('/admin/distributions')
    await expect(page.locator('body')).toContainText(/发行|平台|QQ音乐|网易|Spotify/)
  })

  test('TC-UI-A-008 /admin/publish-confirm 渲染发行确认列表', async ({ page }) => {
    await page.goto('/admin/publish-confirm')
    await expect(page.locator('body')).toContainText(/发行|确认|状态|提交/)
  })

  test('TC-UI-A-009 /admin/revenue 渲染收益', async ({ page }) => {
    await page.goto('/admin/revenue')
    await expect(page.locator('body')).toContainText(/收益|导入|结算/)
  })

  test('TC-UI-A-010 /admin/logs 渲染操作日志', async ({ page }) => {
    await page.goto('/admin/logs')
    await expect(page.locator('body')).toContainText(/日志|操作/)
  })

  test('TC-UI-A-011 /admin/settings 渲染系统设置', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.locator('body')).toContainText(/设置|规则|权重/)
  })

  test('TC-UI-A-012 /admin/groups 渲染用户组', async ({ page }) => {
    await page.goto('/admin/groups')
    await expect(page.locator('body')).toContainText(/用户组|班级|组名|邀请码|分组/)
  })
})
