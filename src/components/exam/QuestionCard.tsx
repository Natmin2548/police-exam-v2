"use client";

import React, { useState } from "react";

const THAI_LETTERS = ["ก", "ข", "ค", "ง"];

export interface QuestionCardProps {
  questionNumber?: number;
  totalQuestions?: number;
  chapter?: string;
  questionText: string;
  choices: string[];
  correctAnswer?: number; // 0=ก, 1=ข, 2=ค, 3=ง
  selectedChoice?: number;
  isReviewMode?: boolean;
  explanation?: string;
  reference?: string;
  onSelectChoice?: (choiceIndex: number) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  questionNumber = 1,
  totalQuestions = 1,
  chapter,
  questionText,
  choices,
  correctAnswer,
  selectedChoice: controlledSelectedChoice,
  isReviewMode = false,
  explanation,
  reference,
  onSelectChoice,
}) => {
  // Local state fallback if not controlled externally
  const [internalSelected, setInternalSelected] = useState<number | undefined>(undefined);
  const selectedIndex = controlledSelectedChoice !== undefined ? controlledSelectedChoice : internalSelected;

  const handleSelect = (idx: number) => {
    if (isReviewMode) return;
    setInternalSelected(idx);
    if (onSelectChoice) {
      onSelectChoice(idx);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-200/90 font-sans transition-all">
      {/* Question Header & Subject Badge */}
      <div className="flex items-center justify-between gap-3 mb-5 pb-3.5 border-b border-slate-100">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-xs sm:text-sm font-bold text-[#BD1B0B]">
          <span>ข้อที่ {questionNumber}</span>
          {totalQuestions > 1 && <span className="text-red-400 font-normal">/ {totalQuestions} ข้อ</span>}
        </div>

        {chapter && (
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg truncate max-w-[200px]">
            {chapter}
          </span>
        )}
      </div>

      {/* Question Text */}
      <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 leading-relaxed mb-6">
        {questionText}
      </h2>

      {/* 4 Choices (ก, ข, ค, ง) */}
      <div className="space-y-3">
        {choices.map((choiceText, idx) => {
          const isSelected = selectedIndex === idx;
          const isCorrect = correctAnswer !== undefined && idx === correctAnswer;

          let btnStyle =
            "w-full text-left p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border font-medium transition-all flex items-center gap-3.5 sm:gap-4 cursor-pointer active:scale-[0.99] touch-manipulation ";
          let badgeStyle =
            "w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-bold text-sm sm:text-base shrink-0 transition-all ";

          if (isReviewMode) {
            if (isCorrect) {
              // ข้อที่ถูกต้อง (สีเขียวมรกต)
              btnStyle += "bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-bold shadow-xs";
              badgeStyle += "bg-emerald-600 text-white shadow-xs";
            } else if (isSelected) {
              // ข้อที่ผู้เรียนตอบผิด (สีแดง)
              btnStyle += "bg-red-50 border-2 border-red-600 text-red-950 font-bold shadow-xs";
              badgeStyle += "bg-red-600 text-white shadow-xs";
            } else {
              // ข้ออื่นๆ ที่ไม่ได้ตอบ
              btnStyle += "bg-white border-slate-200 text-slate-400 opacity-60";
              badgeStyle += "bg-slate-100 text-slate-400";
            }
          } else {
            // โหมดทำข้อสอบปกติ
            if (isSelected) {
              // ตัวเลือกที่กดเลือก (สไตล์ V2 ตาม Blueprint: กรอบแดงเลือดหมู พื้นหลังแดงอ่อน)
              btnStyle += "bg-red-50 border-2 border-[#BD1B0B] text-red-950 font-bold shadow-sm";
              badgeStyle += "bg-[#BD1B0B] text-white shadow-xs";
            } else {
              // ตัวเลือกปกติ (สีขาว คลีนๆ)
              btnStyle += "bg-white border-slate-200 text-slate-700 hover:border-red-300 hover:bg-slate-50/80";
              badgeStyle += "bg-slate-100 text-slate-600";
            }
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={isReviewMode}
              onClick={() => handleSelect(idx)}
              className={btnStyle}
            >
              <div className={badgeStyle}>{THAI_LETTERS[idx]}</div>
              <span className="flex-1 text-sm sm:text-base leading-snug">{choiceText}</span>
            </button>
          );
        })}
      </div>

      {/* Explanation Box (Review Mode Only) */}
      {isReviewMode && explanation && (
        <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 text-xs sm:text-sm leading-relaxed animate-fade-in">
          <div className="font-extrabold mb-1.5 flex items-center gap-1.5 text-amber-900">
            <span>คำอธิบายเฉลยละเอียด:</span>
          </div>
          <p className="text-slate-700 leading-relaxed">{explanation}</p>
          {reference && (
            <div className="mt-3 pt-2.5 border-t border-amber-200/60 text-[11px] sm:text-xs text-amber-800 font-semibold">
              แหล่งอ้างอิง: {reference}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
