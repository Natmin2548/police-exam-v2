import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeCategoryQuery } from "@/lib/categoryUtils";
import { getEmailSafe } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// =============================================================================
// Helper: สุ่ม N ข้อจาก array
// =============================================================================
function sampleRandom<T>(items: T[], n: number): T[] {
  const shuffled = [...items].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

// Select fields ที่ใช้ซ้ำ
const questionSelect = {
  id: true,
  questionText: true,
  choice1: true,
  choice2: true,
  choice3: true,
  choice4: true,
  correctAnswer: true,
  explanation: true,
  examSet: {
    select: { category: true, title: true },
  },
} as const;

// =============================================================================
// GET /api/exam/generate
// =============================================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "subject_single";
    const category = searchParams.get("category") || "ภาษาไทย";
    const count = parseInt(searchParams.get("count") || "30", 10);

    let selectedQuestions: any[] = [];

    // -------------------------------------------------------------------------
    // Mode: subject_single — ข้อสอบรายวิชาเดียว
    // -------------------------------------------------------------------------
    if (mode === "subject_single") {
      const catQuery = normalizeCategoryQuery(category);
      const questions = await prisma.question.findMany({
        where: {
          examSet: { category: { contains: catQuery, mode: "insensitive" } },
        },
        select: questionSelect,
      });
      selectedQuestions = sampleRandom(questions, Math.min(count, questions.length));
    }

    // -------------------------------------------------------------------------
    // Mode: pretest — ดึงข้อสอบทุก category ในคราวเดียว แล้ว group ใน memory
    // -------------------------------------------------------------------------
    else if (mode === "pretest_suppression" || mode === "pretest_admin") {
      const distribution =
        mode === "pretest_suppression"
          ? [
              { category: "ทั่วไป",       count: 30 },
              { category: "ภาษาไทย",      count: 25 },
              { category: "ภาษาอังกฤษ",   count: 30 },
              { category: "กฏหมาย",       count: 30 },
              { category: "คอม",           count: 25 },
              { category: "สังคม",         count: 10 },
            ]
          : [
              { category: "ทั่วไป",               count: 20 },
              { category: "ภาษาไทย",              count: 20 },
              { category: "ภาษาอังกฤษ",           count: 15 },
              { category: "คอม",                   count: 40 },
              { category: "งานสารบรรณ_๒๕๒๖",     count: 20 },
              { category: "สารบรรณตำรวจ_๕๔",     count: 10 },
              { category: "กฏหมาย",               count: 25 },
            ];

      const categoryList = distribution.map((d) => d.category);

      // ✅ ดึง DB ครั้งเดียว ด้วย OR condition แทน N queries
      const allQuestions = await prisma.question.findMany({
        where: {
          examSet: {
            OR: categoryList.map((cat) => ({
              category: { contains: cat, mode: "insensitive" as const },
            })),
          },
        },
        select: questionSelect,
      });

      // Group ใน memory
      for (const dist of distribution) {
        const pool = allQuestions.filter((q) =>
          (q.examSet?.category || "")
            .toLowerCase()
            .includes(dist.category.toLowerCase())
        );
        selectedQuestions.push(...sampleRandom(pool, dist.count));
      }
    }

    // -------------------------------------------------------------------------
    // Mode: chapter — จาก ExamSet IDs ที่ระบุ
    // -------------------------------------------------------------------------
    else if (mode === "chapter") {
      const setIdsParam = searchParams.get("setIds");
      const ids = setIdsParam
        ? setIdsParam
            .split(",")
            .map((id) => parseInt(id, 10))
            .filter((n) => !isNaN(n))
        : [];

      if (ids.length > 0) {
        const questions = await prisma.question.findMany({
          where: { examSetId: { in: ids } },
          select: questionSelect,
        });
        const limit = Math.min(count > 0 ? count : 20, 20);
        selectedQuestions = sampleRandom(questions, Math.min(limit, questions.length));
      }
    }

    // -------------------------------------------------------------------------
    // Mode: review_incorrect — ข้อที่เคยตอบผิด (ต้องล็อกอิน)
    // -------------------------------------------------------------------------
    else if (mode === "review_incorrect") {
      // ✅ ใช้ token จาก Authorization header ถ้ามี, fallback query param
      const emailParam = searchParams.get("email");
      const email = await getEmailSafe(request, emailParam || undefined);
      let wrongQuestions: any[] = [];

      if (email) {
        const dbUser = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });

        if (dbUser) {
          const incorrectRecords = await prisma.incorrectQuestion.findMany({
            where: { userId: dbUser.id, isMastered: false },
            include: { question: { select: questionSelect } },
            orderBy: [{ wrongCount: "desc" }, { createdAt: "desc" }],
          });
          wrongQuestions = incorrectRecords.map((rec) => rec.question).filter(Boolean);
        }
      }

      // Fallback ถ้าไม่มี wrong questions
      if (wrongQuestions.length === 0) {
        wrongQuestions = await prisma.question.findMany({
          take: 10,
          select: questionSelect,
        });
      }

      selectedQuestions = wrongQuestions;
    }

    // -------------------------------------------------------------------------
    // Format output
    // -------------------------------------------------------------------------
    const formattedQuestions = selectedQuestions.map((q, idx) => ({
      index: idx + 1,
      id: q.id,
      questionText: q.questionText,
      choices: [q.choice1, q.choice2, q.choice3, q.choice4],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || "ไม่มีคำอธิบายเพิ่มเติมสำหรับข้อนี้",
      category: q.examSet?.category || category,
      title: q.examSet?.title || "",
    }));

    return NextResponse.json(
      { total: formattedQuestions.length, mode, questions: formattedQuestions },
      {
        headers: {
          // ✅ Cache 1 นาทีสำหรับ pretest (ข้อสอบไม่เปลี่ยนบ่อย)
          "Cache-Control":
            mode.startsWith("pretest") || mode === "chapter"
              ? "public, s-maxage=60, stale-while-revalidate=300"
              : "no-store",
        },
      }
    );
  } catch (error: any) {
    console.error("Error generating exam:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
