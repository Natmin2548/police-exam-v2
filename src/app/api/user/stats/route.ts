import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    stats: {
      totalExams: 15,
      avgScore: 78,
      maxScore: 92,
      readiness: "พร้อมสอบสูง",
      subjects: [
        { id: "th", name: "ภาษาไทย", times: "12 ครั้ง", pct: 85, icon: "TH", color: "rose" },
        { id: "general", name: "ความสามารถทั่วไป", times: "15 ครั้ง", pct: 76, icon: "🧠", color: "pink" },
        { id: "computer", name: "คอมพิวเตอร์", times: "10 ครั้ง", pct: 88, icon: "💻", color: "sky" },
        { id: "law", name: "กฎหมาย", times: "14 ครั้ง", pct: 72, icon: "⚖️", color: "amber" },
        { id: "social", name: "สังคม", times: "8 ครั้ง", pct: 80, icon: "🌍", color: "emerald" },
        { id: "en", name: "ภาษาอังกฤษ", times: "11 ครั้ง", pct: 69, icon: "EN", color: "amber" },
      ],
      recentAttempts: [],
    },
  });
}
