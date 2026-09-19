"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  BookOpen,
  Sparkles,
  Award,
  Bell,
  ArrowRight,
  Clock,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

interface SlideItem {
  id: number;
  badge: string;
  badgeIcon: React.ReactNode;
  title: string;
  highlightText: string;
  subtitle: string;
  primaryCtaText: string;
  primaryCtaHref: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  bgGradient: string;
  accentColor: string;
  metaTags: string[];
}

const slides: SlideItem[] = [
  {
    id: 1,
    badge: "สนามสอบจำลองเสมือนจริง 2569",
    badgeIcon: <Award className="w-4 h-4 text-rose-400" />,
    title: "เตรียมพร้อม",
    highlightText: "สู่เครื่องแบบตำรวจ",
    subtitle:
      "แพลตฟอร์มติวสอบนายสิบตำรวจที่ครบวงจรที่สุด ตะลุยโจทย์ 150 ข้อ จับเวลาจริง คำนวณเกณฑ์ผ่าน 60% สถิติวิเคราะห์แม่นยำ",
    primaryCtaText: "เข้าสู่สนามสอบ Pretest",
    primaryCtaHref: "/home",
    secondaryCtaText: "ดูแนวข้อสอบ",
    secondaryCtaHref: "#subjects",
    bgGradient: "from-slate-950 via-rose-950/40 to-slate-900",
    accentColor: "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30",
    metaTags: ["สายปราบปราม", "สายอำนวยการ", "พิสูจน์หลักฐาน", "150 ข้อเต็ม"],
  },
  {
    id: 2,
    badge: "คลังข้อสอบย้อนหลัง 3,800+ ข้อ",
    badgeIcon: <BookOpen className="w-4 h-4 text-sky-400" />,
    title: "เจาะลึกข้อสอบจริง",
    highlightText: "ครบ 6 หมวดวิชา",
    subtitle:
      "รวบรวมข้อสอบย้อนหลังพร้อมเฉลยละเอียดและข้อกฎหมายอ้างอิง ความสามารถทั่วไป, สารบรรณ, ภาษาไทย, อังกฤษ, คอมพิวเตอร์, สังคม",
    primaryCtaText: "เปิดคลังข้อสอบ",
    primaryCtaHref: "/home",
    secondaryCtaText: "วิเคราะห์จุดอ่อน",
    secondaryCtaHref: "/home",
    bgGradient: "from-slate-950 via-blue-950/40 to-slate-900",
    accentColor: "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30",
    metaTags: ["ระเบียบสารบรรณ ๒๕๒๖", "พ.ร.บ.ตำรวจ", "คณิตศาสตร์", "ภาษาไทย"],
  },
  {
    id: 3,
    badge: "มินิเกมพัฒนาทักษะภาษาอังกฤษ",
    badgeIcon: <Sparkles className="w-4 h-4 text-emerald-400" />,
    title: "ฝึกคำศัพท์ Oxford",
    highlightText: "3,000 คำ ตรงจุดสอบ",
    subtitle:
      "เกมจับคู่คำศัพท์และความหมายระดับ A1 - C1 ออกแบบมาเพื่อช่วยจำศัพท์ยากได้เร็วขึ้น เพิ่มคะแนนภาษาอังกฤษในสนามสอบจริง",
    primaryCtaText: "เริ่มเล่นมินิเกมคำศัพท์",
    primaryCtaHref: "/home",
    secondaryCtaText: "เลือกคำศัพท์ A1-C1",
    secondaryCtaHref: "/home",
    bgGradient: "from-slate-950 via-emerald-950/40 to-slate-900",
    accentColor: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30",
    metaTags: ["ระดับ A1 - C1", "จับคู่ความหมาย", "จำศัพท์แม่น", "ฟรี 100%"],
  },
  {
    id: 4,
    badge: "อัปเดตข่าวสารการรับสมัครสอบ",
    badgeIcon: <Bell className="w-4 h-4 text-amber-400" />,
    title: "ประกาศรับสมัครสอบ",
    highlightText: "นายสิบตำรวจ ปี 2569",
    subtitle:
      "ติดตามกำหนดการรับสมัคร วันเลือกที่นั่งสอบ วันพิมพ์บัตรประจำตัวสอบ และข้อกำหนดสำคัญโดยตรงจากกองบัญชาการศึกษา",
    primaryCtaText: "ดูประกาศและกำหนดการ",
    primaryCtaHref: "#announcements",
    bgGradient: "from-slate-950 via-amber-950/40 to-slate-900",
    accentColor: "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30",
    metaTags: ["บช.ศ.", "800 อัตรา", "ม.6/ปวช.", "เปิดรับสมัครล่าสุด"],
  },
];

export const HeroSlider: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto slide every 6 seconds
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const prevSlide = () => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const nextSlide = () => {
    setCurrent((prev) => (prev + 1) % slides.length);
  };

  const slide = slides[current];

  return (
    <div
      className="relative w-full overflow-hidden bg-slate-950 text-white select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Ambience Gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${slide.bgGradient} transition-all duration-700 ease-in-out opacity-90`}
      />

      {/* Decorative Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-16 sm:pb-24">
        {/* Slide Content Box */}
        <div className="min-h-[420px] sm:min-h-[440px] flex flex-col justify-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs sm:text-sm font-semibold text-white/90 mb-6 w-fit animate-fade-in shadow-inner">
            {slide.badgeIcon}
            <span>{slide.badge}</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.1] mb-6">
            {slide.title} <br />
            <span className="bg-gradient-to-r from-rose-500 via-red-400 to-amber-300 bg-clip-text text-transparent">
              {slide.highlightText}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl text-base sm:text-lg md:text-xl text-slate-300 font-normal leading-relaxed mb-8">
            {slide.subtitle}
          </p>

          {/* Meta Tags */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-8">
            {slide.metaTags.map((tag, idx) => (
              <span
                key={idx}
                className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-slate-300"
              >
                ✓ {tag}
              </span>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Link
              href={slide.primaryCtaHref}
              className={`inline-flex items-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold text-sm sm:text-base shadow-xl transition-all duration-200 active:scale-95 ${slide.accentColor}`}
            >
              <span>{slide.primaryCtaText}</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>

            {slide.secondaryCtaText && (
              <Link
                href={slide.secondaryCtaHref || "#"}
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-3.5 sm:py-4 rounded-xl font-semibold text-sm sm:text-base bg-white/10 hover:bg-white/15 border border-white/20 text-white backdrop-blur-sm transition-all duration-200 active:scale-95"
              >
                <span>{slide.secondaryCtaText}</span>
              </Link>
            )}
          </div>
        </div>

        {/* Carousel Navigation Controls */}
        <div className="mt-10 sm:mt-14 flex items-center justify-between border-t border-white/10 pt-6">
          {/* Indicator Dots */}
          <div className="flex items-center gap-2 sm:gap-3">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrent(idx)}
                aria-label={`Slide ${idx + 1}`}
                className={`transition-all duration-300 rounded-full ${
                  current === idx
                    ? "w-8 sm:w-10 h-2.5 bg-rose-500"
                    : "w-2.5 h-2.5 bg-white/30 hover:bg-white/50"
                }`}
              />
            ))}
            <span className="text-xs text-slate-400 ml-2 hidden sm:inline">
              {current + 1} / {slides.length}
            </span>
          </div>

          {/* Left / Right Arrow Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevSlide}
              aria-label="Previous Slide"
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-colors active:scale-90"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextSlide}
              aria-label="Next Slide"
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-colors active:scale-90"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
