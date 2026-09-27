import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmailSafe } from "@/lib/supabaseServer";
import { calculateLevel, trackMissionProgress } from "@/lib/missionService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomCode, email: bodyEmail } = body;

    const email = await getEmailSafe(request, bodyEmail);
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const room = await prisma.partyRoom.findUnique({
      where: { roomCode },
      include: {
        members: {
          orderBy: [{ gold: "desc" }, { joinedAt: "asc" }],
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // แจก EXP ให้ผู้เล่นทุกคนตามลำดับ
    const podiumRewards = [120, 80, 50]; // 1st, 2nd, 3rd
    const baseReward = 30; // 4th onwards

    const podium = await Promise.all(
      room.members.map(async (member, index) => {
        const rewardExp = podiumRewards[index] || baseReward;

        // อัปเดต EXP ในตาราง User
        const dbUser = await prisma.user.findUnique({
          where: { id: member.userId },
          select: { id: true, exp: true },
        });

        if (dbUser) {
          const newExp = (dbUser.exp || 0) + rewardExp;
          const newLevel = calculateLevel(newExp);

          await prisma.user.update({
            where: { id: member.userId },
            data: { exp: newExp, level: newLevel },
          });

          // อัปเดต Daily Mission
          trackMissionProgress(member.userId, "EXAM_PRACTICE", room.totalQ).catch(() => {});
          if (index === 0) {
            trackMissionProgress(member.userId, "HIGH_ACCURACY", 1).catch(() => {});
          }
        }

        return {
          rank: index + 1,
          userId: member.userId,
          username: member.username,
          avatar: member.avatar,
          gold: member.gold,
          earnedExp: rewardExp,
        };
      })
    );

    // ปรับสถานะห้องเป็น FINISHED
    await prisma.partyRoom.update({
      where: { id: room.id },
      data: { status: "FINISHED" },
    });

    return NextResponse.json({
      success: true,
      podium,
    });
  } catch (error: any) {
    console.error("Error in /api/arena/finish:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
