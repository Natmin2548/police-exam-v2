import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, role } = body;

    return NextResponse.json({
      success: true,
      user: {
        id: 1,
        username: username || "min",
        fullName: "คุณมีน (แอดมิน)",
        role: role === "ADMIN" ? "ADMIN" : "USER",
        email: "nni893399@gmail.com",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
