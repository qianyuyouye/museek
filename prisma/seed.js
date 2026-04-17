const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

// PRD §6.2 三档分成规则（与 src/lib/commission.ts DEFAULT_REVENUE_RULES 保持一致）
const REVENUE_RULES = [
  {
    name: '高分激励',
    creatorRatio: 0.8,
    platformRatio: 0.2,
    conditionType: 'min_song_score',
    conditionValue: 90,
    priority: 1,
    enabled: true,
  },
  {
    name: '量产奖励',
    creatorRatio: 0.75,
    platformRatio: 0.25,
    conditionType: 'min_published_count',
    conditionValue: 10,
    priority: 2,
    enabled: true,
  },
  {
    name: '默认规则',
    creatorRatio: 0.7,
    platformRatio: 0.3,
    conditionType: 'default',
    conditionValue: null,
    priority: 99,
    enabled: true,
  },
]

async function main() {
  const passwordHash = await bcrypt.hash('Abc12345', 10)

  // 创建超级管理员角色
  const superRole = await prisma.adminRole.upsert({
    where: { id: 1 },
    update: {},
    create: { name: '超级管理员', description: '拥有所有权限', permissions: {}, isBuiltin: true },
  })

  // 创建默认管理员账号
  await prisma.adminUser.upsert({
    where: { account: 'admin' },
    update: {},
    create: { account: 'admin', name: '超级管理员', passwordHash, roleId: superRole.id, status: true },
  })

  // 初始化分成规则（仅在不存在时插入，避免覆盖管理员已编辑的配置）
  await prisma.systemSetting.upsert({
    where: { key: 'revenue_rules' },
    update: {},
    create: { key: 'revenue_rules', value: REVENUE_RULES },
  })

  console.log('✅ 初始化完成')
  console.log('  管理员: admin / Abc12345')
  console.log('  ⚠️ 请首次登录后立即修改密码')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
