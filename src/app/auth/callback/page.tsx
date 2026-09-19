"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  useEffect(() => {
    let resolved = false;

    const goToHome = () => {
      if (!resolved) {
        resolved = true;
        window.location.replace("/home");
      }
    };

    const goToLanding = () => {
      if (!resolved) {
        resolved = true;
        window.location.replace("/");
      }
    };

    // 1. Listen for auth state change from Supabase
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        goToHome();
      }
    });

    // 2. Handle PKCE code in query string
    const handleAuth = async () => {
      try {
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const code = params.get("code");
          if (code) {
            const { data } = await supabase.auth.exchangeCodeForSession(code);
            if (data?.session?.user) {
              goToHome();
              return;
            }
          }

          // 3. Check if session already active or parsed from hash
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user) {
            goToHome();
            return;
          }
        }
      } catch (err) {
        console.error("Auth callback error:", err);
      }
    };

    handleAuth();

    // Fallback timer: if after 4 seconds no session is found, return to landing page
    const timer = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          goToHome();
        } else {
          goToLanding();
        }
      });
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="w-10 h-10 rounded-full border-2 border-red-200 border-t-[#BD1B0B] animate-spin mb-4" />
      <p className="text-sm text-slate-600 font-bold">กำลังเข้าสู่ระบบ...</p>
    </div>
  );
}
