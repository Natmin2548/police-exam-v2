import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    stats: {
      users: 843,
      examSets: 38,
      questions: 3800,
      attempts: 272,
    },
  });
}
