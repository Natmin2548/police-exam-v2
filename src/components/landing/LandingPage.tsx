"use client";

import React, { useState } from "react";
import { Navbar } from "./Navbar";
import { HeroSection } from "./HeroSection";
import { LoginModal } from "./LoginModal";

export const LandingPage: React.FC = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const handleOpenLogin = () => setIsLoginModalOpen(true);
  const handleCloseLogin = () => setIsLoginModalOpen(false);

  const handleGoogleLogin = () => {
    alert("ระบบเข้าสู่ระบบด้วย Google");
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-police-100 selection:text-police-900">
      {/* Top Sticky Navbar */}
      <Navbar onOpenLogin={handleOpenLogin} />

      {/* Main Content */}
      <main className="flex-1">
        <HeroSection onOpenLogin={handleOpenLogin} />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-8 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-extrabold text-slate-800">
            POLICE<span className="text-police-800">EXAM</span>
          </span>
          <p>© 2026 POLICE EXAM. เพื่อการศึกษาและเตรียมสอบนายสิบตำรวจ.</p>
        </div>
      </footer>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={handleCloseLogin}
        onGoogleLogin={handleGoogleLogin}
      />
    </div>
  );
};
