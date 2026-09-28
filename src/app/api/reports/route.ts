import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditReportedQuestion } from "@/lib/aiExamAuditor";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { questionId, questionText, reason, email } = await req.json();

    if (!questionId || !questionText || !reason) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ครบถ้วน (questionId, questionText, reason)" },
        { status: 400 }
      );
    }

    // Find user if email provided
    let userId: number | null = null;
    if (email) {
      const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
      });
      if (user) userId = user.id;
    }

    // Default to first user or fallback if anonymous
    if (!userId) {
      const firstUser = await prisma.user.findFirst({ select: { id: true } });
      userId = firstUser?.id || 1;
    }

    // 1. Create Report in Database
    const report = await prisma.reportedQuestion.create({
      data: {
        userId,
        questionId: String(questionId),
        questionText: String(questionText),
        reason: String(reason).trim(),
        status: "PENDING",
      },
    });

    // 2. Trigger Autonomous AI Audit & Knowledge Engine
    let auditOutcome: any = null;
    try {
      auditOutcome = await auditReportedQuestion(report.id);
    } catch (aiErr: any) {
      console.error("[Reports API] AI Audit Error:", aiErr.message);
    }

    // Fetch updated report status after AI processing
    const updatedReport = await prisma.reportedQuestion.findUnique({
      where: { id: report.id },
    });

    return NextResponse.json({
      success: true,
      report: updatedReport,
      aiOutcome: auditOutcome,
      autoResolved: updatedReport?.autoResolved || false,
      message:
        updatedReport?.status === "RESOLVED"
          ? "ทีมงานวิชาการได้ตรวจสอบและแก้ไขเฉลยในระบบให้ถูกต้องเรียบร้อยแล้วครับ ขอบคุณที่ร่วมพัฒนาคลังข้อสอบครับ"
          : updatedReport?.status === "REJECTED"
          ? "ทีมงานวิชาการได้ร่วมตรวจสอบข้อสอบข้อนี้แล้วครับ ขอขอบคุณที่ร่วมส่งข้อเสนอแนะเข้ามาครับ"
          : "บันทึกรายงานเรียบร้อยแล้ว ทีมงานวิชาการกำลังดำเนินการตรวจสอบอย่างละเอียดครับ",
    });
  } catch (error: any) {
    console.error("[Reports API] Error submitting report:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const status = searchParams.get("status");

    const where: any = {};
    if (status) where.status = status;

    const reports = await prisma.reportedQuestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    return NextResponse.json({ success: true, reports });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
