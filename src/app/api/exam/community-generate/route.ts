import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmailSafe } from "@/lib/supabaseServer";
import { generateCommunityExam } from "@/lib/communityExamGenerator";

export const dynamic = "force-dynamic";

const DAILY_QUOTA_LIMIT = 5;

// Helper: ดึงวันที่ปัจจุบันตามเวลาไทย (YYYY-MM-DD)
function getBangkokDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// =============================================================================
// GET: ตรวจสอบโควต้าประจำวันของผู้ใช้
// =============================================================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get("email");
    const email = await getEmailSafe(req, emailParam || undefined);

    if (!email) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อนตรวจสอบโควต้า" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: {
        id: true,
        aiGenCount: true,
        aiGenLastDate: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "ไม่พบข้อมูลผู้ใช้" }, { status: 404 });
    }

    const todayStr = getBangkokDateString();
    const lastDateStr = user.aiGenLastDate ? getBangkokDateString(user.aiGenLastDate) : "";

    const usedToday = todayStr === lastDateStr ? user.aiGenCount : 0;
    const remainingToday = Math.max(0, DAILY_QUOTA_LIMIT - usedToday);

    return NextResponse.json({
      success: true,
      usedToday,
      remainingToday,
      maxQuota: DAILY_QUOTA_LIMIT,
      todayDate: todayStr,
    });
  } catch (error: any) {
    console.error("Error in GET /api/exam/community-generate:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// =============================================================================
// POST: สร้างข้อสอบใหม่เข้าคลังกลาง (โควต้าคนละ 5 ครั้ง/วัน + ซ่อนเฉลย 100%)
// =============================================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { category, chapterName, email: bodyEmail } = body;

    if (!category || !chapterName) {
      return NextResponse.json(
        { error: "กรุณาระบุวิชา (category) และชื่อบทเรียน (chapterName)" },
        { status: 400 }
      );
    }

    // 1. ตรวจสอบสิทธิ์ผู้ใช้
    const email = await getEmailSafe(req, bodyEmail || undefined);
    if (!email) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบเพื่อใช้งานระบบสร้างข้อสอบ" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });

    if (!user) {
      return NextResponse.json(
        { error: "ไม่พบบัญชีผู้ใช้งานในระบบ" },
        { status: 404 }
      );
    }

    // 2. ตรวจสอบโควต้าประจำวัน (5 ครั้ง/วัน)
    const todayStr = getBangkokDateString();
    const lastDateStr = user.aiGenLastDate ? getBangkokDateString(user.aiGenLastDate) : "";
    let usedToday = todayStr === lastDateStr ? user.aiGenCount : 0;

    if (usedToday >= DAILY_QUOTA_LIMIT) {
      return NextResponse.json(
        {
          error: `คุณใช้โควต้าสร้างข้อสอบครบ ${DAILY_QUOTA_LIMIT} ครั้งสำหรับวันนี้แล้ว (โควต้าจะรีเซ็ตใหม่เวลา 00:00 น.)`,
          usedToday,
          remainingToday: 0,
        },
        { status: 429 }
      );
    }

    // 3. เรียกใช้งาน AI Generator Service เพื่อสร้างข้อสอบ 5 ข้อ
    const genResult = await generateCommunityExam(category, chapterName, 5);

    if (!genResult.success || genResult.questions.length === 0) {
      return NextResponse.json(
        {
          error:
            genResult.error ||
            "ไม่สามารถสร้างข้อสอบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
        },
        { status: 400 }
      );
    }

    // 4. บันทึกเข้าคลังข้อสอบกลาง (ExamSet & Question)
    // 4.1 ค้นหาหรือสร้าง ExamSet สำหรับข้อสอบส่วนกลางบทนี้
    const cleanChapterName = chapterName
      .replace(/^บทที่\s*[0-9๑-๙]+(?:-[0-9๑-๙]+)?\s*[:\s]*/, "")
      .trim();

    let examSet = await prisma.examSet.findFirst({
      where: {
        category: { equals: category, mode: "insensitive" },
        isPublic: true,
        OR: [
          { title: { contains: chapterName, mode: "insensitive" } },
          { title: { contains: cleanChapterName, mode: "insensitive" } },
          { subcategory: { contains: cleanChapterName, mode: "insensitive" } },
        ],
      },
      orderBy: { id: "asc" },
    });

    if (!examSet) {
      examSet = await prisma.examSet.create({
        data: {
          title: `แบบทดสอบ${category}: ${chapterName} (ชุดที่ 1)`,
          category: category,
          subcategory: cleanChapterName || chapterName,
          totalCount: 0,
          isPublic: true,
          status: "COMPLETED",
          createdById: user.id,
        },
      });
    }

    // 4.2 บันทึกข้อสอบเข้าตาราง Question (บันทึกเฉลยลง Database ฝั่ง Server เท่านั้น)
    const questionsToCreate = genResult.questions.map((q, idx) => ({
      examSetId: examSet.id,
      questionText: q.questionText,
      choice1: q.choice1,
      choice2: q.choice2,
      choice3: q.choice3,
      choice4: q.choice4,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      topic: q.topic,
      subtopic: q.subtopic,
      sortOrder: idx + 1,
    }));

    await prisma.question.createMany({
      data: questionsToCreate,
    });

    // อัปเดตยอดรวมข้อสอบใน ExamSet
    await prisma.examSet.update({
      where: { id: examSet.id },
      data: {
        totalCount: { increment: questionsToCreate.length },
      },
    });

    // 5. บันทึกแจ้งเตือน (In-App Notification)
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: "สร้างข้อสอบเข้าคลังสำเร็จ (+25 EXP) 🎉",
        message: `คุณได้สร้างข้อสอบ 5 ข้อในหมวด [${category} • ${chapterName}] เข้าสู่คลังกลางเรียบร้อยแล้ว เพื่อนสมาชิกทุกคนสามารถเข้าฝึกทำได้แล้ววันนี้`,
        type: "COMMUNITY_EXAM",
        link: "/exam/category",
      },
    });

    // 6. อัปเดตโควต้าและมอบรางวัล EXP ให้ผู้ใช้
    const newUsedCount = usedToday + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        aiGenCount: newUsedCount,
        aiGenLastDate: new Date(),
        exp: { increment: 25 },
      },
    });

    // 7. ส่งผลลัพธ์ตอบกลับผู้ใช้ (🔒 ปลอดภัย 100%: ไม่ส่ง correctAnswer หรือ explanation กลับไป!)
    return NextResponse.json({
      success: true,
      message: `สร้างข้อสอบสำเร็จ ${questionsToCreate.length} ข้อ เข้าสู่คลังรวมเรียบร้อยแล้ว`,
      category,
      chapterName,
      questionsCreated: questionsToCreate.length,
      usedToday: newUsedCount,
      remainingToday: Math.max(0, DAILY_QUOTA_LIMIT - newUsedCount),
      maxQuota: DAILY_QUOTA_LIMIT,
      rewardExp: 25,
    });
  } catch (error: any) {
    console.error("Error in POST /api/exam/community-generate:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาดในการประมวลผล" },
      { status: 500 }
    );
  }
}
