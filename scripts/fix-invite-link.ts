/**
 * 修复历史 invite_link 数据
 *
 * 之前代码将 invite_link 硬编码为 https://aimusic.com/join/{code}。
 * 修复后 invite_link 从 system_settings.invite_link_domain 或
 * NEXT_PUBLIC_SITE_URL 环境变量动态生成。
 *
 * 此脚本将已有记录的 invite_link 统一更新为当前配置的域名。
 *
 * 用法：npx tsx scripts/fix-invite-link.ts
 *      （会打印将要更新的行数，确认后执行；传 --force 直接执行）
 */

import { prisma } from '../src/lib/prisma'
import { getSetting, SETTING_KEYS } from '../src/lib/system-settings'

async function main() {
  const force = process.argv.includes('--force')

  // 确定目标域名（与 buildInviteLink 逻辑一致）
  const domain = await getSetting<string>(SETTING_KEYS.INVITE_LINK_DOMAIN, '')
  const baseUrl = domain || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  console.log(`目标域名: ${baseUrl}`)
  console.log(`新链接格式: ${baseUrl}/join/{inviteCode}`)

  // 统计需要更新的记录：旧域名 aimusic.com 或 inviteLink 为空的记录
  const oldGroups = await prisma.group.findMany({
    where: {
      OR: [
        { inviteLink: { contains: 'aimusic.com' } },
        { inviteLink: null },
      ],
    },
    select: { id: true, name: true, inviteCode: true, inviteLink: true },
  })

  if (oldGroups.length === 0) {
    console.log('没有需要更新的 invite_link 数据。')
    return
  }

  console.log(`\n发现 ${oldGroups.length} 条需要更新的记录：`)
  oldGroups.forEach((g) => {
    console.log(`  [${g.id}] ${g.name}  inviteCode=${g.inviteCode}`)
    console.log(`    旧: ${g.inviteLink}`)
    console.log(`    新: ${baseUrl}/join/${g.inviteCode}`)
  })

  if (!force) {
    console.log(`\n如需执行，请添加 --force 参数：npx tsx scripts/fix-invite-link.ts --force`)
    return
  }

  // 批量更新
  let updated = 0
  for (const g of oldGroups) {
    await prisma.group.update({
      where: { id: g.id },
      data: { inviteLink: `${baseUrl}/join/${g.inviteCode}` },
    })
    updated++
  }

  console.log(`\n已更新 ${updated} 条记录的 invite_link。`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
