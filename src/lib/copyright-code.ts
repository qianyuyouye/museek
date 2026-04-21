import type { Prisma } from '@prisma/client'

/**
 * 在事务内生成年度递增版权码，形如 `AIMU-2026-000001`。
 *
 * 实现（单语句原子化，避免 InnoDB 间隙锁死锁）：
 *   1. `INSERT ... ON DUPLICATE KEY UPDATE counter = counter + 1` —— 首次写入 counter=1，
 *      之后原子自增；MySQL 对主键行加排它锁，并发事务在此串行化
 *   2. `SELECT counter FROM ... WHERE year = ?` 读回自增后的值
 *
 * 并发两条事务：第二条在 INSERT ... ON DUP 语句上阻塞到第一条 commit 后 +1，零竞态且无死锁。
 */
export async function nextCopyrightCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear()
  await tx.$executeRaw`INSERT INTO copyright_sequences (year, counter, updatedAt) VALUES (${year}, 1, NOW()) ON DUPLICATE KEY UPDATE counter = counter + 1, updatedAt = NOW()`
  const rows = await tx.$queryRaw<{ counter: number }[]>`SELECT counter FROM copyright_sequences WHERE year = ${year}`
  const next = rows[0].counter
  return `AIMU-${year}-${String(next).padStart(6, '0')}`
}
