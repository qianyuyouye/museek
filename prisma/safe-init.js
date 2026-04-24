const { execSync } = require('child_process')
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  let count = 0
  try {
    count = await prisma.user.count()
    console.log('⚠️  Database already has', count, 'users, skipping init.')
    return
  } catch (e) {
    // Tables don't exist yet
    console.log('Database empty (or tables missing), running init...')
  } finally {
    await prisma.$disconnect()
  }

  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' })
  execSync('node prisma/seed.js', { stdio: 'inherit' })
}

main().catch(e => { console.error(e); process.exit(1) })
