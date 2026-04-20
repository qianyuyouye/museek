/**
 * 身份证明文批量加密迁移脚本
 *
 * 背景：早期 seed / 手工 SQL INSERT 可能直接写入了明文身份证号，
 *      新 API 创建才走 encryptIdCard（AES-256-GCM）。
 * 本脚本扫描 users.id_card，识别"看起来是明文"的（长度 18 + 符合格式）
 * 并就地加密；已加密的（base64 更长）跳过。
 *
 * 用法：
 *   确保 .env 有 ENCRYPTION_KEY（64 位 hex）
 *   npx tsx scripts/migrate-id-card-encrypt.ts         # dry run
 *   npx tsx scripts/migrate-id-card-encrypt.ts --apply # 真正加密
 */

import { PrismaClient } from '@prisma/client'
import { encryptIdCard, assertEncryptionKey } from '../src/lib/encrypt'

const PLAIN_ID_CARD_RE = /^\d{17}[\dXx]$/

async function main() {
  const apply = process.argv.includes('--apply')
  assertEncryptionKey()

  const prisma = new PrismaClient()
  try {
    const users = await prisma.user.findMany({
      where: { idCard: { not: null } },
      select: { id: true, phone: true, realName: true, idCard: true },
    })

    let plainCount = 0
    let encryptedCount = 0
    let skippedCount = 0
    const toEncrypt: { id: number; cipher: string }[] = []

    for (const u of users) {
      const raw = u.idCard ?? ''
      if (PLAIN_ID_CARD_RE.test(raw)) {
        plainCount++
        toEncrypt.push({ id: u.id, cipher: encryptIdCard(raw) })
        console.log(`[plain] id=${u.id} phone=${u.phone} → 待加密`)
      } else if (raw.length > 40) {
        encryptedCount++
      } else {
        skippedCount++
        console.log(`[skip ] id=${u.id} phone=${u.phone} 非预期格式 len=${raw.length}`)
      }
    }

    console.log('---')
    console.log(`扫描 ${users.length} 条；明文 ${plainCount}、已加密 ${encryptedCount}、跳过 ${skippedCount}`)

    if (!apply) {
      console.log('\n🔍 这是 dry-run。加 --apply 参数执行实际加密。')
      return
    }

    if (toEncrypt.length === 0) {
      console.log('\n✅ 无需迁移。')
      return
    }

    console.log(`\n⚙️  开始加密 ${toEncrypt.length} 条...`)
    await prisma.$transaction(
      toEncrypt.map((r) =>
        prisma.user.update({
          where: { id: r.id },
          data: { idCard: r.cipher },
        }),
      ),
    )
    console.log('✅ 完成')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('❌ 失败：', e)
  process.exit(1)
})
