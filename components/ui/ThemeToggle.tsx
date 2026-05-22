"use client";

import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "@/store/themeStore";

export default function ThemeToggle() {
  const { dark, toggle } = useThemeStore();

  return (
    <button
      onClick={toggle}
      title={dark ? "الوضع الفاتح" : "الوضع الداكن"}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold transition-all duration-150"
      style={{
        borderRadius: 9999,
        color: "rgba(255,255,255,.40)",
        background: "transparent",
      }}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
      <span>{dark ? "الوضع الفاتح" : "الوضع الداكن"}</span>
    </button>
  );
}
