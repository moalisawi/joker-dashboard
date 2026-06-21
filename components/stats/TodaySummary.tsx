"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, Copy, Check,
  Crown, Swords, Users,
  Megaphone, UserCheck, CalendarDays, BarChart2,
  RefreshCcw, LogOut, PauseCircle, Snowflake,
} from "lucide-react";
import type { Subscriber } from "@/types";
import { toast } from "@/lib/toast";

// ─── Date / Timestamp helpers ────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }

function shiftDate(base: string, delta: number) {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Converts Firestore Timestamp | string | Date | null/undefined → "YYYY-MM-DD" */
type TSLike = { toDate: () => Date } | string | Date | null | undefined;
function tsToDate(v: TSLike): string {
  if (!v) return "";
  if (typeof v === "string")                  return v.slice(0, 10);
  if (v instanceof Date)                      return v.toISOString().slice(0, 10);
  if (typeof (v as { toDate?: unknown }).toDate === "function")
    return (v as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  return "";
}

function labelFor(dateStr: string) {
  const t = todayStr();
  if (dateStr === t)               return "اليوم";
  if (dateStr === shiftDate(t,-1)) return "أمس";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ar-SA", { weekday: "short", month: "short", day: "numeric" });
}

function fullDateFor(dateStr: string) {
  return new Date(dateStr + "T00:00:00")
    .toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

function reportDateFor(dateStr: string) {
  return new Date(dateStr + "T00:00:00")
    .toLocaleDateString("ar-SA", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function timeAgoAr(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 8)   return "الآن";
  if (s < 60)  return `منذ ${s} ث`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `منذ ${m} د`;
  return `منذ ${Math.floor(m / 60)} س`;
}

function rank(vals: string[]): { label: string; count: number }[] {
  const map: Record<string, number> = {};
  for (const v of vals) { const k = (v || "").trim(); if (k) map[k] = (map[k] || 0) + 1; }
  return Object.entries(map).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

/** Format phone number for display: dialCode + phone */
function fmtPhone(s: Subscriber): string {
  const code  = (s.dialCode || "").replace(/\s/g, "");
  const phone = (s.phone    || "").replace(/\s/g, "");
  return code ? `${code}${phone}` : phone;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Bone({ w, h, r = 8 }: { w: string | number; h: number; r?: number }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.75, 0.4] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      style={{ width: w, height: h, borderRadius: r, background: "var(--jk-divider)", flexShrink: 0 }}
    />
  );
}

function TodaySummarySkeleton() {
  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      {/* Gradient header skeleton */}
      <div style={{
        padding: "18px 18px 16px",
        background: "linear-gradient(135deg, #4338CA 0%, #5B5FEF 45%, #6D28D9 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <motion.div
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.18)", flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <motion.div animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: "55%", height: 13, borderRadius: 6, background: "rgba(255,255,255,0.22)" }} />
            <motion.div animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
              style={{ width: "70%", height: 10, borderRadius: 5, background: "rgba(255,255,255,0.14)", marginTop: 5 }} />
          </div>
          <motion.div animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 62, height: 24, borderRadius: 999, background: "rgba(255,255,255,0.14)" }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <motion.div animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,0.14)", flexShrink: 0 }} />
          <motion.div animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ flex: 1, height: 32, borderRadius: 9, background: "rgba(0,0,0,0.18)" }} />
          <motion.div animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,0.14)", flexShrink: 0 }} />
          <motion.div animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 68, height: 32, borderRadius: 9, background: "rgba(255,255,255,0.14)", flexShrink: 0 }} />
        </div>
      </div>
      <div style={{ padding: "14px 20px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[0, 1, 2].map(i => (
            <motion.div key={i}
              animate={{ opacity: [0.4, 0.75, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.12 }}
              style={{ background: "var(--jk-panel)", borderRadius: 14, padding: "12px 12px 10px", border: "1px solid var(--jk-divider)" }}
            >
              <div style={{ width: 24, height: 24, borderRadius: 7, background: "var(--jk-divider)", marginBottom: 8 }} />
              <div style={{ width: "55%", height: 20, borderRadius: 6, background: "var(--jk-divider)", marginBottom: 5 }} />
              <div style={{ width: "75%", height: 10, borderRadius: 4, background: "var(--jk-divider)" }} />
            </motion.div>
          ))}
        </div>
        {[0, 1].map(i => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Bone w={22} h={22} r={6} />
              <Bone w={80} h={10} r={5} />
            </div>
            <Bone w="60%" h={13} r={5} />
            <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: "var(--jk-divider)" }}>
              <motion.div
                animate={{ width: ["0%", "50%", "0%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
                style={{ height: "100%", background: "var(--jk-border)", borderRadius: 999 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Metric chip ─────────────────────────────────────────────────────────────

interface ChipProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  valueColor: string;
  delay: number;
}

function MetricChip({ icon, label, value, bg, border, iconBg, iconColor, valueColor, delay }: ChipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -3 }}
      style={{
        background: bg,
        border,
        borderRadius: 14,
        padding: "12px 10px 10px",
        cursor: "default",
        transition: "box-shadow 0.18s",
        display: "flex", flexDirection: "column", gap: 5,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 16px ${iconColor}22`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
    >
      <div style={{
        width: 24, height: 24, borderRadius: 7,
        background: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: iconColor,
        border: `1px solid ${iconColor}22`,
      }}>
        {icon}
      </div>
      <span style={{
        fontSize: 22, fontWeight: 800,
        color: valueColor,
        lineHeight: 1,
        letterSpacing: "-0.025em",
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </span>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--jk-subtle)", lineHeight: 1 }}>
        {label}
      </span>
    </motion.div>
  );
}

// ─── Rank section ────────────────────────────────────────────────────────────

interface RankSectionProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  top: { label: string; count: number } | undefined;
  rest: { label: string; count: number }[];
  total: number;
  accentColor: string;
  delay: number;
  emptyText: string;
}

function RankSection({ icon, iconBg, iconColor, title, top, rest, total, accentColor, delay, emptyText }: RankSectionProps) {
  const pct = top && total > 0 ? Math.round((top.count / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 7,
          background: iconBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: iconColor,
          border: `1px solid ${iconColor}22`,
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--jk-text)" }}>{title}</span>
        {top && (
          <span style={{
            marginRight: "auto",
            fontSize: 10, fontWeight: 700,
            padding: "2px 8px", borderRadius: 999,
            background: `${accentColor}12`, color: accentColor,
            border: `1px solid ${accentColor}28`,
          }}>
            {pct}%
          </span>
        )}
      </div>

      {!top ? (
        <p style={{ fontSize: 12, color: "var(--jk-subtle)", margin: "0 0 2px", paddingRight: 31 }}>
          {emptyText}
        </p>
      ) : (
        <div style={{ paddingRight: 0 }}>
          {/* Top entry row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{
              fontSize: 13, fontWeight: 700, color: "var(--jk-text)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: 1, paddingLeft: 4,
            }}>
              🥇 {top.label}
            </span>
            <span style={{
              fontSize: 12, fontWeight: 700, color: accentColor,
              fontVariantNumeric: "tabular-nums", flexShrink: 0, marginRight: 6,
            }}>
              {top.count}
            </span>
          </div>

          {/* Progress bar */}
          <div style={{
            height: 6, background: "var(--jk-panel)",
            borderRadius: 999, overflow: "hidden",
            border: "1px solid var(--jk-divider)", marginBottom: 7,
          }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1], delay: delay + 0.1 }}
              style={{
                height: "100%", borderRadius: 999,
                background: accentColor,
                boxShadow: `0 0 6px ${accentColor}55`,
              }}
            />
          </div>

          {/* Runner-ups */}
          {rest.slice(0, 3).length > 0 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {rest.slice(0, 3).map(({ label, count }, i) => (
                <span key={label} style={{
                  fontSize: 10.5, fontWeight: 600,
                  padding: "2px 9px", borderRadius: 999,
                  background: "var(--jk-panel)",
                  color: "var(--jk-muted)",
                  border: "1px solid var(--jk-divider)",
                  whiteSpace: "nowrap",
                }}>
                  {["🥈","🥉","4"][i]} {label} · {count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Live dot ────────────────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8, flexShrink: 0 }}>
      <motion.span
        animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--jk-success)" }}
      />
      <span style={{ position: "relative", width: 8, height: 8, borderRadius: "50%", background: "var(--jk-success)", boxShadow: "0 0 5px #22C55E80" }} />
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  subscribers: Subscriber[];
  loading?: boolean;
}

const slide = {
  enter: (d: number) => ({ opacity: 0, x: d > 0 ? 16 : -16 }),
  center: { opacity: 1, x: 0 },
  exit:   (d: number) => ({ opacity: 0, x: d > 0 ? -16 : 16 }),
};

export default function TodaySummary({ subscribers, loading = false }: Props) {
  const [date, setDate]         = useState(todayStr);
  const [dir, setDir]           = useState(1);
  const [copied, setCopied]     = useState(false);
  const [lastUpdated, setLU]    = useState(() => new Date());
  const [tick, setTick]         = useState(0);
  const prevLen                 = useRef(subscribers.length);

  useEffect(() => {
    if (subscribers.length !== prevLen.current) { setLU(new Date()); prevLen.current = subscribers.length; }
  }, [subscribers]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const nav = useCallback((delta: number) => {
    const next = shiftDate(date, delta);
    if (next > todayStr()) return;
    setDir(delta); setDate(next);
  }, [date]);

  // ── New subscribers that day ───────────────────────────────────────────────
  const daySubs = useMemo(
    () => subscribers.filter(s => (typeof s.date === "string" ? s.date : "").slice(0, 10) === date),
    [subscribers, date],
  );
  const total     = daySubs.length;
  const goldSubs  = useMemo(() => daySubs.filter(s => s.package === "ذهبية"), [daySubs]);
  const silverSubs= useMemo(() => daySubs.filter(s => s.package === "فضية"),  [daySubs]);
  const srcRank   = useMemo(() => rank(daySubs.map(s => s.source)),            [daySubs]);
  const empRank   = useMemo(() => rank(daySubs.map(s => s.convincedBy)),       [daySubs]);

  // ── Events that day (renewals / withdrawals / pauses / freezes) ────────────
  const dayEvents = useMemo(() => {
    const renewals:    Subscriber[] = [];
    const withdrawals: Subscriber[] = [];
    const pauses:      Subscriber[] = [];
    const freezes:     Subscriber[] = [];

    for (const s of subscribers) {
      // Renewals — check renewals[] array for renewedAt matching date
      if (s.renewals?.length) {
        const renewed = s.renewals.some(r => tsToDate(r.renewedAt as TSLike) === date);
        if (renewed) renewals.push(s);
      }
      // Withdrawals
      const wDate =
        tsToDate(s.withdrawalData?.withdrawnAt as TSLike) ||
        tsToDate(s.withdrawnAt as TSLike);
      if (wDate === date && s.subscriptionState === "withdrawn") withdrawals.push(s);

      // Pauses
      if (tsToDate(s.pausedAt as TSLike) === date) pauses.push(s);

      // Freezes
      if (tsToDate(s.freezeData?.frozenAt as TSLike) === date) freezes.push(s);
    }
    return { renewals, withdrawals, pauses, freezes };
  }, [subscribers, date]);

  const hasEvents = total > 0 ||
    dayEvents.renewals.length > 0 ||
    dayEvents.withdrawals.length > 0 ||
    dayEvents.pauses.length > 0 ||
    dayEvents.freezes.length > 0;

  // ── Copy ──────────────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    const sep = "━━━━━━━━━━━━━━━━━━━";
    const lines: string[] = [
      `📊 تقرير يوم ${reportDateFor(date)}`,
      sep,
    ];

    // ── New subscribers
    lines.push(`📥 الاشتراكات الجديدة: ${total}`);
    lines.push("");

    if (goldSubs.length > 0) {
      lines.push(`🥇 الباقة الذهبية (${goldSubs.length}):`);
      goldSubs.forEach(s => {
        const cv = (s.convincedBy || "").trim();
        lines.push(`  • ${fmtPhone(s)}${cv ? ` — ${cv}` : ""}`);
      });
      lines.push("");
    }

    if (silverSubs.length > 0) {
      lines.push(`⚔️  الباقة الفضية (${silverSubs.length}):`);
      silverSubs.forEach(s => {
        const cv = (s.convincedBy || "").trim();
        lines.push(`  • ${fmtPhone(s)}${cv ? ` — ${cv}` : ""}`);
      });
      lines.push("");
    }

    // ── Events
    const { renewals, withdrawals, pauses, freezes } = dayEvents;
    const hasEvt = renewals.length + withdrawals.length + pauses.length + freezes.length > 0;

    if (hasEvt) {
      lines.push(sep);

      if (renewals.length > 0) {
        lines.push(`🔄 التجديدات (${renewals.length}):`);
        renewals.forEach(s => {
          // Find the renewal that happened on that date
          const r = s.renewals?.find(rn => tsToDate(rn.renewedAt as TSLike) === date);
          lines.push(`  • ${fmtPhone(s)} — ${r?.package ?? s.package}`);
        });
        lines.push("");
      }

      if (withdrawals.length > 0) {
        lines.push(`🚪 الانسحابات (${withdrawals.length}):`);
        withdrawals.forEach(s => lines.push(`  • ${fmtPhone(s)} — ${s.name}`));
        lines.push("");
      }

      if (pauses.length > 0) {
        lines.push(`⏸️  الإيقافات (${pauses.length}):`);
        pauses.forEach(s => lines.push(`  • ${fmtPhone(s)} — ${s.name}`));
        lines.push("");
      }

      if (freezes.length > 0) {
        lines.push(`❄️  التجميدات (${freezes.length}):`);
        freezes.forEach(s => lines.push(`  • ${fmtPhone(s)} — ${s.name}`));
        lines.push("");
      }
    }

    // ── Sources + Employees
    if (srcRank.length > 0 || empRank.length > 0) {
      lines.push(sep);
      if (srcRank.length > 0) {
        lines.push("📢 المصادر:");
        srcRank.slice(0, 5).forEach(({ label, count }, i) => lines.push(`${i + 1}. ${label} — ${count}`));
        lines.push("");
      }
      if (empRank.length > 0) {
        lines.push("🏅 الموظفون:");
        empRank.slice(0, 5).forEach(({ label, count }, i) => lines.push(`${i + 1}. ${label} — ${count}`));
      }
    }

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      toast.success("✅ تم نسخ التقرير");
      setTimeout(() => setCopied(false), 2400);
    } catch {
      toast.error("تعذّر النسخ");
    }
  }, [date, total, goldSubs, silverSubs, srcRank, empRank, dayEvents]);

  if (loading) return <TodaySummarySkeleton />;

  const isNextDisabled = date >= todayStr();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="panel"
      style={{ overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}
    >

      {/* ══════════ HEADER ══════════ */}
      <div style={{
        position: "relative",
        padding: "18px 18px 16px",
        background: "linear-gradient(135deg, #4338CA 0%, #5B5FEF 45%, #6D28D9 100%)",
        overflow: "hidden",
      }}>
        {/* Decorative orb top-right */}
        <span style={{
          position: "absolute", top: -28, insetInlineEnd: -28,
          width: 100, height: 100, borderRadius: "50%",
          background: "rgba(255,255,255,0.10)",
          pointerEvents: "none",
        }} />
        {/* Decorative orb bottom-left */}
        <span style={{
          position: "absolute", bottom: -18, insetInlineStart: 14,
          width: 64, height: 64, borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          pointerEvents: "none",
        }} />
        {/* Top shine */}
        <span style={{
          position: "absolute", top: 0, insetInlineStart: 0, insetInlineEnd: 0,
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)",
          pointerEvents: "none",
        }} />

        {/* Title row */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.28)",
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}>
            <BarChart2 size={15} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 14.5, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.015em" }}>
              ملخص اليوم
            </h3>
            <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", margin: 0, fontWeight: 500 }}>
              {tick >= 0 ? timeAgoAr(lastUpdated) : ""}
            </p>
          </div>

          {/* Live badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(0,0,0,0.18)",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 999,
            padding: "3px 9px",
            flexShrink: 0,
          }}>
            <LiveDot />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#4ADE80" }}>مباشر</span>
          </div>
        </div>

        {/* Date navigation row */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>

          {/* Prev */}
          <button
            onClick={() => nav(-1)}
            title="اليوم السابق"
            style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              background: "rgba(255,255,255,0.14)",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(255,255,255,0.22)",
              color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.14s",
              outline: "none",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.24)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.14)"; }}
          >
            <ChevronRight size={14} />
          </button>

          {/* Date display */}
          <div style={{
            flex: 1,
            background: "rgba(0,0,0,0.18)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 9,
            height: 32,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            padding: "0 6px",
          }}>
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={date}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                style={{ textAlign: "center", pointerEvents: "none" }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", display: "block", lineHeight: 1 }}>
                  {labelFor(date)}
                </span>
                <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.50)", display: "block", lineHeight: 1.4 }}>
                  {fullDateFor(date)}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Next */}
          <button
            onClick={() => nav(1)}
            disabled={isNextDisabled}
            title="اليوم التالي"
            style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              background: "rgba(255,255,255,0.14)",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(255,255,255,0.22)",
              color: "#fff",
              cursor: isNextDisabled ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.14s",
              outline: "none",
              opacity: isNextDisabled ? 0.35 : 1,
            }}
            onMouseEnter={e => { if (!isNextDisabled) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.24)"; }}
            onMouseLeave={e => { if (!isNextDisabled) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.14)"; }}
          >
            <ChevronLeft size={14} />
          </button>

          {/* Copy button */}
          <motion.button
            onClick={handleCopy}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.91 }}
            title="نسخ التقرير"
            style={{
              height: 32, padding: "0 13px",
              borderRadius: 9, flexShrink: 0,
              background: copied ? "rgba(34,197,94,0.30)" : "rgba(255,255,255,0.14)",
              backdropFilter: "blur(4px)",
              border: copied ? "1px solid rgba(74,222,128,0.50)" : "1px solid rgba(255,255,255,0.22)",
              color: copied ? "#4ADE80" : "#fff",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 700,
              transition: "background 0.2s, border 0.2s, color 0.2s",
              outline: "none",
              whiteSpace: "nowrap",
            }}
          >
            <AnimatePresence mode="wait">
              {copied
                ? <motion.span key="c" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}><Check size={12} /></motion.span>
                : <motion.span key="u" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}><Copy size={12} /></motion.span>
              }
            </AnimatePresence>
            {copied ? "تم!" : "نسخ"}
          </motion.button>
        </div>
      </div>

      {/* ══════════ BODY ══════════ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 18px" }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={date}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >

            {/* ── Metric chips ──────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9, marginBottom: 18 }}>

              {/* Total */}
              <MetricChip
                icon={<Users size={12} />}
                label="الإجمالي"
                value={total}
                bg="var(--jk-accent-bg)"
                border="1px solid var(--jk-accent-border)"
                iconBg="rgba(91,95,239,0.12)"
                iconColor="var(--jk-primary)"
                valueColor="var(--jk-primary)"
                delay={0.04}
              />

              {/* Gold */}
              <MetricChip
                icon={<Crown size={12} />}
                label="ذهبية"
                value={goldSubs.length}
                bg="linear-gradient(145deg, #FEF3C7 0%, #FFFBEA 100%)"
                border="1px solid rgba(180,130,20,0.22)"
                iconBg="rgba(180,130,20,0.12)"
                iconColor="#B07D10"
                valueColor="#92640A"
                delay={0.08}
              />

              {/* Silver */}
              <MetricChip
                icon={<Swords size={12} />}
                label="فضية"
                value={silverSubs.length}
                bg="linear-gradient(145deg, #F1F5F9 0%, #F8FAFC 100%)"
                border="1px solid rgba(100,116,139,0.20)"
                iconBg="rgba(100,116,139,0.10)"
                iconColor="#5A6680"
                valueColor="#475569"
                delay={0.12}
              />
            </div>

            {/* ── Empty state ───────────────────────────── */}
            {!hasEvents && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  textAlign: "center", padding: "24px 0",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 10,
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: "var(--jk-panel)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--jk-subtle)",
                  border: "1px solid var(--jk-divider)",
                }}>
                  <CalendarDays size={20} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--jk-muted)", margin: 0 }}>
                  لا توجد أحداث هذا اليوم
                </p>
              </motion.div>
            )}

            {hasEvents && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* ── Day Events badges ─────────────────── */}
                {(dayEvents.renewals.length > 0 || dayEvents.withdrawals.length > 0 ||
                  dayEvents.pauses.length > 0  || dayEvents.freezes.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.13, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--jk-muted)" }}>أحداث أخرى</span>
                      <div style={{ flex: 1, height: 1, background: "var(--jk-divider)" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                      {([
                        {
                          key: "renewals", icon: <RefreshCcw size={11} />,
                          label: "تجديد", count: dayEvents.renewals.length,
                          bg: "rgba(59,130,246,0.07)", border: "rgba(59,130,246,0.18)",
                          iconBg: "rgba(59,130,246,0.12)", iconColor: "#3B82F6", valColor: "#1D4ED8",
                        },
                        {
                          key: "withdrawals", icon: <LogOut size={11} />,
                          label: "انسحاب", count: dayEvents.withdrawals.length,
                          bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.18)",
                          iconBg: "rgba(239,68,68,0.10)", iconColor: "#EF4444", valColor: "#DC2626",
                        },
                        {
                          key: "pauses", icon: <PauseCircle size={11} />,
                          label: "إيقاف", count: dayEvents.pauses.length,
                          bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.18)",
                          iconBg: "rgba(245,158,11,0.12)", iconColor: "#F59E0B", valColor: "#B45309",
                        },
                        {
                          key: "freezes", icon: <Snowflake size={11} />,
                          label: "تجميد", count: dayEvents.freezes.length,
                          bg: "rgba(99,102,241,0.07)", border: "rgba(99,102,241,0.18)",
                          iconBg: "rgba(99,102,241,0.12)", iconColor: "#6366F1", valColor: "#4338CA",
                        },
                      ] as const).filter(e => e.count > 0).map((e, i) => (
                        <motion.div
                          key={e.key}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.15 + i * 0.05, duration: 0.28 }}
                          style={{
                            background: e.bg,
                            border: `1px solid ${e.border}`,
                            borderRadius: 12,
                            padding: "9px 10px 8px",
                            display: "flex", alignItems: "center", gap: 8,
                          }}
                        >
                          <div style={{
                            width: 22, height: 22, borderRadius: 7,
                            background: e.iconBg,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: e.iconColor, flexShrink: 0,
                          }}>
                            {e.icon}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: e.valColor, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                              {e.count}
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--jk-subtle)", lineHeight: 1.3 }}>
                              {e.label}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Divider */}
                {total > 0 && <div style={{ height: 1, background: "var(--jk-divider)" }} />}

                {/* ── Sources ───────────────────────────── */}
                {total > 0 && (
                  <>
                    <RankSection
                      icon={<Megaphone size={11} />}
                      iconBg="var(--jk-accent-bg)"
                      iconColor="var(--jk-primary)"
                      title="أفضل مصدر"
                      top={srcRank[0]}
                      rest={srcRank.slice(1)}
                      total={total}
                      accentColor="var(--jk-primary)"
                      delay={0.18}
                      emptyText="لا توجد بيانات مصدر"
                    />

                    <div style={{ height: 1, background: "var(--jk-divider)" }} />

                    <RankSection
                      icon={<UserCheck size={11} />}
                      iconBg="rgba(180,130,20,0.10)"
                      iconColor="#B07D10"
                      title="أفضل موظف"
                      top={empRank[0]}
                      rest={empRank.slice(1)}
                      total={total}
                      accentColor="#D97706"
                      delay={0.24}
                      emptyText="لا توجد بيانات موظفين"
                    />
                  </>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* ══════════ FOOTER ══════════ */}
      <div style={{
        padding: "9px 20px",
        borderTop: "1px solid var(--jk-divider)",
        display: "flex", alignItems: "center", gap: 6,
        background: "var(--jk-panel)",
      }}>
        <LiveDot />
        <span style={{ fontSize: 10.5, color: "var(--jk-subtle)", fontWeight: 500 }}>
          يتحدث مع كل اشتراك جديد
        </span>
        {total > 0 && (
          <span style={{
            marginRight: "auto",
            fontSize: 10.5, fontWeight: 700,
            padding: "2px 9px", borderRadius: 999,
            background: "var(--jk-accent-bg)", color: "var(--jk-primary)",
            border: "1px solid var(--jk-accent-border)",
          }}>
            {total} اليوم
          </span>
        )}
      </div>
    </motion.div>
  );
}
