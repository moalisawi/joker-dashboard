"use client";

import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "@/store/themeStore";

export default function ThemeToggle() {
  const { dark, toggle } = useThemeStore();

  return (
    <button
      onClick={toggle}
      title={dark ? "الوضع الفاتح" : "الوضع الداكن"}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-150 text-white/40 hover:bg-white/[0.07] hover:text-white/90"
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
      <span>{dark ? "الوضع الفاتح" : "الوضع الداكن"}</span>
    </button>
  );
}
