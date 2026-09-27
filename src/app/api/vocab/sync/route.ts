import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmailSafe } from "@/lib/supabaseServer";
import { trackMissionProgress } from "@/lib/missionService";

export const dynamic = "force-dynamic";

/**
 * GET /api/vocab/sync
 * ดึงสถานะคำศัพท์ทั้งหมดของผู้ใช้ (Bookmarks, Mastered)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const emailParam = searchParams.get("email");
    const email = await getEmailSafe(request, emailParam || undefined);

    if (!email) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in to sync vocabulary" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const records = await prisma.userVocabProgress.findMany({
      where: { userId: user.id },
      select: {
        word: true,
        level: true,
        isBookmarked: true,
        isMastered: true,
        wrongCount: true,
        updatedAt: true,
      },
    });

    const bookmarkedWords: string[] = [];
    const masteredWords: string[] = [];

    records.forEach((r) => {
      if (r.isBookmarked) bookmarkedWords.push(r.word);
      if (r.isMastered) masteredWords.push(r.word);
    });

    return NextResponse.json({
      success: true,
      bookmarkedWords,
      masteredWords,
      totalCount: records.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching vocab sync:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/vocab/sync
 * อัปเดตหรือซิงค์ข้อมูลคำศัพท์แบบ 2-way merge
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email: bodyEmail, mode = "merge", word, type, value, level = "ALL", localBookmarks = [], localMastered = [] } = body;

    const email = await getEmailSafe(request, bodyEmail);
    if (!email) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in to sync vocabulary" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = user.id;

    // -------------------------------------------------------------------------
    // Mode 1: Toggle single word (รวดเร็ว เหมาะกับการคลิกบน UI)
    // -------------------------------------------------------------------------
    if (mode === "toggle" && word && type) {
      const isBookmark = type === "bookmark";
      const isMastered = type === "mastered";

      const existing = await prisma.userVocabProgress.findUnique({
        where: { userId_word: { userId, word } },
      });

      const nextVal = typeof value === "boolean" ? value : isBookmark ? !existing?.isBookmarked : !existing?.isMastered;

      const record = await prisma.userVocabProgress.upsert({
        where: { userId_word: { userId, word } },
        create: {
          userId,
          word,
          level,
          isBookmarked: isBookmark ? nextVal : false,
          isMastered: isMastered ? nextVal : false,
          lastReviewedAt: new Date(),
        },
        update: {
          ...(isBookmark ? { isBookmarked: nextVal } : {}),
          ...(isMastered ? { isMastered: nextVal } : {}),
          level: level !== "ALL" ? level : existing?.level || "ALL",
          lastReviewedAt: new Date(),
        },
      });

      if (isMastered && nextVal) {
        trackMissionProgress(userId, "VOCAB_MASTERY", 1).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        word: record.word,
        isBookmarked: record.isBookmarked,
        isMastered: record.isMastered,
      });
    }

    // -------------------------------------------------------------------------
    // Mode 2: Two-Way Union Merge (ผสานข้อมูล LocalStorage กับ Cloud)
    // -------------------------------------------------------------------------
    if (mode === "merge") {
      // ดึงข้อมูลเดิมบน Cloud
      const cloudRecords = await prisma.userVocabProgress.findMany({
        where: { userId },
      });

      const cloudMap = new Map(cloudRecords.map((r) => [r.word, r]));

      // รวม Bookmarks (Union: cloud + local)
      const mergedBookmarks = new Set<string>();
      cloudRecords.filter((r) => r.isBookmarked).forEach((r) => mergedBookmarks.add(r.word));
      if (Array.isArray(localBookmarks)) {
        localBookmarks.forEach((w: string) => mergedBookmarks.add(w));
      }

      // รวม Mastered (Union: cloud + local)
      const mergedMastered = new Set<string>();
      cloudRecords.filter((r) => r.isMastered).forEach((r) => mergedMastered.add(r.word));
      if (Array.isArray(localMastered)) {
        localMastered.forEach((w: string) => mergedMastered.add(w));
      }

      // หาคำทั้งหมดที่ต้องบันทึกหรืออัปเดตลง Cloud
      const allWords = new Set<string>([...mergedBookmarks, ...mergedMastered]);

      const upsertOperations: any[] = [];
      allWords.forEach((targetWord) => {
        const cloudItem = cloudMap.get(targetWord);
        const shouldBeBookmark = mergedBookmarks.has(targetWord);
        const shouldBeMastered = mergedMastered.has(targetWord);

        // ถ้าไม่มีใน Cloud หรือสถานะเปลี่ยน
        if (!cloudItem || cloudItem.isBookmarked !== shouldBeBookmark || cloudItem.isMastered !== shouldBeMastered) {
          upsertOperations.push(
            prisma.userVocabProgress.upsert({
              where: { userId_word: { userId, word: targetWord } },
              create: {
                userId,
                word: targetWord,
                level,
                isBookmarked: shouldBeBookmark,
                isMastered: shouldBeMastered,
                lastReviewedAt: new Date(),
              },
              update: {
                isBookmarked: shouldBeBookmark,
                isMastered: shouldBeMastered,
                lastReviewedAt: new Date(),
              },
            })
          );
        }
      });

      // ดำเนินการ batch transaction ครั้งเดียว
      if (upsertOperations.length > 0) {
        await prisma.$transaction(upsertOperations);
      }

      return NextResponse.json({
        success: true,
        bookmarkedWords: Array.from(mergedBookmarks),
        masteredWords: Array.from(mergedMastered),
        syncedCount: upsertOperations.length,
        syncedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: "Invalid sync mode" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in vocab sync POST:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
