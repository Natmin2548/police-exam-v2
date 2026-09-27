"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Target,
  Flame,
  Sparkles,
  BookOpen,
  Languages,
  Trophy,
  CheckCircle2,
  ChevronRight,
  Zap,
  Award,
  Loader2,
} from "lucide-react";
import confetti from "canvas-confetti";
import { authFetch } from "@/lib/authFetch";

interface Mission {
  questKey: string;
  title: string;
  description: string;
  targetCount: number;
  currentCount: number;
  rewardExp: number;
  category: string;
  icon: string;
  isCompleted: boolean;
  isClaimed: boolean;
}

interface MissionsData {
  streak: number;
  level: number;
  exp: number;
  currentExpInLevel: number;
  expPerLevel: number;
  expToNextLevel: number;
  missions: Mission[];
}

export function DailyMissionsCard() {
  const [data, setData] = useState<MissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);

  const fetchMissions = async () => {
    try {
      const res = await authFetch(`/api/user/missions?_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setData(json);
        }
      }
    } catch (err) {
      console.error("Failed to fetch daily missions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissions();
  }, []);

  const handleClaim = async (questKey: string) => {
    if (claimingKey) return;
    setClaimingKey(questKey);
    try {
      const res = await authFetch("/api/user/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", questKey }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          // 🎉 Confetti effect
          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.7 },
              colors: ["#BD1B0B", "#F59E0B", "#10B981", "#3B82F6"],
            });
          } catch (e) {}

          // Refresh missions data
          fetchMissions();
        }
      }
    } catch (err) {
      console.error("Error claiming reward:", err);
    } finally {
      setClaimingKey(null);
    }
  };

  const getMissionIcon = (iconName: string) => {
    switch (iconName) {
      case "Sparkles":
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case "BookOpen":
        return <BookOpen className="w-4 h-4 text-blue-500" />;
      case "Languages":
        return <Languages className="w-4 h-4 text-purple-500" />;
      case "Trophy":
        return <Trophy className="w-4 h-4 text-emerald-500" />;
      default:
        return <Target className="w-4 h-4 text-[#BD1B0B]" />;
    }
  };

  const getMissionActionLink = (questKey: string) => {
    switch (questKey) {
      case "VOCAB_MASTERY":
        return "/vocab";
      case "EXAM_PRACTICE":
      case "HIGH_ACCURACY":
        return "/exam";
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs animate-pulse">
        <div className="h-5 bg-slate-100 rounded-lg w-1/3 mb-4" />
        <div className="space-y-3">
          <div className="h-14 bg-slate-50 rounded-2xl" />
          <div className="h-14 bg-slate-50 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const completedCount = data.missions.filter((m) => m.isCompleted).length;
  const totalCount = data.missions.length;
  const expProgressPct = Math.min(100, Math.round((data.currentExpInLevel / data.expPerLevel) * 100));

  return (
    <div className="relative overflow-hidden bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm">
      {/* Decorative gradient glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-amber-100/40 via-red-50/20 to-transparent rounded-full blur-2xl pointer-events-none" />

      {/* Top Header: Level & Streak */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Target className="w-5 h-5 text-[#BD1B0B]" />
              ภารกิจประจำวัน
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {completedCount}/{totalCount} สำเร็จ
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            สะสม EXP เพื่อเลื่อนระดับและรักษาสตรีคความต่อเนื่อง
          </p>
        </div>

        {/* Streak & Level Badges */}
        <div className="flex items-center gap-2">
          {/* Streak Flame */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200/80 text-orange-700 shadow-2xs font-black text-xs"
            title={`ทำต่อเนื่องติดต่อกัน ${data.streak} วัน`}
          >
            <Flame className="w-4 h-4 fill-orange-500 text-orange-600 animate-pulse" />
            <span>{data.streak} วัน</span>
          </div>

          {/* Level Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/80 text-[#BD1B0B] shadow-2xs font-black text-xs">
            <Award className="w-4 h-4 text-[#BD1B0B]" />
            <span>Lv. {data.level}</span>
          </div>
        </div>
      </div>

      {/* Level EXP Progress Bar */}
      <div className="relative mb-5 bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
          <div className="flex items-center gap-1.5 text-slate-700">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span>ความก้าวหน้าระดับ {data.level}</span>
          </div>
          <span className="text-slate-500 font-semibold text-[11px]">
            {data.currentExpInLevel} / {data.expPerLevel} EXP (อีก {data.expToNextLevel} EXP ขึ้น Lv.{data.level + 1})
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-[#BD1B0B] rounded-full transition-all duration-700 ease-out shadow-xs"
            style={{ width: `${expProgressPct}%` }}
          />
        </div>
      </div>

      {/* Mission List */}
      <div className="relative space-y-2.5">
        {data.missions.map((mission) => {
          const actionLink = getMissionActionLink(mission.questKey);
          const progressPct = Math.min(
            100,
            Math.round((mission.currentCount / mission.targetCount) * 100)
          );

          return (
            <div
              key={mission.questKey}
              className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                mission.isClaimed
                  ? "bg-slate-50/70 border-slate-200/60 opacity-75"
                  : mission.isCompleted
                  ? "bg-emerald-50/50 border-emerald-200/80 shadow-xs"
                  : "bg-white border-slate-200/80 hover:border-slate-300"
              }`}
            >
              {/* Mission Details */}
              <div className="flex items-start sm:items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    mission.isCompleted
                      ? "bg-emerald-100/70 border-emerald-200"
                      : "bg-slate-100 border-slate-200/70"
                  }`}
                >
                  {mission.isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    getMissionIcon(mission.icon)
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      {mission.title}
                    </h3>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
                      +{mission.rewardExp} EXP
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    {mission.description}
                  </p>
                </div>
              </div>

              {/* Progress & Action Button */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                {/* Progress Number */}
                <div className="text-right">
                  <span className="text-xs font-black text-slate-700">
                    {mission.currentCount}/{mission.targetCount}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-medium">
                    {progressPct}%
                  </span>
                </div>

                {/* Claim / Action Buttons */}
                {mission.isClaimed ? (
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/60">
                    รับแล้ว
                  </span>
                ) : mission.isCompleted ? (
                  <button
                    onClick={() => handleClaim(mission.questKey)}
                    disabled={claimingKey === mission.questKey}
                    className="cursor-pointer px-4 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-1.5 animate-bounce-subtle"
                  >
                    {claimingKey === mission.questKey ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>รับรางวัล</span>
                  </button>
                ) : actionLink ? (
                  <Link
                    href={actionLink}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1"
                  >
                    <span>ไปทำ</span>
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  </Link>
                ) : (
                  <span className="text-xs font-medium text-slate-400">กำลังทำ</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
