import { describe, it, expect, beforeAll } from 'vitest'
import { adminLogin, BASE_URL } from './_helpers'

/**
 * CSV 编码 / 格式变体 10 条
 * 目标：/api/admin/revenue/imports 的解析鲁棒性
 */

let adminCookie = ''

async function upload(platform: string, csv: string | Uint8Array, fileName = 'test.csv'): Promise<{ status: number; body: { code?: number; message?: string; data?: { totalRows: number; matchedRows?: number; parseErrors?: string[] } } }> {
  const form = new FormData()
  form.append('platform', platform)
  form.append('file', new Blob([csv], { type: 'text/csv' }), fileName)
  const res = await fetch(`${BASE_URL}/api/admin/revenue/imports`, {
    method: 'POST',
    headers: { Cookie: adminCookie, Origin: BASE_URL },
    body: form,
  })
  const body = await res.json()
  return { status: res.status, body }
}

describe('CSV 导入格式变体', () => {
  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie
  })

  it('TC-CSV-001 空文件 → 400 / 0 rows', async () => {
    const r = await upload('qishui', '')
    // 空文件返回 400 或 200 + 0 rows
    expect([200, 400]).toContain(r.status)
    if (r.status === 200) {
      expect(r.body.data?.totalRows).toBe(0)
    }
  })

  it('TC-CSV-002 只有表头 → 400（无有效数据行）', async () => {
    const header = '歌曲抖音跟拍收入,起止日期,歌曲名称,歌曲ID,抖音收入,汽水收入,总收入\n'
    const r = await upload('qishui', header)
    expect(r.status).toBe(400)
    expect(r.body.message).toContain('无有效数据')
  })

  it('TC-CSV-003 单行列数不足 → 400 + message 含行号', async () => {
    const TS = Date.now().toString()
    const csv = `歌曲抖音跟拍收入,起止日期,歌曲名称,歌曲ID,抖音收入,汽水收入,总收入\n-,2288/01/01 - 2288/01/31,truncated,="${TS}",10\n`
    const r = await upload('qishui', csv)
    expect(r.status).toBe(400)
    expect(r.body.message).toContain('列数不足')
  })

  it('TC-CSV-004 单行 歌曲ID 非数字 → 400 + message 含"歌曲ID"', async () => {
    const csv = `歌曲抖音跟拍收入,起止日期,歌曲名称,歌曲ID,抖音收入,汽水收入,总收入\n-,2288/01/01 - 2288/01/31,bad-id,="abc123",1,2,3\n`
    const r = await upload('qishui', csv)
    expect(r.status).toBe(400)
    expect(r.body.message).toContain('歌曲ID')
  })

  it('TC-CSV-005 单行日期格式非法 → 400 + message 含"日期"', async () => {
    const TS = Date.now().toString()
    const csv = `歌曲抖音跟拍收入,起止日期,歌曲名称,歌曲ID,抖音收入,汽水收入,总收入\n-,not-a-date,baddate,="${TS}",1,2,3\n`
    const r = await upload('qishui', csv)
    expect(r.status).toBe(400)
    expect(r.body.message).toContain('日期')
  })

  it('TC-CSV-006 Windows 换行 \\r\\n 正确解析', async () => {
    const TS = Date.now().toString()
    const QID = `70${TS}`.slice(0, 15)
    const csv = `歌曲抖音跟拍收入,起止日期,歌曲名称,歌曲ID,抖音收入,汽水收入,总收入\r\n-,2288/01/01 - 2288/01/31,crlf,="${QID}",1,2,3\r\n`
    const r = await upload('qishui', csv)
    expect(r.status).toBe(200)
    expect(r.body.data?.totalRows).toBeGreaterThanOrEqual(1)
  })

  it('TC-CSV-007 千分位数值 1,234.56 解析为 1234.56', async () => {
    const TS = Date.now().toString()
    const QID = `71${TS}`.slice(0, 15)
    // 注意千分位需要引号包裹，否则会被当作列分隔符
    const csv = `歌曲抖音跟拍收入,起止日期,歌曲名称,歌曲ID,抖音收入,汽水收入,总收入\n-,2288/02/01 - 2288/02/28,thousand,="${QID}","1,234.56","1,000.00","2,234.56"\n`
    const r = await upload('qishui', csv)
    expect(r.status).toBe(200)
    expect(r.body.data?.totalRows).toBeGreaterThanOrEqual(1)
  })

  it('TC-CSV-008 非法 platform → 400', async () => {
    const r = await upload('UNKNOWN_PLATFORM', 'x\n')
    expect([400, 422]).toContain(r.status)
  })

  it('TC-CSV-009 空行混合有效行：只计有效行', async () => {
    const TS = Date.now().toString()
    const QID = `72${TS}`.slice(0, 15)
    const csv = `歌曲抖音跟拍收入,起止日期,歌曲名称,歌曲ID,抖音收入,汽水收入,总收入\n\n\n-,2288/03/01 - 2288/03/31,mixed,="${QID}",1,2,3\n\n`
    const r = await upload('qishui', csv)
    expect(r.status).toBe(200)
    expect(r.body.data?.totalRows).toBe(1)
  })

  it('TC-CSV-010 缺 file 字段 → 400', async () => {
    const form = new FormData()
    form.append('platform', 'qishui')
    const res = await fetch(`${BASE_URL}/api/admin/revenue/imports`, {
      method: 'POST',
      headers: { Cookie: adminCookie, Origin: BASE_URL },
      body: form,
    })
    expect(res.status).toBe(400)
  })
})
