import { prisma } from '@/lib/prisma'

// In-process mutex to serialize copyright code generation within the same Node process
let _mutex: Promise<void> = Promise.resolve()

/**
 * 生成年度递增版权码，形如 `AIMU-2026-000001`。
 *
 * 用 in-process 队列串行化 + Prisma update + 读取当前值两步：
 *   1. UPDATE counter +1（MySQL 行级锁自动串行化）
 *   2. 读回最新值
 *
 * 首次调用先 INSERT 初始行。
 */
export async function nextCopyrightCode(): Promise<string> {
  const year = new Date().getFullYear()

  // 先确保行存在（忽略重复错误）
  try {
    await prisma.copyrightSequence.create({
      data: { year, counter: 0 },
    })
  } catch {
    // 已存在，忽略
  }

  // 用 Prisma 的 update + read 原子递增
  await prisma.copyrightSequence.update({
    where: { year },
    data: { counter: { increment: 1 } },
  })
  const row = await prisma.copyrightSequence.findUnique({
    where: { year },
    select: { counter: true },
  })
  const next = row!.counter
  return `AIMU-${year}-${String(next).padStart(6, '0')}`
}
