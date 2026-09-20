"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Brain,
  Laptop,
  Scale,
  Globe,
  FileText,
  ClipboardList,
  BookOpen,
} from "lucide-react";

interface ChapterItem {
  num: string;
  name: string;
  totalQuestions: number;
  setIds: number[];
}

interface CategoryData {
  categoryKey: string;
  displayName: string;
  iconType: string;
  iconColor: string;
  badgeBg: string;
  badgeText: string;
  totalQuestions: number;
  chapterCount: number;
  chapters: ChapterItem[];
}

function ArchiveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCategoryKey = searchParams.get("subject");

  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChapters = async () => {
      try {
        const res = await fetch("/api/exam/chapters");
        if (res.ok) {
          const data = await res.json();
          if (data.categories) {
            setCategories(data.categories);
          }
        }
      } catch (err) {
        console.error("Failed to load chapters:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchChapters();
  }, []);

  const activeCategory = categories.find(
    (c) => c.categoryKey === selectedCategoryKey || c.displayName === selectedCategoryKey
  );

  // Helper to render subject icon
  const renderIcon = (type: string, color: string) => {
    switch (type) {
      case "text":
        return <span className={`text-xs font-black ${color} tracking-wider`}>TH</span>;
      case "text_en":
        return <span className={`text-xs font-black ${color} tracking-wider`}>EN</span>;
      case "brain":
        return <Brain className={`w-5 h-5 ${color}`} />;
      case "laptop":
        return <Laptop className={`w-5 h-5 ${color}`} />;
      case "scale":
        return <Scale className={`w-5 h-5 ${color}`} />;
      case "globe":
        return <Globe className={`w-5 h-5 ${color}`} />;
      case "file":
        return <FileText className={`w-5 h-5 ${color}`} />;
      case "clipboard":
        return <ClipboardList className={`w-5 h-5 ${color}`} />;
      default:
        return <BookOpen className={`w-5 h-5 ${color}`} />;
    }
  };

  // Helper to render icon background
  const getIconBg = (type: string) => {
    switch (type) {
      case "text":
        return "bg-red-50";
      case "brain":
        return "bg-purple-50";
      case "laptop":
        return "bg-blue-50";
      case "scale":
        return "bg-amber-50";
      case "globe":
        return "bg-emerald-50";
      case "file":
        return "bg-orange-50";
      case "clipboard":
        return "bg-pink-50";
      case "text_en":
        return "bg-cyan-50";
      default:
        return "bg-slate-50";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFB] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-full border-3 border-red-200 border-t-[#BD1B0B] animate-spin mb-4" />
        <p className="text-sm font-black text-slate-800">กำลังโหลดคลังข้อสอบรายบท...</p>
      </div>
    );
  }

  // SCREEN 4: CHAPTERS LIST FOR SELECTED SUBJECT
  if (activeCategory) {
    return (
      <div className="min-h-screen bg-[#FBFBFB] py-6 sm:py-10 px-4">
        <div className="max-w-xl mx-auto space-y-6">
          {/* Header with back button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/archive")}
              className="inline-flex items-center gap-2 text-slate-800 hover:text-[#BD1B0B] transition-colors cursor-pointer group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {activeCategory.displayName}
              </h1>
            </button>
          </div>

          {/* White Card with list of chapters */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {activeCategory.chapters.map((ch, idx) => (
              <Link
                key={idx}
                href={`/exam/session?mode=chapter&setIds=${ch.setIds.join(
                  ","
                )}&title=${encodeURIComponent(ch.name)}&category=${encodeURIComponent(
                  activeCategory.categoryKey
                )}`}
                className="flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50/80 transition-colors group cursor-pointer"
              >
                {/* Left: Red number */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <span className="w-7 sm:w-8 text-base sm:text-lg font-black text-[#BD1B0B] shrink-0">
                    {idx + 1}
                  </span>

                  {/* Middle: Title & Count */}
                  <div className="min-w-0 truncate">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#BD1B0B] transition-colors truncate">
                      {ch.name}
                    </h2>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      {ch.totalQuestions} ข้อ
                    </p>
                  </div>
                </div>

                {/* Right: Chevron */}
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // SCREEN 3: SUBJECTS SELECTION FOR CHAPTER EXAMS
  return (
    <div className="min-h-screen bg-[#FBFBFB] py-6 sm:py-10 px-4 pb-20">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-1">
            คลังข้อสอบรายบท
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-bold">เลือกวิชา</p>
        </div>

        {/* Subjects List */}
        <div className="space-y-3 pt-1">
          {categories.map((cat) => (
            <Link
              key={cat.categoryKey}
              href={`/archive?subject=${encodeURIComponent(cat.categoryKey)}`}
              className="block bg-white border border-slate-200/80 hover:border-red-200 rounded-3xl p-4 sm:p-5 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between gap-4">
                {/* Left: Icon & Title */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-2xl ${getIconBg(
                      cat.iconType
                    )} flex items-center justify-center shrink-0 border border-slate-100 shadow-2xs`}
                  >
                    {renderIcon(cat.iconType, cat.iconColor)}
                  </div>

                  <div className="truncate">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-[#BD1B0B] transition-colors truncate">
                      {cat.displayName}
                    </h2>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      {cat.totalQuestions} ข้อในคลัง
                    </p>
                  </div>
                </div>

                {/* Right: Pastel Badge Pill */}
                <div
                  className={`px-3 py-1 rounded-full text-xs font-black ${cat.badgeBg} ${cat.badgeText} flex items-center gap-1 shrink-0 border border-slate-100`}
                >
                  <span>{cat.chapterCount} บท</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom Button: กลับหน้าหลัก */}
        <div className="pt-4">
          <Link
            href="/home"
            className="w-full py-3.5 px-4 bg-white border border-[#BD1B0B] text-[#BD1B0B] hover:bg-red-50 text-sm font-black rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับหน้าหลัก</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ArchivePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FBFBFB] flex flex-col items-center justify-center p-4">
          <div className="w-10 h-10 rounded-full border-3 border-red-200 border-t-[#BD1B0B] animate-spin mb-4" />
          <p className="text-sm font-black text-slate-800">กำลังเตรียมคลังข้อสอบ...</p>
        </div>
      }
    >
      <ArchiveContent />
    </Suspense>
  );
}
