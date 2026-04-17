const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

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

  console.log('✅ 初始化完成')
  console.log('  管理员: admin / Abc12345')
  console.log('  ⚠️ 请首次登录后立即修改密码')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
