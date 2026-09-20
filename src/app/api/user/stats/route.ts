import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    // Find user in PostgreSQL
    const dbUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
    });

    if (!dbUser) {
      // User not in DB yet, return 0 stats
      return NextResponse.json({
        completedSets: 0,
        averageScore: 0,
        maxScore: 0,
        subjects: {
          thai: { count: 0, score: 0 },
          math: { count: 0, score: 0 },
          com: { count: 0, score: 0 },
          law: { count: 0, score: 0 },
          social: { count: 0, score: 0 },
          eng: { count: 0, score: 0 },
        },
      });
    }

    // Fetch quiz attempts if any
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: dbUser.id },
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

    return NextResponse.json({
      completedSets,
      averageScore,
      maxScore,
      subjects: {
        thai: { count: countThai > 0 ? countThai : scoreThai > 0 ? 1 : 0, score: scoreThai },
        math: { count: countGeneral > 0 ? countGeneral : scoreGeneral > 0 ? 1 : 0, score: scoreGeneral },
        com: { count: countCom > 0 ? countCom : scoreCom > 0 ? 1 : 0, score: scoreCom },
        law: { count: countLaw > 0 ? countLaw : scoreLaw > 0 ? 1 : 0, score: scoreLaw },
        social: { count: countSocial > 0 ? countSocial : scoreSocial > 0 ? 1 : 0, score: scoreSocial },
        eng: { count: countEng > 0 ? countEng : scoreEng > 0 ? 1 : 0, score: scoreEng },
      },
    });
  } catch (error: any) {
    console.error("Error in /api/user/stats:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
