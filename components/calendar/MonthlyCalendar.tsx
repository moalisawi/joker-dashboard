"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Subscriber } from "@/types";
import { formatNumber, ARABIC_MONTHS } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { ChevronRight, ChevronLeft, X, ExternalLink } from "lucide-react";

interface Props { subscribers: Subscriber[] }

const DAY_HEADERS = ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

export default function MonthlyCalendar({ subscribers }: Props) {
  const { can } = useAuthStore();
  const canRev  = can("canViewRevenue");

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [dayModal, setDayModal] = useState<{ date: string; data: Subscriber[] } | null>(null);

  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const todayStr = new Date().toISOString().split("T")[0];

  const monthData = useMemo(() =>
    subscribers.filter((s) => {
      const d = new Date(s.date);
      return d.getFullYear() === year && d.getMonth() === month;
    }),
  [subscribers, year, month]);

  const dayMap = useMemo(() => {
    const m: Record<string, Subscriber[]> = {};
    monthData.forEach((s) => { (m[s.date] ??= []).push(s); });
    return m;
  }, [monthData]);

  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = (new Date(year, month, 1).getDay() + 1) % 7;

  function prevMonth() {
    setCurrentMonth((d) => { const nd = new Date(d); nd.setMonth(nd.getMonth() - 1); return nd; });
  }
  function nextMonth() {
    setCurrentMonth((d) => { const nd = new Date(d); nd.setMonth(nd.getMonth() + 1); return nd; });
  }

  return (
    <div className="panel p-5" style={{ minHeight: 500 }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        {/* Navigation — left (RTL end) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={prevMonth}
            style={{
              width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--surface-2)", color: "var(--text-muted)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <ChevronRight size={15} />
          </button>
          <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: "var(--text-primary)", minWidth: 80, textAlign: "center" }}>
            {ARABIC_MONTHS[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            style={{
              width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--surface-2)", color: "var(--text-muted)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <ChevronLeft size={15} />
          </button>
        </div>

        {/* Title — right (RTL start) */}
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "var(--fs-heading)", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>
            التقويم الشهري
          </p>
          <p style={{ fontSize: "var(--fs-micro)", color: "var(--text-muted)", marginTop: 3 }}>
            نشاط الاشتراكات لكل يوم
          </p>
        </div>
      </div>

      {/* ── Day headers ────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 8 }}>
        {DAY_HEADERS.map((d) => (
          <div key={d} style={{
            textAlign: "center", paddingBlock: 6,
            fontSize: "var(--fs-micro)", fontWeight: 700,
            letterSpacing: "0.06em", color: "var(--text-muted)",
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ──────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>

        {/* Empty offset cells */}
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`e${i}`} style={{ minHeight: 78 }} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day     = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayData = dayMap[dateStr] ?? [];
          const isToday = dateStr === todayStr;
          const hasData = dayData.length > 0;
          const silver  = dayData.filter((s) => s.package === "فضية").length;
          const gold    = dayData.filter((s) => s.package === "ذهبية").length;

          return (
            <div
              key={day}
              onClick={() => hasData && setDayModal({ date: dateStr, data: dayData })}
              style={{
                minHeight: 78,
                borderRadius: 12,
                padding: "8px 7px 7px",
                cursor: hasData ? "pointer" : "default",
                background: hasData
                  ? "rgba(99,102,241,.11)"
                  : "rgba(255,255,255,.38)",
                border: isToday
                  ? "2px solid #5B5FEF"
                  : hasData
                    ? "1px solid rgba(99,102,241,.20)"
                    : "1px solid transparent",
                transition: "all .15s ease",
                display: "flex", flexDirection: "column",
                boxShadow: isToday ? "0 0 0 1px rgba(16,20,26,.06)" : "none",
              }}
              onMouseEnter={e => {
                if (hasData) (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,.18)";
              }}
              onMouseLeave={e => {
                if (hasData) (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,.11)";
              }}
            >
              {/* Day number */}
              <span style={{
                fontSize: "var(--fs-micro)", fontWeight: isToday ? 800 : 600,
                color: isToday ? "var(--text-primary)" : "var(--text-muted)",
                display: "block", textAlign: "right", lineHeight: 1,
                ...(isToday ? {
                  background: "#5B5FEF", color: "#fff",
                  width: 20, height: 20, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginRight: "auto",
                } : {}),
              }}>
                {day}
              </span>

              {/* Badges */}
              {hasData && (
                <div style={{
                  marginTop: "auto", paddingTop: 6,
                  display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "flex-end",
                }}>
                  {silver > 0 && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, lineHeight: 1,
                      padding: "2px 5px", borderRadius: 5,
                      background: "rgba(91,95,239,.20)", color: "#4A78C0",
                    }}>
                      {silver}ف
                    </span>
                  )}
                  {gold > 0 && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, lineHeight: 1,
                      padding: "2px 5px", borderRadius: 5,
                      background: "rgba(245,158,11,.22)", color: "#9A6A10",
                    }}>
                      {gold}ذ
                    </span>
                  )}
                  {dayData.length > silver + gold && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, lineHeight: 1,
                      padding: "2px 5px", borderRadius: 5,
                      background: "rgba(99,102,241,.18)", color: "#4F46E5",
                    }}>
                      {dayData.length - silver - gold}+
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Day detail modal ───────────────────────────────────── */}
      {dayModal && (
        <div className="modal-overlay" onClick={() => setDayModal(null)}>
          <div className="modal-panel max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 22px", borderBottom: "1px solid var(--border-soft)",
            }}>
              <button
                onClick={() => setDayModal(null)}
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "var(--surface-2)", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--text-muted)",
                }}
              >
                <X size={16} />
              </button>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "var(--fs-heading)", fontWeight: 700, color: "var(--text-primary)" }}>
                  {new Date(dayModal.date).toLocaleDateString("ar-EG", {
                    weekday: "long", day: "numeric", month: "long",
                  })}
                </p>
                <p style={{ fontSize: "var(--fs-micro)", color: "var(--text-muted)", marginTop: 2 }}>
                  {dayModal.data.length} اشتراك جديد
                </p>
              </div>
            </div>

            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              {canRev && (
                <div style={{
                  borderRadius: 16, padding: "14px 18px", textAlign: "center",
                  background: "rgba(34,197,94,.08)",
                  border: "1px solid rgba(34,197,94,.20)",
                }}>
                  <p style={{ fontSize: "var(--fs-micro)", fontWeight: 700, color: "#5B5FEF", letterSpacing: "0.06em", marginBottom: 4 }}>
                    إيرادات اليوم
                  </p>
                  <p style={{ fontSize: "var(--fs-display)", fontWeight: 800, color: "#5B5FEF", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                    ${formatNumber(dayModal.data.reduce((s, x) => s + x.netAmountUSD, 0), 2)}
                  </p>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dayModal.data.map((s) => (
                  <Link
                    key={s.id}
                    href={`/subscribers/${s.id}`}
                    onClick={() => setDayModal(null)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px", borderRadius: 12, textDecoration: "none",
                      background: "var(--surface-2)", border: "1px solid var(--border-soft)",
                      transition: "all .15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,.08)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,.22)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-soft)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "var(--fs-caption)", fontWeight: 700, color: "#4F46E5" }}>
                        ${formatNumber(s.netAmountUSD, 0)}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${s.package === "فضية" ? "pkg-silver" : "pkg-gold"}`}>
                        {s.package}
                      </span>
                      <ExternalLink size={11} style={{ color: "var(--text-muted)" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "right" }}>
                      <div>
                        <p style={{ fontSize: "var(--fs-small)", fontWeight: 600, color: "var(--text-primary)" }}>{s.name}</p>
                        <p style={{ fontSize: "var(--fs-micro)", color: "var(--text-muted)", marginTop: 2 }} dir="ltr">
                          {s.dialCode}{s.phone}
                        </p>
                      </div>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                        background: "linear-gradient(135deg, #5B5FEF, #3B82F6)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 11, fontWeight: 700,
                      }}>
                        {s.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
                      </div>
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
