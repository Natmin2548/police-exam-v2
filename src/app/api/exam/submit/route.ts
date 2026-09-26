import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { categoryToScoreField, subjectStringToScoreField } from "@/lib/categoryUtils";
import { getEmailSafe } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email: bodyEmail, subject, setTitle, answers, timeSpentSeconds } = body;

    if (!answers || typeof answers !== "object") {
      return NextResponse.json({ error: "Missing answers" }, { status: 400 });
    }

    const questionIds = Object.keys(answers).map((id) => parseInt(id, 10));
    if (questionIds.length === 0) {
      return NextResponse.json({ error: "No answers provided" }, { status: 400 });
    }

    // ✅ ใช้ token จาก Authorization header ถ้ามี (ป้องกัน spoofing)
    const email = await getEmailSafe(request, bodyEmail);

    // -------------------------------------------------------------------------
    // ดึงข้อสอบพร้อมเฉลย
    // -------------------------------------------------------------------------
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        questionText: true,
        choice1: true,
        choice2: true,
        choice3: true,
        choice4: true,
        correctAnswer: true,
        explanation: true,
        examSet: { select: { category: true, title: true } },
      },
    });

    let correctCount = 0;
    const detailedResults: any[] = [];
    const wrongQuestionIds: number[] = [];

    questions.forEach((q) => {
      const userChoice = answers[q.id];
      const isCorrect = userChoice === q.correctAnswer;
      if (isCorrect) correctCount++;
      else wrongQuestionIds.push(q.id);

      detailedResults.push({
        id: q.id,
        questionText: q.questionText,
        choices: [q.choice1, q.choice2, q.choice3, q.choice4],
        userAnswer: userChoice ?? null,
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation: q.explanation || "ไม่มีคำอธิบายเพิ่มเติมสำหรับข้อนี้",
        category: q.examSet?.category || "",
      });
    });

    const totalQuestions = questions.length;
    const scorePct = Math.round((correctCount / totalQuestions) * 100);
    const passed = scorePct >= 60;

    // -------------------------------------------------------------------------
    // บันทึกผลถ้าล็อกอินอยู่
    // -------------------------------------------------------------------------
    if (email) {
      const dbUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });

      if (dbUser) {
        // 1. บันทึก QuizAttempt
        await prisma.quizAttempt.create({
          data: {
            userId: dbUser.id,
            subject: subject || "แบบทดสอบรายวิชา",
            setTitle: setTitle || `ชุดข้อสอบ ${totalQuestions} ข้อ`,
            scorePct,
            correctCount,
            totalQuestions,
          },
        });

        // 2. อัปเดต score ผู้ใช้ (✅ ใช้ MAX — ไม่ overwrite ถ้าคะแนนใหม่ต่ำกว่าเดิม)
        const subStr = `${subject || ""} ${setTitle || ""}`.toLowerCase();
        const updateData: Record<string, number> = {};

        if (subStr.includes("pretest") || totalQuestions >= 100) {
          // Pretest: คำนวณ score แยกตาม category
          const categoryCounts: Record<string, { correct: number; total: number }> = {};

          detailedResults.forEach((r) => {
            const field = categoryToScoreField(r.category || "");
            if (field) {
              if (!categoryCounts[field]) categoryCounts[field] = { correct: 0, total: 0 };
              categoryCounts[field].total++;
              if (r.isCorrect) categoryCounts[field].correct++;
            }
          });

          Object.entries(categoryCounts).forEach(([field, v]) => {
            if (v.total > 0) {
              updateData[field] = Math.round((v.correct / v.total) * 100);
            }
          });
        } else {
          // Single subject
          const field = subjectStringToScoreField(subStr);
          if (field) updateData[field] = scorePct;
        }

        // ✅ ดึงค่าปัจจุบันก่อน แล้วใช้ MAX เพื่อไม่ให้คะแนนตก
        if (Object.keys(updateData).length > 0) {
          try {
            const currentUser = await prisma.user.findUnique({
              where: { id: dbUser.id },
              select: Object.fromEntries(Object.keys(updateData).map((k) => [k, true])) as any,
            });

            const safeUpdate: Record<string, number> = {};
            for (const [field, newScore] of Object.entries(updateData)) {
              const currentScore = (currentUser as any)?.[field] ?? 0;
              // เก็บค่าที่สูงกว่า (best score)
              safeUpdate[field] = Math.max(currentScore, newScore);
            }

            await prisma.user.update({
              where: { id: dbUser.id },
              data: safeUpdate,
            });
          } catch (err) {
            console.error("Error updating user subject scores:", err);
          }
        }

        // 3. บันทึกข้อที่ตอบผิด (Spaced Repetition)
        for (const wrongId of wrongQuestionIds) {
          try {
            await prisma.incorrectQuestion.upsert({
              where: { userId_questionId: { userId: dbUser.id, questionId: wrongId } },
              create: { userId: dbUser.id, questionId: wrongId, wrongCount: 1, isMastered: false },
              update: { wrongCount: { increment: 1 }, isMastered: false },
            });
          } catch (err) {
            console.error("Error upserting incorrect question:", err);
          }
        }

        // 4. Mark mastered สำหรับข้อที่เคยผิดแต่ตอบถูกแล้ว
        const correctQuestionIds = detailedResults.filter((r) => r.isCorrect).map((r) => r.id);
        if (correctQuestionIds.length > 0) {
          try {
            await prisma.incorrectQuestion.updateMany({
              where: {
                userId: dbUser.id,
                questionId: { in: correctQuestionIds },
                isMastered: false,
              },
              data: { isMastered: true, lastReviewedAt: new Date() },
            });
          } catch (err) {
            console.error("Error updating mastered questions:", err);
          }
        }
      }
    }

    return NextResponse.json({
      scorePct,
      correctCount,
      totalQuestions,
      passed,
      timeSpentSeconds: timeSpentSeconds || 0,
      detailedResults,
    });
  } catch (error: any) {
    console.error("Error evaluating exam:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
