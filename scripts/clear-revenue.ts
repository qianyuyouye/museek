/**
 * P1-4 配套：清空 revenue 三表，用于 period 从 "YYYY-MM" 升级到 "YYYY/MM/DD - YYYY/MM/DD" 原始字符串后的数据重置。
 *
 * 使用：部署代码更新前执行一次，清空后重新导入 CSV。
 *   npx tsx scripts/clear-revenue.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [s, rr, ri] = await prisma.$transaction([
    prisma.settlement.deleteMany(),
    prisma.revenueRow.deleteMany(),
    prisma.revenueImport.deleteMany(),
  ])
  console.log(`cleared: settlements=${s.count}, revenueRows=${rr.count}, revenueImports=${ri.count}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
