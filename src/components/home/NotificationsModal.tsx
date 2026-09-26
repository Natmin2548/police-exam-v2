"use client";

import React from "react";
import { Bell, X, CheckCheck, MessageSquare, Flag, Info, Clock, CheckCircle2 } from "lucide-react";

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getIcon = (type: string) => {
    switch (type) {
      case "SUPPORT_REPLY":
        return <MessageSquare className="w-4 h-4 text-[#BD1B0B]" />;
      case "QUESTION_RESOLVED":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      default:
        return <Bell className="w-4 h-4 text-blue-600" />;
    }
  };

  const getBadge = (type: string) => {
    switch (type) {
      case "SUPPORT_REPLY":
        return { label: "แอดมินตอบกลับ", bg: "bg-red-50 text-[#BD1B0B] border-red-100" };
      case "QUESTION_RESOLVED":
        return { label: "ข้อสอบแก้ไขแล้ว", bg: "bg-emerald-50 text-emerald-700 border-emerald-100" };
      default:
        return { label: "แจ้งเตือนระบบ", bg: "bg-blue-50 text-blue-700 border-blue-100" };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-slide-up flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-red-50 text-[#BD1B0B] flex items-center justify-center">
              <Bell className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">การแจ้งเตือน</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-50 text-[#BD1B0B] border border-red-100">
                    ใหม่ {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">คำตอบจากแอดมินและการอัปเดตระบบ</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                title="อ่านทั้งหมด"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">อ่านทั้งหมด</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto p-4 space-y-3 divide-y divide-slate-100/80">
          {notifications.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-sm font-black text-slate-800">ไม่มีการแจ้งเตือนใหม่ในขณะนี้</p>
              <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
                เมื่อแอดมินตอบกลับคำร้อง หรือแก้ไขข้อสอบที่คุณแจ้ง จะปรากฏขึ้นที่นี่ครับ
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const badge = getBadge(item.type);
              return (
                <div
                  key={item.id}
                  className={`pt-3 first:pt-0 rounded-2xl p-3 transition-colors ${
                    !item.isRead ? "bg-red-50/30 border border-red-100/60" : "bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        {getIcon(item.type)}
                      </div>
                      <span className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                        {item.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.bg}`}>
                        {badge.label}
                      </span>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#BD1B0B] animate-pulse shrink-0" />
                      )}
                    </div>
                  </div>

                  <div className="pl-9 space-y-1.5">
                    <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-line bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {item.message}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {new Date(item.createdAt).toLocaleString("th-TH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
