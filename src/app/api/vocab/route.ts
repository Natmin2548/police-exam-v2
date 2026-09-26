import { NextResponse } from "next/server";
import vocabDataFile from "@/data/oxfordVocabData.json";

export const dynamic = "force-dynamic";

interface VocabWord {
  word: string;
  meaning: string;
}

const VOCAB_DATA: Record<string, VocabWord[]> = vocabDataFile.VOCAB_DATA;
const VOCAB_LEVELS = vocabDataFile.VOCAB_LEVELS;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "list";
    const level = (searchParams.get("level") || "all").toUpperCase();
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const count = parseInt(searchParams.get("count") || "10", 10);

    // 1. Stats Mode: Return counts and metadata
    if (mode === "stats") {
      const stats = Object.entries(VOCAB_LEVELS).map(([key, val]: [string, any]) => ({
        key,
        name: val.name,
        description: val.description,
        color: val.color,
        icon: val.icon,
        count: VOCAB_DATA[key]?.length || 0,
      }));
      const totalWords = Object.values(VOCAB_DATA).reduce(
        (sum, list) => sum + list.length,
        0
      );

      return NextResponse.json({
        totalWords,
        levels: stats,
      });
    }

    // 2. Quiz Mode: Pick N questions with 4 choices
    if (mode === "quiz") {
      let pool: { word: string; meaning: string; level: string }[] = [];
      if (level !== "ALL" && VOCAB_DATA[level]) {
        pool = VOCAB_DATA[level].map((w) => ({ ...w, level }));
      } else {
        Object.entries(VOCAB_DATA).forEach(([lvl, list]) => {
          list.forEach((w) => pool.push({ ...w, level: lvl }));
        });
      }

      if (pool.length === 0) {
        return NextResponse.json({ error: "No words found" }, { status: 400 });
      }

      // Shuffle pool and take `count` words
      const shuffledPool = [...pool].sort(() => 0.5 - Math.random());
      const selected = shuffledPool.slice(0, Math.min(count, pool.length));

      const quizQuestions = selected.map((item) => {
        // Find 3 distractors from the same level or pool
        const candidates = (VOCAB_DATA[item.level] || pool)
          .filter((w) => w.meaning !== item.meaning)
          .map((w) => w.meaning);

        const shuffledCandidates = candidates.sort(() => 0.5 - Math.random());
        const distractors = shuffledCandidates.slice(0, 3);
        const options = [item.meaning, ...distractors].sort(() => 0.5 - Math.random());

        return {
          word: item.word,
          meaning: item.meaning,
          level: item.level,
          options,
        };
      });

      return NextResponse.json({
        questions: quizQuestions,
        total: quizQuestions.length,
        level,
      });
    }

    // 3. List Mode: Paginated & Searchable
    let words: { word: string; meaning: string; level: string }[] = [];

    if (level !== "ALL" && VOCAB_DATA[level]) {
      words = VOCAB_DATA[level].map((w) => ({ ...w, level }));
    } else {
      Object.entries(VOCAB_DATA).forEach(([lvl, list]) => {
        list.forEach((w) => words.push({ ...w, level: lvl }));
      });
    }

    // Filter by search term
    if (search) {
      words = words.filter(
        (w) =>
          w.word.toLowerCase().includes(search) ||
          w.meaning.toLowerCase().includes(search)
      );
    }

    const total = words.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (currentPage - 1) * limit;
    const paginatedWords = words.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      words: paginatedWords,
      total,
      page: currentPage,
      totalPages,
      limit,
      level,
      levels: VOCAB_LEVELS,
    });
  } catch (error: any) {
    console.error("Vocab API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vocabulary", details: error.message },
      { status: 500 }
    );
  }
}
