import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// POST: บันทึก heartbeat (เรียกทุก 2-3 นาที)
export async function POST(req: NextRequest) {
  try {
    // ✅ ใช้ token จาก Authorization header ก่อน fallback body
    let email: string | null = null;

    const authUser = await getAuthUser(req);
    if (authUser) {
      email = authUser.email;
    } else {
      // fallback สำหรับ client เก่าที่ยังส่ง body
      const body = await req.json().catch(() => ({}));
      email = body.email || null;
    }

    if (!email) return NextResponse.json({ ok: false }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ ok: false }, { status: 404 });

    const now = new Date().toISOString();

    await prisma.systemSetting.upsert({
      where: { key: `hb_${user.id}` },
      update: { value: now },
      create: { key: `hb_${user.id}`, value: now },
    });

    // ✅ Cleanup: ลบ heartbeat ที่เกิน 30 นาที (inactive users)
    // ทำใน background ไม่ต้อง await เพื่อไม่ให้ช้า
    prisma.systemSetting
      .deleteMany({
        where: {
          key: { startsWith: "hb_" },
          value: { lt: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
        },
      })
      .catch(() => {}); // ไม่ throw ถ้า cleanup fail

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: นับ online users (heartbeat ภายใน 5 นาทีที่แล้ว)
export async function GET() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const records = await prisma.systemSetting.findMany({
      where: { key: { startsWith: "hb_" } },
    });
    const online = records.filter((r) => r.value >= fiveMinutesAgo).length;
    return NextResponse.json(
      { online },
      {
        // ✅ Cache 1 นาที (ตัวเลข online ไม่ต้อง realtime มาก)
        headers: { "Cache-Control": "public, s-maxage=60" },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
