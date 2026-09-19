"use client";

import React from "react";
import Link from "next/link";
import { Shield, BookOpen, User, LogOut, ArrowRight, CheckCircle2, Trophy, Clock } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navbar for Home */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#BD1B0B] to-rose-600 flex items-center justify-center text-white shadow-md shadow-red-700/20">
              <Shield className="w-5 h-5 fill-white/20" />
            </div>
            <div>
              <span className="font-black text-slate-900 tracking-tight text-lg sm:text-xl">
                POLICE <span className="text-[#BD1B0B]">EXAM</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-[#BD1B0B] border border-red-200">
                Dashboard
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs sm:text-sm font-medium">
              <User className="w-4 h-4 text-[#BD1B0B]" />
              <span className="font-semibold">ผู้ใช้งาน</span>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-red-600 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>ออกจากระบบ</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#BD1B0B] to-[#871005] p-6 sm:p-10 text-white shadow-xl shadow-red-950/15 mb-8">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-bold text-red-100 mb-4 border border-white/20">
              <span>เตรียมพร้อมสู่เครื่องแบบ ปี 2569</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight mb-2">
              ยินดีต้อนรับสู่ระบบทำข้อสอบ
            </h1>
            <p className="text-sm sm:text-base text-red-100/90 font-medium leading-relaxed mb-6">
              เลือกสายงานที่ต้องการสอบเพื่อเริ่มทำโจทย์ย้อนหลัง พร้อมระบบจับเวลาและวิเคราะห์ผลทันที
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 bg-white text-[#BD1B0B] hover:bg-red-50 active:scale-98 text-sm font-extrabold px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
              >
                <span>เริ่มทำข้อสอบจำลอง</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>เวลาสอบจริง</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">3 ชม.</div>
            <div className="text-[11px] text-slate-500 mt-0.5">150 ข้อ ตามหลักสูตร บช.ศ.</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>เกณฑ์ผ่าน</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600">60%</div>
            <div className="text-[11px] text-slate-500 mt-0.5">ผ่านทั้ง 2 ส่วนวิชา</div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>ข้อสอบทั้งหมด</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">3,800+ ข้อ</div>
            <div className="text-[11px] text-slate-500 mt-0.5">อัปเดตเฉลยละเอียดทุกข้อ</div>
          </div>
        </div>

        {/* Exam Categories */}
        <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#BD1B0B]" />
          <span>เลือกสายสอบ</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Track 1: ปราบปราม */}
          <div className="bg-white border-2 border-slate-200 hover:border-red-500 rounded-2xl p-5 sm:p-6 transition-all hover:shadow-lg group cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 text-[#BD1B0B] flex items-center justify-center font-black text-xl group-hover:scale-105 transition-transform">
                ปป.
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                พร้อมสอบ
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 group-hover:text-[#BD1B0B] transition-colors mb-1">
              สายปราบปราม (นสต.)
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mb-4">
              ความสามารถทั่วไป, ภาษาไทย, ภาษาอังกฤษ, กฎหมายที่ประชาชนควรรู้, สังคมและจริยธรรม, เทคโนโลยีสารสนเทศ
            </p>
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 pt-3 border-t border-slate-100">
              <span>150 ข้อ / 3 ชั่วโมง</span>
              <span className="inline-flex items-center gap-1 text-[#BD1B0B] group-hover:translate-x-1 transition-transform">
                เข้าทำข้อสอบ <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* Track 2: อำนวยการ */}
          <div className="bg-white border-2 border-slate-200 hover:border-blue-500 rounded-2xl p-5 sm:p-6 transition-all hover:shadow-lg group cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-black text-xl group-hover:scale-105 transition-transform">
                อก.
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                พร้อมสอบ
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors mb-1">
              สายอำนวยการและสนับสนุน (อก.)
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mb-4">
              ความสามารถทั่วไป, ภาษาไทย, ภาษาอังกฤษ, สารบัญและงานธุรการ, สังคมและจริยธรรม, เทคโนโลยีสารสนเทศ
            </p>
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 pt-3 border-t border-slate-100">
              <span>150 ข้อ / 3 ชั่วโมง</span>
              <span className="inline-flex items-center gap-1 text-blue-600 group-hover:translate-x-1 transition-transform">
                เข้าทำข้อสอบ <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
