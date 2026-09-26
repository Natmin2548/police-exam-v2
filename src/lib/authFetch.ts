import { supabase } from "@/lib/supabaseClient";

// =============================================================================
// authFetch — fetch wrapper ที่แนบ Authorization: Bearer token อัตโนมัติ
// ใช้แทน fetch() ทุกที่ที่เรียก internal API (/api/...)
// =============================================================================

type FetchArgs = Parameters<typeof fetch>;

/**
 * fetch() ที่แนบ Supabase access token ใน Authorization header อัตโนมัติ
 * ถ้าไม่มี session (guest) จะ fetch ปกติโดยไม่มี header
 */
export async function authFetch(
  input: FetchArgs[0],
  init?: FetchArgs[1]
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;

  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(input, { ...init, headers });
}
