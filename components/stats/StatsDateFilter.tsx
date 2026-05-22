"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

export type StatsPeriod =
  | { mode: "current_month" }
  | { mode: "days"; n: 30 | 90 | 180 }
  | { mode: "month"; ym: string }; // "YYYY-MM"

const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function getPeriodLabel(p: StatsPeriod): string {
  const now = new Date();
  if (p.mode === "current_month") return `${AR_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  if (p.mode === "days")          return `آخر ${p.n} يوم`;
  const [y, m] = p.ym.split("-");
  return `${AR_MONTHS[Number(m) - 1]} ${y}`;
}

interface Props {
  value:    StatsPeriod;
  onChange: (p: StatsPeriod) => void;
}

export default function StatsDateFilter({ value, onChange }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowPicker(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const today        = new Date();
  const currentYear  = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const isActive = (p: StatsPeriod) => JSON.stringify(value) === JSON.stringify(p);
  const isMonthMode = value.mode === "month";

  const pill = (active: boolean) =>
    `transition-all whitespace-nowrap ${active ? "" : "hover:text-slate-700"}`;

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 18px",
    fontSize: 12.5,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    background: active ? "#5B5FEF" : "transparent",
    color: active ? "#fff" : "var(--jk-muted)",
    boxShadow: active ? "var(--jk-shadow-nav)" : "none",
    borderRadius: 999,
  });

  return (
    <div
      className="flex items-center gap-1 flex-wrap mb-5"
      dir="rtl"
      style={{
        background: "var(--jk-surface)",
        border: "1px solid var(--jk-border)",
        borderRadius: 999,
        padding: 5,
        boxShadow: "var(--jk-shadow-flat)",
        width: "fit-content",
      }}
    >
      <button
        className={pill(value.mode === "current_month")}
        style={pillStyle(value.mode === "current_month")}
        onClick={() => { onChange({ mode: "current_month" }); setShowPicker(false); }}
      >
        الشهر الحالي
      </button>

      {([30, 90, 180] as const).map((n) => (
        <button
          key={n}
          className={pill(isActive({ mode: "days", n }))}
          style={pillStyle(isActive({ mode: "days", n }))}
          onClick={() => { onChange({ mode: "days", n }); setShowPicker(false); }}
        >
          آخر {n} يوم
        </button>
      ))}

      {/* Month picker */}
      <div ref={ref} className="relative">
        <button
          className={`${pill(isMonthMode)} flex items-center gap-1.5`}
          style={pillStyle(isMonthMode)}
          onClick={() => setShowPicker((v) => !v)}
        >
          <Calendar size={13} />
          {isMonthMode ? getPeriodLabel(value) : "شهر محدد"}
        </button>

        {showPicker && (
          <div
            className="absolute top-full mt-2 right-0 z-50 p-4 w-60"
            dir="rtl"
            style={{
              background: "var(--jk-surface)",
              border: "1px solid var(--jk-border)",
              borderRadius: 22,
              boxShadow: "var(--jk-shadow-modal)",
            }}
          >
            {/* Year navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                className="p-1 transition rounded-full"
                style={{ color: "#6B7280" }}
                onClick={() => setPickerYear((y) => y - 1)}
              >
                <ChevronRight size={15} />
              </button>
              <span className="text-sm font-black" style={{ color: "#5B5FEF" }}>{pickerYear}</span>
              <button
                className="p-1 transition rounded-full disabled:opacity-30"
                style={{ color: "#6B7280" }}
                onClick={() => setPickerYear((y) => y + 1)}
                disabled={pickerYear >= currentYear}
              >
                <ChevronLeft size={15} />
              </button>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {AR_MONTHS.map((name, idx) => {
                const monthNum = idx + 1;
                const ym       = `${pickerYear}-${String(monthNum).padStart(2, "0")}`;
                const isFuture = pickerYear === currentYear && monthNum > currentMonth;
                const selected = isActive({ mode: "month", ym });

                return (
                  <button
                    key={ym}
                    disabled={isFuture}
                    onClick={() => { onChange({ mode: "month", ym }); setShowPicker(false); }}
                    className="text-xs py-1.5 font-bold transition-all"
                    style={{
                      borderRadius: 9999,
                      background: selected ? "#5B5FEF" : "transparent",
                      color: selected ? "#fff" : isFuture ? "#9CA3AF" : "#6B7280",
                      cursor: isFuture ? "not-allowed" : "pointer",
                    }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
