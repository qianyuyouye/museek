/**
 * 一次性注入测试用创作者 / 评审账号（配合 _helpers.ts 中 loginCache 期望的手机号）
 * 用法：npx tsx prisma/seed-test-users.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('Abc12345', 10)

  const group = await prisma.group.upsert({
    where: { inviteCode: 'E2ETEST1' },
    update: { status: 'active' },
    create: { name: 'E2ETEST1 Group', inviteCode: 'E2ETEST1', status: 'active', createdBy: 1 },
  })
  console.log('group', group.id, group.inviteCode, group.status)

  const creator = await prisma.user.upsert({
    where: { phone: '13800001234' },
    update: { passwordHash, status: 'active', type: 'creator', name: '测试创作者' },
    create: { phone: '13800001234', name: '测试创作者', passwordHash, type: 'creator', realNameStatus: 'unverified' },
  })
  console.log('creator', creator.id, creator.phone, creator.status)

  try {
    await prisma.userGroup.create({ data: { userId: creator.id, groupId: group.id } })
    console.log('userGroup created')
  } catch (e: unknown) {
    const code = (e as { code?: string }).code ?? (e as Error).message
    console.log('userGroup skip:', code)
  }

  const reviewer = await prisma.user.upsert({
    where: { phone: '13500008888' },
    update: { passwordHash, status: 'active', type: 'reviewer' },
    create: { phone: '13500008888', name: '测试评审', passwordHash, type: 'reviewer' },
  })
  console.log('reviewer', reviewer.id, reviewer.phone, reviewer.status)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
