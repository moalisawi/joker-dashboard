"use client";

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
    `text-xs px-3 py-1.5 rounded-lg font-bold transition-all border whitespace-nowrap ${
      active
        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
    }`;

  return (
    <div className="flex items-center gap-2 flex-wrap mb-5" dir="rtl">
      <span className="text-[11px] font-bold text-slate-400">إحصائيات:</span>

      <button
        className={pill(value.mode === "current_month")}
        onClick={() => { onChange({ mode: "current_month" }); setShowPicker(false); }}
      >
        الشهر الحالي
      </button>

      {([30, 90, 180] as const).map((n) => (
        <button
          key={n}
          className={pill(isActive({ mode: "days", n }))}
          onClick={() => { onChange({ mode: "days", n }); setShowPicker(false); }}
        >
          آخر {n} يوم
        </button>
      ))}

      {/* Month picker */}
      <div ref={ref} className="relative">
        <button
          className={`${pill(isMonthMode)} flex items-center gap-1.5`}
          onClick={() => setShowPicker((v) => !v)}
        >
          <Calendar size={12} />
          {isMonthMode ? getPeriodLabel(value) : "شهر محدد"}
        </button>

        {showPicker && (
          <div
            className="absolute top-full mt-2 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 w-60"
            dir="rtl"
          >
            {/* Year navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                className="p-1 hover:bg-slate-100 rounded-lg transition"
                onClick={() => setPickerYear((y) => y - 1)}
              >
                <ChevronRight size={15} className="text-slate-500" />
              </button>
              <span className="text-sm font-black text-slate-800">{pickerYear}</span>
              <button
                className="p-1 hover:bg-slate-100 rounded-lg transition disabled:opacity-30"
                onClick={() => setPickerYear((y) => y + 1)}
                disabled={pickerYear >= currentYear}
              >
                <ChevronLeft size={15} className="text-slate-500" />
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
                    className={`text-xs py-1.5 rounded-lg font-bold transition-all ${
                      selected
                        ? "bg-blue-600 text-white"
                        : isFuture
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                    }`}
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
