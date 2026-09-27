"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Crown,
  Users,
  Copy,
  Check,
  Play,
  Flame,
  Shield,
  Coins,
  Sparkles,
  Trophy,
  Loader2,
  Volume2,
  VolumeX,
  AlertCircle,
  HelpCircle,
  Clock,
  Swords,
} from "lucide-react";
import confetti from "canvas-confetti";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";
import { gameSounds } from "@/lib/gameSounds";

interface Member {
  id: number;
  userId: number;
  username: string;
  avatar: string | null;
  gold: number;
  streak: number;
  hasShield: boolean;
  isHost: boolean;
  isAnswered: boolean;
  isCurrentMember?: boolean;
  hasPickedChest?: boolean;
  pickedChest?: number | null;
}

interface QuestionItem {
  id: number;
  questionText: string;
  choices: string[];
  category: string;
  correctAnswer?: number;
  explanation?: string;
}

interface RoomData {
  id: string;
  roomCode: string;
  title: string;
  hostId: number;
  hostName: string;
  status: "LOBBY" | "PLAYING" | "FINISHED";
  category: string;
  totalQ: number;
  currentQIdx: number;
  questions: QuestionItem[];
  members: Member[];
}

const CHOICE_COLORS = [
  { bg: "bg-red-500 hover:bg-red-600", text: "text-white", border: "border-red-600", label: "ก" },
  { bg: "bg-blue-500 hover:bg-blue-600", text: "text-white", border: "border-blue-600", label: "ข" },
  { bg: "bg-amber-500 hover:bg-amber-600", text: "text-white", border: "border-amber-600", label: "ค" },
  { bg: "bg-emerald-500 hover:bg-emerald-600", text: "text-white", border: "border-emerald-600", label: "ง" },
];

const QUESTION_TIME_LIMIT = 90; // ข้อละ 1.5 นาที (90 วินาที)

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

export default function ArenaRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.code as string;

  const [room, setRoom] = useState<RoomData | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [serverIsHost, setServerIsHost] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Sound & Copy state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copiedPin, setCopiedPin] = useState(false);

  // In-Game Question State (90 วินาที = 1.5 นาทีต่อข้อ)
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<{
    isCorrect: boolean;
    gainedGold: number;
    explanation?: string;
    correctAnswer?: number;
  } | null>(null);

  // Mystery Chest State (เมื่อตอบถูก)
  const [showChestModal, setShowChestModal] = useState(false);
  const [isOpeningChest, setIsOpeningChest] = useState(false);
  const [chestOutcome, setChestOutcome] = useState<{
    effectType: string;
    message: string;
    goldDelta: number;
  } | null>(null);

  // Round summary & ticker alerts
  const [showRoundSummary, setShowRoundSummary] = useState(false);
  const [tickerMessage, setTickerMessage] = useState<string | null>(null);

  // Podium / Game over state
  const [podiumData, setPodiumData] = useState<any[] | null>(null);

  // Action loaders & state
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isAdvancingRound, setIsAdvancingRound] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const prevMembersCount = useRef<number>(0);
  const currentQIdxRef = useRef<number>(0);

  // ---------------------------------------------------------------------------
  // 1. Fetch Room Data
  // ---------------------------------------------------------------------------
  const fetchRoomData = useCallback(async () => {
    try {
      const res = await authFetch(`/api/arena/room?roomCode=${roomCode}`);
      if (res.ok) {
        const json = await res.json();
        setRoom(json.room);
        if (json.currentUserId) setCurrentUserId(json.currentUserId);
        if (typeof json.isHost === "boolean") setServerIsHost(json.isHost);

        if (json.room?.members) {
          if (prevMembersCount.current > 0 && json.room.members.length > prevMembersCount.current) {
            if (soundEnabled) gameSounds.playTick();
          }
          prevMembersCount.current = json.room.members.length;
        }

        // Auto-advance client if server moved to a new question index
        if (
          json.room &&
          json.room.status === "PLAYING" &&
          json.room.currentQIdx !== currentQIdxRef.current
        ) {
          currentQIdxRef.current = json.room.currentQIdx;
          resetQuestionRound();
        }

        return json.room;
      } else {
        const errJson = await res.json();
        setErrorMsg(errJson.error || "ไม่พบห้องนี้");
      }
    } catch (e: any) {
      setErrorMsg("เกิดข้อผิดพลาดในการโหลดข้อมูลห้อง");
    } finally {
      setLoading(false);
    }
    return null;
  }, [roomCode, soundEnabled]);

  // ---------------------------------------------------------------------------
  // 2. Setup User & Supabase Realtime Channel
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let activeChannel: any = null;

    const setupAuthAndRealtime = async () => {
      // 1. Check current logged in user
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
      }

      // 2. Initial Fetch
      await fetchRoomData();

      // 3. Connect to Supabase Realtime Channel
      const channel = supabase.channel(`arena_party_${roomCode}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "REFRESH_ROOM" }, () => {
          fetchRoomData();
        })
        .on("broadcast", { event: "GAME_STARTED" }, () => {
          fetchRoomData().then(() => {
            resetQuestionRound();
          });
        })
        .on("broadcast", { event: "ALERT_TICKER" }, (payload) => {
          setTickerMessage(payload.payload?.message || null);
          setTimeout(() => setTickerMessage(null), 4000);
        })
        .on("broadcast", { event: "NEXT_QUESTION" }, () => {
          fetchRoomData().then(() => {
            resetQuestionRound();
          });
        })
        .on("broadcast", { event: "GAME_OVER" }, () => {
          finishGame();
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            // ✅ Notify all other players in the room immediately
            channel.send({
              type: "broadcast",
              event: "REFRESH_ROOM",
              payload: { event: "MEMBER_JOINED" },
            });
          }
        });

      activeChannel = channel;
      channelRef.current = channel;
    };

    setupAuthAndRealtime();

    return () => {
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomCode, fetchRoomData]);

  // ---------------------------------------------------------------------------
  // Auto-polling fallback in LOBBY (every 2.5s) to guarantee player updates
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!room || room.status !== "LOBBY") return;
    const interval = setInterval(() => {
      fetchRoomData();
    }, 2500);
    return () => clearInterval(interval);
  }, [room?.status, fetchRoomData]);

  // ---------------------------------------------------------------------------
  // Action: Leave Room (Deletes room if empty or transfers host)
  // ---------------------------------------------------------------------------
  const handleLeaveRoom = useCallback(
    async (destination = "/arena") => {
      if (isLeaving) return;
      setIsLeaving(true);

      try {
        // Broadcast leave event immediately
        channelRef.current?.send({
          type: "broadcast",
          event: "REFRESH_ROOM",
          payload: { event: "MEMBER_LEFT", userId: currentUserId },
        });

        await authFetch("/api/arena/room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "leave",
            roomCode,
            userId: currentUserId,
            email: currentUser?.email,
          }),
        });
      } catch (e) {
        console.error("Error leaving room:", e);
      } finally {
        router.push(destination);
      }
    },
    [isLeaving, roomCode, currentUserId, currentUser?.email, router]
  );

  // Send leave signal on tab close or browser navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!roomCode) return;
      const payload = JSON.stringify({
        action: "leave",
        roomCode,
        userId: currentUserId,
        email: currentUser?.email,
      });
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/arena/room", blob);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [roomCode, currentUserId, currentUser?.email]);

  // ---------------------------------------------------------------------------
  // 3. Round Countdown Timer (1.5 นาที = 90 วินาที)
  // ---------------------------------------------------------------------------
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(QUESTION_TIME_LIMIT);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeOut();
          return 0;
        }
        if (prev <= 10 && soundEnabled) {
          gameSounds.playTick();
        }
        return prev - 1;
      });
    }, 1000);
  }, [soundEnabled]);

  const resetQuestionRound = () => {
    setSelectedChoice(null);
    setAnswerResult(null);
    setShowChestModal(false);
    setChestOutcome(null);
    setShowRoundSummary(false);
    startTimer();
  };

  const handleTimeOut = () => {
    // If player didn't answer in time -> ตอบผิด ไม่ได้กล่องสุ่ม
    setSelectedChoice((current) => {
      if (current === null) {
        if (soundEnabled) gameSounds.playWrong();
        setAnswerResult({
          isCorrect: false,
          gainedGold: 0,
          explanation: "หมดเวลาทำข้อสอบแล้ว! (ไม่ได้รับสิทธิ์เปิดกล่องสุ่ม)",
        });

        // ส่งผลหมดเวลาไปยังเซิร์ฟเวอร์
        authFetch("/api/arena/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "answer",
            roomCode,
            choice: 0,
            timeRemaining: 0,
          }),
        }).then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            if (data.autoAdvanced) {
              setTimeout(() => {
                if (data.isFinished) {
                  channelRef.current?.send({ type: "broadcast", event: "GAME_OVER", payload: {} });
                  finishGame();
                } else {
                  channelRef.current?.send({ type: "broadcast", event: "NEXT_QUESTION", payload: {} });
                  fetchRoomData().then(() => resetQuestionRound());
                }
              }, 1500);
            }
          }
        });
      }
      return current;
    });
    setShowChestModal(false);
    setTimeout(() => setShowRoundSummary(true), 1500);
  };

  // ---------------------------------------------------------------------------
  // 4. Action: Start Game (Host only)
  // ---------------------------------------------------------------------------
  const handleStartGame = async () => {
    try {
      setIsStartingGame(true);
      const res = await authFetch("/api/arena/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", roomCode }),
      });

      if (res.ok) {
        // Broadcast to everyone
        channelRef.current?.send({
          type: "broadcast",
          event: "GAME_STARTED",
          payload: {},
        });
        await fetchRoomData();
        resetQuestionRound();
      }
    } catch (e) {
      console.error("Error starting game:", e);
    } finally {
      setIsStartingGame(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. Action: Answer Question
  // ---------------------------------------------------------------------------
  const handleAnswer = async (choiceIndex: number) => {
    if (selectedChoice !== null || !room) return;
    setSelectedChoice(choiceIndex);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const res = await authFetch("/api/arena/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          roomCode,
          choice: choiceIndex,
          timeRemaining: timeLeft,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAnswerResult({
          isCorrect: data.isCorrect,
          gainedGold: data.gainedGold,
          explanation: data.explanation,
          correctAnswer: data.correctAnswer,
        });

        if (data.isCorrect) {
          if (soundEnabled) gameSounds.playCorrect();
          // 🎁 เฉพาะคนที่ตอบถูกเท่านั้นที่ได้เปิดกล่องสุ่ม!
          setTimeout(() => setShowChestModal(true), 800);
        } else {
          if (soundEnabled) gameSounds.playWrong();
          // ❌ คนที่ตอบผิด ไม่ได้กล่องสุ่มเด็ดขาด
          setShowChestModal(false);
          setTimeout(() => setShowRoundSummary(true), 2500);
        }

        // Notify room members
        channelRef.current?.send({
          type: "broadcast",
          event: "REFRESH_ROOM",
          payload: {},
        });

        // 🚀 ถ้าทุกคนตอบและเปิดกล่องครบแล้ว -> ข้ามไปข้อถัดไปทันทีอัตโนมัติ!
        if (data.autoAdvanced) {
          setTimeout(() => {
            if (data.isFinished) {
              channelRef.current?.send({
                type: "broadcast",
                event: "GAME_OVER",
                payload: {},
              });
              finishGame();
            } else {
              channelRef.current?.send({
                type: "broadcast",
                event: "NEXT_QUESTION",
                payload: {},
              });
              fetchRoomData().then(() => resetQuestionRound());
            }
          }, 2000);
        }
      }
    } catch (e) {
      console.error("Answer submit error:", e);
    }
  };

  // ---------------------------------------------------------------------------
  // 6. Action: Open Mystery Chest
  // ---------------------------------------------------------------------------
  const handlePickChest = async (chestIndex: number) => {
    if (isOpeningChest) return;
    setIsOpeningChest(true);

    try {
      const res = await authFetch("/api/arena/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open_chest",
          roomCode,
          chestIndex,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (soundEnabled) gameSounds.playChestOpen();

        try {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        } catch (e) {}

        setChestOutcome({
          effectType: data.effectType,
          message: data.message,
          goldDelta: data.goldDelta,
        });

        // Broadcast ticker alert to all players!
        channelRef.current?.send({
          type: "broadcast",
          event: "ALERT_TICKER",
          payload: { message: data.message },
        });

        channelRef.current?.send({
          type: "broadcast",
          event: "REFRESH_ROOM",
          payload: {},
        });

        // After 2.5 seconds, close modal and show leaderboard summary
        setTimeout(() => {
          setShowChestModal(false);
          setShowRoundSummary(true);
          setIsOpeningChest(false);
        }, 2500);

        // 🚀 ถ้าทุกคนตอบและเลือกกล่องครบแล้ว -> ไปข้อถัดไปทันทีอัตโนมัติ!
        if (data.autoAdvanced) {
          setTimeout(() => {
            if (data.isFinished) {
              channelRef.current?.send({
                type: "broadcast",
                event: "GAME_OVER",
                payload: {},
              });
              finishGame();
            } else {
              channelRef.current?.send({
                type: "broadcast",
                event: "NEXT_QUESTION",
                payload: {},
              });
              fetchRoomData().then(() => resetQuestionRound());
            }
          }, 2300);
        }
      } else {
        const err = await res.json();
        alert(err.error || "ไม่สามารถเปิดกล่องนี้ได้");
        await fetchRoomData();
        setIsOpeningChest(false);
      }
    } catch (e) {
      console.error("Chest pick error:", e);
      setIsOpeningChest(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 7. Action: Next Question
  // ---------------------------------------------------------------------------
  const handleNextQuestion = async () => {
    try {
      setIsAdvancingRound(true);
      const res = await authFetch("/api/arena/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "next_question", roomCode }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.isFinished) {
          channelRef.current?.send({
            type: "broadcast",
            event: "GAME_OVER",
            payload: {},
          });
          finishGame();
        } else {
          channelRef.current?.send({
            type: "broadcast",
            event: "NEXT_QUESTION",
            payload: {},
          });
          await fetchRoomData();
          resetQuestionRound();
        }
      }
    } catch (e) {
      console.error("Advance round error:", e);
    } finally {
      setIsAdvancingRound(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 8. Action: Finish Game (Podium)
  // ---------------------------------------------------------------------------
  const finishGame = async () => {
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      const res = await authFetch("/api/arena/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode }),
      });

      if (res.ok) {
        const data = await res.json();
        setPodiumData(data.podium || []);
        if (soundEnabled) gameSounds.playVictory();
        try {
          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.5 },
          });
        } catch (e) {}
      }
    } catch (e) {
      console.error("Finish game error:", e);
    }
  };

  const copyPinToClipboard = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(roomCode);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER: Loading or Error
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#BD1B0B] mb-3" />
        <p className="text-sm font-bold text-slate-300">กำลังเชื่อมต่อห้องประลอง {roomCode}...</p>
      </div>
    );
  }

  if (errorMsg || !room) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h2 className="text-lg font-black mb-1">ไม่สามารถเข้าสู่ห้องได้</h2>
        <p className="text-xs text-slate-400 mb-6">{errorMsg || "ไม่พบห้องประลอง"}</p>
        <Link
          href="/arena"
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
        >
          กลับหน้าล็อบบี้
        </Link>
      </div>
    );
  }

  const currentMember = room.members.find(
    (m: any) =>
      (currentUserId && m.userId === currentUserId) ||
      m.isCurrentMember ||
      (currentUser?.email && m.username?.toLowerCase().includes(currentUser.email.split("@")[0].toLowerCase())) ||
      (room.members.length === 1 && m.isHost)
  );

  const isHost =
    serverIsHost ||
    currentMember?.isHost ||
    (currentUserId && room.hostId === currentUserId) ||
    (room.members.length === 1 && room.members[0]?.isHost) ||
    false;

  const currentQuestion = room.questions[room.currentQIdx];

  // ===========================================================================
  // STAGE 1: LOBBY (รอก่อนเริ่มเกม)
  // ===========================================================================
  if (room.status === "LOBBY") {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex flex-col justify-between p-4 sm:p-8">
        {/* Top bar */}
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          <button
            onClick={() => handleLeaveRoom("/arena")}
            disabled={isLeaving}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-red-500/50 transition-colors cursor-pointer text-xs font-bold shadow-sm"
          >
            {isLeaving ? (
              <Loader2 className="w-4 h-4 animate-spin text-red-400" />
            ) : (
              <ArrowLeft className="w-4 h-4" />
            )}
            <span>ออกจากห้อง</span>
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={soundEnabled ? "ปิดเสียง" : "เปิดเสียง"}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-amber-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
          </button>
        </div>

        {/* Center: PIN Code Display */}
        <div className="max-w-xl mx-auto w-full text-center py-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-500/20 text-red-400 border border-red-500/30 mb-3">
            <Swords className="w-3.5 h-3.5" />
            <span>รหัสเข้าร่วมห้อง (GAME PIN)</span>
          </span>

          <div
            onClick={copyPinToClipboard}
            className="cursor-pointer group relative bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-slate-700 hover:border-red-500 rounded-3xl p-6 shadow-2xl transition-all inline-block max-w-sm w-full mx-auto"
          >
            <div className="text-4xl sm:text-5xl font-black tracking-widest text-amber-400 font-mono mb-2">
              {room.roomCode.slice(0, 3)} {room.roomCode.slice(3)}
            </div>
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 group-hover:text-white transition-colors">
              {copiedPin ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">คัดลอก PIN แล้ว!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>คลิกเพื่อคัดลอกรหัส</span>
                </>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-4">
            หมวดวิชา: <strong className="text-white">{room.category}</strong> • จำนวน:{" "}
            <strong className="text-white">{room.totalQ} ข้อ</strong>
          </p>
        </div>

        {/* Members Grid (1-8 Players) */}
        <div className="max-w-4xl mx-auto w-full">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2 text-xs font-black text-slate-400">
              <Users className="w-4 h-4 text-[#BD1B0B]" />
              <span>ผู้เข้าร่วมในห้อง ({room.members.length}/8 คน)</span>
            </div>
            {isHost && (
              <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                คุณคือหัวหน้าห้อง
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {Array.from({ length: 8 }).map((_, idx) => {
              const member = room.members[idx];
              if (member) {
                const isMe = currentUserId ? member.userId === currentUserId : member.isCurrentMember;
                return (
                  <div
                    key={member.id}
                    className={`bg-slate-800/90 border rounded-2xl p-3 flex items-center gap-2.5 shadow-sm relative overflow-hidden transition-all ${
                      isMe ? "border-amber-400/80 shadow-amber-500/10 shadow-md ring-1 ring-amber-400/30" : "border-slate-700"
                    }`}
                  >
                    {member.isHost && (
                      <Crown className="w-4 h-4 text-amber-400 absolute top-2 right-2 animate-bounce" />
                    )}
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center font-black text-white text-xs shrink-0 shadow-xs">
                      {member.username.slice(0, 1)}
                    </div>
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-1">
                        <h4 className="text-xs font-bold text-slate-200 truncate">
                          {member.username}
                        </h4>
                        {isMe && (
                          <span className="text-[9px] font-black text-amber-300 bg-amber-500/20 px-1 py-0.2 rounded">
                            คุณ
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        {member.isHost ? "หัวหน้าห้อง" : "ผู้ท้าชิง"}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={`slot-${idx}`}
                  className="border-2 border-dashed border-slate-700/60 rounded-2xl p-3 flex items-center justify-center gap-2 text-slate-500 text-xs font-bold bg-slate-900/40 min-h-[58px]"
                >
                  <Users className="w-3.5 h-3.5 opacity-40" />
                  <span>ว่าง (#{idx + 1})</span>
                </div>
              );
            })}
          </div>

          {/* Bottom Action */}
          <div className="text-center">
            {isHost ? (
              <button
                onClick={handleStartGame}
                disabled={isStartingGame || room.members.length === 0}
                className="cursor-pointer px-8 py-4 bg-gradient-to-r from-[#BD1B0B] to-[#D32F2F] hover:from-[#A81507] hover:to-[#BD1B0B] text-white font-black text-sm rounded-2xl shadow-xl shadow-red-600/30 active:scale-98 transition-all flex items-center gap-2 mx-auto"
              >
                {isStartingGame ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5 fill-white" />
                )}
                <span>เริ่มประลองเลย! ({room.members.length} คน)</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>กำลังรอหัวหน้าห้อง ({room.hostName}) กดเริ่มเกม...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // STAGE 2: QUESTION & CHEST GAMEPLAY
  // ===========================================================================
  if (room.status === "PLAYING" && currentQuestion && !podiumData) {
    const answeredCount = room.members.filter((m) => m.isAnswered).length;
    const isCurrentUserAnswered = selectedChoice !== null;
    const progressTimerPct = (timeLeft / QUESTION_TIME_LIMIT) * 100;

    return (
      <div className="min-h-screen bg-[#0B132B] text-white flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden">
        {/* Real-time Ticker Alert Banner */}
        {tickerMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-2 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-2 border border-white/20 animate-in slide-in-from-top-4">
            <Sparkles className="w-4 h-4" />
            <span>{tickerMessage}</span>
          </div>
        )}

        {/* Top Header: Round info, Gold & Timer */}
        <div className="max-w-4xl mx-auto w-full">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (confirm("ต้องการออกจากห้องประลองหรือไม่?")) {
                    handleLeaveRoom("/arena");
                  }
                }}
                disabled={isLeaving}
                className="p-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-colors cursor-pointer"
                title="ออกจากห้องประลอง"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-black px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-300">
                ข้อ {room.currentQIdx + 1}/{room.totalQ}
              </span>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
                {currentQuestion.category}
              </span>
            </div>

            {/* Current Member Gold & Shield */}
            <div className="flex items-center gap-2">
              {currentMember?.hasShield && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-300 text-xs font-black">
                  <Shield className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
                  <span>มีโล่</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black shadow-xs">
                <Coins className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>{currentMember?.gold ?? 0}G</span>
              </div>
            </div>
          </div>

          {/* Animated 90-second Countdown Bar */}
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700 mb-6">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                timeLeft <= 15
                  ? "bg-red-500"
                  : timeLeft <= 35
                  ? "bg-amber-400"
                  : "bg-emerald-400"
              }`}
              style={{ width: `${progressTimerPct}%` }}
            />
          </div>
        </div>

        {/* Center: Question Card */}
        <div className="max-w-3xl mx-auto w-full mb-6">
          <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm text-center">
            <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs font-bold mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>
                เหลือเวลา: <strong className="text-amber-300 font-mono text-sm">{formatTime(timeLeft)}</strong> นาที ({timeLeft} วินาที)
              </span>
            </div>
            <h2 className="text-base sm:text-xl font-black text-white leading-relaxed tracking-tight">
              {currentQuestion.questionText}
            </h2>
          </div>
        </div>

        {/* 4 Big Choices Buttons (Kahoot Colorful Grid) */}
        <div className="max-w-3xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {currentQuestion.choices.map((choiceText, idx) => {
            const choiceIndex = idx + 1;
            const style = CHOICE_COLORS[idx] || CHOICE_COLORS[0];
            const isSelected = selectedChoice === choiceIndex;
            const isThisCorrect = answerResult?.correctAnswer ? choiceIndex === answerResult.correctAnswer : false;

            let choiceStateClass = `${style.bg} ${style.border} active:scale-98 shadow-md`;
            if (isCurrentUserAnswered) {
              if (isSelected) {
                if (answerResult?.isCorrect) {
                  choiceStateClass = "bg-emerald-600 border-emerald-400 ring-4 ring-emerald-400/50 scale-[1.02] text-white";
                } else {
                  choiceStateClass = "bg-red-600 border-red-400 ring-4 ring-red-400/50 scale-[1.02] text-white";
                }
              } else if (isThisCorrect) {
                // เฉลยข้อที่ถูกถ้าผู้ใช้ตอบผิด
                choiceStateClass = "bg-emerald-800/80 border-2 border-emerald-400 text-white ring-2 ring-emerald-400/40";
              } else {
                choiceStateClass = "opacity-40 bg-slate-800/50 border-slate-700";
              }
            }

            return (
              <button
                key={idx}
                disabled={isCurrentUserAnswered}
                onClick={() => handleAnswer(choiceIndex)}
                className={`cursor-pointer min-h-[72px] p-4 rounded-2xl border-2 transition-all flex items-center justify-between text-left ${choiceStateClass}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-sm shrink-0">
                    {style.label}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white leading-snug">
                    {choiceText}
                  </span>
                </div>
                {isCurrentUserAnswered && isSelected && (
                  <span className="text-lg shrink-0">
                    {answerResult?.isCorrect ? "✅" : "❌"}
                  </span>
                )}
                {isCurrentUserAnswered && !isSelected && isThisCorrect && (
                  <span className="text-[11px] font-black bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded-full shrink-0">
                    คำตอบที่ถูกต้อง
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Answer Feedback Banner (แจ้งชัดเจนว่าตอบผิดจะไม่ได้กล่องสุ่ม) */}
        {isCurrentUserAnswered && answerResult && !answerResult.isCorrect && (
          <div className="max-w-3xl mx-auto w-full bg-red-950/70 border-2 border-red-500/70 rounded-2xl p-4 text-center mb-4 animate-in fade-in duration-300 shadow-xl">
            <div className="flex items-center justify-center gap-2 text-red-400 font-black text-sm mb-1">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>❌ ตอบไม่ถูกต้อง! คุณไม่ได้รับสิทธิ์เปิดกล่องสุ่มรอบนี้</span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl mx-auto">
              คำอธิบาย: {answerResult.explanation || currentQuestion.explanation || "จำข้อนี้ไว้ แล้วลุยต่อในข้อถัดไป!"}
            </p>
          </div>
        )}

        {/* Bottom Status & Round Summary Ticker */}
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between text-xs font-bold text-slate-400 px-2">
          <span>
            ผู้เล่นตอบแล้ว:{" "}
            <strong className="text-white">
              {answeredCount}/{room.members.length}
            </strong>
          </span>

          {/* Auto-advance indicator */}
          {answeredCount === room.members.length && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-400/30 px-3 py-1 rounded-xl animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              <span>ตอบครบแล้ว รอเปิดกล่องเสร็จจะไปข้อต่อไปอัตโนมัติ...</span>
            </div>
          )}

          {/* Host Next button (เป็นปุ่มสำรองกรณีกดข้ามก่อนหมดเวลา) */}
          {(showRoundSummary || answeredCount === room.members.length) && isHost && (
            <button
              onClick={handleNextQuestion}
              disabled={isAdvancingRound}
              className="cursor-pointer px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black shadow-md flex items-center gap-1.5 transition-all"
            >
              {isAdvancingRound ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>ข้อถัดไป ➔</span>
              )}
            </button>
          )}
        </div>

        {/* =================================================================== */}
        {/* MODAL: MYSTERY CHEST SELECTION (เปิดเฉพาะเมื่อตอบถูกเท่านั้น!) */}
        {/* =================================================================== */}
        {showChestModal && answerResult?.isCorrect && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-900 mb-3 shadow-lg">
                <Sparkles className="w-3.5 h-3.5" />
                <span>ตอบถูกต้อง! +{answerResult?.gainedGold}G</span>
              </span>

              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-1">
                เลือกกล่องสุ่มชิงทอง (6 กล่อง)
              </h3>
              <p className="text-xs text-amber-300 font-medium mb-6">
                ⚡ คนตอบถูกต้องก่อน มีสิทธิ์เลือกก่อน! (กล่องที่ถูกเปิดแล้วจะเลือกซ้ำไม่ได้)
              </p>

              {/* 6 Bouncing Golden Chests (First-come, first-served) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 mb-6">
                {[1, 2, 3, 4, 5, 6].map((chestNum) => {
                  const takenMember = room.members.find((m) => m.pickedChest === chestNum);
                  const isTakenByMe = currentMember?.pickedChest === chestNum;
                  const isTakenByOther = Boolean(takenMember && !isTakenByMe);

                  if (isTakenByOther) {
                    return (
                      <div
                        key={chestNum}
                        className="bg-slate-900/90 border-2 border-slate-700/80 rounded-2xl p-3 flex flex-col items-center justify-center min-h-[110px] opacity-70 relative select-none"
                      >
                        <div className="text-2xl sm:text-3xl mb-1 filter grayscale">
                          📦
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 line-through mb-1">
                          กล่องที่ {chestNum}
                        </span>
                        <span className="text-[9px] font-black text-red-400 bg-red-950/80 border border-red-500/40 px-1.5 py-0.5 rounded-md truncate max-w-[100px]">
                          🔒 {takenMember?.username}
                        </span>
                      </div>
                    );
                  }

                  if (isTakenByMe) {
                    return (
                      <div
                        key={chestNum}
                        className="bg-gradient-to-b from-amber-500 to-amber-700 border-2 border-amber-300 ring-2 ring-amber-400/50 rounded-2xl p-3 flex flex-col items-center justify-center min-h-[110px] shadow-xl relative"
                      >
                        <div className="text-3xl mb-1 animate-bounce">
                          ✨
                        </div>
                        <span className="text-[11px] font-black text-slate-950 uppercase tracking-wider mb-1">
                          กล่องที่ {chestNum}
                        </span>
                        <span className="text-[9px] font-black text-amber-950 bg-amber-300 px-2 py-0.5 rounded-full">
                          คุณเปิดกล่องนี้
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={chestNum}
                      onClick={() => handlePickChest(chestNum)}
                      disabled={isOpeningChest || Boolean(currentMember?.pickedChest)}
                      className="cursor-pointer group relative bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 border-2 border-amber-300 rounded-2xl p-3 shadow-xl active:scale-95 transition-all flex flex-col items-center justify-center min-h-[110px]"
                    >
                      <div className="text-3xl mb-1 group-hover:scale-110 transition-transform">
                        🎁
                      </div>
                      <span className="text-[11px] font-black text-slate-950 uppercase tracking-wider">
                        กล่องที่ {chestNum}
                      </span>
                      <span className="text-[9px] font-bold text-amber-950/80 mt-0.5">
                        ว่าง • คลิกเลือก
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Chest Outcome Reveal */}
              {chestOutcome && (
                <div className="bg-slate-900 border-2 border-amber-400 rounded-2xl p-4 text-center animate-in zoom-in-95">
                  <p className="text-sm font-black text-amber-300">
                    {chestOutcome.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* ROUND LEADERBOARD POPUP (แสดงหลังตอบเสร็จ) */}
        {/* =================================================================== */}
        {showRoundSummary && !showChestModal && (
          <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl">
              <h3 className="text-base font-black text-white text-center mb-1 flex items-center justify-center gap-1.5">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>คะแนนทองคำสะสมรอบนี้</span>
              </h3>
              <p className="text-xs text-slate-400 text-center mb-4">
                {currentQuestion.explanation}
              </p>

              {/* Leaderboard Bars */}
              <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                {[...room.members]
                  .sort((a, b) => b.gold - a.gold)
                  .map((m, idx) => (
                    <div
                      key={m.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        m.userId === currentUser?.id
                          ? "bg-amber-500/10 border-amber-400/40 text-amber-300"
                          : "bg-slate-800/80 border-slate-700 text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400 w-5">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-bold truncate max-w-[140px]">
                          {m.username}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 font-black text-xs text-amber-400">
                        <Coins className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{m.gold}G</span>
                      </div>
                    </div>
                  ))}
              </div>

              {isHost ? (
                <button
                  onClick={handleNextQuestion}
                  disabled={isAdvancingRound}
                  className="cursor-pointer w-full py-3 bg-[#BD1B0B] hover:bg-[#A81507] text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isAdvancingRound ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>
                      {room.currentQIdx + 1 >= room.totalQ
                        ? "สรุปผลการประลอง 🏆"
                        : "ลุยข้อต่อไป ➔"}
                    </span>
                  )}
                </button>
              ) : (
                <p className="text-center text-xs text-slate-400 font-medium">
                  รอหัวหน้าห้อง ({room.hostName}) กดลุยข้อถัดไป...
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===========================================================================
  // STAGE 3: FINISHED / PODIUM CELEBRATION
  // ===========================================================================
  if (room.status === "FINISHED" || podiumData) {
    const list = podiumData || [...room.members].sort((a, b) => b.gold - a.gold);
    const champion = list[0];
    const second = list[1];
    const third = list[2];

    return (
      <div className="min-h-screen bg-[#0A0F1D] text-white flex flex-col items-center justify-center p-4 sm:p-8 text-center relative overflow-hidden">
        {/* Glow ambient */}
        <div className="absolute top-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-400/40 mb-3 shadow-lg">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>การประลองจบลงแล้ว!</span>
        </span>

        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
          ผู้ชนะเลิศการชิงทองคำ 👑
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-8 font-medium">
          ขอแสดงความยินดีกับผู้คว้ารางวัลทองคำสูงสุด ทุกคนได้รับ EXP เพิ่มเติมเพื่ออัปเลเวล!
        </p>

        {/* Podium Layout (2nd, 1st, 3rd) */}
        <div className="flex items-end justify-center gap-2 sm:gap-4 max-w-lg w-full mb-8">
          {/* 2nd Place */}
          {second && (
            <div className="flex-1 flex flex-col items-center">
              <span className="text-xl mb-1">🥈</span>
              <span className="text-xs font-bold text-slate-300 truncate max-w-[100px] mb-1">
                {second.username}
              </span>
              <span className="text-[11px] font-black text-amber-400 mb-2">
                {second.gold}G
              </span>
              <div className="w-full h-24 bg-slate-800 border-2 border-slate-600 rounded-t-2xl flex items-center justify-center font-black text-lg text-slate-400">
                2nd
              </div>
            </div>
          )}

          {/* 1st Place (Champion) */}
          {champion && (
            <div className="flex-1 flex flex-col items-center">
              <span className="text-3xl mb-1">👑</span>
              <span className="text-sm font-black text-amber-300 truncate max-w-[120px] mb-1">
                {champion.username}
              </span>
              <span className="text-xs font-black text-amber-400 mb-2">
                {champion.gold}G
              </span>
              <div className="w-full h-36 bg-gradient-to-t from-amber-600 to-amber-500 border-2 border-amber-300 rounded-t-2xl flex flex-col items-center justify-center font-black text-2xl text-slate-950 shadow-2xl shadow-amber-500/20">
                1st
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {third && (
            <div className="flex-1 flex flex-col items-center">
              <span className="text-xl mb-1">🥉</span>
              <span className="text-xs font-bold text-slate-300 truncate max-w-[100px] mb-1">
                {third.username}
              </span>
              <span className="text-[11px] font-black text-amber-400 mb-2">
                {third.gold}G
              </span>
              <div className="w-full h-16 bg-slate-800 border-2 border-slate-700 rounded-t-2xl flex items-center justify-center font-black text-base text-slate-500">
                3rd
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <button
            onClick={() => handleLeaveRoom("/arena")}
            disabled={isLeaving}
            className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-black border border-slate-700 transition-all text-center cursor-pointer flex items-center justify-center gap-2"
          >
            {isLeaving ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : null}
            <span>กลับหน้าล็อบบี้</span>
          </button>
          <button
            onClick={() => handleLeaveRoom("/home")}
            disabled={isLeaving}
            className="w-full py-3.5 bg-[#BD1B0B] hover:bg-[#A81507] text-white rounded-2xl text-xs font-black shadow-lg shadow-red-600/20 transition-all text-center cursor-pointer flex items-center justify-center gap-2"
          >
            {isLeaving ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : null}
            <span>หน้าหลัก</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
