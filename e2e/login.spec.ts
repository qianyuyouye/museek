import { test, expect } from '@playwright/test'
import { SEED } from './_helpers'

/**
 * 登录 UI 流程 12 条
 * 覆盖：3 端登录表单渲染 + 错误提示 + 成功跳转 + 密码显示切换
 */

test.describe('管理端登录 /admin/login', () => {
  test('TC-UI-L-001 页面渲染登录标题 + 2 个输入框', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page.getByText('管理员登录')).toBeVisible()
    await expect(page.getByPlaceholder('管理员账号 / 邮箱')).toBeVisible()
    await expect(page.getByPlaceholder('密码')).toBeVisible()
  })

  test('TC-UI-L-002 错误密码 → 显示红色错误提示', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByPlaceholder('管理员账号 / 邮箱').fill('admin')
    await page.getByPlaceholder('密码').fill('wrongpassword')
    await page.getByRole('button', { name: '登录' }).click()
    // 等待错误提示出现（API 401/429/423 都展示 message）
    await expect(page.locator('p').filter({ hasText: /密码|错误|锁定|限流|次/ }).first()).toBeVisible({ timeout: 5000 })
  })

  test('TC-UI-L-003 正确登录 → 跳转 /admin/dashboard', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByPlaceholder('管理员账号 / 邮箱').fill(SEED.admin.account)
    await page.getByPlaceholder('密码').fill(SEED.admin.password)
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 })
    expect(page.url()).toContain('/admin/dashboard')
  })

  test('TC-UI-L-004 密码显示切换按钮', async ({ page }) => {
    await page.goto('/admin/login')
    const pw = page.getByPlaceholder('密码')
    await pw.fill('test123')
    await expect(pw).toHaveAttribute('type', 'password')
    // 点击眼睛图标 — 位于密码输入旁的 button
    await page.locator('button', { hasText: '👁' }).click()
    await expect(pw).toHaveAttribute('type', 'text')
  })
})

test.describe('创作者登录 /creator/login', () => {
  test('TC-UI-L-010 页面渲染 Tab 登录/注册', async ({ page }) => {
    await page.goto('/creator/login')
    // tab 按钮出现 2 次（登录 tab + submit btn），注册 1 次（只 tab，默认 mode=login）
    await expect(page.getByRole('button', { name: '登录', exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '注册', exact: true })).toBeVisible()
  })

  test('TC-UI-L-011 成功登录跳转 /creator/home', async ({ page }) => {
    await page.goto('/creator/login')
    await page.getByPlaceholder('手机号 / 邮箱').fill(SEED.creator.account)
    await page.getByPlaceholder('密码').fill(SEED.creator.password)
    // submit button 是最后一个"登录"
    await page.getByRole('button', { name: '登录', exact: true }).last().click()
    await page.waitForURL('**/creator/home', { timeout: 10000 })
  })

  test('TC-UI-L-012 切到注册 tab 显示邀请码 + 验证码字段', async ({ page }) => {
    await page.goto('/creator/login')
    await page.getByRole('button', { name: '注册', exact: true }).click()
    await expect(page.getByPlaceholder('邀请码（由管理员或班级链接获取）')).toBeVisible()
    await expect(page.getByPlaceholder('短信验证码')).toBeVisible()
    await expect(page.getByText('《平台用户服务协议》')).toBeVisible()
  })

  test('TC-UI-L-013 注册不勾选协议 → 错误提示', async ({ page }) => {
    await page.goto('/creator/login')
    await page.getByRole('button', { name: '注册', exact: true }).click()
    await page.getByPlaceholder('手机号').fill('13900009999')
    await page.getByPlaceholder('密码').fill('Abc12345')
    await page.getByPlaceholder('短信验证码').fill('123456')
    // submit 注册按钮：tab + submit 两个"注册"按钮，最后一个是 submit
    await page.getByRole('button', { name: '注册', exact: true }).last().click()
    await expect(page.locator('p').filter({ hasText: /协议|隐私/ })).toBeVisible({ timeout: 5000 })
  })
})

test.describe('评审端登录 /review/login', () => {
  test('TC-UI-L-020 页面渲染评审账号登录', async ({ page }) => {
    await page.goto('/review/login')
    await expect(page.getByText('评审账号登录')).toBeVisible()
    await expect(page.getByPlaceholder('手机号 / 邮箱')).toBeVisible()
  })

  test('TC-UI-L-021 成功登录跳转 /review/workbench', async ({ page }) => {
    await page.goto('/review/login')
    await page.getByPlaceholder('手机号 / 邮箱').fill(SEED.reviewer.account)
    await page.getByPlaceholder('密码').fill(SEED.reviewer.password)
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL('**/review/workbench', { timeout: 10000 })
  })
})

test.describe('登录锁定', () => {
  test('TC-UI-L-030 连续错误 ≥3 次显示锁定警告', async ({ page }) => {
    await page.goto('/admin/login')
    for (let i = 0; i < 4; i++) {
      await page.getByPlaceholder('管理员账号 / 邮箱').fill('admin')
      await page.getByPlaceholder('密码').fill(`wrong-${i}`)
      await page.getByRole('button', { name: '登录' }).click()
      await page.waitForTimeout(400)
    }
    await expect(page.getByText(/已连续错误|账号已锁定/)).toBeVisible({ timeout: 5000 })
  })
})
