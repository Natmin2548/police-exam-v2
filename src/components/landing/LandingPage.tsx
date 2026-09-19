"use client";

import React, { useState } from "react";
import { Navbar } from "./Navbar";
import { HeroSection } from "./HeroSection";
import { Footer } from "./Footer";
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
      <Footer />

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={handleCloseLogin}
        onGoogleLogin={handleGoogleLogin}
      />
    </div>
  );
};
