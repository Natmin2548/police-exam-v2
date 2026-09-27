const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Adding pickedChest column to PartyMember...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "PartyMember" ADD COLUMN IF NOT EXISTS "pickedChest" INTEGER;
  `);
  console.log('Column pickedChest added successfully!');
}

main()
  .catch((e) => {
    console.error('Error adding column:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
