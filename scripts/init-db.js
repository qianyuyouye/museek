// Init container entrypoint: safety check for empty DB, then run prisma + seed.
// Used by docker-compose init service (builder stage image).
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const p = new PrismaClient();

p.user.count()
  .then(c => {
    console.log('⚠️  DB already has', c, 'users, skipping init.');
    process.exit(0);
  })
  .catch(() => {
    console.log('DB empty, running init...');
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    execSync('node prisma/seed.js', { stdio: 'inherit' });
  })
  .finally(() => p.$disconnect());
