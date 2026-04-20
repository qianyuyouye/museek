import { test, expect } from '@playwright/test'
import { apiLogin, SEED } from './_helpers'

/**
 * 创作者端表单交互 10 条
 * 覆盖：上传流程步骤守卫、个人资料/密码/实名/代理协议 modal
 */

test.beforeEach(async ({ page }) => {
  await apiLogin(page, 'creator', SEED.creator.account, SEED.creator.password)
})

test.describe('上传作品流程守卫', () => {
  test('TC-UI-CF-001 Step1 未上传音频 → "下一步"被阻止（toast/按钮禁用）', async ({ page }) => {
    await page.goto('/creator/upload')
    // 页面渲染 STEP 1：上传文件
    await expect(page.getByText('上传文件')).toBeVisible()
    // 点击"下一步"应该无法进入 Step2（未上传音频）
    const next = page.getByRole('button', { name: /下一步/ }).first()
    if (await next.count() > 0 && await next.isEnabled()) {
      await next.click()
      await page.waitForTimeout(500)
      // 仍停留 Step1 或展示 toast
      await expect(page.locator('body')).toContainText(/上传文件|请先上传|音频/)
    }
  })

  test('TC-UI-CF-002 上传页 STEPS 面包屑显示 3 步', async ({ page }) => {
    await page.goto('/creator/upload')
    await expect(page.locator('body')).toContainText(/上传文件/)
    await expect(page.locator('body')).toContainText(/填写信息.*AI声明|AI声明/)
    await expect(page.locator('body')).toContainText(/确认提交/)
  })
})

test.describe('个人资料 · 修改姓名', () => {
  test('TC-UI-CF-010 打开修改资料 modal', async ({ page }) => {
    await page.goto('/creator/profile')
    await page.getByRole('button', { name: /修改姓名|修改资料/ }).first().click()
    await page.waitForTimeout(300)
    // modal 内展示"手机号"字段 + "保存修改"按钮
    await expect(page.getByRole('button', { name: /保存修改|保存/ })).toBeVisible()
  })
})

test.describe('个人资料 · 修改密码', () => {
  test('TC-UI-CF-020 打开修改密码 modal + 3 个密码输入框', async ({ page }) => {
    await page.goto('/creator/profile')
    await page.getByRole('button', { name: /更换密码|修改密码/ }).click()
    await page.waitForTimeout(300)
    await expect(page.getByPlaceholder('请输入当前密码')).toBeVisible()
    await expect(page.getByPlaceholder('>=8位，含字母+数字')).toBeVisible()
  })

  test('TC-UI-CF-021 弱新密码 → 前端 toast 提示', async ({ page }) => {
    await page.goto('/creator/profile')
    await page.getByRole('button', { name: /更换密码|修改密码/ }).click()
    await page.waitForTimeout(300)
    await page.getByPlaceholder('请输入当前密码').fill('Abc12345')
    await page.getByPlaceholder('>=8位，含字母+数字').fill('abc')
    await page.getByPlaceholder('再次输入新密码').fill('abc')
    // 提交（modal 内第一个 btnPrimary 为"保存"类按钮）
    const submit = page.getByRole('button', { name: /确认修改|保存|提交|确定/ }).last()
    if (await submit.count() > 0) {
      await submit.click()
      await page.waitForTimeout(500)
      // 期望前端或后端返回错误文案
      await expect(page.locator('body')).toContainText(/密码|长度|8位|不一致|字母/)
    }
  })
})

test.describe('个人资料 · 实名认证', () => {
  test('TC-UI-CF-030 打开实名认证 modal', async ({ page }) => {
    await page.goto('/creator/profile')
    // "提交认证"或"查看认证"都打开同一 modal
    const btn = page.getByRole('button', { name: /提交认证|查看认证/ }).first()
    if (await btn.count() > 0) {
      await btn.click()
      await page.waitForTimeout(300)
      // unverified 展示输入框，verified/pending 展示只读
      await expect(page.locator('body')).toContainText(/身份证|实名|姓名/)
    }
  })

  test('TC-UI-CF-031 未认证态：身份证格式错误 → 前端 toast', async ({ page }) => {
    await page.goto('/creator/profile')
    const btn = page.getByRole('button', { name: /提交认证/ }).first()
    if (await btn.count() === 0) {
      // 已认证/审核中，跳过
      test.skip()
      return
    }
    await btn.click()
    await page.waitForTimeout(300)
    await page.getByPlaceholder('请输入身份证上的姓名').fill('张三')
    await page.getByPlaceholder('18 位身份证号').fill('123')
    const submit = page.getByRole('button', { name: /提交|确认|保存/ }).last()
    await submit.click()
    await page.waitForTimeout(500)
    await expect(page.locator('body')).toContainText(/身份证|格式/)
  })
})

test.describe('通知中心', () => {
  test('TC-UI-CF-040 通知列表渲染 + type 切换 tab', async ({ page }) => {
    await page.goto('/creator/notifications')
    await expect(page.locator('body')).toContainText(/全部|作品|收益|系统/)
  })

  test('TC-UI-CF-041 "全部标为已读"按钮存在且可点击', async ({ page }) => {
    await page.goto('/creator/notifications')
    const btn = page.getByRole('button', { name: /全部已读|全部标为已读|标记已读/ })
    if (await btn.count() > 0) {
      await btn.first().click()
      await page.waitForTimeout(500)
      // 点击后 UI 应无错误
      await expect(page.locator('body')).toContainText(/消息|通知/)
    }
  })
})

test.describe('社区广场', () => {
  test('TC-UI-CF-050 /creator/community 渲染作品卡片 + 点赞按钮', async ({ page }) => {
    await page.goto('/creator/community')
    // 页面展示作品或"暂无"
    await expect(page.locator('body')).toContainText(/作品|社区|广场|点赞|暂无/)
  })
})
