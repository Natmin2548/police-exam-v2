import { prisma } from "@/lib/prisma";

export interface AIQuestionAuditResult {
  isReportValid: boolean; // มีข้อผิดพลาดจริงหรือไม่
  errorType: "WRONG_ANSWER" | "TYPO" | "AMBIGUOUS" | "OUTDATED_LAW" | "NO_ERROR";
  confidence: number; // 0.00 - 1.00
  legalReference?: string; // มาตราหรือระเบียบอ้างอิง
  coreFact: string; // ข้อเท็จจริงสำคัญเพื่อเก็บเข้าคลังความรู้
  detailedReason: string; // คำชี้แจงเพื่อแจ้งผู้ใช้/แอดมิน
  correctedQuestion?: {
    questionText: string;
    choice1: string;
    choice2: string;
    choice3: string;
    choice4: string;
    correctAnswer: number;
    explanation: string;
  };
}

/**
 * Call Gemini 2.5 Flash to inspect the reported question
 */
async function callGeminiExaminer(
  questionData: any,
  userReason: string,
  knowledgeContext: string[]
): Promise<AIQuestionAuditResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `คุณคือผู้เชี่ยวชาญการตรวจข้อสอบนายสิบตำรวจและกฎหมายตำรวจแห่งชาติ (พ.ร.บ.ตำรวจแห่งชาติ พ.ศ. 2565, ป.อาญา, ป.วิ.อาญา, ก.ตร., ระเบียบสำนักนายกฯ)

[ข้อมูลข้อสอบปัจจุบัน]
หมวดวิชา: ${questionData.category || "ความรู้ตำรวจ"}
โจทย์: ${questionData.questionText}
ตัวเลือก 1: ${questionData.choice1}
ตัวเลือก 2: ${questionData.choice2}
ตัวเลือก 3: ${questionData.choice3}
ตัวเลือก 4: ${questionData.choice4}
เฉลยเดิม: ข้อ ${questionData.correctAnswer}
คำอธิบายเดิม: ${questionData.explanation || "-"}

[ข้อความรายงานจากผู้เข้าสอบ]
"${userReason}"

[คลังความรู้กฎหมายที่เคยบันทึกไว้ในระบบ]
${knowledgeContext.length > 0 ? knowledgeContext.join("\n- ") : "ยังไม่มีข้อมูลเฉพาะในคลัง"}

จงวิเคราะห์อย่างละเอียดว่าข้อสอบนี้มีข้อผิดพลาดตามที่ผู้ใช้แจ้งหรือไม่
*ข้อควรระวัง: ผู้ใช้อาจจำกฎหมายฉบับเก่ามา หรือผู้ใช้ตอบผิดเองแล้วเข้าใจผิดว่าเฉลยผิด ตรวจสอบกับตัวบทกฎหมายปัจจุบัน (เช่น พ.ร.บ.ตำรวจ 2565) ให้ถูกต้องเด็ดขาด*

ตอบกลับเป็น JSON เท่านั้น (ห้ามมีคำนำหรือ markdown code block ครอบ) ตามโครงสร้างนี้:
{
  "isReportValid": true หรือ false,
  "errorType": "WRONG_ANSWER" | "TYPO" | "AMBIGUOUS" | "OUTDATED_LAW" | "NO_ERROR",
  "confidence": ตัวเลข 0.00 ถึง 1.00,
  "legalReference": "มาตรา หรือ ระเบียบที่ใช้อ้างอิง (ถ้ามี)",
  "coreFact": "สาระสำคัญความรู้ที่เป็นข้อยุติสำหรับเก็บเข้าคลังความรู้",
  "detailedReason": "คำอธิบายภาษาไทยสรุปเหตุผลอย่างสุภาพ ชัดเจน",
  "correctedQuestion": {
    "questionText": "โจทย์ที่แก้ไขแล้ว (ถ้าไม่ต้องแก้โจทย์ให้ใช้ของเดิม)",
    "choice1": "ตัวเลือก 1",
    "choice2": "ตัวเลือก 2",
    "choice3": "ตัวเลือก 3",
    "choice4": "ตัวเลือก 4",
    "correctAnswer": ตัวเลข 1-4 ที่ถูกต้อง,
    "explanation": "คำอธิบายเฉลยที่ถูกต้องและอ้างอิงมาตรากฎหมายชัดเจน"
  }
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!res.ok) {
      console.error("[AI Auditor] Gemini API error:", res.status, await res.text());
      return null;
    }

    const json = await res.json();
    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e: any) {
    console.error("[AI Auditor] Gemini parsing failed:", e.message);
    return null;
  }
}

/**
 * Call Grok 4.5 via OpenRouter to act as Independent Auditor (Cross-checking)
 */
async function callGrokAuditor(
  questionData: any,
  userReason: string,
  geminiProposal: AIQuestionAuditResult
): Promise<{ agreesWithGemini: boolean; confidence: number; feedback: string } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const prompt = `คุณคือผู้ตรวจประเมินข้อสอบอิสระ (Independent Exam Auditor)
จงตรวจสอบผลการตรวจข้อสอบของระบบว่าถูกต้องตรงตามกฎหมายและวิชาการหรือไม่

[โจทย์ข้อสอบ]
${questionData.questionText}
1. ${questionData.choice1}
2. ${questionData.choice2}
3. ${questionData.choice3}
4. ${questionData.choice4}
เฉลยเดิม: ข้อ ${questionData.correctAnswer}

[ผู้ใช้ร้องเรียน]
"${userReason}"

[ผลการวินิจฉัยของ Examiner]
มีข้อผิดพลาด: ${geminiProposal.isReportValid ? "จริง" : "ไม่จริง (ข้อสอบเดิมถูกแล้ว)"}
เฉลยใหม่ที่เสนอ: ข้อ ${geminiProposal.correctedQuestion?.correctAnswer || questionData.correctAnswer}
หลักกฎหมายอ้างอิง: ${geminiProposal.legalReference || "-"}
เหตุผล: ${geminiProposal.detailedReason}

คุณเห็นชอบกับการตัดสินนี้หรือไม่?
ตอบกลับเป็น JSON เท่านั้น:
{
  "agreesWithGemini": true หรือ false,
  "confidence": ตัวเลข 0.00 ถึง 1.00,
  "feedback": "ความเห็นสั้นๆ"
}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "x-ai/grok-4.5",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      console.warn("[AI Auditor] Grok API status:", res.status);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const cleanJson = content.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e: any) {
    console.warn("[AI Auditor] Grok check skipped or error:", e.message);
    return null;
  }
}

/**
 * Main Autonomous Audit Runner:
 * 1. Checks Knowledge Bank
 * 2. Runs Dual-AI (Gemini + Grok)
 * 3. Auto-Approves if high confidence
 * 4. Saves learned knowledge to ExamKnowledgeBank
 * 5. Sends instant notification to reporting user
 */
export async function auditReportedQuestion(reportId: number) {
  try {
    const report = await prisma.reportedQuestion.findUnique({
      where: { id: reportId },
      include: { user: true },
    });

    if (!report || report.status !== "PENDING") {
      return { success: false, message: "Report not found or already processed" };
    }

    // Find the original question from Question table
    const questionIdNum = parseInt(report.questionId, 10);
    const question = !isNaN(questionIdNum)
      ? await prisma.question.findUnique({
          where: { id: questionIdNum },
          include: { examSet: true },
        })
      : null;

    if (!question) {
      // If not in database Question table (e.g. from static mock json)
      return { success: false, message: "Question not found in database Question table" };
    }

    // 1. Retrieve relevant memories from ExamKnowledgeBank (RAG)
    const category = question.topic || question.examSet?.category || "กฎหมายตำรวจ";
    const relevantKnowledge = await prisma.examKnowledgeBank.findMany({
      where: { category: { equals: category, mode: "insensitive" } },
      orderBy: { timesReferenced: "desc" },
      take: 5,
    });
    const knowledgeSnippets = relevantKnowledge.map(
      (k) => `[${k.legalReference || k.topic}]: ${k.coreFact}`
    );

    // 2. Call Gemini 2.5 Flash (Primary Examiner)
    const geminiResult = await callGeminiExaminer(question, report.reason, knowledgeSnippets);
    if (!geminiResult) {
      return { success: false, message: "AI Examiner returned no result" };
    }

    // 3. Call Grok 4.5 for verification (Cross-Auditor)
    let grokResult = await callGrokAuditor(question, report.reason, geminiResult);
    const hasConsensus = grokResult ? grokResult.agreesWithGemini : geminiResult.confidence >= 0.90;
    const finalConfidence = Math.min(
      geminiResult.confidence,
      grokResult ? grokResult.confidence : geminiResult.confidence
    );

    // =========================================================================
    // CASE A: HIGH CONFIDENCE ERROR FOUND -> AUTO-APPROVE & AUTO-FIX DATABASE!
    // =========================================================================
    if (geminiResult.isReportValid && hasConsensus && finalConfidence >= 0.85) {
      const corrected = geminiResult.correctedQuestion || {
        questionText: question.questionText,
        choice1: question.choice1,
        choice2: question.choice2,
        choice3: question.choice3,
        choice4: question.choice4,
        correctAnswer: question.correctAnswer,
        explanation: geminiResult.detailedReason,
      };

      // Backup snapshot of original question
      const previousData = {
        questionText: question.questionText,
        choice1: question.choice1,
        choice2: question.choice2,
        choice3: question.choice3,
        choice4: question.choice4,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      };

      // 1. Update Question in DB
      await prisma.question.update({
        where: { id: question.id },
        data: {
          questionText: corrected.questionText,
          choice1: corrected.choice1,
          choice2: corrected.choice2,
          choice3: corrected.choice3,
          choice4: corrected.choice4,
          correctAnswer: corrected.correctAnswer,
          explanation: corrected.explanation || geminiResult.detailedReason,
        },
      });

      // 2. Save / Update Knowledge in ExamKnowledgeBank (AI Learns!)
      if (geminiResult.coreFact) {
        const existingKnowledge = await prisma.examKnowledgeBank.findFirst({
          where: {
            category,
            legalReference: geminiResult.legalReference || undefined,
          },
        });

        if (existingKnowledge) {
          await prisma.examKnowledgeBank.update({
            where: { id: existingKnowledge.id },
            data: {
              coreFact: geminiResult.coreFact,
              timesReferenced: { increment: 1 },
            },
          });
        } else {
          await prisma.examKnowledgeBank.create({
            data: {
              category,
              topic: geminiResult.legalReference || category,
              legalReference: geminiResult.legalReference || null,
              coreFact: geminiResult.coreFact,
              sampleQuestion: question.questionText,
              timesReferenced: 1,
            },
          });
        }
      }

      // 3. Mark Report as RESOLVED (Auto-Resolved)
      const now = new Date();
      await prisma.reportedQuestion.update({
        where: { id: report.id },
        data: {
          status: "RESOLVED",
          autoResolved: true,
          aiConfidence: finalConfidence,
          aiAnalysis: { gemini: geminiResult, grok: grokResult } as any,
          previousData: previousData as any,
          adminReply: `[AI ตรวจสอบและแก้ไขอัตโนมัติ]: ${geminiResult.detailedReason}`,
          resolvedAt: now,
          resolvedBy: "Autonomous AI Engine (Gemini + Grok)",
        },
      });

      // 4. Notify User
      if (report.userId) {
        await prisma.notification.create({
          data: {
            userId: report.userId,
            title: `🎉 ข้อสอบที่คุณแจ้ง (#${report.questionId}) ได้รับการแก้ไขเรียบร้อยแล้ว`,
            message: `ระบบ AI ได้ตรวจสอบกับตัวบทกฎหมายและแก้ไขเฉลยให้ถูกต้องทันที:\n\n${geminiResult.detailedReason}\n\nขอบคุณที่ร่วมเป็นส่วนหนึ่งในการพัฒนาคลังข้อสอบครับ!`,
            type: "QUESTION_RESOLVED",
            link: "/archive",
            isRead: false,
          },
        });
      }

      return {
        success: true,
        action: "AUTO_RESOLVED",
        confidence: finalConfidence,
        message: "AI ตรวจสอบพบข้อผิดพลาดจริง และได้อนุมัติแก้ไขลงฐานข้อมูลอัตโนมัติเรียบร้อยแล้ว",
      };
    }

    // =========================================================================
    // CASE B: HIGH CONFIDENCE QUESTION WAS ALREADY CORRECT -> AUTO-REJECT
    // =========================================================================
    if (!geminiResult.isReportValid && hasConsensus && finalConfidence >= 0.85) {
      const now = new Date();
      await prisma.reportedQuestion.update({
        where: { id: report.id },
        data: {
          status: "REJECTED",
          autoResolved: true,
          aiConfidence: finalConfidence,
          aiAnalysis: { gemini: geminiResult, grok: grokResult } as any,
          adminReply: `[AI ตรวจสอบแล้ว - ข้อสอบเดิมถูกต้อง]: ${geminiResult.detailedReason}`,
          resolvedAt: now,
          resolvedBy: "Autonomous AI Engine (Gemini + Grok)",
        },
      });

      if (report.userId) {
        await prisma.notification.create({
          data: {
            userId: report.userId,
            title: `ผลการตรวจสอบข้อสอบที่คุณแจ้ง (#${report.questionId})`,
            message: `ระบบ AI ได้ตรวจสอบกับข้อกฎหมายแล้วพบว่า ข้อสอบเดิมมีเฉลยที่ถูกต้องอยู่แล้วครับ:\n\n${geminiResult.detailedReason}`,
            type: "SYSTEM_ALERT",
            link: "/archive",
            isRead: false,
          },
        });
      }

      return {
        success: true,
        action: "AUTO_REJECTED",
        confidence: finalConfidence,
        message: "AI ตรวจสอบแล้วพบว่าข้อสอบเดิมถูกต้องอยู่แล้ว จึงปิดคำร้องอัตโนมัติ",
      };
    }

    // =========================================================================
    // CASE C: LOW CONFIDENCE OR DISAGREEMENT -> KEEP PENDING FOR HUMAN ADMIN
    // =========================================================================
    await prisma.reportedQuestion.update({
      where: { id: report.id },
      data: {
        aiConfidence: finalConfidence,
        aiAnalysis: { gemini: geminiResult, grok: grokResult } as any,
        adminReply: `[AI ร่างข้อเสนอแนะ]: ${geminiResult.detailedReason}`,
      },
    });

    return {
      success: true,
      action: "PENDING_ADMIN_REVIEW",
      confidence: finalConfidence,
      message: "AI วิเคราะห์และร่างคำตอบไว้ให้แล้ว รอแอดมินกดอนุมัติในหน้า Admin Dashboard",
    };
  } catch (error: any) {
    console.error("[AI Auditor] Error auditing report:", error);
    return { success: false, message: error.message };
  }
}
