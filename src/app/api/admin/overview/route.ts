import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, role: true },
    });

    if (!dbUser || dbUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const [
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      premiumUsers,
      totalQuestions,
      totalExamSets,
      totalAttempts,
      attemptsToday,
      reportedCount,
      recentReports,
      supportTicketCount,
      recentTickets,
      avgScoreRaw,
      heartbeats,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.user.count({ where: { premiumUntil: { gte: new Date() } } }),
      prisma.question.count(),
      prisma.examSet.count(),
      prisma.quizAttempt.count(),
      prisma.quizAttempt.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.reportedQuestion.count(),
      prisma.reportedQuestion.findMany({
        take: 50,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: { user: { select: { id: true, email: true, fullName: true } } },
      }),
      prisma.supportTicket.count({ where: { status: "PENDING" } }),
      prisma.supportTicket.findMany({
        take: 50,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: { user: { select: { id: true, email: true, fullName: true } } },
      }),
      prisma.quizAttempt.aggregate({ _avg: { scorePct: true } }),
      prisma.systemSetting.findMany({ where: { key: { startsWith: "hb_" } } }),
    ]);

    // Attach Question details (choices, answer, explanation) for each report
    const qIds = recentReports
      .map((r) => parseInt(r.questionId, 10))
      .filter((id) => !isNaN(id));

    const questions = await prisma.question.findMany({
      where: { id: { in: qIds } },
      select: {
        id: true,
        examSetId: true,
        choice1: true,
        choice2: true,
        choice3: true,
        choice4: true,
        correctAnswer: true,
        explanation: true,
        topic: true,
      },
    });

    const qMap = new Map(questions.map((q) => [q.id, q]));
    const reportsWithQuestion = recentReports.map((r) => {
      const qId = parseInt(r.questionId, 10);
      return {
        ...r,
        question: !isNaN(qId) ? qMap.get(qId) || null : null,
      };
    });

    const onlineUsers = heartbeats.filter((r) => r.value >= fiveMinutesAgo).length;

    return NextResponse.json({
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      premiumUsers,
      totalQuestions,
      totalExamSets,
      totalAttempts,
      attemptsToday,
      avgScore: Math.round(avgScoreRaw._avg.scorePct ?? 0),
      onlineUsers,
      reportedCount,
      recentReports: reportsWithQuestion,
      supportTicketCount,
      recentTickets,
    });
  } catch (error: any) {
    console.error("Error in admin overview:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

