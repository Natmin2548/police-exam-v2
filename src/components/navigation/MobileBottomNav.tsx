"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookMarked, Trophy, BookOpen } from "lucide-react";

export const MobileBottomNav = () => {
  const pathname = usePathname();

  const navItems = [
    {
      label: "หน้าหลัก",
      href: "/home",
      icon: Home,
      isActive: pathname === "/home" || pathname === "/",
    },
    {
      label: "คลังข้อสอบ",
      href: "/archive",
      icon: BookMarked,
      isActive: pathname === "/archive",
    },
    {
      label: "คลังคำศัพท์",
      href: "/vocab",
      icon: BookOpen,
      isActive: pathname === "/vocab",
    },
    {
      label: "จัดอันดับ",
      href: "/rank",
      icon: Trophy,
      isActive: pathname === "/rank",
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 py-1.5 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-lg shadow-slate-900/5 flex items-center justify-between lg:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer active:scale-95 touch-manipulation ${
              item.isActive
                ? "text-[#BD1B0B] font-black"
                : "text-slate-400 hover:text-slate-600 font-bold"
            }`}
          >
            <Icon className={`w-5 h-5 ${item.isActive ? "stroke-[2.5]" : "stroke-2"}`} />
            <span className="text-[10px] sm:text-[11px] leading-none text-center whitespace-nowrap">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};
