"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  ChevronRight,
  Shield,
  Laptop,
  Scale,
  Globe,
  Brain,
  BookOpen,
  Trophy,
  Home,
  BookMarked,
  Image as ImageIcon,
  LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

interface SubjectProgress {
  id: string;
  name: string;
  count: string;
  score: number;
  iconType: "text" | "brain" | "laptop" | "scale" | "globe";
  iconText?: string;
  iconColor?: string;
  bgColor?: string;
}

const subjectsData: SubjectProgress[] = [
  {
    id: "thai",
    name: "ภาษาไทย",
    count: "3 ครั้ง",
    score: 14,
    iconType: "text",
    iconText: "TH",
    iconColor: "text-red-600",
    bgColor: "bg-red-50",
  },
  {
    id: "math",
    name: "ความสามารถทั่วไป",
    count: "3 ครั้ง",
    score: 20,
    iconType: "brain",
    iconColor: "text-pink-500",
    bgColor: "bg-pink-50",
  },
  {
    id: "com",
    name: "คอมพิวเตอร์",
    count: "3 ครั้ง",
    score: 44,
    iconType: "laptop",
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50",
  },
  {
    id: "law",
    name: "กฎหมาย",
    count: "3 ครั้ง",
    score: 23,
    iconType: "scale",
    iconColor: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    id: "social",
    name: "สังคม",
    count: "2 ครั้ง",
    score: 10,
    iconType: "globe",
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-50",
  },
  {
    id: "eng",
    name: "ภาษาอังกฤษ",
    count: "2 ครั้ง",
    score: 14,
    iconType: "text",
    iconText: "EN",
    iconColor: "text-rose-600",
    bgColor: "bg-rose-50",
  },
];

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [greeting, setGreeting] = useState("สวัสดีตอนบ่าย");
  const [activeTab, setActiveTab] = useState<"home" | "archive" | "rank">("home");

  useEffect(() => {
    // Determine dynamic Thai greeting based on current local hour
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setGreeting("สวัสดีตอนเช้า");
    else if (hour >= 12 && hour < 17) setGreeting("สวัสดีตอนบ่าย");
    else if (hour >= 17 && hour < 21) setGreeting("สวัสดีตอนเย็น");
    else setGreeting("สวัสดีตอนค่ำ");

    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // Get display name (e.g. first word of full name, or email prefix)
  const displayName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "มีน";

  return (
    <div className="min-h-screen bg-[#FBFBFB] text-slate-900 pb-28 font-sans selection:bg-red-100 selection:text-red-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#FBFBFB]/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between max-w-4xl mx-auto">
        {/* Brand Logo */}
        <Link href="/home" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-[#BD1B0B] flex items-center justify-center text-white shadow-xs">
            <Shield className="w-4 h-4 fill-white" />
          </div>
          <span className="font-black text-lg tracking-tight text-slate-900">
            POLICE<span className="text-[#BD1B0B]">EXAM</span>
          </span>
        </Link>

        {/* User Info & Actions */}
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <button
            type="button"
            className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-[#BD1B0B] hover:border-red-200 transition-colors shadow-2xs"
            aria-label="แจ้งเตือน"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2.5 pl-1">
            <div className="flex flex-col text-right">
              <span className="text-[11px] text-slate-500 font-medium leading-none">
                {greeting}
              </span>
              <span className="text-sm font-black text-slate-900 leading-tight">
                {displayName}
              </span>
            </div>

            {/* Avatar */}
            <div className="relative group">
              <button
                type="button"
                onClick={handleLogout}
                title="คลิกเพื่อออกจากระบบ"
                className="w-10 h-10 rounded-full ring-2 ring-slate-100 overflow-hidden bg-slate-200 flex items-center justify-center hover:opacity-85 transition-opacity cursor-pointer"
              >
                {user?.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 pt-2 space-y-6">
        {/* Banner: Pretest 150 ข้อ */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#BD1B0B] via-[#BD1B0B] to-[#991408] text-white p-6 sm:p-7 shadow-xl shadow-red-900/15 flex items-center justify-between cursor-pointer hover:shadow-2xl transition-all group">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Pretest 150 ข้อ
            </h1>
            <p className="text-xs sm:text-sm text-red-100/90 font-medium">
              สายปราบปราม - สายอำนวยการ
            </p>
          </div>

          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center group-hover:bg-white group-hover:text-[#BD1B0B] transition-all shrink-0">
            <ChevronRight className="w-6 h-6" />
          </div>
        </div>

        {/* 4 Feature Cards (2x2 Grid) */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* Card 1: บีบอัดรูป */}
          <div className="bg-white border border-slate-100 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer">
            <h3 className="text-base font-black text-slate-900 mb-0.5">
              บีบอัดรูป
            </h3>
            <p className="text-xs text-slate-400 font-medium">ลดขนาดไฟล์</p>
          </div>

          {/* Card 2: คลังรายบท */}
          <div className="bg-white border border-slate-100 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer">
            <h3 className="text-base font-black text-slate-900 mb-0.5">
              คลังรายบท
            </h3>
            <p className="text-xs text-slate-400 font-medium">เจาะทีละบท</p>
          </div>

          {/* Card 3: อันดับ */}
          <div className="bg-white border border-slate-100 hover:border-red-200 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer">
            <h3 className="text-base font-black text-[#BD1B0B] mb-0.5">
              อันดับ
            </h3>
            <p className="text-xs text-slate-400 font-medium">ผู้สอบ 150 ข้อ</p>
          </div>

          {/* Card 4: คลังคำศัพท์ */}
          <div className="bg-white border border-slate-100 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer">
            <h3 className="text-base font-black text-slate-900 mb-0.5">
              คลังคำศัพท์
            </h3>
            <p className="text-xs text-slate-400 font-medium">เลือกด่วน !</p>
          </div>
        </div>

        {/* Section: สถิติ */}
        <div>
          <h2 className="text-base font-black text-slate-900 mb-3">สถิติ</h2>
          <div className="grid grid-cols-3 gap-3">
            {/* Stat 1: 20 ชุด */}
            <div className="bg-white border border-slate-100 rounded-2xl py-4 sm:py-5 px-3 text-center shadow-xs flex flex-col items-center justify-center">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">
                20 <span className="text-sm font-bold">ชุด</span>
              </div>
              <span className="text-xs text-slate-400 font-semibold">ทำแล้ว</span>
            </div>

            {/* Stat 2: 21% (Highlighted Rose/Pink) */}
            <div className="bg-[#FFF5F5] border border-red-100 rounded-2xl py-4 sm:py-5 px-3 text-center shadow-xs flex flex-col items-center justify-center">
              <div className="text-2xl sm:text-3xl font-black text-[#BD1B0B] tracking-tight leading-none mb-1">
                21<span className="text-sm font-bold">%</span>
              </div>
              <span className="text-xs text-slate-500 font-semibold">เฉลี่ย</span>
            </div>

            {/* Stat 3: 93% */}
            <div className="bg-white border border-slate-100 rounded-2xl py-4 sm:py-5 px-3 text-center shadow-xs flex flex-col items-center justify-center">
              <div className="text-2xl sm:text-3xl font-black text-[#BD1B0B] tracking-tight leading-none mb-1">
                93<span className="text-sm font-bold">%</span>
              </div>
              <span className="text-xs text-slate-400 font-semibold">สูงสุด</span>
            </div>
          </div>
        </div>

        {/* Section: รายวิชา */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 sm:p-6 shadow-xs">
          <h2 className="text-base font-black text-slate-900 mb-4">รายวิชา</h2>

          <div className="space-y-4">
            {subjectsData.map((subj) => (
              <div
                key={subj.id}
                className="flex items-center gap-3 sm:gap-4 py-1.5 hover:bg-slate-50/80 -mx-2 px-2 rounded-2xl transition-colors cursor-pointer"
              >
                {/* Subject Icon */}
                <div
                  className={`w-10 h-10 rounded-2xl ${subj.bgColor} flex items-center justify-center shrink-0 border border-slate-100`}
                >
                  {subj.iconType === "text" && (
                    <span
                      className={`text-xs font-black ${subj.iconColor} tracking-wider`}
                    >
                      {subj.iconText}
                    </span>
                  )}
                  {subj.iconType === "brain" && (
                    <Brain className={`w-5 h-5 ${subj.iconColor}`} />
                  )}
                  {subj.iconType === "laptop" && (
                    <Laptop className={`w-5 h-5 ${subj.iconColor}`} />
                  )}
                  {subj.iconType === "scale" && (
                    <Scale className={`w-5 h-5 ${subj.iconColor}`} />
                  )}
                  {subj.iconType === "globe" && (
                    <Globe className={`w-5 h-5 ${subj.iconColor}`} />
                  )}
                </div>

                {/* Subject Title & Count */}
                <div className="w-28 sm:w-36 shrink-0">
                  <h4 className="text-sm font-bold text-slate-800 leading-tight truncate">
                    {subj.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    {subj.count}
                  </p>
                </div>

                {/* Progress Bar Container */}
                <div className="flex-1 px-1">
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#BD1B0B] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${subj.score}%` }}
                    />
                  </div>
                </div>

                {/* Percentage Score */}
                <div className="w-10 text-right shrink-0">
                  <span className="text-xs sm:text-sm font-black text-[#BD1B0B]">
                    {subj.score}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Floating Bottom Navigation Dock */}
      <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-full px-6 py-2 shadow-xl shadow-slate-900/10 flex items-center gap-8 sm:gap-12">
        {/* Nav Item 1: หน้าหลัก (Active) */}
        <button
          type="button"
          onClick={() => setActiveTab("home")}
          className={`flex flex-col items-center gap-0.5 transition-colors cursor-pointer ${
            activeTab === "home" ? "text-[#BD1B0B]" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-bold">หน้าหลัก</span>
        </button>

        {/* Nav Item 2: คลัง */}
        <button
          type="button"
          onClick={() => setActiveTab("archive")}
          className={`flex flex-col items-center gap-0.5 transition-colors cursor-pointer ${
            activeTab === "archive" ? "text-[#BD1B0B]" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <BookMarked className="w-5 h-5" />
          <span className="text-[10px] font-bold">คลัง</span>
        </button>

        {/* Nav Item 3: อันดับ */}
        <button
          type="button"
          onClick={() => setActiveTab("rank")}
          className={`flex flex-col items-center gap-0.5 transition-colors cursor-pointer ${
            activeTab === "rank" ? "text-[#BD1B0B]" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] font-bold">อันดับ</span>
        </button>
      </nav>
    </div>
  );
}
