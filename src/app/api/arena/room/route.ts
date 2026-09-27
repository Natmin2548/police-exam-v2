import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmailSafe } from "@/lib/supabaseServer";
import { normalizeCategoryQuery } from "@/lib/categoryUtils";

export const dynamic = "force-dynamic";

/**
 * GET /api/arena/room
 * ดึงสถานะห้อง หรือ รายการห้องสาธารณะที่กำลังรอคน
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomCode = searchParams.get("roomCode");
    const mode = searchParams.get("mode");

    // 1. ดึงรายการห้องสาธารณะสำหรับหน้าล็อบบี้
    if (mode === "active_rooms") {
      const activeRooms = await prisma.partyRoom.findMany({
        where: {
          status: "LOBBY",
          isPublic: true,
        },
        include: {
          members: {
            select: { id: true, userId: true, username: true, avatar: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      return NextResponse.json({
        rooms: activeRooms.map((r) => ({
          roomCode: r.roomCode,
          title: r.title,
          hostName: r.hostName,
          category: r.category,
          totalQ: r.totalQ,
          memberCount: r.members.length,
          maxMembers: 8,
          createdAt: r.createdAt,
        })),
      });
    }

    // 2. ดึงข้อมูลห้องเฉพาะเจาะจง
    if (!roomCode) {
      return NextResponse.json({ error: "Missing roomCode" }, { status: 400 });
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

    // Authenticate caller to identify current user and host status
    const email = await getEmailSafe(request);
    let currentDbUser = null;
    if (email) {
      currentDbUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, username: true, fullName: true },
      });
    }

    const currentUserId = currentDbUser?.id ?? null;
    const isHost = currentUserId ? room.hostId === currentUserId : room.members.length === 1;

    // Sanitized questions (อย่าส่งเฉลยตัวจริงถ้าเกมยังไม่จบ)
    const rawQuestions = Array.isArray(room.questions) ? room.questions : [];
    const sanitizedQuestions = rawQuestions.map((q: any) => ({
      id: q.id,
      questionText: q.questionText,
      choices: q.choices,
      category: q.category,
      explanation: room.status === "FINISHED" ? q.explanation : undefined,
      correctAnswer: room.status === "FINISHED" ? q.correctAnswer : undefined,
    }));

    const membersWithFlag = room.members.map((m) => ({
      ...m,
      isCurrentMember: currentUserId ? m.userId === currentUserId : false,
    }));

    return NextResponse.json({
      room: {
        ...room,
        members: membersWithFlag,
        questions: sanitizedQuestions,
        totalQuestionsCount: rawQuestions.length,
      },
      currentUserId,
      isHost,
    });
  } catch (error: any) {
    console.error("Error in /api/arena/room GET:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/arena/room
 * จัดการการสร้าง, เข้าร่วม, สุ่มห้อง และเริ่มเกม
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, roomCode, category = "รวมทุกวิชา", totalQ = 5, email: bodyEmail } = body;

    const email = await getEmailSafe(request, bodyEmail);
    if (!email) {
      return NextResponse.json({ error: "Unauthorized: Please log in" }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, username: true, fullName: true, faceImage: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const displayName = user.fullName?.trim() || user.username || `ผู้สอบ #${user.id}`;
    const avatar = user.faceImage || null;

    // Helper: สุ่มข้อสอบจาก Database กระจายทุกบท
    const fetchQuestionsPool = async (cat: string, count: number) => {
      let whereClause: any = {};
      if (cat && cat !== "รวมทุกวิชา") {
        const catQuery = normalizeCategoryQuery(cat);
        whereClause = {
          examSet: { category: { contains: catQuery, mode: "insensitive" } },
        };
      }

      const questions = await prisma.question.findMany({
        where: whereClause,
        select: {
          id: true,
          questionText: true,
          choice1: true,
          choice2: true,
          choice3: true,
          choice4: true,
          correctAnswer: true,
          explanation: true,
          examSet: { select: { category: true } },
        },
        take: 500, // สุ่มจากข้อสอบทั้งหมดในหมวดนั้น
      });

      const shuffled = [...questions].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, Math.min(count, shuffled.length)).map((q) => ({
        id: q.id,
        questionText: q.questionText,
        choices: [q.choice1, q.choice2, q.choice3, q.choice4],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "ไม่มีคำอธิบายเพิ่มเติม",
        category: q.examSet?.category || cat,
      }));
    };

    // Helper: สร้างเลข PIN 6 หลักที่ไม่ซ้ำ
    const generateRoomCode = async (): Promise<string> => {
      let code = "";
      let exists = true;
      while (exists) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
        const found = await prisma.partyRoom.findUnique({ where: { roomCode: code } });
        if (!found) exists = false;
      }
      return code;
    };

    // -------------------------------------------------------------------------
    // Action 1: CREATE (สร้างห้องใหม่)
    // -------------------------------------------------------------------------
    if (action === "create") {
      const code = await generateRoomCode();
      const questionCount = Math.max(3, Math.min(Number(totalQ) || 5, 50));
      const pool = await fetchQuestionsPool(category, questionCount);

      if (pool.length === 0) {
        return NextResponse.json({ error: "ไม่พบข้อสอบในหมวดวิชานี้" }, { status: 400 });
      }

      const newRoom = await prisma.partyRoom.create({
        data: {
          roomCode: code,
          title: `ห้องประลอง: ${category}`,
          hostId: user.id,
          hostName: displayName,
          status: "LOBBY",
          category,
          totalQ: pool.length,
          isPublic: true,
          questions: pool,
          members: {
            create: {
              userId: user.id,
              username: displayName,
              avatar,
              gold: 0,
              streak: 0,
              isHost: true,
            },
          },
        },
        include: { members: true },
      });

      return NextResponse.json({
        success: true,
        roomCode: newRoom.roomCode,
        room: newRoom,
      });
    }

    // -------------------------------------------------------------------------
    // Action 2: JOIN (เข้าร่วมห้องด้วย PIN 6 หลัก)
    // -------------------------------------------------------------------------
    if (action === "join") {
      if (!roomCode) {
        return NextResponse.json({ error: "กรุณาระบุรหัสห้อง PIN" }, { status: 400 });
      }

      const cleanCode = roomCode.replace(/\s+/g, "").trim();
      const targetRoom = await prisma.partyRoom.findUnique({
        where: { roomCode: cleanCode },
        include: { members: true },
      });

      if (!targetRoom) {
        return NextResponse.json({ error: "ไม่พบห้องที่มีรหัสนี้" }, { status: 404 });
      }

      if (targetRoom.status !== "LOBBY") {
        return NextResponse.json({ error: "เกมกำลังเล่นอยู่หรือไม่สามารถเข้าได้" }, { status: 400 });
      }

      if (targetRoom.members.length >= 8) {
        return NextResponse.json({ error: "ห้องเต็มแล้ว (สูงสุด 8 คน)" }, { status: 400 });
      }

      // Upsert สมาชิกในห้อง
      await prisma.partyMember.upsert({
        where: { roomId_userId: { roomId: targetRoom.id, userId: user.id } },
        create: {
          roomId: targetRoom.id,
          userId: user.id,
          username: displayName,
          avatar,
          gold: 0,
          streak: 0,
          isHost: targetRoom.hostId === user.id,
        },
        update: {
          username: displayName,
          avatar,
        },
      });

      return NextResponse.json({ success: true, roomCode: cleanCode });
    }

    // -------------------------------------------------------------------------
    // Action 3: QUICK_MATCH (สุ่มเข้าห้องที่เปิดอยู่ หรือสร้างใหม่ถ้าไม่มี)
    // -------------------------------------------------------------------------
    if (action === "quick_match") {
      // ค้นหาห้อง LOBBY สาธารณะที่ยังมีที่ไม่เต็ม
      const availableRooms = await prisma.partyRoom.findMany({
        where: {
          status: "LOBBY",
          isPublic: true,
        },
        include: { members: true },
        orderBy: { createdAt: "desc" },
      });

      const matchedRoom = availableRooms.find((r) => r.members.length < 8);

      if (matchedRoom) {
        // เข้าร่วมห้องที่เจอ
        await prisma.partyMember.upsert({
          where: { roomId_userId: { roomId: matchedRoom.id, userId: user.id } },
          create: {
            roomId: matchedRoom.id,
            userId: user.id,
            username: displayName,
            avatar,
            gold: 0,
            streak: 0,
            isHost: matchedRoom.hostId === user.id,
          },
          update: { username: displayName, avatar },
        });

        return NextResponse.json({
          success: true,
          roomCode: matchedRoom.roomCode,
          isNew: false,
        });
      }

      // ถ้าไม่มีห้องว่างเลย -> สร้างห้องใหม่ให้เป็น Host รอคนอื่นสุ่มมา
      const code = await generateRoomCode();
      const pool = await fetchQuestionsPool("รวมทุกวิชา", 5);

      const created = await prisma.partyRoom.create({
        data: {
          roomCode: code,
          title: "ห้องประลองสาธารณะ",
          hostId: user.id,
          hostName: displayName,
          status: "LOBBY",
          category: "รวมทุกวิชา",
          totalQ: pool.length,
          isPublic: true,
          questions: pool,
          members: {
            create: {
              userId: user.id,
              username: displayName,
              avatar,
              gold: 0,
              streak: 0,
              isHost: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        roomCode: created.roomCode,
        isNew: true,
      });
    }

    // -------------------------------------------------------------------------
    // Action 4: START (หัวหน้าสั่งเริ่มเกม)
    // -------------------------------------------------------------------------
    if (action === "start") {
      if (!roomCode) return NextResponse.json({ error: "Missing roomCode" }, { status: 400 });

      const room = await prisma.partyRoom.findUnique({ where: { roomCode } });
      if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

      if (room.hostId !== user.id) {
        return NextResponse.json({ error: "เฉพาะหัวหน้าห้องเท่านั้นที่เริ่มเกมได้" }, { status: 403 });
      }

      // รีเซ็ตสถานะตอบของสมาชิกทุกคน
      await prisma.partyMember.updateMany({
        where: { roomId: room.id },
        data: {
          isAnswered: false,
          lastAnswerChoice: null,
          hasShield: false,
        },
      });

      await prisma.partyRoom.update({
        where: { id: room.id },
        data: { status: "PLAYING", currentQIdx: 0 },
      });

      return NextResponse.json({ success: true, roomCode });
    }

    // -------------------------------------------------------------------------
    // Action 5: LEAVE (ออกจากห้อง)
    // -------------------------------------------------------------------------
    if (action === "leave") {
      if (!roomCode) return NextResponse.json({ error: "Missing roomCode" }, { status: 400 });

      const room = await prisma.partyRoom.findUnique({
        where: { roomCode },
        include: { members: true },
      });

      if (!room) return NextResponse.json({ success: true });

      // ลบตนเองออกจากห้อง
      await prisma.partyMember.deleteMany({
        where: { roomId: room.id, userId: user.id },
      });

      const remaining = room.members.filter((m) => m.userId !== user.id);

      if (remaining.length === 0) {
        // ห้องว่าง ลบทิ้ง
        await prisma.partyRoom.delete({ where: { id: room.id } });
      } else if (room.hostId === user.id) {
        // หัวหน้าออก โอนสิทธิ์หัวหน้าให้คนถัดไป
        const newHost = remaining[0];
        await prisma.partyRoom.update({
          where: { id: room.id },
          data: { hostId: newHost.userId, hostName: newHost.username },
        });
        await prisma.partyMember.update({
          where: { id: newHost.id },
          data: { isHost: true },
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in /api/arena/room POST:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
