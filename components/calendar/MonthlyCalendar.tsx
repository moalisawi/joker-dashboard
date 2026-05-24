"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { Subscriber } from "@/types";
import { formatNumber, ARABIC_MONTHS } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { ChevronRight, ChevronLeft, X, ExternalLink, CalendarDays } from "lucide-react";

interface Props { subscribers: Subscriber[] }

const DAY_HEADERS = ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

/* Heat level → colors (5 tiers like GitHub) */
function heatColor(count: number, max: number) {
  if (count === 0 || max === 0) return { bg: "transparent", border: "var(--jk-divider)", text: "var(--jk-subtle)", dot: "var(--jk-subtle)" };
  const r = count / max;
  if (r <= 0.2)  return { bg: "rgba(91,95,239,0.10)", border: "rgba(91,95,239,0.18)", text: "var(--jk-text)", dot: "#818CF8" };
  if (r <= 0.4)  return { bg: "rgba(91,95,239,0.20)", border: "rgba(91,95,239,0.28)", text: "var(--jk-text)", dot: "#6366F1" };
  if (r <= 0.65) return { bg: "rgba(91,95,239,0.40)", border: "rgba(91,95,239,0.48)", text: "#fff", dot: "#fff" };
  if (r <= 0.85) return { bg: "rgba(91,95,239,0.65)", border: "rgba(91,95,239,0.72)", text: "#fff", dot: "#fff" };
  return { bg: "#5B5FEF", border: "#4F46E5", text: "#fff", dot: "#fff" };
}

export default function MonthlyCalendar({ subscribers }: Props) {
  const { can } = useAuthStore();
  const canRev  = can("canViewRevenue");

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [dayModal, setDayModal] = useState<{ date: string; data: Subscriber[] } | null>(null);

  const year     = currentMonth.getFullYear();
  const month    = currentMonth.getMonth();
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

  const maxDay = useMemo(
    () => Math.max(...Object.values(dayMap).map((v) => v.length), 1),
    [dayMap],
  );

  const daysInMonth    = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = (new Date(year, month, 1).getDay() + 1) % 7;
  const monthRevenue   = monthData.reduce((sum, s) => sum + s.netAmountUSD, 0);

  function prevMonth() {
    setCurrentMonth((d) => { const nd = new Date(d); nd.setMonth(nd.getMonth() - 1); return nd; });
  }
  function nextMonth() {
    setCurrentMonth((d) => { const nd = new Date(d); nd.setMonth(nd.getMonth() + 1); return nd; });
  }

  return (
    <div className="panel" style={{ padding: "22px 22px 18px", minHeight: 480 }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: "var(--jk-accent-bg)", color: "var(--jk-primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid var(--jk-accent-border)",
            }}>
              <CalendarDays size={15} />
            </div>
            <h3 style={{ fontSize: 15.5, fontWeight: 800, color: "var(--jk-text)", margin: 0, letterSpacing: "-0.015em" }}>
              التقويم الشهري
            </h3>
          </div>
          <p style={{ fontSize: 12, color: "var(--jk-subtle)", margin: 0, paddingInlineStart: 39 }}>
            نشاط الاشتراكات · {ARABIC_MONTHS[month]} {year}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Summary chips */}
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
              background: "var(--jk-accent-bg)", color: "var(--jk-primary)",
              border: "1px solid var(--jk-accent-border)",
            }}>
              {monthData.length} اشتراك
            </span>
            {canRev && monthRevenue > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                background: "#ECFDF3", color: "#22C55E",
                border: "1px solid rgba(34,197,94,0.25)",
              }}>
                ${formatNumber(monthRevenue, 0)}
              </span>
            )}
          </div>

          {/* Nav buttons */}
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { onClick: prevMonth, icon: <ChevronRight size={14} /> },
              { onClick: nextMonth, icon: <ChevronLeft size={14} /> },
            ].map(({ onClick, icon }, idx) => (
              <button key={idx} onClick={onClick} style={{
                width: 30, height: 30, borderRadius: 9,
                border: "1px solid var(--jk-border)",
                background: "var(--jk-surface)", color: "var(--jk-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all .15s",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "var(--jk-accent-bg)";
                el.style.color = "var(--jk-primary)";
                el.style.borderColor = "var(--jk-accent-border)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "var(--jk-surface)";
                el.style.color = "var(--jk-muted)";
                el.style.borderColor = "var(--jk-border)";
              }}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Day headers ────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
        {DAY_HEADERS.map((d) => (
          <div key={d} style={{
            textAlign: "center", paddingBlock: 5,
            fontSize: 10, fontWeight: 700,
            letterSpacing: "0.06em", color: "var(--jk-subtle)",
            textTransform: "uppercase",
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar grid (heatmap) ─────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>

        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`e${i}`} style={{ minHeight: 70 }} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day     = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayData = dayMap[dateStr] ?? [];
          const isToday = dateStr === todayStr;
          const hasData = dayData.length > 0;
          const gold    = dayData.filter((s) => s.package === "ذهبية").length;
          const silver  = dayData.filter((s) => s.package === "فضية").length;
          const heat    = heatColor(dayData.length, maxDay);

          return (
            <motion.div
              key={day}
              onClick={() => hasData && setDayModal({ date: dateStr, data: dayData })}
              whileHover={hasData ? { scale: 1.06, y: -2 } : {}}
              whileTap={hasData ? { scale: 0.95 } : {}}
              transition={{ type: "spring", stiffness: 600, damping: 30 }}
              style={{
                minHeight: 70, borderRadius: 11,
                padding: "7px 7px 6px",
                cursor: hasData ? "pointer" : "default",
                background: isToday
                  ? (hasData ? heat.bg : "rgba(91,95,239,0.06)")
                  : heat.bg,
                border: isToday
                  ? "2px solid var(--jk-primary)"
                  : `1px solid ${heat.border}`,
                display: "flex", flexDirection: "column",
                boxShadow: isToday ? "0 0 0 3px rgba(91,95,239,0.12)" : "none",
                transition: "box-shadow .2s ease",
              }}
            >
              {/* Day number */}
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 20, height: 20, borderRadius: "50%",
                background: isToday ? "var(--jk-primary)" : "transparent",
                color: isToday ? "#fff" : heat.text,
                fontSize: 11, fontWeight: isToday ? 800 : (hasData ? 700 : 500),
                lineHeight: 1,
              }}>
                {day}
              </span>

              {/* Dot indicators + mini badges */}
              {hasData && (
                <div style={{ marginTop: "auto", paddingTop: 4 }}>
                  {/* Package badges */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "flex-end", marginBottom: 3 }}>
                    {gold > 0 && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 4, lineHeight: 1.5,
                        background: "rgba(245,158,11,.22)", color: heat.text === "#fff" ? "rgba(255,240,200,0.9)" : "#92600A",
                      }}>
                        {gold}ذ
                      </span>
                    )}
                    {silver > 0 && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 4, lineHeight: 1.5,
                        background: "rgba(148,163,184,.22)", color: heat.text === "#fff" ? "rgba(220,230,240,0.9)" : "#475569",
                      }}>
                        {silver}ف
                      </span>
                    )}
                  </div>
                  {/* Dot count */}
                  <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                    {Array.from({ length: Math.min(dayData.length, 4) }).map((_, di) => (
                      <span key={di} style={{
                        width: 3.5, height: 3.5, borderRadius: "50%",
                        background: heat.dot, display: "block", flexShrink: 0,
                      }} />
                    ))}
                    {dayData.length > 4 && (
                      <span style={{ fontSize: 7, fontWeight: 700, color: heat.dot, lineHeight: 1 }}>+</span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ── Heatmap legend ─────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 14 }}>
        <span style={{ fontSize: 10, color: "var(--jk-subtle)", fontWeight: 600 }}>أقل</span>
        {["transparent", "rgba(91,95,239,0.10)", "rgba(91,95,239,0.25)", "rgba(91,95,239,0.50)", "#5B5FEF"].map((bg, idx) => (
          <span key={idx} style={{
            width: 12, height: 12, borderRadius: 3,
            background: bg,
            border: idx === 0 ? "1px solid var(--jk-divider)" : "none",
            display: "block",
          }} />
        ))}
        <span style={{ fontSize: 10, color: "var(--jk-subtle)", fontWeight: 600 }}>أكثر</span>
      </div>

      {/* ── Day detail modal ───────────────────────────────────── */}
      <AnimatePresence>
        {dayModal && (
          <div className="modal-overlay" onClick={() => setDayModal(null)}>
            <motion.div
              className="modal-panel"
              style={{ maxWidth: 440, width: "100%" }}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
            >
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "18px 22px 16px", borderBottom: "1px solid var(--jk-divider)",
              }}>
                <button
                  onClick={() => setDayModal(null)}
                  style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "var(--jk-panel)", border: "1px solid var(--jk-divider)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--jk-muted)", transition: "all .15s",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = "rgba(239,68,68,.08)";
                    el.style.color = "#EF4444";
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = "var(--jk-panel)";
                    el.style.color = "var(--jk-muted)";
                  }}
                >
                  <X size={15} />
                </button>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 15.5, fontWeight: 800, color: "var(--jk-text)", margin: 0 }}>
                    {new Date(dayModal.date + "T12:00:00").toLocaleDateString("ar-EG", {
                      weekday: "long", day: "numeric", month: "long",
                    })}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--jk-muted)", marginTop: 3 }}>
                    {dayModal.data.length} اشتراك جديد
                  </p>
                </div>
              </div>

              <div style={{ padding: "18px 22px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
                {canRev && (
                  <div style={{
                    borderRadius: 16, padding: "16px 20px",
                    background: "linear-gradient(135deg, #5B5FEF, #7C3AED)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div>
                      <p style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.75)", marginBottom: 4 }}>
                        إيراد اليوم
                      </p>
                      <p style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>
                        ${formatNumber(dayModal.data.reduce((s, x) => s + x.netAmountUSD, 0), 2)}
                      </p>
                    </div>
                    <CalendarDays size={28} style={{ color: "rgba(255,255,255,0.4)" }} />
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
                  {dayModal.data.map((s) => (
                    <Link
                      key={s.id}
                      href={`/subscribers/${s.id}`}
                      onClick={() => setDayModal(null)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 14px", borderRadius: 13, textDecoration: "none",
                        background: "var(--jk-panel)", border: "1px solid var(--jk-divider)",
                        transition: "all .15s",
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = "rgba(91,95,239,.07)";
                        el.style.borderColor = "rgba(91,95,239,.22)";
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = "var(--jk-panel)";
                        el.style.borderColor = "var(--jk-divider)";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        {canRev && (
                          <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--jk-primary)" }}>
                            ${formatNumber(s.netAmountUSD, 0)}
                          </span>
                        )}
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${s.package === "فضية" ? "pkg-silver" : "pkg-gold"}`}>
                          {s.package}
                        </span>
                        <ExternalLink size={10} style={{ color: "var(--jk-subtle)" }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "right" }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--jk-text)", margin: 0 }}>{s.name}</p>
                          <p style={{ fontSize: 11, color: "var(--jk-subtle)", marginTop: 2 }} dir="ltr">
                            {s.dialCode}{s.phone}
                          </p>
                        </div>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                          background: "linear-gradient(135deg, #5B5FEF, #7C3AED)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 11, fontWeight: 800,
                        }}>
                          {s.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
