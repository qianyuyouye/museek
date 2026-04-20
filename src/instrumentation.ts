export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // 环境变量已显式设置 → 直接用，不碰 DB（最安全：key 不落库）
  const existing = process.env.ENCRYPTION_KEY
  if (existing && /^[0-9a-fA-F]{64}$/.test(existing)) return

  // 否则兜底：从 DB 读取 / 生成并持久化到 system_settings，容器重启 key 不变
  try {
    const { prisma } = await import('./lib/prisma')
    const KEY_NAME = '_encryption_key_v1'

    const row = await prisma.systemSetting.findUnique({ where: { key: KEY_NAME } })
    let hex = (row?.value as { hex?: string } | null)?.hex
    if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
      const buf = new Uint8Array(32)
      globalThis.crypto.getRandomValues(buf)
      hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
      await prisma.systemSetting.upsert({
        where: { key: KEY_NAME },
        create: { key: KEY_NAME, value: { hex } },
        update: { value: { hex } },
      })
      console.warn('[instrumentation] 首次启动，自动生成 ENCRYPTION_KEY 并持久化到数据库（system_settings._encryption_key_v1）。生产强烈建议改用 .env ENCRYPTION_KEY 托管。')
    }
    process.env.ENCRYPTION_KEY = hex
  } catch (e) {
    console.warn('[instrumentation] 自动生成 ENCRYPTION_KEY 失败，身份证加密暂不可用：', e instanceof Error ? e.message : String(e))
  }
}
