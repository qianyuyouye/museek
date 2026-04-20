import type { Page } from '@playwright/test'

export const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/**
 * 通过 UI 登录（填表单点击按钮）。登录后等待目标页路由。
 * portal:
 *   admin    → /admin/dashboard
 *   creator  → /creator/home
 *   reviewer → /review/workbench
 */
export async function uiLogin(
  page: Page,
  portal: 'admin' | 'creator' | 'reviewer',
  account: string,
  password: string,
) {
  const loginPathMap = { admin: '/admin/login', creator: '/creator/login', reviewer: '/review/login' }
  const successPathMap = {
    admin: '/admin/dashboard',
    creator: '/creator/home',
    reviewer: '/review/workbench',
  }
  await page.goto(loginPathMap[portal])
  // 第一个 input 是 account，第二个 input 是 password
  const inputs = page.locator('input').filter({ hasNot: page.locator('[type="checkbox"]') })
  await inputs.nth(0).fill(account)
  await inputs.nth(1).fill(password)
  await page.getByRole('button', { name: '登录' }).click()
  await page.waitForURL(`**${successPathMap[portal]}`, { timeout: 10000 })
}

/** 通过 API 登录直接设置 cookie（快），比 UI 登录快 3-5 倍 */
export async function apiLogin(
  page: Page,
  portal: 'admin' | 'creator' | 'reviewer',
  account: string,
  password: string,
) {
  const res = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { account, password, portal },
    headers: { 'Content-Type': 'application/json' },
  })
  if (res.status() !== 200) {
    throw new Error(`apiLogin ${portal} failed: ${res.status()} ${await res.text()}`)
  }
}

export const SEED = {
  admin: { account: 'admin', password: 'Abc12345' },
  creator: { account: '13800001234', password: 'Abc12345' },
  reviewer: { account: '13500008888', password: 'Abc12345' },
}
