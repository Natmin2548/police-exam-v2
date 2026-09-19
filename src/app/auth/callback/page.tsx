"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Shield, Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Auth callback error:", error.message);
        }
        // Redirect to /home after session initialized
        router.replace("/home");
      } catch (err) {
        console.error("Unexpected error:", err);
        router.replace("/home");
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#BD1B0B] to-rose-600 flex items-center justify-center text-white shadow-xl shadow-red-700/25 ring-4 ring-red-50/80 mb-6 animate-pulse">
        <Shield className="w-8 h-8 fill-white/20" />
      </div>
      <div className="flex items-center gap-3 text-slate-800 font-black text-lg mb-2">
        <Loader2 className="w-5 h-5 text-[#BD1B0B] animate-spin" />
        <span>กำลังยืนยันตัวตน...</span>
      </div>
      <p className="text-sm text-slate-500 font-medium">กำลังพาคุณเข้าสู่หน้าทำข้อสอบ</p>
    </div>
  );
}
