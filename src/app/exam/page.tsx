"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

export default function ExamSelectionPage() {
  const options = [
    {
      id: "suppression",
      title: "สายปราบปราม",
      href: "/exam/session?mode=pretest_suppression&title=Pretest%20สายปราบปราม%20150%20ข้อ",
    },
    {
      id: "admin",
      title: "สายอำนวยการ",
      href: "/exam/session?mode=pretest_admin&title=Pretest%20สายอำนวยการ%20150%20ข้อ",
    },
    {
      id: "subject",
      title: "ทำข้อสอบรายวิชา 30 ข้อ",
      href: "/exam/category",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FBFBFB] py-6 sm:py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header with Back Arrow */}
        <div>
          <Link
            href="/home"
            className="inline-flex items-center gap-2 text-slate-700 hover:text-[#BD1B0B] transition-colors mb-3 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Pretest 150 ข้อ
            </h1>
          </Link>
          <p className="text-xs sm:text-sm text-slate-400 font-bold pl-7">
            เลือกสายที่ต้องการสอบ
          </p>
        </div>

        {/* Selection Cards List */}
        <div className="space-y-4 pt-2">
          {options.map((opt) => (
            <Link
              key={opt.id}
              href={opt.href}
              className="block bg-white border border-slate-200/80 hover:border-red-200 rounded-3xl p-5 sm:p-6 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-[#BD1B0B] transition-colors">
                  {opt.title}
                </h2>
                <div className="w-11 h-11 rounded-full bg-[#BD1B0B] text-white flex items-center justify-center shadow-md shadow-red-950/20 group-hover:scale-105 group-hover:bg-[#A81507] transition-all shrink-0">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
