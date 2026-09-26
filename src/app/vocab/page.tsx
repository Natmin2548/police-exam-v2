"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Volume2,
  Star,
  CheckCircle2,
  RotateCw,
  Sparkles,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Flame,
  BookOpen,
  Layers,
  Zap,
  Check,
  X,
  VolumeX,
  HelpCircle,
  Award,
} from "lucide-react";
import confetti from "canvas-confetti";
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav";
import rawVocabData from "@/data/oxfordVocabData.json";

interface VocabWord {
  word: string;
  meaning: string;
}

interface LevelMeta {
  name: string;
  description: string;
  color: string;
  icon: string;
  count: number;
}

const VOCAB_DATA: Record<string, VocabWord[]> = rawVocabData.VOCAB_DATA;
const VOCAB_LEVELS: Record<string, LevelMeta> = rawVocabData.VOCAB_LEVELS;

const LEVEL_KEYS = ["A1", "A2", "B1", "B2", "C1"] as const;

export default function VocabBankPage() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<"list" | "flashcard" | "quiz">("list");
  const [selectedLevel, setSelectedLevel] = useState<string>("ALL");

  // User LocalStorage Data
  const [bookmarkedWords, setBookmarkedWords] = useState<Set<string>>(new Set());
  const [masteredWords, setMasteredWords] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // Search & Filters in List Mode
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "unmastered" | "mastered" | "starred">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 40;

  // Flashcard State
  const [flashcardLevel, setFlashcardLevel] = useState<string>("A1");
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [flashcardDeck, setFlashcardDeck] = useState<(VocabWord & { level: string })[]>([]);

  // Quiz State
  const [quizLevel, setQuizLevel] = useState<string>("ALL");
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(10);
  const [quizState, setQuizState] = useState<"setup" | "playing" | "summary">("setup");
  const [quizQuestions, setQuizQuestions] = useState<
    {
      word: string;
      meaning: string;
      level: string;
      options: string[];
    }[]
  >([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState<
    { word: string; correctMeaning: string; chosenMeaning: string; level: string }[]
  >([]);
  const [autoSpeech, setAutoSpeech] = useState(true);

  // Sound playing state
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // 1. Load & Persist Bookmarks & Mastered words in LocalStorage
  // ---------------------------------------------------------------------------
  useEffect(() => {
    try {
      const savedBookmarks = localStorage.getItem("police_vocab_bookmarks");
      if (savedBookmarks) {
        setBookmarkedWords(new Set(JSON.parse(savedBookmarks)));
      }
      const savedMastered = localStorage.getItem("police_vocab_mastered");
      if (savedMastered) {
        setMasteredWords(new Set(JSON.parse(savedMastered)));
      }
    } catch (e) {
      console.error("Error loading vocab progress:", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const toggleBookmark = (word: string) => {
    setBookmarkedWords((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      localStorage.setItem("police_vocab_bookmarks", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const toggleMastered = (word: string) => {
    setMasteredWords((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      localStorage.setItem("police_vocab_mastered", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // 2. Text to Speech helper
  // ---------------------------------------------------------------------------
  const playAudio = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      utterance.onstart = () => setSpeakingWord(text);
      utterance.onend = () => setSpeakingWord(null);
      utterance.onerror = () => setSpeakingWord(null);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("SpeechSynthesis error:", e);
      setSpeakingWord(null);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // 3. Filtered Words for List View
  // ---------------------------------------------------------------------------
  const allWordsWithLevel = useMemo(() => {
    const list: (VocabWord & { level: string })[] = [];
    Object.entries(VOCAB_DATA).forEach(([lvl, words]) => {
      words.forEach((w) => list.push({ ...w, level: lvl }));
    });
    return list;
  }, []);

  const filteredWords = useMemo(() => {
    let pool = allWordsWithLevel;

    // Filter by CEFR Level
    if (selectedLevel !== "ALL") {
      pool = pool.filter((w) => w.level === selectedLevel);
    }

    // Filter by Starred / Mastered status
    if (filterMode === "starred") {
      pool = pool.filter((w) => bookmarkedWords.has(w.word));
    } else if (filterMode === "mastered") {
      pool = pool.filter((w) => masteredWords.has(w.word));
    } else if (filterMode === "unmastered") {
      pool = pool.filter((w) => !masteredWords.has(w.word));
    }

    // Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      pool = pool.filter(
        (w) => w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)
      );
    }

    return pool;
  }, [allWordsWithLevel, selectedLevel, filterMode, searchQuery, bookmarkedWords, masteredWords]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLevel, filterMode, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredWords.length / pageSize));
  const paginatedWords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredWords.slice(start, start + pageSize);
  }, [filteredWords, currentPage, pageSize]);

  // ---------------------------------------------------------------------------
  // 4. Flashcard Deck Generation
  // ---------------------------------------------------------------------------
  const buildFlashcardDeck = useCallback(() => {
    let deck: (VocabWord & { level: string })[] = [];
    if (flashcardLevel === "ALL") {
      deck = [...allWordsWithLevel];
    } else if (flashcardLevel === "STARRED") {
      deck = allWordsWithLevel.filter((w) => bookmarkedWords.has(w.word));
    } else if (VOCAB_DATA[flashcardLevel]) {
      deck = VOCAB_DATA[flashcardLevel].map((w) => ({ ...w, level: flashcardLevel }));
    }

    if (isShuffled) {
      deck.sort(() => 0.5 - Math.random());
    }

    setFlashcardDeck(deck);
    setCardIndex(0);
    setIsFlipped(false);
  }, [flashcardLevel, isShuffled, allWordsWithLevel, bookmarkedWords]);

  useEffect(() => {
    if (activeTab === "flashcard") {
      buildFlashcardDeck();
    }
  }, [activeTab, flashcardLevel, isShuffled, buildFlashcardDeck]);

  const currentFlashcard = flashcardDeck[cardIndex];

  const handleNextCard = useCallback((markMastered?: boolean) => {
    if (markMastered && currentFlashcard) {
      toggleMastered(currentFlashcard.word);
    }
    setIsFlipped(false);
    if (cardIndex < flashcardDeck.length - 1) {
      setCardIndex((prev) => prev + 1);
    } else {
      // Completed deck!
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } catch (e) {}
    }
  }, [cardIndex, currentFlashcard, flashcardDeck.length]);

  const handlePrevCard = useCallback(() => {
    setIsFlipped(false);
    if (cardIndex > 0) {
      setCardIndex((prev) => prev - 1);
    }
  }, [cardIndex]);

  // Keyboard navigation for Flashcards
  useEffect(() => {
    if (activeTab !== "flashcard") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNextCard();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrevCard();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, handleNextCard, handlePrevCard]);

  // ---------------------------------------------------------------------------
  // 5. Quiz Arena Logic ("เลือกด่วน !")
  // ---------------------------------------------------------------------------
  const startQuiz = () => {
    let pool: (VocabWord & { level: string })[] = [];
    if (quizLevel === "ALL") {
      pool = [...allWordsWithLevel];
    } else if (VOCAB_DATA[quizLevel]) {
      pool = VOCAB_DATA[quizLevel].map((w) => ({ ...w, level: quizLevel }));
    }

    if (pool.length === 0) return;

    // Pick N unique random questions
    const shuffledPool = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffledPool.slice(0, Math.min(quizQuestionCount, pool.length));

    const generated = selected.map((item) => {
      // 3 random distractors from same level
      const otherMeanings = (VOCAB_DATA[item.level] || pool)
        .filter((w) => w.meaning !== item.meaning)
        .map((w) => w.meaning);

      const shuffledOthers = otherMeanings.sort(() => 0.5 - Math.random()).slice(0, 3);
      const options = [item.meaning, ...shuffledOthers].sort(() => 0.5 - Math.random());

      return {
        word: item.word,
        meaning: item.meaning,
        level: item.level,
        options,
      };
    });

    setQuizQuestions(generated);
    setCurrentQuizIndex(0);
    setSelectedAnswer(null);
    setIsAnswerChecked(false);
    setQuizScore(0);
    setQuizStreak(0);
    setMaxStreak(0);
    setWrongAnswers([]);
    setQuizState("playing");

    if (autoSpeech && generated[0]) {
      playAudio(generated[0].word);
    }
  };

  const handleSelectAnswer = (option: string) => {
    if (isAnswerChecked) return;

    setSelectedAnswer(option);
    setIsAnswerChecked(true);

    const currentQ = quizQuestions[currentQuizIndex];
    const isCorrect = option === currentQ.meaning;

    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
      setQuizStreak((prev) => {
        const next = prev + 1;
        if (next > maxStreak) setMaxStreak(next);
        return next;
      });
      // Mark as mastered if correct
      toggleMastered(currentQ.word);
    } else {
      setQuizStreak(0);
      setWrongAnswers((prev) => [
        ...prev,
        {
          word: currentQ.word,
          correctMeaning: currentQ.meaning,
          chosenMeaning: option,
          level: currentQ.level,
        },
      ]);
    }
  };

  const handleNextQuizQuestion = () => {
    if (currentQuizIndex < quizQuestions.length - 1) {
      const nextIdx = currentQuizIndex + 1;
      setCurrentQuizIndex(nextIdx);
      setSelectedAnswer(null);
      setIsAnswerChecked(false);
      if (autoSpeech && quizQuestions[nextIdx]) {
        playAudio(quizQuestions[nextIdx].word);
      }
    } else {
      // Completed quiz!
      setQuizState("summary");
      const finalScorePct = Math.round(((quizScore + (selectedAnswer === quizQuestions[currentQuizIndex].meaning ? 1 : 0)) / quizQuestions.length) * 100);
      if (finalScorePct >= 70) {
        try {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });
        } catch (e) {}
      }
    }
  };

  // Helper level badge colors
  const getLevelBadge = (level: string) => {
    switch (level) {
      case "A1":
        return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "A1 เบื้องต้น" };
      case "A2":
        return { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", label: "A2 ก่อนกลาง" };
      case "B1":
        return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "B1 ปานกลาง" };
      case "B2":
        return { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", label: "B2 สูงกว่ากลาง" };
      case "C1":
        return { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", label: "C1 ขั้นสูง" };
      default:
        return { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", label: level };
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFB] text-slate-900 pb-28 lg:pb-16 font-sans selection:bg-red-100 selection:text-red-900">
      {/* --------------------------------------------------------------------- */}
      {/* Top Header */}
      {/* --------------------------------------------------------------------- */}
      <header className="sticky top-0 z-30 bg-[#FBFBFB]/95 backdrop-blur-md border-b border-slate-100 px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/home"
              className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-[#BD1B0B] hover:border-red-200 transition-colors shadow-2xs"
              title="กลับหน้าหลัก"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  คลังคำศัพท์
                </h1>
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-red-50 text-[#BD1B0B] border border-red-200/80">
                  3,000 คำ • A1-C1
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Oxford 3000 Vocabulary สำหรับสอบตำรวจและข้าราชการ
              </p>
            </div>
          </div>

          {/* Quick Header Stats */}
          <div className="hidden sm:flex items-center gap-3 text-xs font-bold">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
              <span>ติดดาว {bookmarkedWords.size}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>จำได้แล้ว {masteredWords.size}</span>
            </div>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------------- */}
      {/* Main Container */}
      {/* --------------------------------------------------------------------- */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 pt-5 space-y-6">
        {/* Mode Selector Tabs (Big & Modern) */}
        <div className="bg-slate-200/60 p-1 rounded-2xl flex items-center gap-1 max-w-xl mx-auto shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === "list"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>คลังคำศัพท์</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("flashcard")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === "flashcard"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>แฟลชการ์ด</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("quiz")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === "quiz"
                ? "bg-[#BD1B0B] text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>เลือกด่วน ! (ควิซ)</span>
          </button>
        </div>

        {/* =================================================================== */}
        {/* TAB 1: คลังคำศัพท์ (Word List & Search Mode) */}
        {/* =================================================================== */}
        {activeTab === "list" && (
          <div className="space-y-5 animate-slide-up">
            {/* Level Selector Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedLevel("ALL")}
                className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer border ${
                  selectedLevel === "ALL"
                    ? "bg-[#BD1B0B] text-white border-[#BD1B0B] shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                ทั้งหมด (3,000 คำ)
              </button>

              {LEVEL_KEYS.map((lvl) => {
                const meta = VOCAB_LEVELS[lvl];
                const isSelected = selectedLevel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedLevel(lvl)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer border flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span>{meta.icon}</span>
                    <span>{lvl}</span>
                    <span className="text-[10px] opacity-70">({meta.count})</span>
                  </button>
                );
              })}
            </div>

            {/* Search Bar & Quick Filters */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาคำศัพท์ภาษาอังกฤษ หรือความหมายภาษาไทย..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-[#BD1B0B] transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 px-1"
                  >
                    ล้าง
                  </button>
                )}
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold pt-1">
                <span className="text-slate-400 text-[11px] shrink-0 font-medium">กรอง:</span>
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterMode === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  ทั้งหมด ({filteredWords.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("starred")}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                    filterMode === "starred" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Star className="w-3 h-3 fill-current" />
                  <span>ติดดาว ({bookmarkedWords.size})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("unmastered")}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterMode === "unmastered" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  ยังจำไม่ได้
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("mastered")}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                    filterMode === "mastered" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>จำได้แล้ว ({masteredWords.size})</span>
                </button>
              </div>
            </div>

            {/* Word Grid */}
            {paginatedWords.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
                  🔍
                </div>
                <h3 className="text-base font-black text-slate-800">ไม่พบคำศัพท์ที่ค้นหา</h3>
                <p className="text-xs text-slate-400">ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่นดูนะครับ</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {paginatedWords.map((item, idx) => {
                  const badge = getLevelBadge(item.level);
                  const isStarred = bookmarkedWords.has(item.word);
                  const isDone = masteredWords.has(item.word);
                  const isSpeaking = speakingWord === item.word;

                  return (
                    <div
                      key={`${item.word}-${idx}`}
                      className={`bg-white border rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between ${
                        isDone ? "border-emerald-200 bg-emerald-50/20" : "border-slate-200/80"
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Word & Controls */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight block">
                              {item.word}
                            </span>
                            <span
                              className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {item.level}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Audio button */}
                            <button
                              type="button"
                              onClick={() => playAudio(item.word)}
                              className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                                isSpeaking
                                  ? "bg-red-50 border-red-200 text-[#BD1B0B] animate-pulse"
                                  : "border-slate-100 hover:border-slate-200 text-slate-500 hover:text-slate-800 bg-slate-50/60"
                              }`}
                              title="ฟังเสียงอ่าน"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Bookmark button */}
                            <button
                              type="button"
                              onClick={() => toggleBookmark(item.word)}
                              className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                                isStarred
                                  ? "border-amber-200 bg-amber-50 text-amber-500"
                                  : "border-slate-100 hover:border-slate-200 text-slate-300 hover:text-amber-400 bg-slate-50/60"
                              }`}
                              title={isStarred ? "นำออกจากคำติดดาว" : "ติดดาวคำนี้"}
                            >
                              <Star className={`w-3.5 h-3.5 ${isStarred ? "fill-amber-400" : ""}`} />
                            </button>
                          </div>
                        </div>

                        {/* Meaning */}
                        <p className="text-sm font-bold text-slate-700 leading-snug">
                          {item.meaning}
                        </p>
                      </div>

                      {/* Mastered Status Button */}
                      <button
                        type="button"
                        onClick={() => toggleMastered(item.word)}
                        className={`mt-3 w-full py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                          isDone
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100 hover:text-slate-600"
                        }`}
                      >
                        <CheckCircle2 className={`w-3.5 h-3.5 ${isDone ? "fill-emerald-600 text-white" : ""}`} />
                        <span>{isDone ? "จำได้แล้ว" : "ยังจำไม่ได้"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
                <span className="text-xs text-slate-400 font-bold">
                  แสดง {((currentPage - 1) * pageSize) + 1} -{" "}
                  {Math.min(currentPage * pageSize, filteredWords.length)} จาก {filteredWords.length} คำ
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="text-xs font-black text-slate-800 px-2">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: แฟลชการ์ด (3D Interactive Flashcards Mode) */}
        {/* =================================================================== */}
        {activeTab === "flashcard" && (
          <div className="space-y-6 max-w-xl mx-auto animate-slide-up">
            {/* Deck Configuration */}
            <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 shadow-xs">
              <div className="flex items-center gap-2">
                <label className="text-xs font-black text-slate-700">หมวด:</label>
                <select
                  value={flashcardLevel}
                  onChange={(e) => setFlashcardLevel(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-100"
                >
                  <option value="A1">🌱 A1 — เบื้องต้น (600 คำ)</option>
                  <option value="A2">📗 A2 — ก่อนกลาง (600 คำ)</option>
                  <option value="B1">📘 B1 — ปานกลาง (600 คำ)</option>
                  <option value="B2">📕 B2 — สูงกว่ากลาง (600 คำ)</option>
                  <option value="C1">🎓 C1 — ขั้นสูง (600 คำ)</option>
                  <option value="ALL">✨ สุ่มทุกระดับ (3,000 คำ)</option>
                  <option value="STARRED">⭐ เฉพาะคำติดดาว ({bookmarkedWords.size} คำ)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsShuffled((prev) => !prev)}
                className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isShuffled
                    ? "bg-red-50 border-red-200 text-[#BD1B0B]"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
                title="สุ่มลำดับคำศัพท์"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">สุ่มการ์ด</span>
              </button>
            </div>

            {/* Empty Deck State */}
            {flashcardDeck.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-3">
                <Star className="w-10 h-10 text-amber-400 mx-auto" />
                <h3 className="text-base font-black text-slate-800">ยังไม่มีคำศัพท์ในหมวดนี้</h3>
                <p className="text-xs text-slate-400">
                  {flashcardLevel === "STARRED"
                    ? "คุณยังไม่ได้ติดดาวคำศัพท์ใดๆ ลองไปกด ⭐ ที่คลังคำศัพท์ก่อนนะครับ"
                    : "ไม่พบคำศัพท์"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Progress Counter & Level Badge */}
                <div className="flex items-center justify-between text-xs font-black text-slate-500 px-1">
                  <span>
                    การ์ดที่ {cardIndex + 1} / {flashcardDeck.length}
                  </span>
                  {currentFlashcard && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${getLevelBadge(currentFlashcard.level).bg} ${getLevelBadge(currentFlashcard.level).text} ${getLevelBadge(currentFlashcard.level).border}`}
                    >
                      CEFR {currentFlashcard.level}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#BD1B0B] h-full transition-all duration-300"
                    style={{
                      width: `${((cardIndex + 1) / flashcardDeck.length) * 100}%`,
                    }}
                  />
                </div>

                {/* 3D Flip Card Container */}
                <div
                  onClick={() => setIsFlipped((prev) => !prev)}
                  style={{ perspective: 1000 }}
                  className="w-full h-72 sm:h-80 cursor-pointer select-none"
                >
                  <div
                    style={{
                      transformStyle: "preserve-3d",
                      transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                      transition: "transform 0.4s cubic-bezier(0.4, 0.2, 0.2, 1)",
                    }}
                    className="relative w-full h-full"
                  >
                    {/* FRONT SIDE (Word) */}
                    <div
                      style={{ backfaceVisibility: "hidden" }}
                      className="absolute inset-0 bg-white border-2 border-slate-200/90 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-between text-center shadow-lg shadow-slate-900/5"
                    >
                      <div className="w-full flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">ด้านหน้า (English)</span>
                        {currentFlashcard && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookmark(currentFlashcard.word);
                            }}
                            className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                          >
                            <Star
                              className={`w-5 h-5 ${
                                bookmarkedWords.has(currentFlashcard.word)
                                  ? "fill-amber-400 text-amber-500"
                                  : "text-slate-300 hover:text-amber-400"
                              }`}
                            />
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                          {currentFlashcard?.word}
                        </h2>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (currentFlashcard) playAudio(currentFlashcard.word);
                          }}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-[#BD1B0B] text-xs font-bold transition-colors"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>ฟังเสียงอ่าน</span>
                        </button>
                      </div>

                      <p className="text-[11px] font-bold text-slate-400">
                        แตะเพื่อดูคำแปล • หรือกด Spacebar
                      </p>
                    </div>

                    {/* BACK SIDE (Meaning) */}
                    <div
                      style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                      }}
                      className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-between text-center shadow-xl shadow-slate-900/20"
                    >
                      <div className="w-full flex items-center justify-between text-white/60">
                        <span className="text-xs font-bold">ด้านหลัง (คำแปล)</span>
                        <span className="text-xs font-bold">{currentFlashcard?.word}</span>
                      </div>

                      <div className="space-y-2">
                        <span className="text-xs font-bold text-white/50 block">ความหมาย</span>
                        <h3 className="text-2xl sm:text-3xl font-black text-white leading-relaxed">
                          {currentFlashcard?.meaning}
                        </h3>
                      </div>

                      <p className="text-[11px] font-bold text-white/40">
                        แตะอีกครั้งเพื่อพลิกกลับ
                      </p>
                    </div>
                  </div>
                </div>

                {/* Flashcard Action Buttons */}
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleNextCard(false)}
                    className="py-3 rounded-2xl bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    <span>ยังจำไม่ได้</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFlipped((prev) => !prev)}
                    className="py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>พลิกการ์ด</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNextCard(true)}
                    className="py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>จำได้แล้ว!</span>
                  </button>
                </div>

                {/* Keyboard Shortcuts Hint */}
                <div className="text-center text-[11px] text-slate-400 font-medium">
                  คีย์ลัด: <span className="font-bold text-slate-600">Spacebar</span> (พลิกการ์ด) •{" "}
                  <span className="font-bold text-slate-600">←</span> (การ์ดก่อนหน้า) •{" "}
                  <span className="font-bold text-slate-600">→</span> (การ์ดถัดไป)
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: เลือกด่วน ! (Quiz Arena Mode) */}
        {/* =================================================================== */}
        {activeTab === "quiz" && (
          <div className="max-w-xl mx-auto space-y-6 animate-slide-up">
            {/* 1. SETUP SCREEN */}
            {quizState === "setup" && (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#BD1B0B] flex items-center justify-center mx-auto">
                    <Zap className="w-6 h-6 fill-current" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    มินิควิซคำศัพท์ (เลือกด่วน !)
                  </h2>
                  <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                    ทดสอบความจำคำศัพท์แบบปรนัย 4 ตัวเลือก พร้อมระบบจับเวลาและคอมโบไฟลุก
                  </p>
                </div>

                {/* Level Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 block">
                    1. เลือกระดับความยาก:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setQuizLevel("ALL")}
                      className={`py-2 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                        quizLevel === "ALL"
                          ? "bg-[#BD1B0B] text-white border-[#BD1B0B] shadow-2xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      สุ่มทุกระดับ
                    </button>
                    {LEVEL_KEYS.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setQuizLevel(lvl)}
                        className={`py-2 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                          quizLevel === lvl
                            ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {VOCAB_LEVELS[lvl].icon} {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Number of Questions */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 block">
                    2. จำนวนข้อสอบ:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[5, 10, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setQuizQuestionCount(num)}
                        className={`py-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                          quizQuestionCount === num
                            ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {num} ข้อ
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto audio toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-600">
                    อ่านออกเสียงคำศัพท์อัตโนมัติ
                  </span>
                  <input
                    type="checkbox"
                    checked={autoSpeech}
                    onChange={(e) => setAutoSpeech(e.target.checked)}
                    className="w-4 h-4 accent-[#BD1B0B] cursor-pointer"
                  />
                </div>

                {/* Start Quiz Button */}
                <button
                  type="button"
                  onClick={startQuiz}
                  className="w-full py-3.5 rounded-2xl bg-[#BD1B0B] hover:bg-[#A81507] text-white font-black text-sm shadow-md shadow-red-950/20 transition-all cursor-pointer flex items-center justify-center gap-2 group"
                >
                  <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  <span>เริ่มทำควิซทันที</span>
                </button>
              </div>
            )}

            {/* 2. PLAYING SCREEN */}
            {quizState === "playing" && quizQuestions[currentQuizIndex] && (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
                {/* Header: Score, Question count, Streak */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-400">ข้อที่</span>
                    <span className="text-base font-black text-slate-900">
                      {currentQuizIndex + 1}/{quizQuestions.length}
                    </span>
                  </div>

                  {quizStreak >= 2 && (
                    <div className="flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-black animate-pulse">
                      <Flame className="w-3.5 h-3.5 fill-amber-500" />
                      <span>{quizStreak} COMBO!</span>
                    </div>
                  )}

                  <div className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    คะแนน: {quizScore}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#BD1B0B] h-full transition-all duration-300"
                    style={{
                      width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%`,
                    }}
                  />
                </div>

                {/* Question Word Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-3">
                  <div className="inline-block">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                        getLevelBadge(quizQuestions[currentQuizIndex].level).bg
                      } ${getLevelBadge(quizQuestions[currentQuizIndex].level).text} ${
                        getLevelBadge(quizQuestions[currentQuizIndex].level).border
                      }`}
                    >
                      {quizQuestions[currentQuizIndex].level}
                    </span>
                  </div>

                  <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                    {quizQuestions[currentQuizIndex].word}
                  </h2>

                  <button
                    type="button"
                    onClick={() => playAudio(quizQuestions[currentQuizIndex].word)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-[#BD1B0B] text-xs font-bold shadow-2xs"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>ฟังเสียง</span>
                  </button>
                </div>

                {/* 4 Choices */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {quizQuestions[currentQuizIndex].options.map((opt, i) => {
                    const isCorrect = opt === quizQuestions[currentQuizIndex].meaning;
                    const isSelected = selectedAnswer === opt;

                    let btnStyle = "bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50/50";
                    if (isAnswerChecked) {
                      if (isCorrect) {
                        btnStyle = "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-200";
                      } else if (isSelected) {
                        btnStyle = "bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-200";
                      } else {
                        btnStyle = "bg-slate-50 border-slate-200 text-slate-400 opacity-60";
                      }
                    }

                    return (
                      <button
                        key={`${opt}-${i}`}
                        type="button"
                        disabled={isAnswerChecked}
                        onClick={() => handleSelectAnswer(opt)}
                        className={`min-h-[58px] p-3 rounded-2xl border text-sm font-bold transition-all text-left flex items-center justify-between ${btnStyle} cursor-pointer`}
                      >
                        <span>{opt}</span>
                        {isAnswerChecked && isCorrect && (
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                        {isAnswerChecked && isSelected && !isCorrect && (
                          <X className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Next button */}
                {isAnswerChecked && (
                  <button
                    type="button"
                    onClick={handleNextQuizQuestion}
                    className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>
                      {currentQuizIndex < quizQuestions.length - 1 ? "ข้อถัดไป" : "ดูผลคะแนน"}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* 3. SUMMARY SCREEN */}
            {quizState === "summary" && (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6 text-center">
                <div className="space-y-2">
                  <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
                    <Trophy className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">
                    สรุปผลการทดสอบ
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">
                    ระดับ {quizLevel === "ALL" ? "สุ่มทุกระดับ" : quizLevel} • ทั้งหมด {quizQuestions.length} ข้อ
                  </p>
                </div>

                {/* Score Big Display */}
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 max-w-sm mx-auto space-y-2">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl sm:text-5xl font-black text-[#BD1B0B]">
                      {quizScore}
                    </span>
                    <span className="text-lg font-black text-slate-400">
                      / {quizQuestions.length}
                    </span>
                  </div>
                  <p className="text-xs font-black text-slate-600">
                    ความแม่นยำ: {Math.round((quizScore / quizQuestions.length) * 100)}%
                  </p>
                </div>

                {/* Wrong Answers List if any */}
                {wrongAnswers.length > 0 && (
                  <div className="text-left space-y-2 pt-2">
                    <h4 className="text-xs font-black text-slate-700">
                      คำศัพท์ที่ตอบผิด ({wrongAnswers.length} คำ) — บันทึกให้ทบทวน:
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {wrongAnswers.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-black text-slate-900">{item.word}</span>
                            <span className="text-slate-400 font-medium ml-2">
                              แปลว่า: <span className="text-emerald-700 font-bold">{item.correctMeaning}</span>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleBookmark(item.word)}
                            className="p-1 rounded-lg hover:bg-rose-100 text-amber-500 font-bold text-[11px] flex items-center gap-1"
                          >
                            <Star className={`w-3.5 h-3.5 ${bookmarkedWords.has(item.word) ? "fill-amber-400" : ""}`} />
                            <span>ติดดาว</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={startQuiz}
                    className="py-3 rounded-2xl bg-[#BD1B0B] hover:bg-[#A81507] text-white font-black text-xs sm:text-sm shadow-md shadow-red-950/15 transition-all cursor-pointer"
                  >
                    ทดสอบใหม่อีกครั้ง
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuizState("setup")}
                    className="py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-black text-xs sm:text-sm transition-all cursor-pointer"
                  >
                    เปลี่ยนหมวด / จำนวน
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
