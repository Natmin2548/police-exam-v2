"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Swords,
  Crown,
  KeyRound,
  Sparkles,
  Flame,
  Shield,
  Coins,
  RefreshCw,
  Play,
  Loader2,
  Trophy,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav";

interface ActiveRoom {
  roomCode: string;
  title: string;
  hostName: string;
  category: string;
  totalQ: number;
  memberCount: number;
  maxMembers: number;
  createdAt: string;
}

export default function ArenaLobbyPage() {
  const router = useRouter();
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // Join by PIN state
  const [pinInput, setPinInput] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Create Room Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("รวมทุกวิชา");
  const [selectedTotalQ, setSelectedTotalQ] = useState(5);
  const [isCreating, setIsCreating] = useState(false);

  // Quick Match state
  const [isQuickMatching, setIsQuickMatching] = useState(false);

  const fetchRooms = async () => {
    try {
      setLoadingRooms(true);
      const res = await authFetch("/api/arena/room?mode=active_rooms");
      if (res.ok) {
        const data = await res.json();
        setActiveRooms(data.rooms || []);
      }
    } catch (e) {
      console.error("Error fetching rooms:", e);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleQuickMatch = async () => {
    try {
      setIsQuickMatching(true);
      const res = await authFetch("/api/arena/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quick_match" }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.roomCode) {
          router.push(`/arena/${data.roomCode}`);
        }
      }
    } catch (e) {
      console.error("Quick match failed:", e);
    } finally {
      setIsQuickMatching(false);
    }
  };

  const handleJoinWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;

    try {
      setIsJoining(true);
      setJoinError("");
      const res = await authFetch("/api/arena/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          roomCode: pinInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push(`/arena/${pinInput.trim()}`);
      } else {
        setJoinError(data.error || "ไม่สามารถเข้าร่วมห้องนี้ได้");
      }
    } catch (err: any) {
      setJoinError(err.message || "เกิดข้อผิดพลาดในการเข้าร่วม");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateRoom = async () => {
    try {
      setIsCreating(true);
      const res = await authFetch("/api/arena/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          category: selectedCategory,
          totalQ: selectedTotalQ,
        }),
      });

      const data = await res.json();
      if (res.ok && data.roomCode) {
        router.push(`/arena/${data.roomCode}`);
      } else {
        alert(data.error || "เกิดข้อผิดพลาดในการสร้างห้อง");
      }
    } catch (err: any) {
      alert(err.message || "ไม่สามารถสร้างห้องได้");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 sm:pb-12 text-slate-800">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/home"
              className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-[#BD1B0B] hover:border-red-200 transition-colors shadow-2xs"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  <Swords className="w-5 h-5 text-[#BD1B0B]" />
                  สนามประลองชิงทอง 1-8 คน
                </h1>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  PARTY QUIZ
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                ตอบเร็ว ชิงทอง ปล้นเพื่อน และสุ่มกล่องไอเทมสไตล์ Kahoot
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            <Users className="w-4 h-4 text-[#BD1B0B]" />
            <span>รองรับ 1-8 คนต่อห้อง</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 space-y-6">
        {/* Banner Action Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Quick Match */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#BD1B0B] via-[#D32F2F] to-[#E53935] text-white rounded-3xl p-6 shadow-lg shadow-red-600/20 flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-white/20 text-white mb-3 backdrop-blur-xs">
                <Flame className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                <span>เล่นไว ไม่ต้องรอนาน</span>
              </div>
              <h2 className="text-xl font-black tracking-tight mb-1">
                สุ่มเข้าห้องทันที
              </h2>
              <p className="text-xs text-red-100 font-medium leading-relaxed mb-6">
                ระบบจะค้นหาห้องที่มีคนรออยู่ให้ทันที หรือเปิดห้องใหม่ให้คุณเป็นหัวหน้าห้อง
              </p>
            </div>
            <button
              onClick={handleQuickMatch}
              disabled={isQuickMatching}
              className="cursor-pointer w-full py-3.5 px-4 bg-white hover:bg-slate-50 text-[#BD1B0B] text-xs font-black rounded-2xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              {isQuickMatching ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#BD1B0B]" />
              ) : (
                <Play className="w-4 h-4 fill-[#BD1B0B]" />
              )}
              <span>{isQuickMatching ? "กำลังค้นหาห้อง..." : "กดสุ่มห้องเลย (Quick Match)"}</span>
            </button>
          </div>

          {/* Card 2: Create Custom Room */}
          <div className="bg-white border-2 border-slate-200/80 hover:border-amber-400/60 rounded-3xl p-6 shadow-sm flex flex-col justify-between transition-all">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 mb-3">
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span>เป็นหัวหน้าห้อง</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight mb-1">
                สร้างห้องประลอง
              </h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6">
                เลือกหมวดวิชาและจำนวนข้อสอบ ได้รับรหัส PIN 6 หลักชวนเพื่อนมาเล่นด้วยกัน
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="cursor-pointer w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-2xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <Crown className="w-4 h-4 text-amber-400" />
              <span>สร้างห้องใหม่</span>
            </button>
          </div>

          {/* Card 3: Join with PIN */}
          <div className="bg-white border-2 border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 mb-3">
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                <span>มีรหัสห้องแล้ว</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight mb-1">
                เข้าร่วมด้วย PIN
              </h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mb-3">
                กรอกรหัส PIN 6 หลักที่เพื่อนส่งให้ เพื่อกระโดดเข้าห้องทันที
              </p>
            </div>

            <form onSubmit={handleJoinWithPin} className="space-y-2">
              <input
                type="text"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                placeholder="กรอก PIN 6 หลัก..."
                className="w-full text-center text-lg font-black tracking-widest py-2.5 px-4 border-2 border-slate-200 rounded-xl focus:border-red-500 focus:outline-hidden bg-slate-50 transition-all uppercase"
              />
              {joinError && (
                <p className="text-[11px] text-red-600 font-bold text-center">
                  {joinError}
                </p>
              )}
              <button
                type="submit"
                disabled={isJoining || pinInput.length < 6}
                className="cursor-pointer w-full py-3 px-4 bg-[#BD1B0B] hover:bg-[#A81507] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                {isJoining ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <KeyRound className="w-4 h-4" />
                )}
                <span>เข้าร่วมห้อง</span>
              </button>
            </form>
          </div>
        </div>

        {/* Game Rules / Highlights Banner */}
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border border-amber-200/80 rounded-3xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm sm:text-base font-black text-slate-900">
              กฎกติกาการชิงทองคำ & สุ่มกล่องปริศนา
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-semibold text-slate-700">
            <div className="flex items-start gap-2.5 bg-white/80 p-3 rounded-2xl border border-amber-200/60 shadow-2xs">
              <Coins className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900 mb-0.5">ตอบเร็ว ได้ทองเยอะ</strong>
                ตอบถูกได้ฐาน 100G + โบนัสความเร็ววินาทีที่เหลือ
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-white/80 p-3 rounded-2xl border border-amber-200/60 shadow-2xs">
              <Trophy className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900 mb-0.5">กล่องสุ่ม 3 ใบ</strong>
                ตอบถูกมีสิทธิ์เลือก 1 กล่อง ลุ้นทองโบนัส หรือปล้นทองเพื่อน
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-white/80 p-3 rounded-2xl border border-amber-200/60 shadow-2xs">
              <Shield className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900 mb-0.5">ระวังกับดัก & มีโล่</strong>
                ลุ้นได้โล่ป้องกันการขโมย หรืออาจเผลอเปิดเจอกับดักระเบิด!
              </div>
            </div>
          </div>
        </div>

        {/* Section: ห้องสาธารณะที่กำลังรอคน */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-700" />
              <h3 className="text-base font-black text-slate-900">
                ห้องสาธารณะที่เปิดอยู่ ({activeRooms.length})
              </h3>
            </div>
            <button
              onClick={fetchRooms}
              disabled={loadingRooms}
              className="cursor-pointer text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRooms ? "animate-spin" : ""}`} />
              <span>รีเฟรช</span>
            </button>
          </div>

          {loadingRooms ? (
            <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#BD1B0B]" />
              <span>กำลังโหลดรายการห้อง...</span>
            </div>
          ) : activeRooms.length === 0 ? (
            <div className="py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700 mb-1">
                ยังไม่มีห้องที่กำลังรอคนในขณะนี้
              </p>
              <p className="text-xs text-slate-400 mb-4">
                คุณสามารถเป็นคนแรกที่เปิดห้อง แล้วชวนเพื่อนหรือรอคนอื่นสุ่มเข้ามาได้เลย!
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="cursor-pointer px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md hover:bg-slate-800 transition-all"
              >
                + สร้างห้องประลองใหม่
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {activeRooms.map((room) => (
                <div
                  key={room.roomCode}
                  className="p-4 rounded-2xl border border-slate-200/80 hover:border-red-300 hover:shadow-md transition-all flex flex-col justify-between gap-3 bg-slate-50/50"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        PIN: {room.roomCode}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {room.memberCount}/{room.maxMembers} คน
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-800 line-clamp-1">
                      {room.title}
                    </h4>
                    <p className="text-xs text-slate-400 font-medium">
                      หัวหน้า: {room.hostName} • {room.totalQ} ข้อ
                    </p>
                  </div>

                  <Link
                    href={`/arena/${room.roomCode}`}
                    className="w-full py-2 bg-[#BD1B0B] hover:bg-[#A81507] text-white text-xs font-black rounded-xl text-center shadow-xs transition-all"
                  >
                    เข้าร่วมห้องนี้ ➔
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal: Create Room */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                ตั้งค่าห้องประลองใหม่
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Category selection */}
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-700 block mb-2">
                หมวดวิชาข้อสอบ
              </label>
              <div className="grid grid-cols-2 gap-2">
                {["รวมทุกวิชา", "กฎหมาย", "คอมพิวเตอร์", "ภาษาไทย"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`cursor-pointer py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedCategory === cat
                        ? "bg-red-50 border-[#BD1B0B] text-[#BD1B0B] shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Question count */}
            <div className="mb-6">
              <label className="text-xs font-bold text-slate-700 block mb-2">
                จำนวนข้อสอบต่อเกม
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSelectedTotalQ(num)}
                    className={`cursor-pointer py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedTotalQ === num
                        ? "bg-slate-900 border-slate-900 text-white shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {num} ข้อ (ประมาณ {num * 20} วินาที)
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="cursor-pointer flex-1 py-3 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={isCreating}
                className="cursor-pointer flex-1 py-3 rounded-xl text-xs font-black bg-[#BD1B0B] hover:bg-[#A81507] text-white shadow-md flex items-center justify-center gap-1.5 transition-all"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>ยืนยันสร้างห้อง</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
