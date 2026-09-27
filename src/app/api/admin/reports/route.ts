import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditReportedQuestion } from "@/lib/aiExamAuditor";

export const dynamic = "force-dynamic";

async function verifyAdmin(email: string | null) {
  if (!email) return false;
  const adminUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, role: true, fullName: true, email: true },
  });
  return adminUser?.role === "ADMIN" ? adminUser : false;
}

// GET /api/admin/reports -> List reports with AI insights & knowledge bank stats
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    const admin = await verifyAdmin(email);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const [reports, totalCount, autoResolvedCount, knowledgeCount] = await Promise.all([
      prisma.reportedQuestion.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
      }),
      prisma.reportedQuestion.count(),
      prisma.reportedQuestion.count({ where: { autoResolved: true } }),
      prisma.examKnowledgeBank.count(),
    ]);

    return NextResponse.json({
      success: true,
      reports,
      stats: {
        total: totalCount,
        autoResolved: autoResolvedCount,
        knowledgeItems: knowledgeCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/reports -> Trigger AI Re-audit or 1-Click Rollback
export async function POST(req: NextRequest) {
  try {
    const { action, reportId, email } = await req.json();

    const admin = await verifyAdmin(email);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const report = await prisma.reportedQuestion.findUnique({
      where: { id: Number(reportId) },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // 1. Action: AI Re-audit
    if (action === "re_audit_ai") {
      const result = await auditReportedQuestion(report.id);
      const updatedReport = await prisma.reportedQuestion.findUnique({
        where: { id: report.id },
      });
      return NextResponse.json({ success: true, result, report: updatedReport });
    }

    // 2. Action: 1-Click Rollback
    if (action === "rollback") {
      if (!report.previousData) {
        return NextResponse.json(
          { error: "ไม่มีข้อมูลสำรองเดิมสำหรับการย้อนคืน" },
          { status: 400 }
        );
      }

      const prev = report.previousData as any;
      const qId = parseInt(report.questionId, 10);

      if (!isNaN(qId)) {
        await prisma.question.update({
          where: { id: qId },
          data: {
            questionText: prev.questionText,
            choice1: prev.choice1,
            choice2: prev.choice2,
            choice3: prev.choice3,
            choice4: prev.choice4,
            correctAnswer: prev.correctAnswer,
            explanation: prev.explanation,
          },
        });
      }

      const updatedReport = await prisma.reportedQuestion.update({
        where: { id: report.id },
        data: {
          status: "PENDING",
          autoResolved: false,
          adminReply: `[ย้อนคืนข้อมูลเดิมโดยแอดมิน ${admin.fullName || admin.email}]`,
          resolvedAt: null,
          resolvedBy: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: "ย้อนคืนข้อมูลข้อสอบเป็นฉบับเดิมเรียบร้อยแล้ว",
        report: updatedReport,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/reports -> Update report manually
export async function PATCH(req: NextRequest) {
  try {
    const { reportId, status, adminReply, email } = await req.json();

    if (!reportId || !email) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const admin = await verifyAdmin(email);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const report = await prisma.reportedQuestion.findUnique({
      where: { id: Number(reportId) },
      include: { user: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const now = new Date();
    const updatedStatus = status || (adminReply ? "RESOLVED" : report.status);

    const updatedReport = await prisma.reportedQuestion.update({
      where: { id: Number(reportId) },
      data: {
        status: updatedStatus,
        adminReply: adminReply !== undefined ? adminReply : report.adminReply,
        resolvedAt: updatedStatus === "RESOLVED" ? now : null,
        resolvedBy: updatedStatus === "RESOLVED" ? admin.fullName || admin.email : null,
      },
    });

    // Notify user if report is resolved
    if (updatedStatus === "RESOLVED" && report.userId) {
      const replyText = adminReply?.trim()
        ? `รายละเอียดการแก้ไข: "${adminReply.trim()}"`
        : "ทีมงานวิชาการและระบบ AI ได้ตรวจสอบและแก้ไขความถูกต้องของข้อสอบในคลังเรียบร้อยแล้ว ขอบคุณที่ช่วยแจ้งข้อผิดพลาดครับ!";

      await prisma.notification.create({
        data: {
          userId: report.userId,
          title: `ข้อสอบที่คุณแจ้ง (#${report.questionId}) ได้รับการแก้ไขแล้ว`,
          message: `${report.questionText.slice(0, 100)}\n\n${replyText}`,
          type: "QUESTION_RESOLVED",
          link: "/archive",
          isRead: false,
        },
      });
    }

    return NextResponse.json({ success: true, report: updatedReport });
  } catch (error: any) {
    console.error("Error updating report:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
