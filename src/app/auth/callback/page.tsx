"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  useEffect(() => {
    const handleAuth = async () => {
      try {
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const code = params.get("code");
          if (code) {
            await supabase.auth.exchangeCodeForSession(code);
          } else {
            await supabase.auth.getSession();
          }
        }
      } catch (err) {
        console.error("Auth callback error:", err);
      } finally {
        window.location.replace("/home");
      }
    };

    handleAuth();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="w-10 h-10 rounded-full border-2 border-red-200 border-t-[#BD1B0B] animate-spin mb-4" />
      <p className="text-sm text-slate-600 font-bold">กำลังเข้าสู่ระบบ...</p>
    </div>
  );
}
