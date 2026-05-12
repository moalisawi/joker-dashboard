"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Subscriber } from "@/types";
import { formatNumber, ARABIC_MONTHS } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { ChevronRight, ChevronLeft, X, ExternalLink } from "lucide-react";

interface Props {
  subscribers: Subscriber[];
}

export default function MonthlyCalendar({ subscribers }: Props) {
  const { can } = useAuthStore();
  const canRev = can("canViewRevenue");

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [empFilter, setEmpFilter] = useState("");
  const [pkgFilter, setPkgFilter] = useState("");
  const [dayModal, setDayModal] = useState<{ date: string; data: Subscriber[] } | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const todayStr = new Date().toISOString().split("T")[0];

  const monthData = useMemo(() => {
    return subscribers.filter((s) => {
      const d = new Date(s.date);
      if (d.getFullYear() !== year || d.getMonth() !== month) return false;
      if (empFilter && s.convincedBy !== empFilter) return false;
      if (pkgFilter && s.package !== pkgFilter) return false;
      return true;
    });
  }, [subscribers, year, month, empFilter, pkgFilter]);

  // Day → count map
  const dayMap = useMemo(() => {
    const m: Record<string, Subscriber[]> = {};
    monthData.forEach((s) => {
      if (!m[s.date]) m[s.date] = [];
      m[s.date].push(s);
    });
    return m;
  }, [monthData]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = (new Date(year, month, 1).getDay() + 1) % 7;

  const monthRevenue = monthData.reduce((s, x) => s + x.netAmountUSD, 0);
  const dayCounts = Object.fromEntries(
    Object.entries(dayMap).map(([d, arr]) => [new Date(d).getDate(), arr.length])
  );
  const bestDayNum = Object.keys(dayCounts).reduce<string | null>(
    (best, d) => (!best || dayCounts[d] > dayCounts[best]) ? d : best,
    null
  );
  const avgDaily = (monthData.length / daysInMonth).toFixed(1);

  function prevMonth() {
    setCurrentMonth((d) => {
      const nd = new Date(d);
      nd.setMonth(nd.getMonth() - 1);
      return nd;
    });
  }
  function nextMonth() {
    setCurrentMonth((d) => {
      const nd = new Date(d);
      nd.setMonth(nd.getMonth() + 1);
      return nd;
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-[0_1px_2px_rgba(0,0,0,0.05),_0_2px_8px_rgba(0,0,0,0.06)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <ChevronRight size={18} />
          </button>
          <h3 className="font-bold text-slate-800 text-base">
            {ARABIC_MONTHS[month]} {year}
          </h3>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={empFilter}
            onChange={(e) => setEmpFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 bg-white hover:border-slate-300 transition-colors cursor-pointer"
          >
            <option value="">كل الموظفين</option>
            {["حنان","ميار","ميدو"].map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <select
            value={pkgFilter}
            onChange={(e) => setPkgFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 bg-white hover:border-slate-300 transition-colors cursor-pointer"
          >
            <option value="">كل الباقات</option>
            <option value="فضية">فضية</option>
            <option value="ذهبية">ذهبية</option>
          </select>
        </div>
      </div>

      {/* Summary mini-cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "الاشتراكات",   value: formatNumber(monthData.length),                              accent: "border-t-blue-500"    },
          { label: "الإيرادات",    value: canRev ? `$${formatNumber(monthRevenue, 2)}` : "مخفي",       accent: "border-t-emerald-500" },
          { label: "أفضل يوم",     value: bestDayNum ? `يوم ${bestDayNum}` : "—",                     accent: "border-t-amber-500"   },
          { label: "المعدل اليومي",value: formatNumber(parseFloat(avgDaily), 1),                       accent: "border-t-purple-500"  },
        ].map((c) => (
          <div key={c.label} className={`bg-slate-50/80 border border-t-2 ${c.accent} border-x-slate-100 border-b-slate-100 rounded-xl p-3 text-center`}>
            <p className="text-xs text-slate-400 font-medium mb-1">{c.label}</p>
            <p className="font-black text-slate-800 text-sm tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 mb-2">
        {["أحد","اثن","ثلا","أرب","خمي","جمع","سبت"].map((d) => (
          <div key={d} className="text-center py-1.5" style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", color: "#94a3b8" }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="cal-day opacity-0 pointer-events-none" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayData = dayMap[dateStr] || [];
          const isToday = dateStr === todayStr;
          const silver = dayData.filter((s) => s.package === "فضية").length;
          const gold = dayData.filter((s) => s.package === "ذهبية").length;

          return (
            <div
              key={day}
              onClick={() => dayData.length > 0 && setDayModal({ date: dateStr, data: dayData })}
              className={`cal-day ${dayData.length > 0 ? "has-data" : ""} ${isToday ? "today" : ""}`}
            >
              <div className={`day-num text-xs font-bold mb-1.5 ${isToday ? "" : "text-slate-500"}`}>
                {day}
              </div>
              {dayData.length > 0 && (
                <>
                  <div className="text-blue-700 font-black text-sm leading-none mb-1">{dayData.length}</div>
                  <div className="flex gap-0.5 flex-wrap">
                    {silver > 0 && (
                      <span className="text-[9px] font-bold bg-slate-200/80 text-slate-600 px-1.5 py-0.5 rounded-md">{silver}ف</span>
                    )}
                    {gold > 0 && (
                      <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md">{gold}ذ</span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Day detail modal */}
      {dayModal && (
        <div className="modal-overlay" onClick={() => setDayModal(null)}>
          <div
            className="modal-panel max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {new Date(dayModal.date).toLocaleDateString("ar-EG", {
                    weekday: "long", day: "numeric", month: "long",
                  })}
                </h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">
                  {dayModal.data.length} اشتراك جديد
                </p>
              </div>
              <button
                onClick={() => setDayModal(null)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {canRev && (
                <div className="rounded-2xl p-4 border border-t-[3px] border-t-emerald-500 border-x-emerald-100 border-b-emerald-100 bg-gradient-to-br from-emerald-50 to-white text-center">
                  <p className="text-xs font-semibold text-emerald-500 mb-1" style={{ letterSpacing: "0.06em" }}>إيرادات اليوم</p>
                  <p className="text-2xl font-black text-emerald-900 tracking-tight tabular-nums">
                    ${formatNumber(dayModal.data.reduce((s, x) => s + x.netAmountUSD, 0), 2)}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {dayModal.data.map((s) => (
                  <Link
                    key={s.id}
                    href={`/subscribers/${s.id}`}
                    onClick={() => setDayModal(null)}
                    className="flex items-center justify-between px-4 py-3 bg-slate-50/80 rounded-xl border border-slate-100 hover:bg-blue-50 hover:border-blue-200 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-[10px] font-black text-white"
                        style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)" }}>
                        {s.name.split(" ").map((w: string) => w[0]).slice(0,2).join("").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors flex items-center gap-1">
                          {s.name}
                          <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{s.dialCode}{s.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${s.package === "فضية" ? "pkg-silver" : "pkg-gold"}`}>
                        {s.package}
                      </span>
                      {canRev && (
                        <span className="text-xs font-black text-emerald-700 tabular-nums">
                          ${formatNumber(s.netAmountUSD, 2)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
