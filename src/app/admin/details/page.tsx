"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Flag,
  Search,
  Check,
  Send,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Mail,
  User,
  Bell,
  CornerDownRight,
  Filter,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface DetailsData {
  recentReports: any[];
  recentTickets: any[];
  supportTicketCount: number;
  reportedCount: number;
}

export default function AdminDetailsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");
  const [data, setData] = useState<DetailsData | null>(null);
  const [error, setError] = useState("");

  // Filters & State
  const [activeSection, setActiveSection] = useState<"tickets" | "reports">("tickets");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "RESOLVED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Active Reply States
  const [replyingTicketId, setReplyingTicketId] = useState<number | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState("");
  const [submittingAction, setSubmittingAction] = useState<number | null>(null);

  const [replyingReportId, setReplyingReportId] = useState<number | null>(null);
  const [reportReplyText, setReportReplyText] = useState("");

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        router.replace("/home");
        return;
      }
      setAdminEmail(session.user.email);

      const res = await fetch(`/api/admin/overview?email=${encodeURIComponent(session.user.email)}`);
      if (res.status === 403) {
        router.replace("/home");
        return;
      }
      if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลได้");

      const d = await res.json();
      setData({
        recentReports: d.recentReports || [],
        recentTickets: d.recentTickets || [],
        supportTicketCount: d.supportTicketCount || 0,
        reportedCount: d.reportedCount || 0,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Quick Reply Templates
  const quickTemplates = [
    "ทีมงานดำเนินการแก้ไขเรียบร้อยแล้ว ขอบคุณที่แจ้งปัญหาเข้ามาครับ",
    "ฟังก์ชันนี้ได้รับการอัปเดตใหม่แล้ว ลองเข้าใช้งานอีกครั้งได้เลยครับ",
    "ทีมงานรับเรื่องแล้วครับ กำลังดำเนินการตรวจสอบข้อมูลเพิ่มเติม",
  ];

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  const handleResolveTicket = async (ticketId: number, currentStatus: string, replyText?: string) => {
    if (!adminEmail) return;
    const newStatus = currentStatus === "RESOLVED" && !replyText ? "PENDING" : "RESOLVED";

    setSubmittingAction(ticketId);
    try {
      const res = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          status: newStatus,
          adminReply: replyText || undefined,
          email: adminEmail,
        }),
      });

      if (!res.ok) throw new Error("เกิดข้อผิดพลาดในการอัปเดตสถานะ");

      const result = await res.json();

      // Optimistic update in UI
      setData((prev) => {
        if (!prev) return prev;
        const updated = prev.recentTickets.map((t) =>
          t.id === ticketId ? { ...t, ...result.ticket } : t
        );
        return {
          ...prev,
          recentTickets: updated,
          supportTicketCount: updated.filter((t) => t.status === "PENDING").length,
        };
      });

      setReplyingTicketId(null);
      setTicketReplyText("");
      showToast(
        newStatus === "RESOLVED"
          ? "✅ แก้ไขและส่งการแจ้งเตือนไปยังผู้ใช้เรียบร้อยแล้ว!"
          : "เปลี่ยนสถานะเป็นรอดำเนินการ"
      );
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleResolveReport = async (reportId: number, currentStatus: string, replyText?: string) => {
    if (!adminEmail) return;
    const newStatus = currentStatus === "RESOLVED" && !replyText ? "PENDING" : "RESOLVED";

    setSubmittingAction(reportId);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          status: newStatus,
          adminReply: replyText || undefined,
          email: adminEmail,
        }),
      });

      if (!res.ok) throw new Error("เกิดข้อผิดพลาดในการอัปเดตสถานะ");

      const result = await res.json();

      // Optimistic update in UI
      setData((prev) => {
        if (!prev) return prev;
        const updated = prev.recentReports.map((r) =>
          r.id === reportId ? { ...r, ...result.report } : r
        );
        return {
          ...prev,
          recentReports: updated,
          reportedCount: updated.filter((r) => r.status === "PENDING").length,
        };
      });

      setReplyingReportId(null);
      setReportReplyText("");
      showToast(
        newStatus === "RESOLVED"
          ? "✅ บันทึกการแก้ไขข้อสอบและแจ้งเตือนผู้สอบเรียบร้อยแล้ว!"
          : "เปลี่ยนสถานะเป็นรอดำเนินการ"
      );
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setSubmittingAction(null);
    }
  };

  // ---------------------------------------------------------------------------
  // JSON Report Reason Parser
  // ---------------------------------------------------------------------------
  const parseReportReason = (rawReason: string) => {
    try {
      const parsed = JSON.parse(rawReason);
      if (typeof parsed === "object" && parsed !== null) {
        return {
          isJson: true,
          reasonType: parsed.reasonType || parsed.type || "ข้อผิดพลาด",
          details: parsed.details || parsed.detail || "",
          subject: parsed.subject || "",
          chapter: parsed.chapter || "",
          questionNumber: parsed.questionNumber || null,
          correctAnswer: parsed.correctAnswer || null,
          explanation: parsed.explanation || "",
        };
      }
    } catch (e) {
      // not JSON
    }
    return {
      isJson: false,
      reasonType: "แจ้งข้อผิดพลาด",
      details: rawReason,
      subject: "",
      chapter: "",
      questionNumber: null,
      correctAnswer: null,
      explanation: "",
    };
  };

  // ---------------------------------------------------------------------------
  // Filtered Lists
  // ---------------------------------------------------------------------------
  const filteredTickets = useMemo(() => {
    if (!data?.recentTickets) return [];
    return data.recentTickets.filter((ticket) => {
      // Status filter
      if (statusFilter !== "ALL") {
        const ticketStatus = ticket.status || "PENDING";
        if (ticketStatus !== statusFilter) return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const email = (ticket.user?.email || "").toLowerCase();
        const msg = (ticket.message || "").toLowerCase();
        return email.includes(q) || msg.includes(q);
      }
      return true;
    });
  }, [data?.recentTickets, statusFilter, searchQuery]);

  const filteredReports = useMemo(() => {
    if (!data?.recentReports) return [];
    return data.recentReports.filter((report) => {
      // Status filter
      if (statusFilter !== "ALL") {
        const reportStatus = report.status || "PENDING";
        if (reportStatus !== statusFilter) return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const email = (report.user?.email || "").toLowerCase();
        const text = (report.questionText || "").toLowerCase();
        const reason = (report.reason || "").toLowerCase();
        const qId = String(report.questionId || "");
        return email.includes(q) || text.includes(q) || reason.includes(q) || qId.includes(q);
      }
      return true;
    });
  }, [data?.recentReports, statusFilter, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFB] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-3 border-red-200 border-t-[#BD1B0B] animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FBFBFB] flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
        <p className="text-sm font-black text-slate-900 mb-4">{error || "ไม่มีสิทธิ์เข้าถึง"}</p>
        <Link href="/admin" className="py-2.5 px-6 bg-[#BD1B0B] text-white text-xs font-black rounded-xl">
          กลับ
        </Link>
      </div>
    );
  }

  const pendingTicketsCount = data.recentTickets.filter((t) => t.status === "PENDING").length;
  const resolvedTicketsCount = data.recentTickets.filter((t) => t.status === "RESOLVED").length;
  const pendingReportsCount = data.recentReports.filter((r) => r.status === "PENDING").length;

  return (
    <div className="min-h-screen bg-[#FBFBFB] font-sans pb-20 selection:bg-red-100 selection:text-red-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white text-xs font-black px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2.5 animate-bounce">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-slate-500 hover:text-[#BD1B0B] text-xs font-bold transition-colors mb-2 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              กลับหน้าภาพรวม
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-50 text-[#BD1B0B] border border-red-100 flex items-center justify-center shadow-xs">
                <Shield className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  รายละเอียดการแจ้ง
                </h1>
                <p className="text-xs text-slate-400 font-medium">
                  ระบบตอบกลับคำร้อง และตรวจสอบข้อผิดพลาดข้อสอบพร้อมแจ้งเตือนผู้ใช้
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 text-xs font-black shadow-2xs transition-all cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>

        {/* 4 Overview Counters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
            <span className="text-xs font-bold text-slate-400 block mb-1">คำร้องทั้งหมด</span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {data.recentTickets.length}
            </span>
          </div>

          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 shadow-2xs">
            <span className="text-xs font-bold text-amber-700 block mb-1">⏳ รอดำเนินการ</span>
            <span className="text-2xl sm:text-3xl font-black text-amber-600">
              {pendingTicketsCount}
            </span>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 shadow-2xs">
            <span className="text-xs font-bold text-emerald-700 block mb-1">✅ แก้ไขแล้ว</span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-600">
              {resolvedTicketsCount}
            </span>
          </div>

          <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-4 shadow-2xs">
            <span className="text-xs font-bold text-rose-700 block mb-1">🚩 ข้อสอบผิดพลาด</span>
            <span className="text-2xl sm:text-3xl font-black text-rose-600">
              {pendingReportsCount}
            </span>
          </div>
        </div>

        {/* Section Tabs & Filters */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Section Switcher */}
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveSection("tickets")}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                  activeSection === "tickets"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <MessageSquare className="w-4 h-4 text-[#BD1B0B]" />
                <span>คำร้องจากผู้ใช้</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-red-50 text-[#BD1B0B] font-bold">
                  {data.recentTickets.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection("reports")}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                  activeSection === "reports"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Flag className="w-4 h-4 text-amber-500" />
                <span>ข้อสอบที่แจ้งผิด</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 font-bold">
                  {data.recentReports.length}
                </span>
              </button>
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
              <span className="text-slate-400 text-[11px] font-medium mr-1">สถานะ:</span>
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("PENDING")}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === "PENDING"
                    ? "bg-amber-500 text-white shadow-2xs"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                ⏳ รอดำเนินการ
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("RESOLVED")}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === "RESOLVED"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                ✅ แก้ไขแล้ว
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาตามอีเมลผู้ใช้, ข้อความแจ้งปัญหา, หรือรหัสข้อสอบ..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/60 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-[#BD1B0B] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ล้าง
              </button>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* SECTION 1: คำร้องจากผู้ใช้ (Support Tickets) */}
        {/* =================================================================== */}
        {activeSection === "tickets" && (
          <div className="space-y-4">
            {filteredTickets.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-base font-black text-slate-800">ไม่มีรายการคำร้องที่ตรงกับเงื่อนไข</h3>
                <p className="text-xs text-slate-400">คำร้องทุกรายการได้รับการดูแลเรียบร้อยแล้ว</p>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const isResolved = ticket.status === "RESOLVED";
                const isReplying = replyingTicketId === ticket.id;
                const isSubmitting = submittingAction === ticket.id;

                // Extract category tag e.g. [แจ้งปัญหา], [ขอคุณสมบัติ]
                const matchTag = ticket.message?.match(/^\[(.*?)\]/);
                const tag = matchTag ? matchTag[1] : "ทั่วไป";
                const cleanMessage = ticket.message?.replace(/^\[.*?\]\s*/, "") || ticket.message;

                return (
                  <div
                    key={ticket.id}
                    className={`bg-white border rounded-3xl p-5 sm:p-6 shadow-xs transition-all space-y-4 ${
                      isResolved
                        ? "border-emerald-200/80 bg-emerald-50/10"
                        : "border-slate-200/90 hover:border-slate-300"
                    }`}
                  >
                    {/* Top Row: User info, Date, Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-xs font-black">
                          {ticket.user?.fullName?.charAt(0) || ticket.user?.email?.charAt(0) || "U"}
                        </div>
                        <div>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block leading-tight">
                            {ticket.user?.email || "ผู้ใช้งาน"}
                          </span>
                          {ticket.user?.fullName && (
                            <span className="text-[11px] text-slate-400 font-medium">
                              {ticket.user.fullName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 font-medium">
                          {new Date(ticket.createdAt).toLocaleString("th-TH", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                        <span
                          className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                            isResolved
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {isResolved ? "✅ แก้ไขแล้ว" : "⏳ รอดำเนินการ"}
                        </span>
                      </div>
                    </div>

                    {/* Message Body */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          หมวด: {tag}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-800 leading-relaxed bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
                        {cleanMessage}
                      </p>
                    </div>

                    {/* Previous Admin Reply if Resolved */}
                    {ticket.adminReply && (
                      <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800">
                          <span className="flex items-center gap-1.5">
                            <CornerDownRight className="w-3.5 h-3.5" />
                            <span>คำตอบจากแอดมิน ({ticket.resolvedBy || "ทีมงาน"}):</span>
                          </span>
                          {ticket.resolvedAt && (
                            <span className="text-emerald-600 font-normal">
                              {new Date(ticket.resolvedAt).toLocaleString("th-TH", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium pl-5">
                          {ticket.adminReply}
                        </p>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      {/* Left: Quick checkbox toggle */}
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleResolveTicket(ticket.id, ticket.status || "PENDING")}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                          isResolved
                            ? "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                            : "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>{isResolved ? "ยกเลิกเครื่องหมายแก้ไข" : "กดติ๊กแก้ไขแล้ว"}</span>
                      </button>

                      {/* Right: Reply button */}
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTicketId(isReplying ? null : ticket.id);
                          setTicketReplyText(ticket.adminReply || "");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-red-200 text-[#BD1B0B] text-xs font-black shadow-2xs transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isReplying ? "ปิดกล่องตอบกลับ" : "ตอบกลับและแจ้งเตือนผู้ใช้"}</span>
                      </button>
                    </div>

                    {/* Inline Reply Form Drawer */}
                    {isReplying && (
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 animate-slide-up">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                            <Bell className="w-3.5 h-3.5 text-[#BD1B0B]" />
                            <span>ข้อความตอบกลับผู้ใช้ (จะแจ้งเตือนไปยังกระดิ่งของผู้ใช้):</span>
                          </label>
                        </div>

                        {/* Quick Templates Chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {quickTemplates.map((tmpl, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setTicketReplyText(tmpl)}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-red-200 hover:text-[#BD1B0B] transition-colors cursor-pointer text-left"
                            >
                              + {tmpl}
                            </button>
                          ))}
                        </div>

                        <textarea
                          rows={3}
                          value={ticketReplyText}
                          onChange={(e) => setTicketReplyText(e.target.value)}
                          placeholder="พิมพ์ข้อความตอบกลับเพื่อส่งแจ้งเตือนไปยังผู้ใช้..."
                          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-[#BD1B0B]"
                        />

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setReplyingTicketId(null)}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800"
                          >
                            ยกเลิก
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting || !ticketReplyText.trim()}
                            onClick={() =>
                              handleResolveTicket(ticket.id, ticket.status || "PENDING", ticketReplyText)
                            }
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#BD1B0B] hover:bg-[#A81507] text-white text-xs font-black shadow-xs transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{isSubmitting ? "กำลังส่ง..." : "ส่งตอบกลับและแจ้งเตือนผู้ใช้"}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* SECTION 2: ข้อสอบที่ผู้สอบแจ้งผิดพลาด (Reported Questions) */}
        {/* =================================================================== */}
        {activeSection === "reports" && (
          <div className="space-y-4">
            {filteredReports.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-base font-black text-slate-800">ไม่มีรายการข้อผิดพลาดของข้อสอบค้างอยู่</h3>
                <p className="text-xs text-slate-400">ข้อสอบในคลังสมบูรณ์ถูกต้องทั้งหมด</p>
              </div>
            ) : (
              filteredReports.map((report) => {
                const isResolved = report.status === "RESOLVED";
                const isReplying = replyingReportId === report.id;
                const isSubmitting = submittingAction === report.id;
                const parsed = parseReportReason(report.reason || "");

                return (
                  <div
                    key={report.id}
                    className={`bg-white border rounded-3xl p-5 sm:p-6 shadow-xs transition-all space-y-4 ${
                      isResolved
                        ? "border-emerald-200/80 bg-emerald-50/10"
                        : "border-slate-200/90 hover:border-slate-300"
                    }`}
                  >
                    {/* Top Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-xl">
                          ข้อสอบรหัส: #{report.questionId}
                        </span>
                        {parsed.subject && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-red-50 text-[#BD1B0B] border border-red-100">
                            {parsed.subject}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 font-medium">
                          {new Date(report.createdAt).toLocaleString("th-TH", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                        <span
                          className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                            isResolved
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {isResolved ? "✅ ตรวจสอบแล้ว" : "⏳ รอดำเนินการ"}
                        </span>
                      </div>
                    </div>

                    {/* Question Content */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-400">โจทย์ข้อสอบ:</span>
                      <p className="text-xs sm:text-sm font-bold text-slate-800 bg-slate-50/80 p-3 rounded-xl border border-slate-200/60 leading-relaxed">
                        {report.questionText}
                      </p>
                    </div>

                    {/* Student's Reason & Report Details */}
                    <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                          <span>🚩</span>
                          <span>สาเหตุที่ผู้สอบแจ้ง:</span>
                          <span className="underline decoration-amber-400">{parsed.reasonType}</span>
                        </span>
                        {report.user?.email && (
                          <span className="text-[11px] text-amber-800/80 font-medium">
                            ผู้แจ้ง: {report.user.email}
                          </span>
                        )}
                      </div>

                      {parsed.details && (
                        <p className="text-xs text-amber-950 font-medium leading-relaxed pl-5">
                          {parsed.details}
                        </p>
                      )}

                      {parsed.explanation && (
                        <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-xl border border-amber-100">
                          <span className="font-bold text-slate-700">คำอธิบายข้อสอบเดิม: </span>
                          <span>{parsed.explanation}</span>
                        </div>
                      )}
                    </div>

                    {/* Admin Reply Note if Resolved */}
                    {report.adminReply && (
                      <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-3.5 space-y-1">
                        <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>บันทึกการแก้ไขของแอดมิน ({report.resolvedBy || "ทีมงาน"}):</span>
                        </span>
                        <p className="text-xs text-slate-700 font-medium pl-4">{report.adminReply}</p>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        {/* Checkbox Resolve Toggle */}
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleResolveReport(report.id, report.status || "PENDING")}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                            isResolved
                              ? "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                              : "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>{isResolved ? "ยกเลิกเครื่องหมายแก้ไข" : "กดติ๊กแก้ไขแล้ว"}</span>
                        </button>

                        {/* Direct link to edit question */}
                        <Link
                          href={`/admin/questions?search=${encodeURIComponent(report.questionId)}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>เปิดดูในคลังข้อสอบ</span>
                        </Link>
                      </div>

                      {/* Reply Note button */}
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingReportId(isReplying ? null : report.id);
                          setReportReplyText(report.adminReply || "");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-amber-300 text-amber-700 text-xs font-black shadow-2xs transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isReplying ? "ปิดกล่องตอบกลับ" : "บันทึกการแก้ & แจ้งเตือนผู้สอบ"}</span>
                      </button>
                    </div>

                    {/* Inline Reply Form for Question Report */}
                    {isReplying && (
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 animate-slide-up">
                        <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-amber-600" />
                          <span>บันทึกการแก้ไขข้อสอบ (ส่งแจ้งเตือนไปยังผู้สอบที่แจ้ง):</span>
                        </label>

                        <div className="flex flex-wrap gap-1.5">
                          {[
                            "ทีมงานได้ตรวจเช็คและแก้ไขเฉลยในคลังข้อสอบให้ถูกต้องแล้วครับ",
                            "แก้ไขข้อความคำอธิบายเฉลยให้ชัดเจนยิ่งขึ้นเรียบร้อยแล้วครับ",
                            "ข้อสอบได้รับการปรับปรุงให้ตรงตามหลักสูตรล่าสุดแล้วครับ",
                          ].map((tmpl, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setReportReplyText(tmpl)}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-800 transition-colors cursor-pointer text-left"
                            >
                              + {tmpl}
                            </button>
                          ))}
                        </div>

                        <textarea
                          rows={2}
                          value={reportReplyText}
                          onChange={(e) => setReportReplyText(e.target.value)}
                          placeholder="ระบุสิ่งที่แก้ไข เพื่อส่งแจ้งเตือนให้ผู้สอบทราบ..."
                          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-500"
                        />

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setReplyingReportId(null)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800"
                          >
                            ยกเลิก
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting || !reportReplyText.trim()}
                            onClick={() =>
                              handleResolveReport(report.id, report.status || "PENDING", reportReplyText)
                            }
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isSubmitting ? "กำลังบันทึก..." : "บันทึกและส่งแจ้งเตือน"}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
