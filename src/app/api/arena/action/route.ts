import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmailSafe } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, roomCode, choice, timeRemaining = 0, chestIndex, targetMemberId, email: bodyEmail } = body;

    const email = await getEmailSafe(request, bodyEmail);
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, username: true, fullName: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const room = await prisma.partyRoom.findUnique({
      where: { roomCode },
      include: { members: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const currentMember = room.members.find((m) => m.userId === user.id);
    if (!currentMember) {
      return NextResponse.json({ error: "Member not in room" }, { status: 403 });
    }

    const rawQuestions = Array.isArray(room.questions) ? room.questions : [];
    const currentQ = rawQuestions[room.currentQIdx] as any;

    // Helper: ตรวจสอบว่าทุกคนตอบครบและเลือกกล่องครบแล้วหรือยัง ถ้าครบแล้วให้เลื่อนไปข้อถัดไปทันที
    const checkAutoAdvance = async () => {
      const allMembers = await prisma.partyMember.findMany({
        where: { roomId: room.id },
      });
      if (allMembers.length === 0) return { autoAdvanced: false, isFinished: false, nextIdx: room.currentQIdx };

      // ทุกคนต้องตอบแล้ว (isAnswered === true) และถ้าต้องเลือกกล่องก็ต้องเลือกแล้ว (hasPickedChest === true)
      const isEveryoneReady = allMembers.every((m) => m.isAnswered && m.hasPickedChest);
      if (!isEveryoneReady) return { autoAdvanced: false, isFinished: false, nextIdx: room.currentQIdx };

      const nextIdx = room.currentQIdx + 1;
      const isFinished = nextIdx >= room.totalQ;

      await prisma.partyMember.updateMany({
        where: { roomId: room.id },
        data: {
          isAnswered: false,
          lastAnswerChoice: null,
          hasPickedChest: false,
          pickedChest: null,
        },
      });

      await prisma.partyRoom.update({
        where: { id: room.id },
        data: {
          currentQIdx: nextIdx,
          status: isFinished ? "FINISHED" : "PLAYING",
        },
      });

      return { autoAdvanced: true, isFinished, nextIdx };
    };

    // -------------------------------------------------------------------------
    // Action 1: ANSWER (ตอบคำถาม)
    // -------------------------------------------------------------------------
    if (action === "answer") {
      if (!currentQ) {
        return NextResponse.json({ error: "No active question" }, { status: 400 });
      }

      const isCorrect = Number(choice) === Number(currentQ.correctAnswer);

      if (isCorrect) {
        const baseGold = 100;
        const speedBonus = Math.max(0, Math.min(180, Math.floor(Number(timeRemaining) * 2)));
        const streakBonus = currentMember.streak * 20;
        const gainedGold = baseGold + speedBonus + streakBonus;
        const nextGold = currentMember.gold + gainedGold;
        const nextStreak = currentMember.streak + 1;

        await prisma.partyMember.update({
          where: { id: currentMember.id },
          data: {
            gold: nextGold,
            streak: nextStreak,
            isAnswered: true,
            lastAnswerChoice: Number(choice),
            hasPickedChest: false, // ตอบถูก ต้องเลือกกล่องก่อนถึงจะถือว่าเสร็จสิ้น
          },
        });

        const advanceStatus = await checkAutoAdvance();

        return NextResponse.json({
          success: true,
          isCorrect: true,
          gainedGold,
          newGold: nextGold,
          streak: nextStreak,
          correctAnswer: currentQ.correctAnswer,
          explanation: currentQ.explanation,
          canPickChest: true,
          autoAdvanced: advanceStatus.autoAdvanced,
          isFinished: advanceStatus.isFinished,
          nextQIdx: advanceStatus.nextIdx,
        });
      } else {
        await prisma.partyMember.update({
          where: { id: currentMember.id },
          data: {
            streak: 0,
            isAnswered: true,
            lastAnswerChoice: Number(choice),
            hasPickedChest: true, // คนตอบผิดไม่ได้กล่อง ถือว่า action รอบนี้เสร็จสิ้นทันที
          },
        });

        const advanceStatus = await checkAutoAdvance();

        return NextResponse.json({
          success: true,
          isCorrect: false,
          gainedGold: 0,
          newGold: currentMember.gold,
          streak: 0,
          correctAnswer: currentQ.correctAnswer,
          explanation: currentQ.explanation,
          canPickChest: false,
          autoAdvanced: advanceStatus.autoAdvanced,
          isFinished: advanceStatus.isFinished,
          nextQIdx: advanceStatus.nextIdx,
        });
      }
    }

    // -------------------------------------------------------------------------
    // Action 2: OPEN_CHEST (เปิดกล่องสุ่ม 6 กล่อง - คนตอบก่อนได้เลือกก่อน!)
    // -------------------------------------------------------------------------
    if (action === "open_chest") {
      // 🔒 ตรวจสอบว่าต้องตอบข้อปัจจุบันถูกเท่านั้นถึงจะเปิดกล่องได้!
      if (!currentMember.isAnswered || currentMember.lastAnswerChoice === null) {
        return NextResponse.json({ error: "ต้องตอบคำถามก่อนถึงจะเปิดกล่องได้" }, { status: 400 });
      }

      const isCorrectThisRound =
        currentQ && Number(currentMember.lastAnswerChoice) === Number(currentQ.correctAnswer);

      if (!isCorrectThisRound) {
        return NextResponse.json({
          error: "เฉพาะคนที่ตอบถูกต้องเท่านั้นที่มีสิทธิ์เปิดกล่องสุ่มชิงทอง!",
        }, { status: 403 });
      }

      const chosenNum = Number(chestIndex);
      if (isNaN(chosenNum) || chosenNum < 1 || chosenNum > 6) {
        return NextResponse.json({ error: "กรุณาเลือกกล่องหมายเลข 1 ถึง 6" }, { status: 400 });
      }

      // ตรวจสอบว่าตนเองเคยเปิดกล่องไปแล้วหรือยัง
      if (currentMember.hasPickedChest && currentMember.pickedChest !== null) {
        return NextResponse.json({ error: "คุณได้เปิดกล่องสุ่มในรอบนี้ไปแล้ว" }, { status: 400 });
      }

      // 🏁 กฎคนตอบก่อนได้เลือกก่อน: ตรวจสอบว่ากล่องนี้มีเพื่อนในห้องเปิดไปแล้วหรือยัง
      const takenBy = room.members.find((m) => m.pickedChest === chosenNum && m.userId !== user.id);
      if (takenBy) {
        return NextResponse.json({
          error: `กล่องที่ ${chosenNum} ถูกเปิดไปแล้วโดย ${takenBy.username}! กรุณาเลือกกล่องอื่นที่ยังว่าง`,
          alreadyTaken: true,
          takenBy: takenBy.username,
        }, { status: 400 });
      }

      // สุ่มผลลัพธ์ของกล่อง
      const roll = Math.random();
      let effectType = "GOLD_100";
      let goldDelta = 100;
      let message = "คุณได้รับทอง +100G!";
      let targetUsername: string | null = null;
      let isBlockedByShield = false;

      // หาคู่แข่งที่มีทองเยอะที่สุด เพื่อเล็งเป็นเป้าหมายขโมย
      const otherMembers = room.members.filter((m) => m.userId !== user.id);
      const sortedOthers = [...otherMembers].sort((a, b) => b.gold - a.gold);
      const topTarget = sortedOthers[0];

      if (roll < 0.25) {
        // +50 Gold
        effectType = "GOLD_50";
        goldDelta = 50;
        message = "เปิดได้เหรียญทอง +50G!";
        await prisma.partyMember.update({
          where: { id: currentMember.id },
          data: { gold: { increment: 50 } },
        });
      } else if (roll < 0.50) {
        // +100 Gold
        effectType = "GOLD_100";
        goldDelta = 100;
        message = "เปิดได้หีบสมบัติ +100G!";
        await prisma.partyMember.update({
          where: { id: currentMember.id },
          data: { gold: { increment: 100 } },
        });
      } else if (roll < 0.65) {
        // +200 Gold JACKPOT
        effectType = "GOLD_200";
        goldDelta = 200;
        message = "🎉 JACKPOT! ขุมทรัพย์ทองคำแท่ง +200G!";
        await prisma.partyMember.update({
          where: { id: currentMember.id },
          data: { gold: { increment: 200 } },
        });
      } else if (roll < 0.85 && topTarget && topTarget.gold > 50) {
        // STEAL (ขโมย 20% จากคนทองเยอะสุด)
        targetUsername = topTarget.username;
        if (topTarget.hasShield) {
          // โดนโล่ป้องกัน!
          isBlockedByShield = true;
          effectType = "STEAL_BLOCKED";
          goldDelta = 0;
          message = `🛡️ ถูกขัดขวาง! ${topTarget.username} มีโล่ตำรวจป้องกันการขโมย!`;
          // ล้างโล่ของเป้าหมาย
          await prisma.partyMember.update({
            where: { id: topTarget.id },
            data: { hasShield: false },
          });
        } else {
          // ขโมยสำเร็จ
          const stolenAmount = Math.max(30, Math.floor(topTarget.gold * 0.2));
          effectType = "STEAL_SUCCESS";
          goldDelta = stolenAmount;
          message = `🥷 ย่องเบาสำเร็จ! ขโมยทองจาก ${topTarget.username} มาได้ +${stolenAmount}G!`;

          await prisma.$transaction([
            prisma.partyMember.update({
              where: { id: topTarget.id },
              data: { gold: Math.max(0, topTarget.gold - stolenAmount) },
            }),
            prisma.partyMember.update({
              where: { id: currentMember.id },
              data: { gold: currentMember.gold + stolenAmount },
            }),
          ]);
        }
      } else if (roll < 0.93) {
        // SHIELD
        effectType = "SHIELD";
        goldDelta = 0;
        message = "🛡️ ได้รับ 'โล่ตำรวจพิทักษ์ทรัพย์' ป้องกันการถูกขโมยทอง 1 ครั้ง!";
        await prisma.partyMember.update({
          where: { id: currentMember.id },
          data: { hasShield: true },
        });
      } else {
        // BOMB (-15% gold)
        const lossAmount = Math.floor(currentMember.gold * 0.15);
        effectType = "BOMB";
        goldDelta = -lossAmount;
        message = lossAmount > 0
          ? `💣 กับดักระเบิดทำงาน! เสียทองไป -${lossAmount}G!`
          : "💣 เจอกับดักระเบิด! แต่คุณยังไม่มีทองให้เสีย";

        if (lossAmount > 0) {
          await prisma.partyMember.update({
            where: { id: currentMember.id },
            data: { gold: Math.max(0, currentMember.gold - lossAmount) },
          });
        }
      }

      // บันทึกว่าผู้เล่นได้เลือกเปิดกล่องสุ่มหมายเลขนี้แล้ว
      await prisma.partyMember.update({
        where: { id: currentMember.id },
        data: { hasPickedChest: true, pickedChest: chosenNum },
      });

      // ดึงคะแนนทองล่าสุด
      const updatedSelf = await prisma.partyMember.findUnique({
        where: { id: currentMember.id },
        select: { gold: true, hasShield: true },
      });

      // ตรวจสอบว่าทุกคนเปิดกล่องครบแล้วหรือยัง ถ้าครบแล้วข้ามข้อทันที!
      const advanceStatus = await checkAutoAdvance();

      return NextResponse.json({
        success: true,
        chestIndex,
        effectType,
        message,
        goldDelta,
        targetUsername,
        isBlockedByShield,
        myNewGold: updatedSelf?.gold ?? currentMember.gold,
        hasShield: updatedSelf?.hasShield ?? false,
        autoAdvanced: advanceStatus.autoAdvanced,
        isFinished: advanceStatus.isFinished,
        nextQIdx: advanceStatus.nextIdx,
      });
    }

    // -------------------------------------------------------------------------
    // Action 3: NEXT_QUESTION (ข้ามไปข้อถัดไป หรือจบเกม)
    // -------------------------------------------------------------------------
    if (action === "next_question") {
      const nextIdx = room.currentQIdx + 1;
      const isFinished = nextIdx >= room.totalQ;

      await prisma.partyMember.updateMany({
        where: { roomId: room.id },
        data: {
          isAnswered: false,
          lastAnswerChoice: null,
          hasPickedChest: false,
          pickedChest: null,
        },
      });

      await prisma.partyRoom.update({
        where: { id: room.id },
        data: {
          currentQIdx: nextIdx,
          status: isFinished ? "FINISHED" : "PLAYING",
        },
      });

      return NextResponse.json({
        success: true,
        nextQIdx: nextIdx,
        isFinished,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in /api/arena/action:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
