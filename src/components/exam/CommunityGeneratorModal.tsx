"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  X,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Flame,
  Layers,
  ArrowRight,
} from "lucide-react";
import confetti from "canvas-confetti";
import { SUBJECT_CHAPTERS_MAP } from "@/data/subjectChapters";

interface CommunityGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
  onExamCreated?: () => void;
}

export const CommunityGeneratorModal: React.FC<CommunityGeneratorModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  onExamCreated,
}) => {
  // Category & Chapter selection
  const subjectKeys = Object.keys(SUBJECT_CHAPTERS_MAP);
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string>(
    subjectKeys[0] || "saraban_2526"
  );
  const currentSubject = SUBJECT_CHAPTERS_MAP[selectedSubjectKey];
  const [selectedChapterName, setSelectedChapterName] = useState<string>(
    currentSubject?.chapters?.[0]?.name || ""
  );

  // Quota state
  const [quota, setQuota] = useState<{
    usedToday: number;
    remainingToday: number;
    maxQuota: number;
  }>({
    usedToday: 0,
    remainingToday: 5,
    maxQuota: 5,
  });
  const [isLoadingQuota, setIsLoadingQuota] = useState(false);

  // Generation state
  const [status, setStatus] = useState<"idle" | "generating" | "success" | "error">(
    "idle"
  );
  const [progressStep, setProgressStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [successInfo, setSuccessInfo] = useState<{
    count: number;
    category: string;
    chapterName: string;
    remainingToday: number;
  } | null>(null);

  // Update selectedChapterName when subject changes
  useEffect(() => {
    if (currentSubject?.chapters?.length > 0) {
      setSelectedChapterName(currentSubject.chapters[0].name);
    }
  }, [selectedSubjectKey, currentSubject]);

  // Fetch quota when modal opens
  useEffect(() => {
    if (isOpen && userEmail) {
      fetchQuota();
    }
  }, [isOpen, userEmail]);

  const fetchQuota = async () => {
    if (!userEmail) return;
    setIsLoadingQuota(true);
    try {
      const res = await fetch(
        `/api/exam/community-generate?email=${encodeURIComponent(userEmail)}`
      );
      if (res.ok) {
        const data = await res.json();
        setQuota({
          usedToday: data.usedToday,
          remainingToday: data.remainingToday,
          maxQuota: data.maxQuota,
        });
      }
    } catch (e) {
      console.error("Failed to fetch quota:", e);
    } finally {
      setIsLoadingQuota(false);
    }
  };

  // Progress animation while generating
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === "generating") {
      setProgressStep(1);
      timer = setTimeout(() => {
        setProgressStep(2);
        timer = setTimeout(() => {
          setProgressStep(3);
        }, 3500);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [status]);

  const handleGenerate = async () => {
    if (!userEmail) {
      setErrorMessage("กรุณาเข้าสู่ระบบก่อนสร้างข้อสอบ");
      setStatus("error");
      return;
    }

    if (quota.remainingToday <= 0) {
      setErrorMessage("โควต้าการสร้างข้อสอบวันนี้ของคุณเต็มแล้ว (5/5 ครั้ง)");
      setStatus("error");
      return;
    }

    setStatus("generating");
    setErrorMessage("");
    setProgressStep(1);

    try {
      const res = await fetch("/api/exam/community-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: currentSubject.category,
          chapterName: selectedChapterName,
          email: userEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการสร้างข้อสอบ");
      }

      // Success
      setProgressStep(4);
      setStatus("success");
      setSuccessInfo({
        count: data.questionsCreated || 5,
        category: currentSubject.displayName,
        chapterName: selectedChapterName,
        remainingToday: data.remainingToday,
      });
      setQuota({
        usedToday: data.usedToday,
        remainingToday: data.remainingToday,
        maxQuota: data.maxQuota,
      });

      // Fire confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (_) {}

      if (onExamCreated) {
        onExamCreated();
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง");
    }
  };

  const handleResetModal = () => {
    setStatus("idle");
    setErrorMessage("");
    setSuccessInfo(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-sans">
      <div
        className="bg-white border border-slate-200/90 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-50/60 via-amber-50/30 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#BD1B0B] text-white flex items-center justify-center shadow-md shadow-red-950/20">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>สร้างข้อสอบเข้าคลังรวม</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-[#BD1B0B]">
                  AI Grounded
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                คัดเลือกบทเรียน • อิงฐานข้อมูลจริง • ป้องกันข้อซ้ำ 100%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Daily Quota Indicator */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2.5">
              <Flame className="w-5 h-5 text-amber-500" />
              <div>
                <div className="text-xs font-bold text-slate-700">โควต้าของคุณวันนี้</div>
                <div className="text-[11px] text-slate-400 font-medium">
                  รีเซ็ตโควต้าอัตโนมัติเวลา 00:00 น.
                </div>
              </div>
            </div>
            <div className="text-right">
              {isLoadingQuota ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-2xs">
                  <span className="text-xs font-black text-[#BD1B0B]">
                    เหลือ {quota.remainingToday} / {quota.maxQuota}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">ครั้ง</span>
                </div>
              )}
            </div>
          </div>

          {/* Idle / Selection Screen */}
          {status === "idle" && (
            <div className="space-y-4">
              {/* Category Select */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  1. เลือกหมวดหมู่วิชา
                </label>
                <select
                  value={selectedSubjectKey}
                  onChange={(e) => setSelectedSubjectKey(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-2xl px-3.5 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#BD1B0B]/30 focus:border-[#BD1B0B] transition-all"
                >
                  {subjectKeys.map((key) => {
                    const subj = SUBJECT_CHAPTERS_MAP[key];
                    return (
                      <option key={key} value={key}>
                        {subj.icon} {subj.displayName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Chapter Select */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  2. เลือกบทเรียนที่ต้องการออกข้อสอบ
                </label>
                <select
                  value={selectedChapterName}
                  onChange={(e) => setSelectedChapterName(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-2xl px-3.5 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#BD1B0B]/30 focus:border-[#BD1B0B] transition-all"
                >
                  {currentSubject?.chapters?.map((ch) => (
                    <option key={ch.id} value={ch.name}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Anti-Cheat & Knowledge Guarantee Info Box */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/70 space-y-2">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 leading-relaxed font-medium">
                    <span className="font-bold">กติกาความโปร่งใสและคลังส่วนกลาง:</span>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-amber-800">
                      <li>ข้อสอบที่สร้างจะเข้าสู่คลังข้อสอบกลางให้เพื่อนๆ ทุกคนได้ฝึกทำ</li>
                      <li>ระบบจะไม่แสดงเฉลยหรือคำอธิบายแก่ผู้สร้าง เพื่อความเท่าเทียม</li>
                      <li>คุณจะได้รับ <span className="font-bold text-[#BD1B0B]">+25 EXP</span> เมื่อสร้างสำเร็จ</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Generating / Queue Loading Screen */}
          {status === "generating" && (
            <div className="py-8 space-y-6 text-center">
              <div className="relative inline-flex items-center justify-center">
                <div className="w-20 h-20 rounded-3xl bg-red-50 border-2 border-red-200 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-10 h-10 text-[#BD1B0B] animate-spin" />
                </div>
              </div>

              <div className="space-y-2 max-w-sm mx-auto">
                <h3 className="text-base font-black text-slate-900">
                  กำลังประมวลผลข้อสอบเข้าคลังกลาง...
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {currentSubject.displayName} • {selectedChapterName}
                </p>
              </div>

              {/* Animated Progress Steps */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-3 max-w-sm mx-auto">
                <div
                  className={`flex items-center gap-3 text-xs transition-opacity duration-300 ${
                    progressStep >= 1 ? "text-slate-900 font-bold" : "text-slate-400 opacity-50"
                  }`}
                >
                  {progressStep > 1 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-[#BD1B0B] shrink-0" />
                  )}
                  <span>1. ดึงสาระสำคัญและตัวบทกฎหมายของบทเรียน...</span>
                </div>

                <div
                  className={`flex items-center gap-3 text-xs transition-opacity duration-300 ${
                    progressStep >= 2 ? "text-slate-900 font-bold" : "text-slate-400 opacity-50"
                  }`}
                >
                  {progressStep > 2 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : progressStep === 2 ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#BD1B0B] shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                  )}
                  <span>2. AI สังเคราะห์ข้อสอบ 10 ข้อตามมาตรฐานสอบตำรวจ...</span>
                </div>

                <div
                  className={`flex items-center gap-3 text-xs transition-opacity duration-300 ${
                    progressStep >= 3 ? "text-slate-900 font-bold" : "text-slate-400 opacity-50"
                  }`}
                >
                  {progressStep > 3 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : progressStep === 3 ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#BD1B0B] shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                  )}
                  <span>3. ตรวจสอบความถูกต้องและตัดข้อสอบซ้ำ (Deduplication)...</span>
                </div>
              </div>
            </div>
          )}

          {/* Success Screen */}
          {status === "success" && successInfo && (
            <div className="py-6 space-y-5 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-black px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  +25 EXP นำเข้าคลังสำเร็จ
                </span>
                <h3 className="text-xl font-black text-slate-900 pt-2">
                  เพิ่มข้อสอบ {successInfo.count} ข้อเข้าคลังส่วนกลางแล้ว!
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {successInfo.category} • {successInfo.chapterName}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span>สถานะการนำเข้า:</span>
                  <span className="font-bold text-emerald-600">สำเร็จ พร้อมใช้งาน</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>โควต้าวันนี้ที่เหลือ:</span>
                  <span className="font-bold text-slate-900">{successInfo.remainingToday} / 5 ครั้ง</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span>การแสดงเฉลย:</span>
                  <span className="text-[11px] text-amber-700 font-bold">
                    ซ่อนเฉลย (ป้องกันการทุจริต)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error Screen */}
          {status === "error" && (
            <div className="py-6 space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">
                  ไม่สามารถสร้างข้อสอบได้
                </h3>
                <p className="text-xs text-rose-600 font-medium px-4">
                  {errorMessage}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
          {status === "idle" && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={quota.remainingToday <= 0}
                onClick={handleGenerate}
                className="px-6 py-2.5 rounded-2xl text-xs font-black text-white bg-[#BD1B0B] hover:bg-[#A81507] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-red-950/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>ยืนยันสร้าง 10 ข้อ</span>
              </button>
            </>
          )}

          {status === "success" && (
            <>
              {quota.remainingToday > 0 && (
                <button
                  type="button"
                  onClick={handleResetModal}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  สร้างต่ออีกบท
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-2xl text-xs font-black text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition-all cursor-pointer"
              >
                เสร็จสิ้น
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={handleResetModal}
                className="px-5 py-2.5 rounded-2xl text-xs font-black text-white bg-[#BD1B0B] hover:bg-[#A81507] transition-all cursor-pointer"
              >
                ลองใหม่อีกครั้ง
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
