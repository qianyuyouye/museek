import { test, expect } from '@playwright/test'
import { apiLogin, SEED } from './_helpers'

/**
 * 路由守卫 8 条
 * 未登录访问保护路由应 307 重定向到对应登录页
 * 错端 cookie 访问其他端应被拦截
 */

test.describe('未登录访问保护路由', () => {
  test('TC-UI-G-001 /admin/dashboard → 重定向到 /admin/login', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForURL('**/admin/login', { timeout: 5000 })
    expect(page.url()).toContain('/admin/login')
  })

  test('TC-UI-G-002 /admin/songs → 重定向到 /admin/login', async ({ page }) => {
    await page.goto('/admin/songs')
    await page.waitForURL('**/admin/login', { timeout: 5000 })
  })

  test('TC-UI-G-003 /creator/home → 重定向到 /creator/login', async ({ page }) => {
    await page.goto('/creator/home')
    await page.waitForURL('**/creator/login', { timeout: 5000 })
  })

  test('TC-UI-G-004 /review/workbench → 重定向到 /review/login', async ({ page }) => {
    await page.goto('/review/workbench')
    await page.waitForURL('**/review/login', { timeout: 5000 })
  })
})

test.describe('跨端 cookie 拦截', () => {
  test('TC-UI-G-010 creator cookie 访问 /admin/dashboard → 跳 /admin/login', async ({ page }) => {
    await apiLogin(page, 'creator', SEED.creator.account, SEED.creator.password)
    await page.goto('/admin/dashboard')
    await page.waitForURL('**/admin/login', { timeout: 5000 })
  })

  test('TC-UI-G-011 admin cookie 访问 /creator/home → 跳 /creator/login', async ({ page }) => {
    await apiLogin(page, 'admin', SEED.admin.account, SEED.admin.password)
    await page.goto('/creator/home')
    await page.waitForURL('**/creator/login', { timeout: 5000 })
  })

  test('TC-UI-G-012 admin cookie 访问 /review/queue → 跳 /review/login', async ({ page }) => {
    await apiLogin(page, 'admin', SEED.admin.account, SEED.admin.password)
    await page.goto('/review/queue')
    await page.waitForURL('**/review/login', { timeout: 5000 })
  })
})

test.describe('登录后再访问 login 页', () => {
  test('TC-UI-G-020 已登录 admin 访问 /admin/login 仍可停留（无自动跳转）', async ({ page }) => {
    await apiLogin(page, 'admin', SEED.admin.account, SEED.admin.password)
    await page.goto('/admin/login')
    // login 页在白名单，不做反向重定向
    await page.waitForTimeout(500)
    expect(page.url()).toContain('/admin/login')
  })
})
