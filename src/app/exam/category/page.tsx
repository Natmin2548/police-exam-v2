"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  BookOpen,
  Brain,
  Laptop,
  Scale,
  Globe,
  FileText,
  ClipboardList,
} from "lucide-react";

export default function ExamCategoryPage() {
  const categories = [
    {
      id: "thai",
      title: "ภาษาไทย",
      categoryKey: "ภาษาไทย",
      icon: BookOpen,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-600",
    },
    {
      id: "general",
      title: "ความสามารถทั่วไป",
      categoryKey: "ทั่วไป",
      icon: Brain,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    {
      id: "computer",
      title: "คอมพิวเตอร์และสารสนเทศ",
      categoryKey: "คอม",
      icon: Laptop,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      id: "law",
      title: "กฎหมายที่ประชาชนควรรู้",
      categoryKey: "กฏหมาย",
      icon: Scale,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      id: "social",
      title: "สังคมและวัฒนธรรม",
      categoryKey: "สังคม",
      icon: Globe,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      id: "saraban26",
      title: "งานสารบรรณ (๒๕๒๖)",
      categoryKey: "งานสารบรรณ_๒๕๒๖",
      icon: FileText,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
    },
    {
      id: "saraban54",
      title: "ระเบียบตำรวจ ลักษณะที่ ๕๔",
      categoryKey: "สารบรรณตำรวจ_๕๔",
      icon: ClipboardList,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-600",
    },
    {
      id: "english",
      title: "ภาษาอังกฤษ",
      categoryKey: "ภาษาอังกฤษ",
      icon: BookOpen,
      iconBg: "bg-cyan-50",
      iconColor: "text-cyan-600",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FBFBFB] py-6 sm:py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/exam"
            className="inline-flex items-center gap-2 text-slate-700 hover:text-[#BD1B0B] transition-colors mb-2 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              ทำข้อสอบรายวิชา 30 ข้อ
            </h1>
          </Link>
          <p className="text-xs sm:text-sm text-slate-400 font-bold pl-7">
            สุ่มคละทุกบทในวิชา รวม 30 ข้อ
          </p>
        </div>

        {/* Categories List */}
        <div className="space-y-3 pt-2">
          {categories.map((cat) => {
            const IconComponent = cat.icon;
            return (
              <Link
                key={cat.id}
                href={`/exam/session?mode=subject_single&category=${encodeURIComponent(
                  cat.categoryKey
                )}&title=${encodeURIComponent(cat.title)}`}
                className="block bg-white border border-slate-200/80 hover:border-red-200 rounded-3xl p-4 sm:p-5 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Left: Icon & Title */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-2xl ${cat.iconBg} flex items-center justify-center shrink-0 border border-slate-100 shadow-2xs`}
                    >
                      <IconComponent className={`w-6 h-6 ${cat.iconColor}`} />
                    </div>
                    <div className="truncate">
                      <h2 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-[#BD1B0B] transition-colors truncate">
                        {cat.title}
                      </h2>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        สุ่มคละทุกบทเรียน (30 ข้อ)
                      </p>
                    </div>
                  </div>

                  {/* Right: Circular Red Arrow Button */}
                  <div className="w-10 h-10 rounded-full bg-[#BD1B0B] text-white flex items-center justify-center shadow-md shadow-red-950/20 group-hover:scale-105 group-hover:bg-[#A81507] transition-all shrink-0">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
