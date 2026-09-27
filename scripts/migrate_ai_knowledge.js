const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Migrating ReportedQuestion columns...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "ReportedQuestion" ADD COLUMN IF NOT EXISTS "aiAnalysis" JSONB;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ReportedQuestion" ADD COLUMN IF NOT EXISTS "aiConfidence" DOUBLE PRECISION;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ReportedQuestion" ADD COLUMN IF NOT EXISTS "autoResolved" BOOLEAN DEFAULT false;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ReportedQuestion" ADD COLUMN IF NOT EXISTS "previousData" JSONB;`);

  console.log('Creating ExamKnowledgeBank table if not exists...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ExamKnowledgeBank" (
      "id" SERIAL PRIMARY KEY,
      "category" TEXT NOT NULL,
      "topic" TEXT NOT NULL,
      "legalReference" TEXT,
      "coreFact" TEXT NOT NULL,
      "sampleQuestion" TEXT,
      "timesReferenced" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ExamKnowledgeBank_category_idx" ON "ExamKnowledgeBank"("category");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ExamKnowledgeBank_topic_idx" ON "ExamKnowledgeBank"("topic");`);

  console.log('Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
