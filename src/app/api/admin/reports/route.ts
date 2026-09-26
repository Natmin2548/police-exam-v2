import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const { reportId, status, adminReply, email } = await req.json();

    if (!reportId || !email) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Verify admin
    const adminUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, role: true, fullName: true, email: true },
    });

    if (!adminUser || adminUser.role !== "ADMIN") {
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
        resolvedBy: updatedStatus === "RESOLVED" ? adminUser.fullName || adminUser.email : null,
      },
    });

    // Notify user if report is resolved
    if (updatedStatus === "RESOLVED" && report.userId) {
      const replyText = adminReply?.trim()
        ? `รายละเอียดการแก้ไข: "${adminReply.trim()}"`
        : "ทีมงานวิชาการได้ตรวจสอบและแก้ไขความถูกต้องของข้อสอบในคลังเรียบร้อยแล้ว ขอบคุณที่ช่วยแจ้งข้อผิดพลาดครับ!";

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
