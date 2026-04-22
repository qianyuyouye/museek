import { test, expect } from '@playwright/test'
import { apiLogin, SEED, BASE_URL } from './_helpers'
import path from 'path'
import fs from 'fs'
import os from 'os'

test.beforeEach(async ({ page }) => {
  await apiLogin(page, 'admin', SEED.admin.account, SEED.admin.password)
})

/** Write a small PNG file to disk for upload test */
function writeTempPng(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'museek-upload-'))
  const p = path.join(dir, name)
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  )
  fs.writeFileSync(p, png)
  return p
}

test.describe('管理端文件上传', () => {
  test('TC-UI-UPLOAD-001 上传 token API - 通过页面请求（带 Referer）', async ({ page }) => {
    // Navigate to admin content page first (sets cookies + referrer context)
    await page.goto('/admin/content')
    await page.waitForTimeout(1000)

    // Use page.evaluate to make the request from the page context (browser will send Referer)
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/upload/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: 'test.png', fileSize: 1024, type: 'image' }),
        credentials: 'include',
      })
      const json = await res.json()
      return { status: res.status, json }
    })

    expect(result.status).toBe(200)
    expect(result.json.code).toBe(200)
    expect(result.json.data).toHaveProperty('uploadUrl')
    expect(result.json.data).toHaveProperty('key')
  })

  test('TC-UI-UPLOAD-002 完整上传流程 - token + PUT', async ({ page }) => {
    await page.goto('/admin/content')
    await page.waitForTimeout(1000)

    // Get upload token from page context
    const tokenResult = await page.evaluate(async () => {
      const res = await fetch('/api/upload/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: 'test-cover.png', fileSize: 100, type: 'image' }),
        credentials: 'include',
      })
      const json = await res.json()
      return json
    })

    expect(tokenResult.code).toBe(200)
    const { uploadUrl, key } = tokenResult.data

    // Now PUT the file from page context
    const pngData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const binaryStr = atob(pngData)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: 'image/png' })

    const putResult = await page.evaluate(async ({ url, blobData }: { url: string; blobData: string }) => {
      // Reconstruct blob from base64 in browser
      const binaryStr2 = atob(blobData)
      const bytes2 = new Uint8Array(binaryStr2.length)
      for (let i = 0; i < binaryStr2.length; i++) {
        bytes2[i] = binaryStr2.charCodeAt(i)
      }
      const blob2 = new Blob([bytes2], { type: 'image/png' })

      const res = await fetch(url, {
        method: 'PUT',
        body: blob2,
      })
      return { status: res.status, ok: res.ok }
    }, { url: uploadUrl, blobData: pngData })

    expect(putResult.ok).toBe(true)
  })

  test('TC-UI-UPLOAD-003 内容页 UI 上传封面图片', async ({ page }) => {
    await page.goto('/admin/content')
    await page.waitForTimeout(1000)

    // Click "新建内容"
    await page.getByText('新建内容').first().click()
    await page.waitForTimeout(800)

    // Write test PNG
    const pngFile = writeTempPng('test-cover.png')

    // Upload via file input
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles(pngFile)
    await page.waitForTimeout(3000)

    // Check no error toast
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).not.toContain('上传出错')
    expect(bodyText).not.toContain('获取上传凭证失败')
    expect(bodyText).not.toContain('文件上传失败')

    // Should see the file key (uploads/image/...)
    expect(bodyText).toMatch(/uploads\/|test-cover|\.png/)

    fs.rmSync(path.dirname(pngFile), { recursive: true, force: true })
  })

  test('TC-UI-UPLOAD-004 上传 token 接口 - 非法 type 被拒绝', async ({ page }) => {
    await page.goto('/admin/content')
    await page.waitForTimeout(500)

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/upload/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: 'test.exe', fileSize: 1024, type: 'executable' }),
        credentials: 'include',
      })
      return res.json()
    })

    expect(result.code).not.toBe(200)
  })

  test('TC-UI-UPLOAD-005 上传 token 接口 - 超大文件被拒绝', async ({ page }) => {
    await page.goto('/admin/content')
    await page.waitForTimeout(500)

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/upload/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: 'huge.wav', fileSize: 100 * 1024 * 1024, type: 'audio' }),
        credentials: 'include',
      })
      return res.json()
    })

    expect(result.code).not.toBe(200)
  })
})
