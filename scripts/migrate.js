const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Creating Notification table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Notification" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "title" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'INFO',
      "isRead" BOOLEAN NOT NULL DEFAULT false,
      "link" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Creating indices...');
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt")`);

  console.log('All migrations executed successfully!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
