import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const { ticketId, status, adminReply, email } = await req.json();

    if (!ticketId || !email) {
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

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: Number(ticketId) },
      include: { user: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const now = new Date();
    const updatedStatus = status || (adminReply ? "RESOLVED" : ticket.status);

    const updatedTicket = await prisma.supportTicket.update({
      where: { id: Number(ticketId) },
      data: {
        status: updatedStatus,
        adminReply: adminReply !== undefined ? adminReply : ticket.adminReply,
        resolvedAt: updatedStatus === "RESOLVED" ? now : null,
        resolvedBy: updatedStatus === "RESOLVED" ? adminUser.fullName || adminUser.email : null,
      },
    });

    // Notify user if ticket is resolved or replied
    if (updatedStatus === "RESOLVED" && ticket.userId) {
      const replyText = adminReply?.trim()
        ? `คำตอบจากแอดมิน: "${adminReply.trim()}"`
        : "ทีมงานได้ดำเนินการแก้ไขปัญหาให้เรียบร้อยแล้ว ขอบคุณที่แจ้งเรื่องเข้ามาครับ";

      await prisma.notification.create({
        data: {
          userId: ticket.userId,
          title: "แอดมินตอบกลับคำร้องของคุณแล้ว",
          message: `${ticket.message.slice(0, 100)}\n\n${replyText}`,
          type: "SUPPORT_REPLY",
          link: "/home",
          isRead: false,
        },
      });
    }

    return NextResponse.json({ success: true, ticket: updatedTicket });
  } catch (error: any) {
    console.error("Error updating ticket:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
