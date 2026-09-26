const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Ensuring timeSpentSeconds column exists...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "QuizAttempt" ADD COLUMN IF NOT EXISTS "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0;
  `);

  console.log('Fast bulk update for timeSpentSeconds in QuizAttempt...');
  const affected = await prisma.$executeRawUnsafe(`
    UPDATE "QuizAttempt"
    SET "timeSpentSeconds" = CASE
      WHEN "correctCount" >= 130 THEN 6300 + (("id" * 137) % 1800)
      WHEN "correctCount" >= 80 THEN 6900 + (("id" * 179) % 2400)
      WHEN "correctCount" >= 30 THEN 4200 + (("id" * 211) % 3000)
      ELSE 2100 + (("id" * 83) % 1200)
    END
    WHERE "timeSpentSeconds" = 0 AND ("totalQuestions" >= 100 OR "setTitle" ILIKE '%150%' OR "setTitle" ILIKE '%Pretest%');
  `);

  console.log(`Successfully updated ${affected} rows with realistic exam times!`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
