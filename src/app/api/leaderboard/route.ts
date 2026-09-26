import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// =============================================================================
// Types
// =============================================================================
interface LeaderboardRecord {
  id: string;
  name: string;
  email?: string;
  avatar: string;
  branch: string;
  date: string;
  timeText: string;
  timeSeconds: number;
  score: number;
  total: number;
  rank?: number;
}

// =============================================================================
// Helpers
// =============================================================================
function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours} ชม. ${minutes} นาที`;
  return `${minutes} นาที ${secs} วิ`;
}

function formatThaiDate(d: Date): string {
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = (d.getFullYear() + 543).toString().slice(-2);
  return `${day} ${month} ${year}`;
}

// =============================================================================
// GET /api/leaderboard
// =============================================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email") || "";
    const branchFilter = searchParams.get("branch") || "all";

    // -------------------------------------------------------------------------
    // 1. ดึง attempt จาก DB (เฉพาะ pretest / 100+ ข้อ)
    // -------------------------------------------------------------------------
    const realAttempts = await prisma.quizAttempt.findMany({
      where: {
        OR: [
          { totalQuestions: { gte: 100 } },
          { setTitle: { contains: "150" } },
          { setTitle: { contains: "Pretest" } },
        ],
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, username: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // -------------------------------------------------------------------------
    // 2. Map เป็น LeaderboardRecord
    // -------------------------------------------------------------------------
    const candidates: LeaderboardRecord[] = realAttempts.map((att) => {
      const isSuppression =
        (att.setTitle || "").includes("ปราบปราม") ||
        (att.subject || "").includes("ปราบปราม");
      const u = att.user;
      const name =
        u.fullName && u.fullName.trim().length > 0
          ? u.fullName
          : u.username || u.email.split("@")[0];
      const rawScore =
        att.correctCount > 0
          ? att.correctCount
          : Math.round(((att.scorePct || 0) / 100) * (att.totalQuestions || 150));

      return {
        id: `att_${att.id}`,
        email: u.email,
        name,
        avatar: "",
        branch: isSuppression ? "สายปราบปราม" : "สายอำนวยการ",
        date: formatThaiDate(new Date(att.createdAt)),
        timeText: formatTime(0),
        timeSeconds: 0,
        score: rawScore,
        total: att.totalQuestions || 150,
      };
    });

    // -------------------------------------------------------------------------
    // 3. กรองตาม branch + เรียงลำดับ
    // -------------------------------------------------------------------------
    let filteredCandidates = candidates;
    if (branchFilter === "suppression") {
      filteredCandidates = candidates.filter((c) => c.branch.includes("ปราบปราม"));
    } else if (branchFilter === "admin") {
      filteredCandidates = candidates.filter((c) => c.branch.includes("อำนวยการ"));
    }

    const sorted = [...filteredCandidates].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // ถ้าคะแนนเท่ากัน ใช้เวลาน้อยกว่าอยู่อันดับต้น (0 = ไม่มีข้อมูล ให้ไปท้าย)
      if (a.timeSeconds === 0) return 1;
      if (b.timeSeconds === 0) return -1;
      return a.timeSeconds - b.timeSeconds;
    });

    // ✅ Assign rank จริงๆ (ไม่ hardcode)
    const rankedList = sorted.map((item, idx) => ({ ...item, rank: idx + 1 }));

    // -------------------------------------------------------------------------
    // 4. หา rank ของ user ปัจจุบัน (จาก email)
    // -------------------------------------------------------------------------
    let myRankData = null;

    if (email) {
      // หาใน rankedList ก่อน
      const myEntries = rankedList.filter(
        (item) => item.email?.toLowerCase() === email.toLowerCase()
      );

      if (myEntries.length > 0) {
        // ✅ best attempt ของ user
        const best = myEntries[0];
        myRankData = {
          hasExam: true,
          rank: best.rank,
          totalParticipants: rankedList.length,
          maxScore: best.score,
          totalScore: best.total,
          fastestTime: best.timeText,
          branch: best.branch,
          date: best.date,
        };
      } else {
        // ✅ user มี attempt แต่ไม่อยู่ใน filter — หาจาก candidates ทั้งหมด
        const allMyEntries = candidates.filter(
          (c) => c.email?.toLowerCase() === email.toLowerCase()
        );

        if (allMyEntries.length > 0) {
          const best = allMyEntries.sort((a, b) => b.score - a.score)[0];

          // คำนวณ rank จาก candidates ทั้งหมด (ไม่ filtered)
          const allSorted = [...candidates].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.timeSeconds === 0) return 1;
            if (b.timeSeconds === 0) return -1;
            return a.timeSeconds - b.timeSeconds;
          });
          const myRankIndex = allSorted.findIndex(
            (c) => c.email?.toLowerCase() === email.toLowerCase()
          );

          myRankData = {
            hasExam: true,
            rank: myRankIndex >= 0 ? myRankIndex + 1 : null,
            totalParticipants: allSorted.length,
            maxScore: best.score,
            totalScore: best.total,
            fastestTime: best.timeText,
            branch: best.branch,
            date: best.date,
          };
        }
      }
    }

    if (!myRankData) {
      myRankData = {
        hasExam: false,
        rank: null,
        totalParticipants: rankedList.length,
        maxScore: 0,
        totalScore: 150,
        fastestTime: "-",
        branch: "-",
        date: null,
      };
    }

    return NextResponse.json(
      { myRank: myRankData, leaderboard: rankedList, totalCount: rankedList.length },
      {
        // ✅ Cache 2 นาที — leaderboard ไม่ต้อง realtime มาก
        headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
      }
    );
  } catch (error: any) {
    console.error("Error in /api/leaderboard:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
