/**
 * 一次性数据重置：清空除 "admin/超级管理员角色" 之外的所有数据
 * 用于 E2E 真实业务流程完整走查。
 * 用法：npx tsx prisma/reset-to-admin-only.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 清空业务数据（按外键顺序）...')

  // 叶子 → 根 的删除顺序（有关联的先删引用方）
  await prisma.$transaction([
    prisma.settlement.deleteMany(),
    prisma.revenueRow.deleteMany(),
    prisma.revenueImport.deleteMany(),
    prisma.songMapping.deleteMany(),

    prisma.review.deleteMany(),
    prisma.distribution.deleteMany(),
    prisma.learningRecord.deleteMany(),
    prisma.assignmentSubmission.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.formFieldConfig.deleteMany(),

    prisma.platformSong.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.loginLog.deleteMany(),
    prisma.operationLog.deleteMany(),
    prisma.smsCode.deleteMany(),

    prisma.userGroup.deleteMany(),
    prisma.group.deleteMany(),

    prisma.user.deleteMany(),
    prisma.cmsContent.deleteMany(),
    prisma.systemSetting.deleteMany(),
  ])

  // 只保留 account='admin' 的管理员
  const deletedAdmins = await prisma.adminUser.deleteMany({
    where: { account: { not: 'admin' } },
  })
  console.log(`  已删除非 admin 管理员 ${deletedAdmins.count} 个`)

  // 只保留内置超级管理员角色
  const deletedRoles = await prisma.adminRole.deleteMany({
    where: { isBuiltin: false },
  })
  console.log(`  已删除非内置角色 ${deletedRoles.count} 个`)

  // 汇总剩余数据量
  const [admins, roles, users, groups, songs, imports] = await Promise.all([
    prisma.adminUser.count(),
    prisma.adminRole.count(),
    prisma.user.count(),
    prisma.group.count(),
    prisma.platformSong.count(),
    prisma.revenueImport.count(),
  ])
  console.log('📊 剩余：')
  console.log(`  AdminUser: ${admins} (应为 1)`)
  console.log(`  AdminRole: ${roles} (应为 1)`)
  console.log(`  User: ${users} / Group: ${groups} / PlatformSong: ${songs} / RevenueImport: ${imports}`)
}

main()
  .catch((e) => {
    console.error('❌', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
