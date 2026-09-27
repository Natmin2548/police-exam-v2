import { prisma } from "@/lib/prisma";

export function getTodayThaiDateString(): string {
  // Returns YYYY-MM-DD in Asia/Bangkok
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const DEFAULT_MISSIONS = [
  {
    questKey: "DAILY_CHECKIN",
    title: "เช็คชื่อเข้าเตรียมสอบประจำวัน",
    description: "เข้าสู่ระบบและเปิดแอปเพื่อความต่อเนื่อง",
    targetCount: 1,
    rewardExp: 20,
    category: "DAILY",
    icon: "Sparkles",
  },
  {
    questKey: "EXAM_PRACTICE",
    title: "ทำข้อสอบสะสม 15 ข้อ",
    description: "ฝึกทำข้อสอบหมวดใดก็ได้ให้ครบ 15 ข้อ",
    targetCount: 15,
    rewardExp: 50,
    category: "EXAM",
    icon: "BookOpen",
  },
  {
    questKey: "VOCAB_MASTERY",
    title: "พิชิตคำศัพท์ 5 คำ",
    description: "กดจำได้แล้วในคลังคำศัพท์หรือทำควิซภาษาอังกฤษ",
    targetCount: 5,
    rewardExp: 30,
    category: "VOCAB",
    icon: "Languages",
  },
  {
    questKey: "HIGH_ACCURACY",
    title: "ทำคะแนนสอบ 70% ขึ้นไป",
    description: "ทำแบบทดสอบให้ได้คะแนนอย่างน้อย 70% 1 ชุด",
    targetCount: 1,
    rewardExp: 60,
    category: "CHALLENGE",
    icon: "Trophy",
  },
];

/**
 * คำนวณเลเวลจากค่า EXP สะสม (150 EXP ต่อ 1 เลเวล)
 */
export function calculateLevel(exp: number): number {
  return Math.max(1, Math.floor(exp / 150) + 1);
}

/**
 * อัปเดต Streak รายวันของผู้ใช้
 */
export async function updateUserStreak(userId: number): Promise<{ streak: number; streakUpdated: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streak: true, streakLastDate: true },
  });

  if (!user) return { streak: 1, streakUpdated: false };

  const todayStr = getTodayThaiDateString();

  if (!user.streakLastDate) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { streak: 1, streakLastDate: new Date() },
      select: { streak: true },
    });
    return { streak: updated.streak, streakUpdated: true };
  }

  const lastDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(user.streakLastDate);

  if (lastDateStr === todayStr) {
    return { streak: user.streak || 1, streakUpdated: false };
  }

  // คำนวณความห่างของวัน
  const today = new Date(todayStr + "T00:00:00+07:00");
  const last = new Date(lastDateStr + "T00:00:00+07:00");
  const diffDays = Math.round((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  let newStreak = 1;
  if (diffDays === 1) {
    newStreak = (user.streak || 0) + 1;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { streak: newStreak, streakLastDate: new Date() },
    select: { streak: true },
  });

  return { streak: updated.streak, streakUpdated: true };
}

/**
 * ดึงหรือสร้าง UserMissionProgress ของวันนี้
 */
export async function getOrCreateDailyMissions(userId: number) {
  const todayStr = getTodayThaiDateString();

  // ตรวจสอบว่าในระบบมี Master DailyMission ครบหรือไม่
  for (const m of DEFAULT_MISSIONS) {
    await prisma.dailyMission.upsert({
      where: { questKey: m.questKey },
      create: m,
      update: {
        title: m.title,
        description: m.description,
        targetCount: m.targetCount,
        rewardExp: m.rewardExp,
        category: m.category,
        icon: m.icon,
      },
    });
  }

  const masterMissions = await prisma.dailyMission.findMany();

  // ดึง progress ของวันนี้
  const existingProgress = await prisma.userMissionProgress.findMany({
    where: {
      userId,
      missionDate: todayStr,
    },
  });

  const existingMap = new Map(existingProgress.map((p) => [p.questKey, p]));

  // สร้างเควสที่ยังไม่มีสำหรับวันนี้
  for (const master of masterMissions) {
    if (!existingMap.has(master.questKey)) {
      const isCheckin = master.questKey === "DAILY_CHECKIN";
      const created = await prisma.userMissionProgress.create({
        data: {
          userId,
          questKey: master.questKey,
          currentCount: isCheckin ? 1 : 0,
          targetCount: master.targetCount,
          rewardExp: master.rewardExp,
          isCompleted: isCheckin,
          isClaimed: false,
          missionDate: todayStr,
        },
      });
      existingMap.set(master.questKey, created);
    }
  }

  // ผสานข้อมูลส่งกลับ
  return masterMissions.map((m) => {
    const prog = existingMap.get(m.questKey);
    return {
      questKey: m.questKey,
      title: m.title,
      description: m.description,
      targetCount: m.targetCount,
      currentCount: prog ? prog.currentCount : 0,
      rewardExp: m.rewardExp,
      category: m.category,
      icon: m.icon,
      isCompleted: prog ? prog.isCompleted : false,
      isClaimed: prog ? prog.isClaimed : false,
    };
  });
}

/**
 * อัปเดตความคืบหน้าของเควส เช่น เมื่อทำข้อสอบ หรือท่องศัพท์
 */
export async function trackMissionProgress(
  userId: number,
  questKey: string,
  increment: number = 1
) {
  try {
    const todayStr = getTodayThaiDateString();

    const master = await prisma.dailyMission.findUnique({
      where: { questKey },
    });
    if (!master) return;

    const existing = await prisma.userMissionProgress.findUnique({
      where: {
        userId_questKey_missionDate: {
          userId,
          questKey,
          missionDate: todayStr,
        },
      },
    });

    if (existing) {
      const newCount = Math.min(master.targetCount, existing.currentCount + increment);
      const isCompleted = newCount >= master.targetCount;

      await prisma.userMissionProgress.update({
        where: { id: existing.id },
        data: {
          currentCount: newCount,
          isCompleted,
        },
      });
    } else {
      const newCount = Math.min(master.targetCount, increment);
      await prisma.userMissionProgress.create({
        data: {
          userId,
          questKey,
          currentCount: newCount,
          targetCount: master.targetCount,
          rewardExp: master.rewardExp,
          isCompleted: newCount >= master.targetCount,
          isClaimed: false,
          missionDate: todayStr,
        },
      });
    }
  } catch (error) {
    console.error("Error tracking mission progress:", error);
  }
}
