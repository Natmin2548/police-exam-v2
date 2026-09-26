import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

// =============================================================================
// Server-side Supabase client (ใช้ Service Role สำหรับ verify JWT)
// =============================================================================

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fwigijxqyabcnblnqkec.supabase.co";

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_q28mzzJTlpuLRsYks3fLng_S4-HsWwU";

/**
 * สร้าง Supabase server client สำหรับ verify JWT ใน API routes
 * ใช้ service role เพื่อให้ getUser() ทำงานได้โดยไม่ต้องการ RLS
 */
export function createServerClient() {
  const key = supabaseServiceKey || supabaseAnonKey;
  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * ดึง authenticated user จาก Authorization header
 * คืนค่า { email, userId } ถ้า valid
 * คืนค่า null ถ้า token หายหรือ invalid
 */
export async function getAuthUser(
  req: NextRequest | Request
): Promise<{ email: string } | null> {
  try {
    const authHeader =
      req.headers.get("Authorization") || req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return null;

    const supabase = createServerClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user || !data.user.email) {
      return null;
    }

    return { email: data.user.email };
  } catch {
    return null;
  }
}

/**
 * ดึง email จาก token หรือ fallback จาก body (สำหรับ route ที่ยังไม่บังคับ login)
 * ถ้า token valid จะใช้ email จาก token เสมอ (ป้องกัน spoofing)
 */
export async function getEmailSafe(
  req: NextRequest | Request,
  bodyEmail?: string
): Promise<string | null> {
  const authUser = await getAuthUser(req);
  if (authUser) return authUser.email;
  // fallback: ถ้าไม่มี token ใช้ bodyEmail (guest mode)
  return bodyEmail || null;
}
