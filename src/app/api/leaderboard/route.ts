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
  if (hours > 0) {
    return minutes > 0 ? `${hours} ชม. ${minutes} น.` : `${hours} ชม.`;
  }
  if (minutes > 0) {
    return secs > 0 ? `${minutes} น. ${secs} วิ` : `${minutes} นาที`;
  }
  return `${secs} วิ`;
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
          select: { id: true, email: true, fullName: true, username: true, faceImage: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    // -------------------------------------------------------------------------
    // 2. Map เป็น LeaderboardRecord & กรองตาม branch
    // -------------------------------------------------------------------------
    const mappedAttempts: LeaderboardRecord[] = realAttempts.map((att) => {
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
      const durationSeconds = (att as any).timeSpentSeconds || 0;

      return {
        id: `att_${att.id}`,
        email: u.email,
        name,
        avatar: u.faceImage || "",
        branch: isSuppression ? "สายปราบปราม" : "สายอำนวยการ",
        date: formatThaiDate(new Date(att.createdAt)),
        timeText: formatTime(durationSeconds),
        timeSeconds: durationSeconds,
        score: rawScore,
        total: att.totalQuestions || 150,
      };
    });

    // กรองตาม branch ก่อนคำนวณอันดับ
    let filteredList = mappedAttempts;
    if (branchFilter === "suppression") {
      filteredList = mappedAttempts.filter((c) => c.branch.includes("ปราบปราม"));
    } else if (branchFilter === "admin") {
      filteredList = mappedAttempts.filter((c) => c.branch.includes("อำนวยการ"));
    }

    // -------------------------------------------------------------------------
    // 3. รวมคะแนนสูงสุดของแต่ละคน (1 คน = 1 อันดับ ไม่แสดงชื่อซ้ำ)
    // -------------------------------------------------------------------------
    const userBestMap = new Map<string, LeaderboardRecord>();
    for (const record of filteredList) {
      const userKey = (record.email || record.name).toLowerCase();
      const existing = userBestMap.get(userKey);
      if (!existing || record.score > existing.score) {
        userBestMap.set(userKey, record);
      }
    }

    const uniqueCandidates = Array.from(userBestMap.values());

    const sorted = uniqueCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.timeSeconds === 0) return 1;
      if (b.timeSeconds === 0) return -1;
      return a.timeSeconds - b.timeSeconds;
    });

    // ✅ Assign rank จริงๆ (1 คน = 1 อันดับ)
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
        // ✅ user มี attempt แต่ไม่อยู่ใน filter — หาจาก mappedAttempts ทั้งหมด
        const allUserBestMap = new Map<string, LeaderboardRecord>();
        for (const record of mappedAttempts) {
          const userKey = (record.email || record.name).toLowerCase();
          const existing = allUserBestMap.get(userKey);
          if (!existing || record.score > existing.score) {
            allUserBestMap.set(userKey, record);
          }
        }
        const allUnique = Array.from(allUserBestMap.values());

        const myRecord = allUserBestMap.get(email.toLowerCase());

        if (myRecord) {
          // คำนวณ rank จากทั้งหมด (ไม่ filtered)
          const allSorted = allUnique.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.timeSeconds === 0) return 1;
            if (b.timeSeconds === 0) return -1;
            return a.timeSeconds - b.timeSeconds;
          });
          const myRankIndex = allSorted.findIndex(
            (c) => (c.email || c.name).toLowerCase() === email.toLowerCase()
          );

          myRankData = {
            hasExam: true,
            rank: myRankIndex >= 0 ? myRankIndex + 1 : null,
            totalParticipants: allSorted.length,
            maxScore: myRecord.score,
            totalScore: myRecord.total,
            fastestTime: myRecord.timeText,
            branch: myRecord.branch,
            date: myRecord.date,
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
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (error: any) {
    console.error("Error in /api/leaderboard:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
