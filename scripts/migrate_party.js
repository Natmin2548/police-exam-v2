const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Creating PartyRoom table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PartyRoom" (
      "id" TEXT PRIMARY KEY,
      "roomCode" TEXT UNIQUE NOT NULL,
      "title" TEXT NOT NULL DEFAULT 'ห้องประลองความรู้ตำรวจ',
      "hostId" INTEGER NOT NULL,
      "hostName" TEXT NOT NULL DEFAULT 'หัวหน้าห้อง',
      "status" TEXT NOT NULL DEFAULT 'LOBBY',
      "category" TEXT NOT NULL DEFAULT 'รวมทุกวิชา',
      "totalQ" INTEGER NOT NULL DEFAULT 5,
      "isPublic" BOOLEAN NOT NULL DEFAULT true,
      "currentQIdx" INTEGER NOT NULL DEFAULT 0,
      "questions" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Creating PartyRoom indices...');
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PartyRoom_status_isPublic_idx" ON "PartyRoom"("status", "isPublic")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PartyRoom_roomCode_idx" ON "PartyRoom"("roomCode")`);

  console.log('Creating PartyMember table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PartyMember" (
      "id" SERIAL PRIMARY KEY,
      "roomId" TEXT NOT NULL REFERENCES "PartyRoom"("id") ON DELETE CASCADE,
      "userId" INTEGER NOT NULL,
      "username" TEXT NOT NULL,
      "avatar" TEXT,
      "gold" INTEGER NOT NULL DEFAULT 0,
      "streak" INTEGER NOT NULL DEFAULT 0,
      "hasShield" BOOLEAN NOT NULL DEFAULT false,
      "isHost" BOOLEAN NOT NULL DEFAULT false,
      "isAnswered" BOOLEAN NOT NULL DEFAULT false,
      "lastAnswerChoice" INTEGER,
      "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PartyMember_roomId_userId_key" UNIQUE ("roomId", "userId")
    )
  `);

  console.log('Creating PartyMember indices...');
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PartyMember_roomId_idx" ON "PartyMember"("roomId")`);

  console.log('Party tables migrated successfully!');
}

main()
  .catch((e) => {
    console.error('Party migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
