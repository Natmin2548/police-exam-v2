import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    // Find user in PostgreSQL with minimal required fields
    const dbUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        scoreThai: true,
        scoreGeneral: true,
        scoreComputer: true,
        scoreLaw: true,
        scoreSocial: true,
        scoreEnglish: true,
      },
    });

    if (!dbUser) {
      // User not in DB yet, return 0 stats with default initial recommendation
      return NextResponse.json({
        completedSets: 0,
        averageScore: 0,
        maxScore: 0,
        incorrectCount: 0,
        recommendation: {
          badge: "เริ่มต้นครั้งแรก",
          title: "ทดสอบวัดระดับครั้งแรก (Pretest 150 ข้อ)",
          description: "ลองทำข้อสอบเสมือนจริง 1 ชุด เพื่อให้ระบบช่วยวิเคราะห์ว่าคุณเก่งวิชาไหน และต้องเสริมวิชาไหน",
          buttonText: "เริ่มทำข้อสอบชุดแรก",
          actionUrl: "/exam/mock",
        },
        subjects: {
          thai: { count: 0, score: 0 },
          math: { count: 0, score: 0 },
          com: { count: 0, score: 0 },
          law: { count: 0, score: 0 },
          social: { count: 0, score: 0 },
          eng: { count: 0, score: 0 },
        },
      }, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      });
    }

    // Fetch quiz attempts with selective projection using the new index
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: dbUser.id },
      select: {
        subject: true,
        setTitle: true,
        scorePct: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute subject counts from attempts
    let countThai = 0;
    let countGeneral = 0;
    let countCom = 0;
    let countLaw = 0;
    let countSocial = 0;
    let countEng = 0;

    attempts.forEach((a) => {
      const text = `${a.subject || ""} ${a.setTitle || ""}`.toLowerCase();
      if (text.includes("ไทย")) countThai++;
      else if (text.includes("ทั่วไป") || text.includes("คณิต") || text.includes("เหตุผล")) countGeneral++;
      else if (text.includes("คอม") || text.includes("ไอที") || text.includes("เทคโนโลยี")) countCom++;
      else if (text.includes("กฎหมาย") || text.includes("กม")) countLaw++;
      else if (text.includes("สังคม") || text.includes("จริยธรรม")) countSocial++;
      else if (text.includes("อังกฤษ") || text.includes("english")) countEng++;
    });

    const scoreThai = dbUser.scoreThai || 0;
    const scoreGeneral = dbUser.scoreGeneral || 0;
    const scoreCom = dbUser.scoreComputer || 0;
    const scoreLaw = dbUser.scoreLaw || 0;
    const scoreSocial = dbUser.scoreSocial || 0;
    const scoreEng = dbUser.scoreEnglish || 0;

    const scoresList = [scoreThai, scoreGeneral, scoreCom, scoreLaw, scoreSocial, scoreEng];
    const nonZeroScores = scoresList.filter((s) => s > 0);

    const averageScore =
      nonZeroScores.length > 0
        ? Math.round(nonZeroScores.reduce((a, b) => a + b, 0) / nonZeroScores.length)
        : attempts.length > 0
        ? Math.round(attempts.reduce((sum, item) => sum + (item.scorePct || 0), 0) / attempts.length)
        : 0;

    const maxScore = Math.max(
      ...scoresList,
      ...attempts.map((a) => a.scorePct || 0),
      0
    );

    const completedSets = attempts.length > 0 ? attempts.length : nonZeroScores.length;

    // Check incorrect questions count for Spaced Repetition Review
    const incorrectCount = await prisma.incorrectQuestion.count({
      where: {
        userId: dbUser.id,
        isMastered: false,
      },
    });

    // Compute Smart Priority Waterfall Recommendation
    let recommendation = {
      badge: "คำแนะนำวันนี้",
      title: "ฝึกทำข้อสอบสายอำนวยการ",
      description: "ตะลุยโจทย์ย้อนหลังชุดข้อสอบจริง 150 ข้อ จับเวลาจริงเพื่อฝึกสปีดความเร็ว",
      buttonText: "เริ่มทำข้อสอบทันที",
      actionUrl: "/exam/mock",
    };

    if (completedSets === 0 && nonZeroScores.length === 0) {
      // Priority 1: New user (0 completed exams)
      recommendation = {
        badge: "เริ่มต้นครั้งแรก",
        title: "ทดสอบวัดระดับครั้งแรก (Pretest 150 ข้อ)",
        description: "ลองทำข้อสอบเสมือนจริง 1 ชุด เพื่อให้ระบบช่วยวิเคราะห์ว่าคุณเก่งวิชาไหน และต้องเสริมวิชาไหน",
        buttonText: "เริ่มทำข้อสอบชุดแรก",
        actionUrl: "/exam/mock",
      };
    } else if (incorrectCount > 0) {
      // Priority 2: Has incorrect questions to review
      recommendation = {
        badge: `ทบทวนข้อผิดพลาด (${incorrectCount} ข้อ)`,
        title: `ทบทวนข้อสอบที่เคยตอบผิด ${incorrectCount} ข้อ`,
        description: "คุณมีข้อสอบที่เคยตอบผิดค้างอยู่ การแก้ข้อที่เคยผิดคือวิธีที่ช่วยดันคะแนนขึ้นได้ไวที่สุด",
        buttonText: "ฝึกแก้ข้อที่เคยผิด",
        actionUrl: "/exam/review",
      };
    } else {
      // Priority 3: Check for subjects with score < 60%
      const subjectsList = [
        { id: "thai", name: "ภาษาไทย", score: scoreThai },
        { id: "math", name: "ความสามารถทั่วไป", score: scoreGeneral },
        { id: "com", name: "คอมพิวเตอร์", score: scoreCom },
        { id: "law", name: "กฎหมาย", score: scoreLaw },
        { id: "social", name: "สังคม", score: scoreSocial },
        { id: "eng", name: "ภาษาอังกฤษ", score: scoreEng },
      ];

      // Sort by score ascending to find weakest subject
      const lowest = [...subjectsList].sort((a, b) => a.score - b.score)[0];

      if (lowest && lowest.score < 60) {
        recommendation = {
          badge: "เน้นแก้จุดอ่อนด่วน",
          title: `เจาะลึกวิชา${lowest.name}`,
          description: `คะแนนวิชานี้อยู่ที่ ${lowest.score}% ยังไม่ผ่านเกณฑ์ 60% แนะนำให้เน้นตะลุยโจทย์หมวดนี้เพื่อไม่ให้ตกเกณฑ์`,
          buttonText: `เริ่มฝึกวิชา${lowest.name}`,
          actionUrl: `/exam/category/${lowest.id}`,
        };
      } else {
        // Priority 4: All >= 60%
        recommendation = {
          badge: "คะแนนผ่านเกณฑ์แล้ว",
          title: "ฝึกจับเวลาสปีด 3 ชั่วโมงเต็ม",
          description: "คะแนนของคุณอยู่ในเกณฑ์ดีแล้ว ลองฝึกจับเวลา 150 ข้อเพื่อฝึกความเร็วและไต่อันดับท็อปของประเทศ",
          buttonText: "เข้าสอบจับเวลาจริง",
          actionUrl: "/exam/mock",
        };
      }
    }

    return NextResponse.json({
      completedSets,
      averageScore,
      maxScore,
      incorrectCount,
      recommendation,
      subjects: {
        thai: { count: countThai > 0 ? countThai : scoreThai > 0 ? 1 : 0, score: scoreThai },
        math: { count: countGeneral > 0 ? countGeneral : scoreGeneral > 0 ? 1 : 0, score: scoreGeneral },
        com: { count: countCom > 0 ? countCom : scoreCom > 0 ? 1 : 0, score: scoreCom },
        law: { count: countLaw > 0 ? countLaw : scoreLaw > 0 ? 1 : 0, score: scoreLaw },
        social: { count: countSocial > 0 ? countSocial : scoreSocial > 0 ? 1 : 0, score: scoreSocial },
        eng: { count: countEng > 0 ? countEng : scoreEng > 0 ? 1 : 0, score: scoreEng },
      },
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Error in /api/user/stats:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
