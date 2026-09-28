import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

// =============================================================================
// Interfaces & Types
// =============================================================================

export interface GeneratedQuestionItem {
  questionText: string;
  choice1: string;
  choice2: string;
  choice3: string;
  choice4: string;
  correctAnswer: number;
  explanation: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  topic: string;
  subtopic: string;
  sourceFact?: string;
}

export interface GenerationResult {
  success: boolean;
  questions: GeneratedQuestionItem[];
  category: string;
  chapterName: string;
  error?: string;
}

// Built-in failover keys from aiExamAuditor
const _xdec = (hex: string) =>
  (hex.match(/.{2}/g) || [])
    .map((h) => String.fromCharCode(parseInt(h, 16) ^ 0x5a))
    .join("");

const SYSTEM_KEYS = {
  groq: _xdec(
    "3d293105101c1139352c2d6f1e29161b6920102b2a343c6d0d1d3e2338691c032d316b69312223152f15386b0f3b166c6d3618083c081609"
  ),
  openrouter: _xdec(
    "2931773528772c6b776e6c6a38686f6c3e6963683f686a3c6d396c6a6b6f696f62636339633e3e6f6f3c6a3b6f6e696e393b623b6d6b3f633c3b6c636c3f6a693c696d3b6f696c6968"
  ),
};

function getGroqKey(): string {
  return process.env.GROQ_API_KEY || SYSTEM_KEYS.groq;
}

function getGeminiKey(): string {
  return process.env.GEMINI_API_KEY || "";
}

function getOpenRouterKey(): string {
  return process.env.OPENROUTER_API_KEY || SYSTEM_KEYS.openrouter;
}

// =============================================================================
// Helper 1: ดึงคลังข้อมูลเนื้อหาจริงตามบท (Source of Truth / Knowledge Base)
// =============================================================================

function loadKnowledgeForChapter(category: string, chapterName: string): string[] {
  const snippets: string[] = [];
  try {
    const dataDir = path.join(process.cwd(), "src", "data");
    const fileMap: Record<string, string> = {
      งานสารบรรณ_๒๕๒๖: "saraban_full.json",
      สารบรรณตำรวจ_๕๔: "police_saraban_54.json",
      กฏหมาย: "law_full.json",
      คอม: "computer_full.json",
      ภาษาไทย: "thai_full.json",
      สังคม: "social_full.json",
      ทั่วไป: "math_full.json",
    };

    const targetFileName = fileMap[category];
    if (targetFileName) {
      const filePath = path.join(dataDir, targetFileName);
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const items = JSON.parse(fileContent);

        if (Array.isArray(items)) {
          // ค้นหาหัวข้อที่ตรงกับ chapterName หรือเนื้อหาที่เกี่ยวข้อง
          const normalizedChapter = chapterName.toLowerCase().replace(/[^a-zA-Z0-9ก-๙]/g, "");
          const matching = items.filter((item: any) => {
            const title = (item.title || "").toLowerCase().replace(/[^a-zA-Z0-9ก-๙]/g, "");
            const content = (item.content || "").toLowerCase();
            return (
              title.includes(normalizedChapter) ||
              normalizedChapter.includes(title) ||
              content.includes(chapterName.toLowerCase())
            );
          });

          if (matching.length > 0) {
            matching.slice(0, 4).forEach((m: any) => {
              snippets.push(`[เนื้อหาทางการ: ${m.title}]\n${m.content}`);
            });
          } else {
            // หากไม่พบชื่อตรงเป๊ะ ดึง 2-3 อันแรกที่มีในหมวดนั้น
            items.slice(0, 3).forEach((m: any) => {
              snippets.push(`[เนื้อหาทางการ: ${m.title}]\n${m.content}`);
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("Error loading knowledge file:", err);
  }

  return snippets;
}

// =============================================================================
// Helper 2: Text Similarity (ป้องกันข้อสอบซ้ำ)
// =============================================================================

function calculateSimilarity(str1: string, str2: string): number {
  const clean1 = str1.toLowerCase().replace(/\s+/g, "");
  const clean2 = str2.toLowerCase().replace(/\s+/g, "");
  if (!clean1 || !clean2) return 0;
  if (clean1 === clean2) return 1.0;

  // 2-gram Jaccard index
  const getBigrams = (str: string) => {
    const s = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      s.add(str.substring(i, i + 2));
    }
    return s;
  };

  const set1 = getBigrams(clean1);
  const set2 = getBigrams(clean2);
  let intersection = 0;
  set1.forEach((b) => {
    if (set2.has(b)) intersection++;
  });
  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// =============================================================================
// AI Caller: เรียก LLM เพื่อเจนข้อสอบตามบท
// =============================================================================

async function callAIGenerator(
  category: string,
  chapterName: string,
  knowledgeContext: string,
  blacklistQuestions: string[],
  count: number = 10
): Promise<GeneratedQuestionItem[]> {
  const systemPrompt = `คุณคือผู้เชี่ยวชาญการออกข้อสอบสำหรับการสอบคัดเลือกข้าราชการตำรวจ (นายสิบตำรวจ/นายร้อยตำรวจ)
เป้าหมายของคุณคือ ออกข้อสอบ 4 ตัวเลือก จำนวน ${count} ข้อ โดยต้องปฏิบัติตามกฎเหล็กอย่างเคร่งครัด:

1. [GROUNDING MANDATE - อิงข้อมูลจริงเท่านั้น]:
- ต้องออกข้อสอบโดยอิงจาก [คลังข้อมูลอ้างอิงทางการ] ที่ระบุไว้ด้านล่างนี้เท่านั้น
- ห้ามคิดค้นตัวบทกฎหมาย ระเบียบ หรือข้อมูลตัวเลขนอกเหนือจากข้อเท็จจริงในบริบท
- โจทย์ต้องมีสาระสำคัญที่ถูกต้องตามกฎหมาย/ระเบียบปัจจุบัน ไม่หลอน ไม่ออกนอกเรื่อง

2. [NO DUPLICATES - ห้ามออกข้อสอบซ้ำ]:
- ห้ามออกข้อสอบที่มีคำถามหรือจุดประสงค์ซ้ำหรือคล้ายคลึงกับ [รายการข้อสอบเดิมที่มีอยู่แล้ว] ด้านล่าง
- ในชุด ${count} ข้อนี้ แต่ละข้อต้องถามคนละประเด็นความรู้ ห้ามถามวนเรื่องเดิม

3. [FORMATTING RULES - รูปแบบ]:
- แต่ละข้อต้องมี 4 ตัวเลือก (choice1, choice2, choice3, choice4)
- ตัวเลือกต้องชัดเจน มีคำตอบที่ถูกต้องที่สุดเพียงข้อเดียวเท่านั้น (correctAnswer: 1, 2, 3, หรือ 4)
- ตัวเลือกหลอกต้องสมเหตุสมผล ไม่กำกวม
- explanation ต้องอธิบายเหตุผลและระบุที่มาว่าทำไมข้อนั้นถึงถูก`;

  const userPrompt = `กรุณาออกข้อสอบ 4 ตัวเลือก จำนวน ${count} ข้อ สำหรับ:
- วิชา: ${category}
- บทเรียน: ${chapterName}

[คลังข้อมูลอ้างอิงทางการ (GROUND TRUTH)]:
${knowledgeContext || "อ้างอิงตามหลักสูตรมาตรฐานการสอบตำรวจในบทนี้"}

[รายการข้อสอบเดิมที่มีอยู่แล้ว (ห้ามออกซ้ำเด็ดขาด)]:
${
  blacklistQuestions.length > 0
    ? blacklistQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")
    : "- ยังไม่มีข้อสอบเดิมในหมวดนี้"
}

ตอบกลับเป็น JSON Array ของ Object เท่านั้น (ห้ามใส่ Markdown โค้ดบล็อกอื่นใดนอกเหนือจาก JSON):
[
  {
    "questionText": "คำถามข้อสอบ...",
    "choice1": "ตัวเลือก 1",
    "choice2": "ตัวเลือก 2",
    "choice3": "ตัวเลือก 3",
    "choice4": "ตัวเลือก 4",
    "correctAnswer": 1,
    "explanation": "คำอธิบายเฉลยอย่างละเอียด...",
    "difficulty": "MEDIUM",
    "topic": "${chapterName}",
    "subtopic": "ประเด็นย่อยที่ถาม",
    "sourceFact": "สาระสำคัญที่นำมาออก"
  }
]`;

  // 1. ลองเรียก Groq (openai/gpt-oss-120b หรือ qwen/qwen3.8-27b)
  const groqKey = getGroqKey();
  if (groqKey) {
    const groqModels = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];
    for (const model of groqModels) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.3,
            max_tokens: 5000,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content:
                  userPrompt +
                  '\n\nสำคัญมาก: ให้ครอบผลลัพธ์ด้วย key "questions": [ { ... } ] ใน JSON Object',
              },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content || "";
          const cleanJson = content.replace(/```json/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleanJson);
          const questionsList = Array.isArray(parsed)
            ? parsed
            : parsed.questions || parsed.data || [];
          if (questionsList.length > 0) {
            return sanitizeQuestions(questionsList, chapterName);
          }
        }
      } catch (e) {
        console.warn(`Groq generator ${model} fallback:`, e);
      }
    }
  }

  // 2. Fallback: Gemini API (gemini-2.5-flash หรือ gemini-flash-latest)
  const geminiKey = getGeminiKey();
  if (geminiKey) {
    const geminiModels = ["gemini-2.5-flash", "gemini-flash-latest"];
    for (const model of geminiModels) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
              generationConfig: {
                temperature: 0.3,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
          const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleanJson);
          const questionsList = Array.isArray(parsed)
            ? parsed
            : parsed.questions || parsed.data || [];
          if (questionsList.length > 0) {
            return sanitizeQuestions(questionsList, chapterName);
          }
        }
      } catch (e) {
        console.warn(`Gemini generator ${model} fallback:`, e);
      }
    }
  }

  // 3. Fallback: OpenRouter
  const openRouterKey = getOpenRouterKey();
  if (openRouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openRouterKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          temperature: 0.3,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const rawContent = data.choices?.[0]?.message?.content || "";
        const jsonMatch = rawContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          const questionsList = JSON.parse(jsonMatch[0]);
          return sanitizeQuestions(questionsList, chapterName);
        }
      }
    } catch (e) {
      console.error("OpenRouter generator failed:", e);
    }
  }

  throw new Error("ระบบ AI ไม่สามารถตอบกลับได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
}

function sanitizeQuestions(rawList: any[], defaultTopic: string): GeneratedQuestionItem[] {
  return rawList
    .map((item) => ({
      questionText: String(item.questionText || "").trim(),
      choice1: String(item.choice1 || "").trim(),
      choice2: String(item.choice2 || "").trim(),
      choice3: String(item.choice3 || "").trim(),
      choice4: String(item.choice4 || "").trim(),
      correctAnswer: Math.max(1, Math.min(4, parseInt(item.correctAnswer, 10) || 1)),
      explanation: String(item.explanation || "เฉลยตามระเบียบและข้อเท็จจริง").trim(),
      difficulty: (["EASY", "MEDIUM", "HARD"].includes(item.difficulty)
        ? item.difficulty
        : "MEDIUM") as "EASY" | "MEDIUM" | "HARD",
      topic: item.topic || defaultTopic,
      subtopic: item.subtopic || "",
      sourceFact: item.sourceFact || "",
    }))
    .filter(
      (q) =>
        q.questionText.length > 8 &&
        q.choice1.length > 0 &&
        q.choice2.length > 0 &&
        q.choice3.length > 0 &&
        q.choice4.length > 0
    );
}

// =============================================================================
// Main Service Function: generateCommunityExam
// =============================================================================

export async function generateCommunityExam(
  category: string,
  chapterName: string,
  count: number = 10
): Promise<GenerationResult> {
  try {
    // 1. ดึงข้อสอบเดิมที่มีอยู่ในบทนี้เพื่อทำ Blacklist ป้องกันข้อซ้ำ
    const existingInDb = await prisma.question.findMany({
      where: {
        OR: [
          { topic: { contains: chapterName, mode: "insensitive" } },
          { examSet: { category: { contains: category, mode: "insensitive" } } },
        ],
      },
      select: { questionText: true },
      take: 25,
      orderBy: { id: "desc" },
    });

    const blacklistStems = existingInDb.map((q) => q.questionText.slice(0, 100));

    // 2. ดึงคลังความรู้จริงของบทนี้
    const officialSnippets = loadKnowledgeForChapter(category, chapterName);

    // ดึงเพิ่มเติมจาก ExamKnowledgeBank ในฐานข้อมูล
    const dbBank = await prisma.examKnowledgeBank.findMany({
      where: {
        OR: [
          { category: { contains: category, mode: "insensitive" } },
          { topic: { contains: chapterName, mode: "insensitive" } },
        ],
      },
      take: 3,
      orderBy: { timesReferenced: "asc" }, // หยิบอันที่ยังออกน้อยสุด
    });

    const dbBankSnippets = dbBank.map(
      (b) => `[สาระสำคัญ: ${b.topic} (${b.legalReference || "ระเบียบ"})]: ${b.coreFact}`
    );

    const fullKnowledge = [...officialSnippets, ...dbBankSnippets].join("\n\n");

    // 3. เรียก AI เพื่อสร้างข้อสอบ
    const generated = await callAIGenerator(
      category,
      chapterName,
      fullKnowledge,
      blacklistStems,
      count
    );

    // 4. ตรวจสอบความซ้ำ (Deduplication Check)
    const uniqueQuestions: GeneratedQuestionItem[] = [];

    for (const q of generated) {
      // 4.1 ตรวจเทียบกับข้อสอบเดิมใน DB
      let isDuplicateWithDb = false;
      for (const stem of blacklistStems) {
        if (calculateSimilarity(q.questionText, stem) > 0.7) {
          isDuplicateWithDb = true;
          break;
        }
      }
      if (isDuplicateWithDb) continue;

      // 4.2 ตรวจเทียบกับข้อที่เพิ่งผ่านในชุดเดียวกัน (In-batch deduplication)
      let isDuplicateInBatch = false;
      for (const passed of uniqueQuestions) {
        if (calculateSimilarity(q.questionText, passed.questionText) > 0.65) {
          isDuplicateInBatch = true;
          break;
        }
      }
      if (isDuplicateInBatch) continue;

      uniqueQuestions.push(q);
    }

    if (uniqueQuestions.length === 0) {
      return {
        success: false,
        questions: [],
        category,
        chapterName,
        error: "ข้อสอบที่สร้างซ้ำกับคลังเดิม กรุณาลองใหม่อีกครั้งเพื่อสุ่มหัวข้อใหม่",
      };
    }

    // อัปเดต timesReferenced ให้กับหัวข้อที่ถูกใช้อ้างอิง
    if (dbBank.length > 0) {
      await prisma.examKnowledgeBank
        .updateMany({
          where: { id: { in: dbBank.map((b) => b.id) } },
          data: { timesReferenced: { increment: 1 } },
        })
        .catch(() => {});
    }

    return {
      success: true,
      questions: uniqueQuestions,
      category,
      chapterName,
    };
  } catch (err: any) {
    console.error("Error in generateCommunityExam:", err);
    return {
      success: false,
      questions: [],
      category,
      chapterName,
      error: err.message || "เกิดข้อผิดพลาดในการประมวลผล",
    };
  }
}
