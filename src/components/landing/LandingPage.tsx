"use client";

import React from "react";
import { HeroSlider } from "./HeroSlider";
import {
  Shield,
  BookOpen,
  Award,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-rose-100 selection:text-rose-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-700 to-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20">
              <Shield className="w-5 h-5 fill-white/20" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-900">
                POLICE<span className="text-rose-600">EXAM</span>
              </span>
              <span className="hidden sm:inline-block text-[11px] font-semibold text-slate-400 ml-2 uppercase tracking-wider">
                เตรียมสอบตำรวจ
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-3 sm:gap-6">
            <a
              href="#subjects"
              className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors hidden sm:inline"
            >
              รายวิชาสอบ
            </a>
            <a
              href="#announcements"
              className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors hidden sm:inline"
            >
              ประกาศรับสมัคร
            </a>
            <Link
              href="/home"
              className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/20 transition-all active:scale-95"
            >
              <span>เข้าสู่สนามสอบ</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* 1. Interactive Hero Slider */}
        <HeroSlider />

        {/* 2. Key Stats Strip */}
        <section className="bg-white border-b border-slate-200 py-8 sm:py-10 shadow-xs">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
              <div className="flex flex-col items-center">
                <span className="text-3xl sm:text-4xl font-black text-rose-600 tracking-tight">
                  843+
                </span>
                <span className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
                  ผู้ใช้งานเตรียมสอบ
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  3,800+
                </span>
                <span className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
                  คลังข้อสอบย้อนหลัง
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight">
                  90%
                </span>
                <span className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
                  สถิติสอบผ่านของผู้ฝึกฝน
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl sm:text-4xl font-black text-amber-500 tracking-tight">
                  100%
                </span>
                <span className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
                  ใช้งานฟรี ไม่มีค่าใช้จ่าย
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Subjects Section */}
        <section id="subjects" className="py-16 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 mb-3">
              <BookOpen className="w-3.5 h-3.5" />
              <span>หมวดวิชาตามหลักสูตรกองบัญชาการศึกษา</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ครอบคลุมทุกรายวิชาที่ใช้สอบจริง
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              ฝึกทำข้อสอบตามเกณฑ์คะแนนจริง พร้อมเฉลยละเอียดและวิเคราะห์คะแนน
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {[
              {
                title: "ความสามารถทั่วไป (คณิตศาสตร์)",
                desc: "อนุกรม, ตรรกศาสตร์, เงื่อนไขสัญลักษณ์, คณิตศาสตร์ทั่วไป",
                icon: "🧠",
                color: "bg-rose-50 text-rose-700 border-rose-200",
                count: "450+ ข้อ",
              },
              {
                title: "ภาษาไทย",
                desc: "ไวยากรณ์, การสะกดคำ, การใช้ภาษา, การอ่านจับใจความสำคัญ",
                icon: "TH",
                color: "bg-pink-50 text-pink-700 border-pink-200",
                count: "400+ ข้อ",
              },
              {
                title: "ภาษาอังกฤษ",
                desc: "Conversation, Vocabulary, Reading, Grammar แม่นยำ",
                icon: "EN",
                color: "bg-amber-50 text-amber-700 border-amber-200",
                count: "500+ ข้อ",
              },
              {
                title: "คอมพิวเตอร์และเทคโนโลยี",
                desc: "Microsoft Office, Windows, Internet, ระบบรักษาความปลอดภัย",
                icon: "💻",
                color: "bg-sky-50 text-sky-700 border-sky-200",
                count: "420+ ข้อ",
              },
              {
                title: "กฎหมายและระเบียบตำรวจ",
                desc: "พ.ร.บ.ตำรวจแห่งชาติ ๒๕๖๕, กฎหมายวิธีพิจารณาความอาญา, ระเบียบสารบรรณ",
                icon: "⚖️",
                color: "bg-indigo-50 text-indigo-700 border-indigo-200",
                count: "480+ ข้อ",
              },
              {
                title: "สังคม วัฒนธรรม และจริยธรรม",
                desc: "ประชาคมอาเซียน, สังคมศาสตร์, วัฒนธรรมไทย, หลักปรัชญาเศรษฐกิจพอเพียง",
                icon: "🌍",
                color: "bg-emerald-50 text-emerald-700 border-emerald-200",
                count: "350+ ข้อ",
              },
            ].map((sub, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-rose-300 hover:shadow-lg transition-all duration-200 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-base border ${sub.color}`}
                    >
                      {sub.icon}
                    </span>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                      {sub.count}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg group-hover:text-rose-600 transition-colors">
                    {sub.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                    {sub.desc}
                  </p>
                </div>
                <Link
                  href="/home"
                  className="mt-6 inline-flex items-center gap-1 text-xs font-bold text-rose-600 group-hover:translate-x-1 transition-transform"
                >
                  <span>ฝึกทำข้อสอบหมวดนี้</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Announcements Section */}
        <section
          id="announcements"
          className="py-16 sm:py-20 bg-slate-900 text-white"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
              <div>
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                  Update 2569
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                  ประกาศรับสมัครสอบล่าสุด
                </h2>
              </div>
              <Link
                href="/home"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-rose-400 hover:text-rose-300"
              >
                <span>ดูประกาศทั้งหมด</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  org: "กองบัญชาการศึกษา (บช.ศ.)",
                  title: "กลุ่มสายงานอำนวยการและสนับสนุน (ม.6/ปวช.)",
                  positions: "800 อัตรา",
                  examDate: "เร็วๆ นี้",
                  status: "เปิดรับสมัครล่าสุด",
                  statusColor: "bg-rose-500 text-white",
                },
                {
                  org: "กองการสอบ กองบัญชาการศึกษา",
                  title: "กลุ่มสายงานป้องกันปราบปราม (นสต.) ชาย",
                  positions: "5,000 อัตรา",
                  examDate: "ตามประกาศ บช.ศ.",
                  status: "เตรียมเปิดรับ",
                  statusColor: "bg-amber-500 text-white",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700 hover:border-slate-600 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="text-xs font-medium text-slate-400">
                        {item.org}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${item.statusColor}`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white leading-snug">
                      {item.title}
                    </h3>
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-300">
                      <div>
                        จำนวนที่รับ:{" "}
                        <strong className="text-white">{item.positions}</strong>
                      </div>
                      <div>
                        วันสอบ:{" "}
                        <strong className="text-rose-400">{item.examDate}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-700/60 flex justify-end">
                    <Link
                      href="/home"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors"
                    >
                      <span>รายละเอียดและแนวข้อสอบ</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-rose-600 text-white flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 fill-white" />
            </div>
            <span className="font-bold text-slate-800">
              POLICE EXAM THAILAND
            </span>
          </div>
          <p>© 2026 POLICE EXAM. เพื่อการศึกษาและเตรียมสอบนายสิบตำรวจ.</p>
        </div>
      </footer>
    </div>
  );
};
