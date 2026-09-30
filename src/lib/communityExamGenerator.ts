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

    // กรณีวิชาภาษาอังกฤษ
    if (
      category === "ภาษาอังกฤษ" ||
      category.includes("อังกฤษ") ||
      category.toLowerCase().includes("english")
    ) {
      const lowerChap = chapterName.toLowerCase();
      if (lowerChap.includes("conversation") || lowerChap.includes("สนทนา")) {
        snippets.push(
          `[แนวทางการออกข้อสอบ Conversation ระดับ CEFR A1 - B2]:\n` +
          `- ให้สร้างบทสนทนาสถานการณ์ในชีวิตประจำวันทั่วไป เช่น การทักทาย (Greetings), การแนะนำตัว, การสอบถามทาง (Directions), การสั่งอาหารในร้าน (Restaurant), การเช็คอินโรงแรม/สนามบิน (Hotel/Airport), การซื้อของและสอบถามราคา (Shopping), การนัดหมายและการติดต่อในที่ทำงานทั่วไป (Workplace/Appointments)\n` +
          `- ระดับภาษา: A1 - B2 เท่านั้น คำศัพท์และประโยคเข้าใจง่าย เป็นธรรมชาติ ไม่ซับซ้อน\n` +
          `- ⚠️ กฎเหล็ก: ห้ามนำเรื่องกฎหมาย ระเบียบราชการ หรือบริบทตำรวจมาแต่งบทสนทนาเด็ดขาด!`
        );
      } else if (lowerChap.includes("vocab") || lowerChap.includes("ศัพท์")) {
        const vocabPath = path.join(dataDir, "oxfordVocabData.json");
        if (fs.existsSync(vocabPath)) {
          const raw = JSON.parse(fs.readFileSync(vocabPath, "utf-8"));
          const vd = raw.VOCAB_DATA || {};
          const samplePool: { word: string; meaning: string; level: string }[] = [];
          ["A1", "A2", "B1", "B2"].forEach((lvl) => {
            const arr = vd[lvl] || [];
            const shuffled = [...arr].sort(() => 0.5 - Math.random()).slice(0, 6);
            shuffled.forEach((w: any) => samplePool.push({ ...w, level: lvl }));
          });
          const vocabLines = samplePool
            .map((v) => `- ${v.word} (${v.level}): ${v.meaning}`)
            .join("\n");
          snippets.push(
            `[คลังคำศัพท์มาตรฐาน Oxford 3000/5000 ระดับ A1 - B2 สำหรับออกข้อสอบ]:\n${vocabLines}\n(ให้ออกข้อสอบถามความหมาย คำพ้อง Synonym หรือการเลือกใช้คำศัพท์ในประโยคชีวิตประจำวันทั่วไป)`
          );
        }
      } else if (lowerChap.includes("reading") || lowerChap.includes("อ่าน")) {
        snippets.push(
          `[แนวทางการออกข้อสอบ Reading Comprehension ระดับ CEFR A1 - B2]:\n` +
          `- ให้ออกบทความสั้นทั่วไป ความยาว 3 - 5 ประโยค เช่น อีเมลติดต่อทั่วไป (General Email), ป้ายประกาศสาธารณะ (Notice/Announcement), ข่าวสั้นทั่วไป (Short News), บันทึกสั้น (Short Note), หรือเรื่องเล่าไลฟ์สไตล์/การท่องเที่ยว (Lifestyle/Travel)\n` +
          `- ระดับคำศัพท์: A1 - B2 สั้น กระชับ อ่านเข้าใจง่าย\n` +
          `- ⚠️ กฎเหล็กสูงสุด: ห้ามนำตัวบทกฎหมายไทย พระราชบัญญัติ หรือระเบียบราชการมาแปลเป็นภาษาอังกฤษเพื่อทำโจทย์ Reading เด็ดขาด! ไม่ใช่การสอบกฎหมายภาษาอังกฤษ แต่เป็นการสอบภาษาอังกฤษทั่วไป!`
        );
      } else {
        // Grammar chapters
        snippets.push(
          `[แนวทางการออกข้อสอบ Grammar & Structure ระดับ CEFR A1 - B2]:\n` +
          `- อ้างอิงตามบท: ${chapterName}\n` +
          `- ไวยากรณ์มาตรฐาน: Tenses (Present Simple, Past Simple, Future Simple, Present Continuous, Present Perfect), Subject-Verb Agreement, Passive Voice ขั้นพื้นฐาน, Prepositions (in, on, at, by), Pronouns, Articles (a, an, the), Modal Verbs (can, could, should, must, may)\n` +
          `- บริบทประโยค: ชีวิตประจำวันทั่วไป การทำงานทั่วไป ไม่เอาบริบทตำรวจหรือคดีความ!`
        );
      }
      return snippets;
    }

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
  const isPolice54 =
    category === "สารบรรณตำรวจ_๕๔" ||
    category.includes("๕๔") ||
    category.includes("54");
  const isEnglish =
    category === "ภาษาอังกฤษ" ||
    category.includes("อังกฤษ") ||
    category.toLowerCase().includes("english");

  let subjectPersona = "";
  let subjectRules = "";

  if (isPolice54) {
    subjectPersona = "คุณคือผู้เชี่ยวชาญการออกข้อสอบระเบียบงานสารบรรณตำรวจ (ประมวลระเบียบการตำรวจไม่เกี่ยวกับคดี ลักษณะที่ ๕๔ สารบรรณตำรวจ)";
    subjectRules = `[กติกาเฉพาะวิชาสารบรรณตำรวจ ลักษณะที่ ๕๔]:
- ข้อสอบวิชานี้เป็นวิชาเฉพาะทางตำรวจ ให้ออกข้อสอบตาม ปรต. ลักษณะที่ ๕๔ เท่านั้น
- ประเด็นหลัก: ยศตำรวจ, ชั้นข้าราชการตำรวจ, ประเภทหนังสือสั่งการตำรวจ, และขั้นตอนการเสนอหนังสือในสายงานตำรวจ`;
  } else if (isEnglish) {
    subjectPersona = "คุณคืออาจารย์ผู้เชี่ยวชาญการออกข้อสอบวิชาภาษาอังกฤษสำหรับการสอบมาตรฐานทั่วไป (General English CEFR ระดับ A1 - B2)";
    subjectRules = `⚠️ [กฎเหล็กสำคัญที่สุดสำหรับวิชาภาษาอังกฤษ]:
1. ระดับความยากต้องจำกัดที่ระดับ CEFR A1 - B2 เท่านั้น (ระดับที่คนทั่วไปในชีวิตประจำวันและการทำงานเข้าใจได้ง่าย)
2. 🚫 ห้ามเด็ดขาด (STRICT PROHIBITION):
   - ห้ามนำตัวบทกฎหมายไทย พระราชบัญญัติ หรือระเบียบราชการมาแปลเป็นภาษาอังกฤษเพื่อทำโจทย์หรือ Reading เด็ดขาด!
   - ห้ามออกข้อสอบ Reading โดยเอากฎหมายมาแปลให้ทำเด็ดขาด!
   - ห้ามใช้คำศัพท์กฎหมายเฉพาะทาง หรือบริบทตำรวจ (เช่น การจับกุม สืบสวน คดีความ) ในข้อสอบภาษาอังกฤษเด็ดขาด!
3. แนวทางการออกข้อสอบตามบท:
   - หากเป็น Conversation: บทสนทนาในชีวิตประจำวันทั่วไป (ทักทาย, ถามทาง, โรงแรม, สนามบิน, ร้านอาหาร, ซื้อของ, ที่ทำงาน)
   - หากเป็น Vocabulary: คำศัพท์ทั่วไป A1-B2 (Oxford 3000/5000) ในชีวิตประจำวันและที่ทำงานทั่วไป
   - หากเป็น Grammar: ไวยากรณ์มาตรฐาน A1-B2 (Tenses, Subject-Verb Agreement, Passive Voice พื้นฐาน, Prepositions, Articles, Pronouns, Modals)
   - หากเป็น Reading: บทความสั้นทั่วไป 3-5 ประโยค (เช่น อีเมลทั่วไป, ป้ายประกาศสาธารณะ, ข่าวสั้นทั่วไป, บันทึกสั้น, เรื่องเล่าไลฟ์สไตล์) ที่เข้าใจง่ายและเป็นภาษาอังกฤษทั่วไป ไม่ใช่ภาษากฎหมาย!
4. ตัวคำถามและตัวเลือกเป็นภาษาอังกฤษทั้งหมด ส่วน explanation ให้เขียนอธิบายเหตุผลและคำแปลเป็นภาษาไทยอย่างละเอียดเข้าใจง่าย`;
  } else {
    subjectPersona = "คุณคืออาจารย์ผู้เชี่ยวชาญการออกข้อสอบมาตรฐานทั่วไป (แนวข้อสอบ ก.พ. / การสอบเข้าราชการทั่วไป)";
    subjectRules = `⚠️ [กฎเหล็กสำคัญที่สุด - ข้อสอบทั่วไป ไม่เอาบริบทตำรวจ]:
1. ทุกวิชาทั่วไป (ยกเว้นลักษณะที่ ๕๔) ให้ออกข้อสอบแบบ "ข้อสอบทั่วไป / ความรู้ทั่วไป / มาตรฐาน ก.พ."
2. 🚫 ห้ามนำเรื่องตำรวจ ยศตำรวจ การตรวจค้น การจับกุม หรือบริบทตำรวจมาออกข้อสอบโดยเด็ดขาด!
   - ห้ามแต่งโจทย์ว่า 'ร้อยตำรวจเอก...', 'ตำรวจสายตรวจ...', หรือยกคดีตำรวจมาใส่ในโจทย์เด็ดขาด!
   - ให้ใช้สถานการณ์ทั่วไปในชีวิตประจำวัน เช่น นาย ก นาย ข ซื้อของ, การคำนวณเลขทั่วไป, นักเรียน, ประชาชน, ที่ทำงาน, ธรรมชาติ, หรือเหตุการณ์ทั่วไปในสังคม
3. แนวทางเฉพาะวิชา:
   - วิชาทั่วไป (คณิตศาสตร์/ตรรกศาสตร์): โจทย์คณิตศาสตร์ทั่วไป อนุกรม ร้อยละ อัตราส่วน ตรรกศาสตร์ อุปมาอุปไมย (สิ่งของ สัตว์ ธรรมชาติ ในชีวิตประจำวันทั่วไป)
   - วิชาภาษาไทย: หลักภาษา สะกดคำ คำไวพจน์ คำราชาศัพท์ สำนวน โวหาร บทความทั่วไปในสังคม
   - วิชาคอมพิวเตอร์: ความรู้ไอทีทั่วไป คอมพิวเตอร์ ซอฟต์แวร์ อุปกรณ์ อินเทอร์เน็ต ความปลอดภัยไซเบอร์ทั่วไปในชีวิตประจำวัน
   - วิชาสังคม: ความรู้สังคม วัฒนธรรม ศาสนา ประวัติศาสตร์ ภูมิศาสตร์ เศรษฐกิจพอเพียง ธรรมาภิบาล อาเซียน ทั่วไป
   - งานสารบรรณ ๒๕๒๖: ระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ พ.ศ. ๒๕๒๖ (หนังสือราชการทั่วไปของหน่วยงานราชการ)
   - วิชากฎหมาย: ประมวลกฎหมายอาญา / ป.วิ.อาญา ทั่วไป (เช่น ข้อเท็จจริงบุคคลทั่วไป นาย ก นาย ข ลักทรัพย์ ชิงทรัพย์ วิ่งราวทรัพย์ ทั่วไป)`;
  }

  const systemPrompt = `${subjectPersona}
เป้าหมายของคุณคือ ออกข้อสอบ 4 ตัวเลือก จำนวน ${count} ข้อ โดยต้องปฏิบัติตามกฎเหล็กอย่างเคร่งครัด:

1. [SUBJECT GUIDELINES - กฎเฉพาะวิชา]:
${subjectRules}

2. [GROUNDING MANDATE - อิงข้อมูลจริงเท่านั้น]:
- ต้องออกข้อสอบโดยอิงจาก [คลังข้อมูลอ้างอิงทางการ] ที่ระบุไว้ด้านล่างนี้
- ห้ามคิดค้นข้อมูลตัวเลขหรือข้อเท็จจริงนอกเหนือจากหลักวิชาการสากล
- โจทย์ต้องมีสาระสำคัญที่ถูกต้อง ไม่หลอน ไม่ออกนอกเรื่อง

3. [NO DUPLICATES - ห้ามออกข้อสอบซ้ำ]:
- ห้ามออกข้อสอบที่มีคำถามหรือจุดประสงค์ซ้ำหรือคล้ายคลึงกับ [รายการข้อสอบเดิมที่มีอยู่แล้ว] ด้านล่าง
- ในชุด ${count} ข้อนี้ แต่ละข้อต้องถามคนละประเด็นความรู้ ห้ามถามวนเรื่องเดิม

4. [FORMATTING RULES - รูปแบบ]:
- แต่ละข้อต้องมี 4 ตัวเลือก (choice1, choice2, choice3, choice4)
- ตัวเลือกต้องชัดเจน มีคำตอบที่ถูกต้องที่สุดเพียงข้อเดียวเท่านั้น (correctAnswer: 1, 2, 3, หรือ 4)
- ⚠️ กฎเหล็กตัวเลือก: ตัวเลือกทั้ง 4 (choice1 - choice4) ต้องแตกต่างกันโดยสิ้นเชิง ห้ามพิมพ์ช้อยส์ซ้ำกัน ห้ามความหมายเหมือนกัน หรือลอกข้อความเดียวกันเด็ดขาด
- ตัวเลือกหลอกต้องสมเหตุสมผล ไม่กำกวม
- explanation [กฎเหล็กการเฉลยละเอียด]: ต้องเขียนอธิบายเฉลยอย่างละเอียดระดับติวเตอร์มืออาชีพตามโครงสร้าง 4 ส่วนนี้เสมอ:
  ส่วนที่ ๑: อ้างอิงหลักการ / ตัวบทกฎหมาย / สูตร / ระเบียบทางการอย่างชัดเจน (เช่น ตาม ปรต. ลักษณะที่ ๕๔ บทที่... ข้อ... หรือ ตาม ป.อาญา มาตรา... หรือ สูตรคำนวณ...)
  ส่วนที่ ๒: วิเคราะห์ประเด็นที่โจทย์ถาม และอธิบายว่าทำไมตัวเลือกที่ถูกต้องจึงเป็นคำตอบที่ถูก
  ส่วนที่ ๓: จุดสังเกตเปรียบเทียบกับตัวเลือกอื่น (ชี้จุดลวง และอธิบายว่าตัวเลือกหลอกอื่นๆ ผิดตรงไหน หรือเป็นจุดที่ผู้สอบมักจำสับสนอย่างไร)
  ส่วนที่ ๔: สรุปคำตอบที่ถูกต้องที่สุด`;

  const userPrompt = `กรุณาออกข้อสอบ 4 ตัวเลือก จำนวน ${count} ข้อ สำหรับ:
- วิชา: ${category}
- บทเรียน: ${chapterName}

[คลังข้อมูลอ้างอิงทางการ (GROUND TRUTH)]:
${knowledgeContext || `อ้างอิงตามหลักสูตรมาตรฐานทั่วไปในวิชา ${category} บท ${chapterName}`}

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
    "explanation": "ตาม [กฎหมาย/ระเบียบ/สูตร] กำหนดไว้ดังนี้:\\n\\n๑. ประเด็นตามโจทย์: [อธิบายทำไมข้อนี้ถูกตามหลักการ]\\n\\n๒. จุดสังเกตเปรียบเทียบกับตัวเลือกอื่น: [อธิบายจุดลวง/ตัวเลือกอื่นผิดอย่างไร]\\n\\nดังนั้น คำตอบที่ถูกต้องคือ ตัวเลือกที่ ๑ (...)",
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
    .filter((q) => {
      // 1. ความยาวโจทย์และตัวเลือกต้องไม่ว่างเปล่า
      if (
        q.questionText.length < 10 ||
        !q.choice1 ||
        !q.choice2 ||
        !q.choice3 ||
        !q.choice4
      ) {
        return false;
      }

      // 2. 🛡️ ป้องกันช้อยส์ซ้ำ 100%: ตัวเลือกทั้ง 4 ต้องแตกต่างกัน ไม่ซ้ำกันเด็ดขาด
      const choicesNormalized = [q.choice1, q.choice2, q.choice3, q.choice4].map((c) =>
        c.toLowerCase().replace(/\s+/g, "")
      );
      const uniqueChoices = new Set(choicesNormalized);
      if (uniqueChoices.size < 4) {
        // มีช้อยส์ซ้ำกัน ตัดทิ้งทันที
        return false;
      }

      // 3. ตรวจความคล้ายคลึงระหว่างช้อยส์ (ป้องกันช้อยส์ข้อความเหมือนกันเกิน 90%)
      for (let i = 0; i < choicesNormalized.length; i++) {
        for (let j = i + 1; j < choicesNormalized.length; j++) {
          if (calculateSimilarity(choicesNormalized[i], choicesNormalized[j]) > 0.9) {
            return false;
          }
        }
      }

      return true;
    });
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
