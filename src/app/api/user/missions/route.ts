import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmailSafe } from "@/lib/supabaseServer";
import {
  getOrCreateDailyMissions,
  updateUserStreak,
  calculateLevel,
  getTodayThaiDateString,
} from "@/lib/missionService";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/missions
 * ดึงภารกิจประจำวัน สตรีค เลเวล และ EXP ของผู้ใช้
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const emailParam = searchParams.get("email");
    const email = await getEmailSafe(request, emailParam || undefined);

    if (!email) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: {
        id: true,
        streak: true,
        exp: true,
        level: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // อัปเดตสตรีคประจำวัน
    const { streak } = await updateUserStreak(user.id);

    // ดึงหรือสร้างเควสประจำวัน
    const missions = await getOrCreateDailyMissions(user.id);

    // คำนวณ EXP และ Level
    const currentExp = user.exp || 0;
    const computedLevel = calculateLevel(currentExp);
    const expPerLevel = 150;
    const currentExpInLevel = currentExp % expPerLevel;
    const expToNextLevel = expPerLevel - currentExpInLevel;

    // ถ้า level ใน DB ไม่ตรงกับที่คำนวณ ให้อัปเดต
    if (user.level !== computedLevel) {
      await prisma.user.update({
        where: { id: user.id },
        data: { level: computedLevel },
      });
    }

    return NextResponse.json({
      success: true,
      streak,
      level: computedLevel,
      exp: currentExp,
      currentExpInLevel,
      expPerLevel,
      expToNextLevel,
      missions,
      date: getTodayThaiDateString(),
    });
  } catch (error: any) {
    console.error("Error in /api/user/missions GET:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/user/missions
 * เคลมรางวัลภารกิจ (Claim Reward)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email: bodyEmail, action, questKey } = body;

    const email = await getEmailSafe(request, bodyEmail);
    if (!email) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, exp: true, level: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (action === "claim" && questKey) {
      const todayStr = getTodayThaiDateString();

      const progress = await prisma.userMissionProgress.findUnique({
        where: {
          userId_questKey_missionDate: {
            userId: user.id,
            questKey,
            missionDate: todayStr,
          },
        },
      });

      if (!progress) {
        return NextResponse.json({ error: "Mission not found" }, { status: 404 });
      }

      if (!progress.isCompleted) {
        return NextResponse.json({ error: "Mission is not completed yet" }, { status: 400 });
      }

      if (progress.isClaimed) {
        return NextResponse.json({ error: "Reward already claimed" }, { status: 400 });
      }

      // บันทึกสถานะว่าเคลมแล้ว
      await prisma.userMissionProgress.update({
        where: { id: progress.id },
        data: { isClaimed: true },
      });

      // เพิ่ม EXP ให้ User
      const newExp = (user.exp || 0) + progress.rewardExp;
      const newLevel = calculateLevel(newExp);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          exp: newExp,
          level: newLevel,
        },
      });

      return NextResponse.json({
        success: true,
        questKey,
        claimedExp: progress.rewardExp,
        totalExp: newExp,
        level: newLevel,
        currentExpInLevel: newExp % 150,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in /api/user/missions POST:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
