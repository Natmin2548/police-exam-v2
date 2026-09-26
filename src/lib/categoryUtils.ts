// =============================================================================
// Category Utilities — ใช้ร่วมกันระหว่าง generate / submit / stats
// =============================================================================

export type ScoreField =
  | "scoreThai"
  | "scoreGeneral"
  | "scoreComputer"
  | "scoreLaw"
  | "scoreSocial"
  | "scoreEnglish"
  | "scoreSecretariat";

/**
 * แปลงชื่อ category (จาก DB หรือ query param) ให้เป็น normalized query string
 * สำหรับใช้ค้นหาใน Prisma
 */
export function normalizeCategoryQuery(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("กฎ") || c.includes("กฏ") || c.includes("หมาย")) return "กฏหมาย";
  if (c.includes("คอม") || c.includes("ไอที") || c.includes("เทคโนโลยี")) return "คอม";
  if (c.includes("ไทย")) return "ภาษาไทย";
  if (c.includes("อังกฤษ") || c.includes("eng")) return "ภาษาอังกฤษ";
  if (c.includes("ทั่วไป") || c.includes("ความสามารถ") || c.includes("คณิต") || c.includes("เหตุผล")) return "ทั่วไป";
  if (c.includes("สังคม") || c.includes("จริยธรรม")) return "สังคม";
  if (c.includes("๕๔") || c.includes("54") || c.includes("ตำรวจ")) return "สารบรรณตำรวจ_๕๔";
  if (c.includes("สารบรรณ") || c.includes("๒๕๒๖") || c.includes("2526")) return "งานสารบรรณ_๒๕๒๖";
  return category;
}

/**
 * แปลงชื่อ category (จาก DB) ให้เป็น score field ใน User model
 * คืนค่า null ถ้า map ไม่ได้
 */
export function categoryToScoreField(category: string): ScoreField | null {
  const c = (category || "").toLowerCase();
  if (c.includes("ไทย")) return "scoreThai";
  if (c.includes("ทั่วไป") || c.includes("คณิต") || c.includes("เหตุผล")) return "scoreGeneral";
  if (c.includes("คอม") || c.includes("ไอที")) return "scoreComputer";
  if (c.includes("กฎหมาย") || c.includes("กฏหมาย")) return "scoreLaw";
  if (c.includes("สังคม")) return "scoreSocial";
  if (c.includes("อังกฤษ")) return "scoreEnglish";
  if (c.includes("สารบรรณ") || c.includes("๕๔") || c.includes("54")) return "scoreSecretariat";
  return null;
}

/**
 * แปลง subject string (จาก quiz attempt title) ให้เป็น score field
 */
export function subjectStringToScoreField(subStr: string): ScoreField | null {
  const s = subStr.toLowerCase();
  if (s.includes("ไทย")) return "scoreThai";
  if (s.includes("ทั่วไป") || s.includes("คณิต") || s.includes("เหตุผล")) return "scoreGeneral";
  if (s.includes("คอม") || s.includes("ไอที") || s.includes("เทคโนโลยี")) return "scoreComputer";
  if (s.includes("กฎหมาย") || s.includes("กฏหมาย") || s.includes("กม")) return "scoreLaw";
  if (s.includes("สังคม") || s.includes("จริยธรรม")) return "scoreSocial";
  if (s.includes("อังกฤษ") || s.includes("english") || s.includes("eng")) return "scoreEnglish";
  if (s.includes("สารบรรณ") || s.includes("๕๔") || s.includes("54")) return "scoreSecretariat";
  return null;
}
