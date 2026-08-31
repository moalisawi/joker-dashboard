"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { isActiveNow, isInCustomerBase } from "@/lib/subscriberLifecycle";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer} from "recharts";
import { motion, AnimatePresence} from "framer-motion";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useSubscribers } from "@/hooks/useSubscribers";
import { usePayments } from "@/hooks/usePayments";
import { useAuthStore } from "@/store/authStore";
import { formatNumber, ARABIC_MONTHS, RESIDENCE_COUNTRIES, PHONE_COUNTRIES } from "@/lib/utils";
import { useTeams } from "@/hooks/useTeams";
import Link from "next/link";
import {
  Users, DollarSign, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, Activity, Zap, Medal, Lightbulb,
  AlertTriangle, CheckCircle2, Info, XCircle, Download,
  UserMinus, Target, BarChart2, Sparkles, Crown, Star,
  CreditCard, Globe} from "lucide-react";
import { useEmployeePerformance } from "@/hooks/useEmployeePerformance";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useRefunds } from "@/hooks/useRefunds";
import { canExportReports } from "@/lib/permissionGuards";
import {
  exportSubscribersCSV, exportPaymentsCSV, exportEmployeePerformanceCSV,
  exportSubscribersByMonthCSV,
} from "@/lib/analytics/reports";
import type { Insight } from "@/lib/analytics/insights";
import { retentionRate, calculateChurnRate, monthlyAcquisitionTrend } from "@/lib/analytics/calculations";

/* ─────────────────────────────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────────────────────────────── */
const C = {
  primary: "#5B5FEF",
  success: "#22C55E",
  warning: "#F59E0B",
  danger:  "#EF4444",
  purple:  "#8B5CF6",
  cyan:    "#06B6D4",
  dark1:   "#080E1C",
  dark2:   "#111C35",
  dark3:   "#0F1E40",
  tick:    "#94A3B8",
  grid:    "#F1F5F9",
} as const;

const PALETTE = [C.primary, C.success, C.warning, C.purple, C.cyan, C.danger, "#F97316", "#818CF8"];

/* ─────────────────────────────────────────────────────────────────────
   ANIMATION PRESETS
   ───────────────────────────────────────────────────────────────────── */
const fadeUp   = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.40, ease: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number] } } };

const stagger  = { show: { transition: { staggerChildren: 0.06 } } };
const stagger2 = { show: { transition: { staggerChildren: 0.10 } } };

const fast     = { duration: 0.16, ease: "easeOut" } as const;

/* ─────────────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────────────── */
function toDateStr(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof (raw as { toDate?: () => Date }).toDate === "function")
    return (raw as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return "";
}
function resLabel(v: string) {
  return RESIDENCE_COUNTRIES.find(c => c.value === v)?.name ||
    PHONE_COUNTRIES.find(c => c.iso === v)?.name || v || "غير محدد";
}
function topN<T extends { value: number }>(arr: T[], n: number) {
  return [...arr].sort((a, b) => b.value - a.value).slice(0, n);
}

/* ─────────────────────────────────────────────────────────────────────
   ANIMATED COUNTER HOOK
   ───────────────────────────────────────────────────────────────────── */
function useCounter(target: number, ms = 1000): number {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    setV(0);
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / ms, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(e * target));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return v;
}

type Range  = "7d" | "30d" | "90d" | "12m";
type TabKey = "overview" | "employees" | "insights";

/* ─────────────────────────────────────────────────────────────────────
   TOOLTIPS
   ───────────────────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTip({ active, payload, label, prefix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(8,14,28,0.97)", backdropFilter: "blur(16px)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 14, padding: "10px 14px", minWidth: 140,
      boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
    }}>
      {label && <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.38)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: i > 0 ? 5 : 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color || p.fill, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>{p.name}</span>
          <span style={{ marginRight: "auto", fontSize: 13, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{prefix}{formatNumber(p.value, prefix ? 2 : 0)}</span>
        </div>
      ))}
    </div>
  );
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{
      background: "rgba(8,14,28,0.97)", backdropFilter: "blur(16px)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 14, padding: "10px 14px",
      boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
    }}>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", fontWeight: 600, marginBottom: 4 }}>{p.name}</p>
      <p style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
        {formatNumber(p.value)}
        {p.payload?.percent && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", fontWeight: 500, marginRight: 6 }}>
            · {(p.payload.percent * 100).toFixed(1)}%
          </span>
        )}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   DELTA BADGE
   ───────────────────────────────────────────────────────────────────── */
function Delta({ v, size = "sm" }: { v: number | null | undefined; size?: "sm" | "md" }) {
  if (v == null) return null;
  const up = v >= 0;
  const pad  = size === "md" ? "5px 11px" : "3px 8px";
  const fs   = size === "md" ? 12 : 10.5;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: pad, borderRadius: 999, fontSize: fs, fontWeight: 700,
      background: up ? "rgba(34,197,94,0.13)" : "rgba(239,68,68,0.11)",
      color: up ? C.success : C.danger,
      border: `1px solid ${up ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.20)"}`,
      flexShrink: 0,
    }}>
      {up ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
      {up ? "+" : ""}{v.toFixed(1)}%
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   SKELETON
   ───────────────────────────────────────────────────────────────────── */
function Bone({ h = 80, r = 18 }: { h?: number; r?: number }) {
  return <div className="animate-pulse" style={{ height: h, borderRadius: r, background: "var(--jk-panel)" }} />;
}

/* ─────────────────────────────────────────────────────────────────────
   HERO KPI CARD  (dark gradient — the dominant revenue card)
   ───────────────────────────────────────────────────────────────────── */
function HeroKPI({ icon, eyebrow, label, value, sub, delta, spark, rawVal }: {
  icon: React.ReactNode; eyebrow: string; label: string;
  value: string; sub?: string; delta?: number | null; spark: number[]; rawVal?: number;
}) {
  const counted = useCounter(rawVal ?? 0, 1200);
  const display = rawVal !== undefined ? value.replace(/[\d,]+/, formatNumber(counted, 0)) : value;
  const sparkD  = spark.map(v => ({ v }));

  return (
    <motion.div variants={fadeUp}
      whileHover={{ y: -4, transition: fast }}
      style={{
        position: "relative", overflow: "hidden", borderRadius: 26,
        padding: "28px 26px 22px",
        background: `linear-gradient(148deg, ${C.dark1} 0%, ${C.dark2} 55%, ${C.dark3} 100%)`,
        border: "1px solid rgba(255,255,255,0.065)",
        boxShadow: "0 16px 56px rgba(8,14,28,0.70), inset 0 1px 0 rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column", gap: 18,
      }}>

      {/* Glow orbs */}
      <div style={{ position:"absolute", top:-70, right:-70, width:220, height:220, borderRadius:"50%", background:"radial-gradient(circle, rgba(91,95,239,0.32) 0%, transparent 65%)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:-50, left:-40, width:180, height:180, borderRadius:"50%", background:"radial-gradient(circle, rgba(129,140,248,0.15) 0%, transparent 65%)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", top:"50%", left:"38%", width:130, height:130, borderRadius:"50%", background:"radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)", pointerEvents:"none" }} />

      {/* Top row */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", position:"relative" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{
            width:48, height:48, borderRadius:16, flexShrink:0,
            display:"flex", alignItems:"center", justifyContent:"center",
            background:"rgba(91,95,239,0.22)", border:"1px solid rgba(91,95,239,0.38)",
            color:"#A5B4FC", boxShadow:"0 4px 16px rgba(91,95,239,0.28)",
          }}>{icon}</div>
          <div>
            <p style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.13em", textTransform:"uppercase", color:"rgba(255,255,255,0.35)", marginBottom:2 }}>{eyebrow}</p>
            <p style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.58)" }}>{label}</p>
          </div>
        </div>
        {delta != null && <Delta v={delta} size="sm" />}
      </div>

      {/* Value */}
      <div style={{ position:"relative" }}>
        <p style={{
          fontSize:48, fontWeight:900, color:"#FFFFFF", lineHeight:1,
          letterSpacing:"-0.045em", fontVariantNumeric:"tabular-nums",
          textShadow:"0 2px 20px rgba(165,180,252,0.22)",
        }}>{display}</p>
        {sub && <p style={{ fontSize:12, color:"rgba(255,255,255,0.30)", marginTop:7, fontWeight:500, letterSpacing:"0.01em" }}>{sub}</p>}
      </div>

      {/* Sparkline */}
      <div style={{ height:52, position:"relative" }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkD} margin={{ top:4, bottom:0, left:0, right:0 }}>
            <defs>
              <linearGradient id="heroSpk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818CF8" stopOpacity={0.50} />
                <stop offset="100%" stopColor="#818CF8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke="#818CF8" strokeWidth={2.5} fill="url(#heroSpk)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   SECONDARY KPI CARD  (light surface)
   ───────────────────────────────────────────────────────────────────── */
function KPI({ icon, label, value, sub, delta, accent, accentBg, spark, rawVal, compact }: {
  icon: React.ReactNode; label: string; value: string;
  sub?: string; delta?: number | null; accent: string; accentBg?: string;
  spark: number[]; rawVal?: number; compact?: boolean;
}) {
  const sparkD  = spark.map(v => ({ v }));
  const bg      = accentBg ?? `${accent}12`;
  const gid     = `kspk${label.replace(/\s+/g,"")}`;
  const counted = useCounter(rawVal ?? 0, 950);
  const display = rawVal !== undefined ? value.replace(/[\d,]+/, formatNumber(counted, 0)) : value;

  return (
    <motion.div variants={fadeUp}
      whileHover={{ y:-3, boxShadow:"0 14px 36px rgba(15,23,42,0.10)", transition:fast }}
      className="jk-stat" style={{ gap: compact ? 10 : 14, padding: compact ? "18px 20px" : "22px" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <div style={{ width:42, height:42, borderRadius:14, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:bg, color:accent }}>
          {icon}
        </div>
        <Delta v={delta} />
      </div>
      <div>
        <p style={{ fontSize:11.5, fontWeight:500, color:"var(--jk-muted)", marginBottom:6, letterSpacing:"0.01em" }}>{label}</p>
        <p style={{ fontSize:compact ? 26 : 30, fontWeight:800, color:"var(--jk-text)", letterSpacing:"-0.03em", lineHeight:1, fontVariantNumeric:"tabular-nums" }}>{display}</p>
        {sub && <p style={{ fontSize:11, color:"var(--jk-subtle)", marginTop:5 }}>{sub}</p>}
      </div>
      <div style={{ height: compact ? 28 : 34 }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkD} margin={{ top:0, bottom:0, left:0, right:0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.20} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={2} fill={`url(#${gid})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   MINI STAT CARD
   ───────────────────────────────────────────────────────────────────── */
function Mini({ label, value, sub, color, icon, rawVal }: { label:string; value:string; sub:string; color:string; icon?:React.ReactNode; rawVal?:number }) {
  const counted = useCounter(rawVal ?? 0, 900);
  const display = rawVal !== undefined ? value.replace(/[\d,]+/, formatNumber(counted, 0)) : value;
  return (
    <motion.div variants={fadeUp} whileHover={{ y:-1, transition:fast }}
      style={{ background:"var(--jk-surface)", borderRadius:18, padding:"18px 20px", border:"1px solid var(--jk-divider)", boxShadow:"var(--jk-shadow-card)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 }}>
        <p style={{ fontSize:11.5, color:"var(--jk-muted)", fontWeight:500 }}>{label}</p>
        {icon && <span style={{ color, opacity:0.65 }}>{icon}</span>}
      </div>
      <p style={{ fontSize:24, fontWeight:800, color, letterSpacing:"-0.026em", fontVariantNumeric:"tabular-nums", lineHeight:1 }}>{display}</p>
      <p style={{ fontSize:11, color:"var(--jk-subtle)", marginTop:5 }}>{sub}</p>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   CHART SHELL
   ───────────────────────────────────────────────────────────────────── */
function Shell({ title, sub, right, height = 300, children, noPad, bar }: {
  title:string; sub?:string; right?:React.ReactNode;
  height?: number | "auto"; children:React.ReactNode; noPad?:boolean; bar?:string;
}) {
  return (
    <motion.div variants={fadeUp}
      style={{ overflow:"hidden", borderRadius:22, background:"var(--jk-surface)", border:"1px solid var(--jk-divider)", boxShadow:"var(--jk-shadow-card)", position:"relative" }}>
      {bar && <div style={{ position:"absolute", top:0, insetInline:0, height:3, background:`linear-gradient(90deg, ${bar}, ${bar}70)`, borderRadius:"22px 22px 0 0" }} />}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding: bar ? "20px 22px 14px" : "16px 22px 14px", borderBottom:"1px solid var(--jk-divider)" }}>
        <div>
          <p style={{ fontSize:14.5, fontWeight:800, color:"var(--jk-text)", letterSpacing:"-0.018em" }}>{title}</p>
          {sub && <p style={{ fontSize:11.5, color:"var(--jk-subtle)", marginTop:3 }}>{sub}</p>}
        </div>
        {right}
      </div>
      <div style={{ padding:noPad?0:22, height:height==="auto"?undefined:height }} dir="ltr">
        {children}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   INSIGHT STRIP CARD  (horizontal, always-visible AI insights)
   ───────────────────────────────────────────────────────────────────── */
function InsightChip({ icon, text, value, color, bg, border }: { icon:React.ReactNode; text:string; value?:string; color:string; bg:string; border:string }) {
  return (
    <motion.div variants={fadeUp}
      whileHover={{ y:-2, transition:fast }}
      style={{ display:"flex", alignItems:"flex-start", gap:10, borderRadius:16, padding:"13px 15px", background:bg, border:`1px solid ${border}`, flex:1, minWidth:220, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", insetInlineStart:0, top:0, bottom:0, width:3, background:color, borderRadius:"0 99px 99px 0" }} />
      <div style={{ color, marginInlineStart:4, marginTop:1, flexShrink:0 }}>{icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:12.5, fontWeight:600, color:"var(--jk-text)", lineHeight:1.5 }}>{text}</p>
      </div>
      {value && <span style={{ fontSize:13, fontWeight:800, color, flexShrink:0, fontVariantNumeric:"tabular-nums" }}>{value}</span>}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   FULL INSIGHT CARD  (insights tab)
   ───────────────────────────────────────────────────────────────────── */
function InsightCard({ insight }: { insight: Insight }) {
  const map = {
    info:     { icon:<Info size={14}/>,          bg:"rgba(91,95,239,0.05)",  border:"rgba(91,95,239,0.12)",  color:C.primary },
    warning:  { icon:<AlertTriangle size={14}/>, bg:"rgba(245,158,11,0.05)", border:"rgba(245,158,11,0.15)", color:C.warning },
    critical: { icon:<XCircle size={14}/>,       bg:"rgba(239,68,68,0.05)",  border:"rgba(239,68,68,0.13)",  color:C.danger  },
    success:  { icon:<CheckCircle2 size={14}/>,  bg:"rgba(34,197,94,0.05)",  border:"rgba(34,197,94,0.13)",  color:C.success },
  };
  const c = map[insight.level] ?? map.info;
  return (
    <motion.div variants={fadeUp} whileHover={{ x:-3, transition:fast }}
      style={{ display:"flex", alignItems:"flex-start", gap:13, borderRadius:16, padding:"14px 16px", background:c.bg, border:`1px solid ${c.border}`, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", insetInlineStart:0, top:0, bottom:0, width:3, background:c.color, borderRadius:"0 99px 99px 0" }} />
      <div style={{ color:c.color, marginInlineStart:4, flexShrink:0 }}>{c.icon}</div>
      <div style={{ flex:1 }}>
        <p style={{ fontSize:13.5, fontWeight:700, color:"var(--jk-text)", letterSpacing:"-0.01em" }}>{insight.title}</p>
        <p style={{ fontSize:12, marginTop:3, lineHeight:1.65, color:"var(--jk-muted)" }}>{insight.description}</p>
      </div>
      {insight.value && <span style={{ fontSize:13, fontWeight:800, color:c.color, flexShrink:0, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>{insight.value}</span>}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   LEGEND DOT
   ───────────────────────────────────────────────────────────────────── */
function Leg({ color, label }: { color:string; label:string }) {
  return (
    <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:11.5, color:"var(--jk-muted)", fontWeight:500 }}>
      <span style={{ width:8, height:8, borderRadius:3, background:color, flexShrink:0 }} />{label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   RANK BADGE
   ───────────────────────────────────────────────────────────────────── */
function Rank({ n }: { n: number }) {
  const gold   = { bg:"rgba(251,191,36,0.16)", color:"#D97706" };
  const silver = { bg:"rgba(156,163,175,0.16)", color:"#6B7280" };
  const bronze = { bg:"rgba(180,107,60,0.14)", color:"#92400E" };
  const other  = { bg:"var(--jk-panel)", color:"var(--jk-muted)" };
  const s      = n === 1 ? gold : n === 2 ? silver : n === 3 ? bronze : other;
  return (
    <div style={{ width:30, height:30, borderRadius:9, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:s.bg, color:s.color, fontWeight:800, fontSize:12 }}>
      {n === 1 ? <Crown size={13}/> : n}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   PAGE
   ═════════════════════════════════════════════════════════════════════ */
export default function AnalyticsPage() {
  const { can, user } = useAuthStore();
  const canRev    = can("canViewRevenue");
  const canExport = canExportReports(user);

  const [tab, setTab]     = useState<TabKey>("overview");
  const [range, setRange] = useState<Range>("30d");
  const [selMonth, setSelMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const { subscribers, loading } = useSubscribers();
  const { payments }             = usePayments();
  const { refunds }              = useRefunds();
  const { data: rawTeams = [] }  = useTeams(false);
  const allTeams                 = rawTeams.filter(t => t.active !== false);
  const { performance: empPerf, loading: empLoading } = useEmployeePerformance();
  const { insights, loading: insightsLoading }        = useDashboardMetrics();

  const TICK = { fontFamily:"inherit", fontSize:10.5, fill:C.tick, fontWeight:500 };

  /* ── Monthly series (12 months) ───────────────────────────────── */
  const monthly = useMemo(() => {
    const revM: Record<string,number> = {};
    const cntM: Record<string,number> = {};
    payments.forEach(p => {
      const k = toDateStr(p.date).slice(0,7);
      if (k) { revM[k] = (revM[k]||0) + (p.amountUSD||0); cntM[k] = (cntM[k]||0) + 1; }
    });
    refunds.forEach(r => {
      const k = toDateStr(r.refundDate).slice(0,7);
      if (k) revM[k] = (revM[k]||0) - (r.refundAmountUSD||0);
    });
    const now = new Date();
    return Array.from({ length:12 }, (_, i) => {
      const d   = new Date(now.getFullYear(), now.getMonth()-(11-i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      return {
        label:   ARABIC_MONTHS[d.getMonth()].slice(0,3),
        revenue: Math.max(0, +(revM[key]||0).toFixed(2)),
        count:   cntM[key]||0,
      };
    });
  }, [payments, refunds]);

  /* ── Core KPIs ────────────────────────────────────────────────── */
  const kpi = useMemo(() => {
    const total     = subscribers.length;
    const net       = subscribers.reduce((s,x) => s+(x.netAmountUSD||0), 0);
    const paid      = subscribers.reduce((s,x) => s+(x.paidAmountUSD||0), 0);
    const rem       = subscribers.filter(s=>s.subscriptionState!=="withdrawn").reduce((s,x) => s+(x.remainingAmountUSD||0), 0);
    // Two questions, two names. This single "active" used to mean "not
    // withdrawn and not paused", which counted every expired subscriber and
    // reported 44 while the dashboard reported 8 from the same 51 people.
    const active       = subscribers.filter(isActiveNow).length;
    const customerBase = subscribers.filter(isInCustomerBase).length;
    const withdrawn = subscribers.filter(s=>s.subscriptionState==="withdrawn").length;
    const arpu      = total>0 ? net/total : 0;
    const retention = retentionRate(subscribers)*100;
    const churn     = calculateChurnRate(subscribers)*100;
    const conv      = total>0 ? (active/total)*100 : 0;
    return { total, net, paid, rem, active, customerBase, withdrawn, arpu, retention, churn, conv };
  }, [subscribers]);

  /* ── Month-over-month ─────────────────────────────────────────── */
  const mom = useMemo(() => {
    const now   = new Date();
    const curYM = now.toISOString().slice(0,7);
    const prvYM = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7);
    const revFor = (ym:string) => {
      const g = payments.filter(p=>toDateStr(p.date).slice(0,7)===ym).reduce((s,p)=>s+(p.amountUSD||0),0);
      const r = refunds.filter(r=>toDateStr(r.refundDate).slice(0,7)===ym).reduce((s,r)=>s+(r.refundAmountUSD||0),0);
      return Math.max(0, g-r);
    };
    const curRev  = revFor(curYM), prvRev  = revFor(prvYM);
    const curCnt  = subscribers.filter(s=>toDateStr(s.date).slice(0,7)===curYM).length;
    const prvCnt  = subscribers.filter(s=>toDateStr(s.date).slice(0,7)===prvYM).length;
    const revD    = prvRev>0 ? ((curRev-prvRev)/prvRev)*100 : null;
    const cntD    = prvCnt>0 ? ((curCnt-prvCnt)/prvCnt)*100 : null;
    const growPct = prvCnt>0 ? +((curCnt-prvCnt)/prvCnt*100).toFixed(1) : null;
    return { revD, cntD, curRev, curCnt, growPct };
  }, [payments, refunds, subscribers]);

  /* ── Acquisition trend ────────────────────────────────────────── */
  const acqData = useMemo(() =>
    monthlyAcquisitionTrend(subscribers, 7).map(m => ({
      label: ARABIC_MONTHS[parseInt(m.month.slice(5,7))-1].slice(0,3),
      مشتركون: m.subscribers,
      إيراد: m.revenue,
    })),
    [subscribers]
  );

  /* ── Distribution data ────────────────────────────────────────── */
  const countryData = useMemo(() => {
    const m: Record<string,number> = {};
    subscribers.forEach(s => { const k=resLabel(s.residence); m[k]=(m[k]||0)+1; });
    return topN(Object.entries(m).map(([name,value])=>({name,value})), 8);
  }, [subscribers]);

  const methodData = useMemo(() => {
    const m: Record<string,number> = {};
    payments.forEach(p => { const k=p.paymentMethod||"غير محدد"; m[k]=(m[k]||0)+1; });
    return Object.entries(m).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,8);
  }, [payments]);

  const sourceData = useMemo(() => {
    const m: Record<string,number> = {};
    subscribers.forEach(s => { const k=s.source||"غير محدد"; m[k]=(m[k]||0)+1; });
    return topN(Object.entries(m).map(([name,value])=>({name,value})), 6);
  }, [subscribers]);

  const packageData = useMemo(() => [
    { name:"فضية",  value:subscribers.filter(s=>s.package==="فضية").length,  color:"#9ca3af" },
    { name:"ذهبية", value:subscribers.filter(s=>s.package==="ذهبية").length, color:C.warning },
  ], [subscribers]);

  const teamData = useMemo(() => {
    const m: Record<string,{مشتركون:number;نشطون:number;إيراد:number;id:string}> = {};
    subscribers.forEach(s => {
      const k = s.team?.trim();
      if (!k) return;
      if (!m[k]) { const ft=allTeams.find(t=>t.name===k); m[k]={مشتركون:0,نشطون:0,إيراد:0,id:ft?.id??""}; }
      m[k].مشتركون++;
      if (isActiveNow(s)) m[k].نشطون++;
      m[k].إيراد = +(m[k].إيراد+(s.netAmountUSD||0)).toFixed(0);
    });
    return Object.entries(m).map(([name,v])=>({name,...v})).sort((a,b)=>b.مشتركون-a.مشتركون);
  }, [subscribers, allTeams]);

  const recentPay = useMemo(() =>
    [...payments].sort((a,b)=>(toDateStr(b.date)>toDateStr(a.date)?1:-1)).slice(0,8),
    [payments]
  );

  const sparkRev = monthly.map(m=>m.revenue);
  const sparkCnt = monthly.map(m=>m.count);

  /* ── AI insight strip (always visible in overview) ───────────── */
  const aiChips = useMemo(() => {
    const chips: { icon:React.ReactNode; text:string; value?:string; color:string; bg:string; border:string }[] = [];
    if (mom.revD != null) {
      const up = mom.revD >= 0;
      chips.push({
        icon: up ? <TrendingUp size={14}/> : <TrendingDown size={14}/>,
        text: up ? `الإيراد ارتفع ${mom.revD.toFixed(1)}% مقارنة بالشهر الماضي` : `الإيراد انخفض ${Math.abs(mom.revD).toFixed(1)}% مقارنة بالشهر الماضي`,
        value: canRev ? `$${formatNumber(mom.curRev,0)}` : undefined,
        color: up ? C.success : C.danger,
        bg:    up ? "rgba(34,197,94,0.06)"  : "rgba(239,68,68,0.06)",
        border:up ? "rgba(34,197,94,0.14)"  : "rgba(239,68,68,0.13)",
      });
    }
    if (kpi.retention >= 70) {
      chips.push({ icon:<CheckCircle2 size={14}/>, text:"معدل الاحتفاظ ممتاز — المشتركون راضون", value:`${kpi.retention.toFixed(0)}%`, color:C.success, bg:"rgba(34,197,94,0.06)", border:"rgba(34,197,94,0.14)" });
    } else if (kpi.retention < 50) {
      chips.push({ icon:<AlertTriangle size={14}/>, text:"معدل الاحتفاظ منخفض — يحتاج تدخل عاجل", value:`${kpi.retention.toFixed(0)}%`, color:C.danger, bg:"rgba(239,68,68,0.06)", border:"rgba(239,68,68,0.13)" });
    }
    if (sourceData.length > 0) {
      chips.push({ icon:<Globe size={14}/>, text:`أعلى مصدر اشتراك: ${sourceData[0].name}`, value:`${sourceData[0].value} مشترك`, color:C.primary, bg:"rgba(91,95,239,0.06)", border:"rgba(91,95,239,0.13)" });
    }
    if (kpi.churn > 5) {
      chips.push({ icon:<AlertTriangle size={14}/>, text:"معدل الانسحاب مرتفع — راجع المشتركين المعرضين للخطر", value:`${kpi.churn.toFixed(1)}%`, color:C.warning, bg:"rgba(245,158,11,0.06)", border:"rgba(245,158,11,0.14)" });
    } else {
      chips.push({ icon:<Zap size={14}/>, text:"معدل الانسحاب تحت السيطرة — استمر في المتابعة", value:`${kpi.churn.toFixed(1)}%`, color:C.cyan, bg:"rgba(6,182,212,0.06)", border:"rgba(6,182,212,0.14)" });
    }
    return chips.slice(0,4);
  }, [kpi, mom, sourceData, canRev]);

  /* ── Health score ─────────────────────────────────────────────── */
  const health = useMemo(() => {
    let s = 50;
    if (kpi.retention>=70) s+=20; else if (kpi.retention>=50) s+=10;
    if (kpi.churn<=2) s+=20; else if (kpi.churn<=5) s+=10; else s-=10;
    if (kpi.active/(kpi.total||1)>0.7) s+=10;
    return { score: Math.max(0,Math.min(100,s)), color: s>=75?C.success:s>=50?C.warning:C.danger, label: s>=75?"ممتاز":s>=50?"متوسط":"يحتاج تحسين" };
  }, [kpi]);

  const RANGE_LABELS: Record<Range,string> = { "7d":"7 أيام","30d":"30 يوم","90d":"90 يوم","12m":"12 شهر" };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <ProtectedLayout>
      <div className="min-h-full" style={{ background:"var(--jk-bg)" }}>
        <div className="mx-auto max-w-screen-2xl p-5 md:p-7 lg:p-8" style={{ display:"flex", flexDirection:"column", gap:20 }}>

          {/* ── Header ── */}
          <PageHeader
            title="التحليلات"
            subtitle={
              <span style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span className="status-dot-live" style={{ width:7, height:7 }} />
                <span style={{ fontSize:13, color:"var(--jk-muted)" }}>
                  مباشر · {formatNumber(kpi.customerBase)} في قاعدة العملاء · {formatNumber(kpi.active)} نشط الآن
                </span>
              </span>
            }
            actions={canExport ? (
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", justifyContent:"flex-end" }}>
                <div style={{ display:"flex", alignItems:"center", overflow:"hidden", borderRadius:14, border:"1px solid var(--jk-border)", background:"var(--jk-surface)" }}>
                  <input type="month" value={selMonth} max={new Date().toISOString().slice(0,7)}
                    onChange={e=>setSelMonth(e.target.value)}
                    className="px-3 py-2 text-xs bg-transparent outline-none" style={{ color:"var(--jk-text)" }} />
                  <button onClick={()=>exportSubscribersByMonthCSV(subscribers,selMonth)} disabled={!selMonth} className="jk-btn sm" style={{ borderRadius:0 }}>
                    <Download size={12}/> تصدير الشهر
                  </button>
                </div>
                <button onClick={()=>exportSubscribersCSV(subscribers)} className="jk-btn sm"><Download size={12}/> تصدير الكل</button>
                <button onClick={()=>exportPaymentsCSV(payments,refunds)} className="jk-btn sm secondary"><Download size={12}/> الدفعات</button>
              </div>
            ) : undefined}
          />

          {/* ── Controls ── */}
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <div className="jk-date-strip">
              {(["7d","30d","90d","12m"] as Range[]).map(r=>(
                <button key={r} className={range===r?"active":""} onClick={()=>setRange(r)}>{RANGE_LABELS[r]}</button>
              ))}
            </div>
            <div className="jk-tabs">
              {([
                { key:"overview",  label:"نظرة عامة",       icon:<Activity size={13}/> },
                { key:"employees", label:"الموظفون",         icon:<Medal size={13}/> },
                { key:"insights",  label:"التنبيهات الذكية", icon:<Lightbulb size={13}/> },
              ] as {key:TabKey;label:string;icon:React.ReactNode}[]).map(tb=>(
                <button key={tb.key} className={`jk-tab ${tab===tb.key?"active":""}`} onClick={()=>setTab(tb.key)}>
                  {tb.icon}{tb.label}
                  {tb.key==="insights" && insights.filter(i=>i.level==="critical").length>0 && (
                    <span className="badge">{insights.filter(i=>i.level==="critical").length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Loading ── */}
          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <Bone h={220} r={26}/>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
                {Array(4).fill(0).map((_,i)=><Bone key={i} h={78} r={18}/>)}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:14 }}>
                <Bone h={300} r={22}/><Bone h={300} r={22}/>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">

              {/* ══════════════════ OVERVIEW ══════════════════ */}
              {tab==="overview" && (
                <motion.div key="ov" initial="hidden" animate="show" exit={{ opacity:0 }} variants={stagger} style={{ display:"flex", flexDirection:"column", gap:18 }}>

                  {/* ── AI Insights strip ── */}
                  <motion.div variants={stagger2} style={{ display:"grid", gap:10, gridTemplateColumns:"repeat(2,1fr)" }}
                    className="an-insights-strip">
                    {aiChips.map((c,i)=>(
                      <InsightChip key={i} {...c} />
                    ))}
                  </motion.div>

                  {/* ── Hero KPIs ── */}
                  {/* Row 1: dark hero (left, 2 cols) + 2 stacked (right, 1 col) */}
                  <div className="an-hero-grid">
                    <div className="an-hero-featured">
                      <HeroKPI
                        icon={<TrendingUp size={22}/>}
                        eyebrow="المقياس الرئيسي"
                        label="صافي الإيراد الكلي"
                        value={canRev ? `$${formatNumber(kpi.net,0)}` : "—"}
                        sub={canRev ? "USD · صافي بعد الاسترداد · كامل الفترة" : undefined}
                        delta={canRev ? mom.revD : undefined}
                        spark={sparkRev}
                        rawVal={canRev ? Math.round(kpi.net) : undefined}
                      />
                    </div>
                    <div className="an-hero-stacked">
                      <KPI
                        icon={<Users size={17}/>} accent={C.primary}
                        label="المشتركون النشطون"
                        value={formatNumber(kpi.active)}
                        sub={`من ${formatNumber(kpi.total)} إجمالاً`}
                        delta={mom.cntD} spark={sparkCnt} rawVal={kpi.active} compact
                      />
                      <KPI
                        icon={<DollarSign size={17}/>} accent={C.success} accentBg="rgba(34,197,94,0.10)"
                        label="إيراد هذا الشهر"
                        value={canRev ? `$${formatNumber(mom.curRev,0)}` : "—"}
                        sub={canRev ? "USD · الشهر الحالي فقط" : undefined}
                        delta={canRev ? mom.revD : undefined}
                        spark={sparkRev}
                        rawVal={canRev ? Math.round(mom.curRev) : undefined}
                        compact
                      />
                    </div>
                  </div>

                  {/* Row 2: 4 secondary KPIs */}
                  <div className="an-secondary-grid">
                    <KPI
                      icon={<Activity size={17}/>} accent={C.purple} accentBg="rgba(139,92,246,0.10)"
                      label="نمو المشتركين"
                      value={mom.growPct!=null ? `${mom.growPct>0?"+":""}${mom.growPct}%` : "—"}
                      sub={`${mom.curCnt} مشترك هذا الشهر`}
                      delta={mom.growPct} spark={sparkCnt}
                    />
                    <KPI
                      icon={<Target size={17}/>} accent={C.cyan} accentBg="rgba(6,182,212,0.10)"
                      label="معدل التحويل"
                      value={`${kpi.conv.toFixed(1)}%`}
                      sub="نشط من إجمالي المشتركين"
                      spark={sparkCnt}
                    />
                    <KPI
                      icon={<CheckCircle2 size={17}/>} accent={C.success} accentBg="rgba(34,197,94,0.09)"
                      label="معدل الاحتفاظ"
                      value={`${kpi.retention.toFixed(1)}%`}
                      sub="من غير المنسحبين نشطون"
                      spark={sparkCnt}
                    />
                    <KPI
                      icon={<UserMinus size={17}/>}
                      accent={kpi.churn>5?C.danger:kpi.churn>2?C.warning:C.success}
                      accentBg={kpi.churn>5?"rgba(239,68,68,0.08)":kpi.churn>2?"rgba(245,158,11,0.08)":"rgba(34,197,94,0.08)"}
                      label="معدل الانسحاب"
                      value={`${kpi.churn.toFixed(1)}%`}
                      sub="هذا الشهر"
                      spark={sparkCnt}
                    />
                  </div>

                  {/* Row 3: 4 mini stats */}
                  <div className="an-secondary-grid">
                    <Mini label="إجمالي المحصّل"    value={canRev?`$${formatNumber(kpi.paid,0)}`:"—"}    sub="قبل الاسترداد"   color={C.success} icon={<DollarSign size={13}/>} rawVal={canRev?Math.round(kpi.paid):undefined} />
                    <Mini label="متبقي أقساط"        value={canRev?`$${formatNumber(kpi.rem,0)}`:"—"}     sub="أقساط مستحقة"   color={C.warning} icon={<CreditCard size={13}/>} rawVal={canRev?Math.round(kpi.rem):undefined} />
                    <Mini label="المنسحبون"           value={formatNumber(kpi.withdrawn)}                  sub="إجمالي منسحب"   color={C.danger}  icon={<UserMinus size={13}/>} rawVal={kpi.withdrawn} />
                    <Mini label="ARPU"                value={canRev?`$${formatNumber(kpi.arpu,0)}`:"—"}   sub="متوسط الإيراد"   color={C.primary} icon={<Star size={13}/>} />
                  </div>

                  {/* ── Revenue Trend + Country ── */}
                  <div className="an-rev-grid">
                    <Shell
                      title={canRev?"الإيرادات الشهرية":"الدفعات الشهرية"}
                      sub="آخر 12 شهراً · صافي بعد الاسترداد"
                      bar={C.primary}
                      right={
                        <div style={{ display:"flex", gap:14 }}>
                          <Leg color={C.primary} label={canRev?"الإيراد":"الدفعات"} />
                          <Leg color={C.warning} label="العدد" />
                        </div>
                      }
                      height={290}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthly} margin={{ top:12, right:4, left:-14, bottom:0 }}>
                          <defs>
                            <linearGradient id="rG" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor={C.primary} stopOpacity={0.30} />
                              <stop offset="80%"  stopColor={C.primary} stopOpacity={0.04} />
                              <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="cG" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor={C.warning} stopOpacity={0.20} />
                              <stop offset="100%" stopColor={C.warning} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="0" stroke={C.grid} vertical={false} opacity={0.8} />
                          <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
                          <YAxis tick={TICK} axisLine={false} tickLine={false} width={42} />
                          <Tooltip content={p=><DarkTip {...p} prefix={canRev?"$":""} />} cursor={{ stroke:`${C.primary}18`, strokeWidth:1, strokeDasharray:"4 4" }} />
                          <Area type="monotone" dataKey={canRev?"revenue":"count"} name={canRev?"الإيراد":"الدفعات"} stroke={C.primary} strokeWidth={3} fill="url(#rG)" dot={false} activeDot={{ r:6, fill:C.primary, strokeWidth:3, stroke:"#fff" }} />
                          <Area type="monotone" dataKey="count" name="العدد" stroke={C.warning} strokeWidth={2} fill="url(#cG)" dot={false} activeDot={{ r:5, fill:C.warning, strokeWidth:2, stroke:"#fff" }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Shell>

                    <Shell title="توزيع الدول" sub="حسب بلد الإقامة" height={290}>
                      <div style={{ display:"flex", height:"100%", gap:12 }}>
                        <ResponsiveContainer width="50%" height="100%">
                          <PieChart>
                            <Pie data={countryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={54} outerRadius={86} paddingAngle={2} isAnimationActive>
                              {countryData.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]} strokeWidth={0}/>)}
                            </Pie>
                            <Tooltip content={<PieTip/>}/>
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", gap:8, overflow:"hidden" }} dir="rtl">
                          {countryData.slice(0,6).map((d,i)=>(
                            <div key={d.name} style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <span style={{ width:7, height:7, borderRadius:"50%", flexShrink:0, background:PALETTE[i%PALETTE.length] }} />
                              <span style={{ fontSize:11.5, color:"var(--jk-muted)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.name}</span>
                              <span style={{ fontSize:12, fontWeight:800, color:"var(--jk-text)", fontVariantNumeric:"tabular-nums" }}>{d.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Shell>
                  </div>

                  {/* ── Acquisition + Package ── */}
                  <div className="an-acq-grid">
                    <Shell title="اكتساب المشتركين الجدد" sub="آخر 7 أشهر" bar={C.success} height={256}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={acqData} margin={{ top:10, right:4, left:-16, bottom:0 }}>
                          <defs>
                            <linearGradient id="acqG" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={C.primary} stopOpacity={1}/>
                              <stop offset="100%" stopColor={C.purple} stopOpacity={0.7}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="0" stroke={C.grid} vertical={false} opacity={0.8}/>
                          <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false}/>
                          <YAxis tick={TICK} axisLine={false} tickLine={false} width={28}/>
                          <Tooltip content={<DarkTip/>} cursor={{ fill:`${C.primary}07` }}/>
                          <Bar dataKey="مشتركون" fill="url(#acqG)" radius={[7,7,0,0]} maxBarSize={44}/>
                        </BarChart>
                      </ResponsiveContainer>
                    </Shell>

                    <Shell title="توزيع الباقات" sub="فضية مقابل ذهبية" height={256}>
                      <div style={{ display:"flex", height:"100%", alignItems:"center", gap:18 }}>
                        <ResponsiveContainer width="44%" height="100%">
                          <PieChart>
                            <Pie data={packageData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={5} isAnimationActive>
                              {packageData.map(d=><Cell key={d.name} fill={d.color} strokeWidth={0}/>)}
                            </Pie>
                            <Tooltip content={<PieTip/>}/>
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:18 }}>
                          {packageData.map(d=>{
                            const pct = kpi.total ? Math.round((d.value/kpi.total)*100) : 0;
                            return (
                              <div key={d.name}>
                                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                                  <span style={{ color:d.color, fontWeight:700, fontSize:13 }}>{d.name}</span>
                                  <div style={{ display:"flex", gap:6, alignItems:"baseline" }}>
                                    <span style={{ fontSize:20, fontWeight:800, color:"var(--jk-text)", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em" }}>{d.value}</span>
                                    <span style={{ fontSize:11, color:"var(--jk-muted)" }}>{pct}%</span>
                                  </div>
                                </div>
                                <div className="jk-progress" style={{ height:5 }}>
                                  <motion.div className="fill"
                                    initial={{ width:0 }} animate={{ width:`${pct}%` }}
                                    transition={{ duration:0.8, delay:0.2, ease:"easeOut" }}
                                    style={{ background:d.color }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Shell>
                  </div>

                  {/* ── Source Funnel + Live Feed + Payment Methods ── */}
                  <div className="an-sources-grid">

                    {/* Source conversion funnel */}
                    <Shell title="مصادر الاشتراك" sub="أداء كل قناة اكتساب" bar={C.purple} height="auto">
                      <div style={{ display:"flex", flexDirection:"column", gap:12 }} dir="rtl">
                        {sourceData.length===0 ? (
                          <div className="jk-empty py-8"><div className="jk-empty-icon"><BarChart2 size={20}/></div><p className="jk-empty-title">لا بيانات</p></div>
                        ) : sourceData.map((d,i)=>{
                          const total  = sourceData.reduce((s,x)=>s+x.value,0);
                          const pct    = total?Math.round((d.value/total)*100):0;
                          const relPct = sourceData[0]?.value?Math.round((d.value/sourceData[0].value)*100):0;
                          const color  = PALETTE[i%PALETTE.length];
                          return (
                            <div key={d.name}>
                              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:7 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                  <div style={{ width:26, height:26, borderRadius:8, background:`${color}15`, border:`1.5px solid ${color}28`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                    <span style={{ fontSize:9, fontWeight:800, color }}>{i+1}</span>
                                  </div>
                                  <span style={{ fontSize:13, color:"var(--jk-text)", fontWeight:600 }}>{d.name}</span>
                                </div>
                                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                  <span style={{ fontSize:11, color:"var(--jk-subtle)", fontWeight:500 }}>{pct}%</span>
                                  <span style={{ fontSize:14, fontWeight:800, color:"var(--jk-text)", fontVariantNumeric:"tabular-nums" }}>{d.value}</span>
                                </div>
                              </div>
                              <div className="jk-progress" style={{ height:6 }}>
                                <motion.div className="fill"
                                  initial={{ width:0 }} animate={{ width:`${relPct}%` }}
                                  transition={{ duration:0.75, delay:i*0.08, ease:"easeOut" }}
                                  style={{ background:color }}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Shell>

                    {/* Live payments feed */}
                    <Shell title="النشاط المباشر" sub={`أحدث ${recentPay.length} دفعة`}
                      right={
                        <div style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:999, background:"rgba(34,197,94,0.10)", border:"1px solid rgba(34,197,94,0.20)" }}>
                          <span className="status-dot-live" style={{ width:6, height:6 }}/>
                          <span style={{ fontSize:10, fontWeight:700, color:C.success }}>مباشر</span>
                        </div>
                      }
                      noPad height="auto">
                      <div dir="rtl">
                        {recentPay.length===0 ? (
                          <div className="jk-empty py-10"><p className="jk-empty-title">لا توجد دفعات</p></div>
                        ) : recentPay.map((p,i)=>(
                          <div key={p.id}
                            style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 20px", borderTop:i>0?"1px solid var(--jk-divider)":"none", transition:"background 0.12s" }}
                            onMouseEnter={e=>(e.currentTarget.style.background="var(--jk-surface-hover)")}
                            onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                            <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                              <div style={{ width:8, height:8, borderRadius:"50%", background:i===0?C.success:C.grid, flexShrink:0, boxShadow:i===0?`0 0 0 3px rgba(34,197,94,0.18)`:"none" }}/>
                              <div style={{ minWidth:0 }}>
                                {p.subscriberId
                                  ? <Link href={`/subscribers/${p.subscriberId}`} style={{ fontSize:13, fontWeight:600, color:"var(--jk-text)", display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textDecoration:"none" }} className="hover:underline">{p.subscriberName||"—"}</Link>
                                  : <p style={{ fontSize:13, fontWeight:600, color:"var(--jk-text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.subscriberName||"—"}</p>
                                }
                                <p style={{ fontSize:11, color:"var(--jk-subtle)", marginTop:1 }}>{p.paymentMethod||"—"} · {toDateStr(p.date).slice(0,10)||"—"}</p>
                              </div>
                            </div>
                            {canRev && (
                              <span style={{ flexShrink:0, padding:"3px 9px", borderRadius:9, fontSize:12, fontWeight:800, fontVariantNumeric:"tabular-nums", background:"rgba(34,197,94,0.09)", color:C.success, border:"1px solid rgba(34,197,94,0.18)" }}>
                                ${formatNumber(p.amountUSD||0,2)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </Shell>

                    {/* Payment methods */}
                    <Shell title="طرق الدفع" sub="توزيع الدفعات حسب الطريقة" height={300}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={methodData} layout="vertical" margin={{ top:4, right:4, left:4, bottom:0 }}>
                          <CartesianGrid strokeDasharray="0" stroke={C.grid} horizontal={false} opacity={0.8}/>
                          <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} allowDecimals={false}/>
                          <YAxis type="category" dataKey="name" tick={{ ...TICK, fontSize:10 }} axisLine={false} tickLine={false} width={82}/>
                          <Tooltip content={<DarkTip/>} cursor={{ fill:`${C.primary}05` }}/>
                          <Bar dataKey="value" name="الدفعات" radius={[0,7,7,0]} maxBarSize={13}>
                            {methodData.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Shell>
                  </div>

                  {/* ── Team Performance Leaderboard ── */}
                  <motion.div variants={fadeUp}
                    style={{ overflow:"hidden", borderRadius:22, background:"var(--jk-surface)", border:"1px solid var(--jk-divider)", boxShadow:"var(--jk-shadow-card)", position:"relative" }}>
                    <div style={{ position:"absolute", top:0, insetInline:0, height:3, background:`linear-gradient(90deg, ${C.warning}, ${C.warning}60)`, borderRadius:"22px 22px 0 0" }} />
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 22px 14px", borderBottom:"1px solid var(--jk-divider)" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:12, background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.22)", display:"flex", alignItems:"center", justifyContent:"center", color:C.warning }}>
                          <Medal size={17}/>
                        </div>
                        <div>
                          <p style={{ fontSize:15, fontWeight:800, color:"var(--jk-text)", letterSpacing:"-0.016em" }}>لوحة الفرق — الترتيب</p>
                          <p style={{ fontSize:11.5, color:"var(--jk-subtle)", marginTop:2 }}>مرتبة حسب عدد المشتركين</p>
                        </div>
                      </div>
                      <Link href="/admin/teams" style={{ fontSize:12, fontWeight:600, padding:"6px 14px", borderRadius:999, background:"var(--jk-accent-bg)", color:"var(--jk-primary)", border:"1px solid var(--jk-accent-border)", textDecoration:"none" }}>
                        إدارة ←
                      </Link>
                    </div>

                    {teamData.length===0 ? (
                      <div className="jk-empty"><p className="jk-empty-title">لا توجد فرق</p></div>
                    ) : (
                      <div style={{ padding:"14px 18px", display:"flex", flexDirection:"column", gap:4 }}>
                        {teamData.slice(0,6).map((td,i)=>{
                          const colors = [C.primary,C.success,C.warning,C.danger,C.purple,C.cyan];
                          const color  = colors[i%colors.length];
                          const pct    = Math.round((td.مشتركون/(teamData[0]?.مشتركون||1))*100);
                          const actPct = td.مشتركون>0 ? Math.round((td.نشطون/td.مشتركون)*100) : 0;
                          const inner  = (
                            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                              <Rank n={i+1}/>
                              <div style={{ width:38, height:38, borderRadius:13, flexShrink:0, background:`${color}14`, border:`1.5px solid ${color}28`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:800, color }}>
                                {td.name.charAt(0)}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                                  <span style={{ fontSize:13.5, fontWeight:700, color:"var(--jk-text)" }}>{td.name}</span>
                                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                    <span style={{ fontSize:11.5, color:"var(--jk-muted)" }}>{td.مشتركون} مشترك</span>
                                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:999, background:"rgba(34,197,94,0.10)", color:C.success, border:"1px solid rgba(34,197,94,0.18)", fontWeight:700 }}>{td.نشطون} نشط</span>
                                    {canRev && <span style={{ fontSize:13, fontWeight:800, color:"var(--jk-text)", fontVariantNumeric:"tabular-nums" }}>${formatNumber(td.إيراد,0)}</span>}
                                  </div>
                                </div>
                                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                  <div className="jk-progress" style={{ height:5, flex:1 }}>
                                    <motion.div className="fill"
                                      initial={{ width:0 }} animate={{ width:`${pct}%` }}
                                      transition={{ duration:0.8, delay:i*0.09, ease:"easeOut" }}
                                      style={{ background:color }}/>
                                  </div>
                                  <span style={{ fontSize:10.5, color:"var(--jk-subtle)", fontWeight:600, flexShrink:0, fontVariantNumeric:"tabular-nums" }}>{actPct}% نشط</span>
                                </div>
                              </div>
                            </div>
                          );
                          return td.id ? (
                            <Link key={td.name} href={`/admin/teams/${td.id}`}
                              style={{ display:"block", padding:"10px 10px", borderRadius:16, border:"1px solid transparent", textDecoration:"none", transition:"all 0.15s" }}
                              onMouseEnter={e=>{ const el=e.currentTarget as HTMLElement; el.style.background="var(--jk-surface-hover)"; el.style.borderColor="var(--jk-divider)"; }}
                              onMouseLeave={e=>{ const el=e.currentTarget as HTMLElement; el.style.background="transparent"; el.style.borderColor="transparent"; }}>
                              {inner}
                            </Link>
                          ) : <div key={td.name} style={{ padding:"10px 10px", borderRadius:16 }}>{inner}</div>;
                        })}
                      </div>
                    )}
                  </motion.div>

                </motion.div>
              )}

              {/* ══════════════════ EMPLOYEES ══════════════════ */}
              {tab==="employees" && (
                <motion.div key="emp" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} transition={{ duration:0.22 }} style={{ display:"flex", flexDirection:"column", gap:18 }}>
                  {canExport && (
                    <div style={{ display:"flex", justifyContent:"flex-end" }}>
                      <button onClick={()=>exportEmployeePerformanceCSV(subscribers)} className="jk-btn"><Download size={13}/> تصدير CSV</button>
                    </div>
                  )}
                  {empLoading ? (
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      {Array(5).fill(0).map((_,i)=><Bone key={i} h={54} r={14}/>)}
                    </div>
                  ) : empPerf.length===0 ? (
                    <div className="jk-empty py-20">
                      <div className="jk-empty-icon"><Medal size={22}/></div>
                      <p className="jk-empty-title">لا توجد بيانات أداء موظفين</p>
                      <p className="jk-empty-sub">سيظهر هنا الأداء بعد إضافة مشتركين</p>
                    </div>
                  ) : (
                    <>
                      {/* Top 3 leaderboard cards */}
                      {empPerf.length>=1 && (
                        <div className="an-leader-grid">
                          {empPerf.slice(0,3).map((emp,i)=>{
                            const medals   = ["rgba(251,191,36,0.14)","rgba(156,163,175,0.14)","rgba(180,107,60,0.12)"];
                            const colors   = ["#D97706","#6B7280","#92400E"];
                            const borders  = ["rgba(251,191,36,0.28)","rgba(156,163,175,0.22)","rgba(180,107,60,0.22)"];
                            return (
                              <motion.div key={emp.name} variants={fadeUp} whileHover={{ y:-3, transition:fast }}
                                style={{ background:"var(--jk-surface)", borderRadius:20, padding:"22px", border:`1.5px solid ${borders[i]}`, boxShadow:i===0?"0 8px 32px rgba(251,191,36,0.10)":"var(--jk-shadow-card)", position:"relative", overflow:"hidden" }}>
                                {i===0 && <div style={{ position:"absolute", top:-40, right:-40, width:120, height:120, borderRadius:"50%", background:"radial-gradient(circle, rgba(251,191,36,0.16) 0%, transparent 70%)", pointerEvents:"none" }}/>}
                                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
                                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                    <div style={{ width:40, height:40, borderRadius:13, background:medals[i], display:"flex", alignItems:"center", justifyContent:"center", color:colors[i] }}>
                                      {i===0?<Crown size={17}/>:i===1?<Medal size={16}/>:<Medal size={14}/>}
                                    </div>
                                    <div>
                                      <p style={{ fontSize:14, fontWeight:700, color:"var(--jk-text)" }}>{emp.name}</p>
                                      <p style={{ fontSize:11, color:"var(--jk-muted)", marginTop:1 }}>المرتبة {i+1}</p>
                                    </div>
                                  </div>
                                  <span style={{ fontSize:24 }}>{["🥇","🥈","🥉"][i]}</span>
                                </div>
                                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                                  <div style={{ background:"var(--jk-panel)", borderRadius:12, padding:"10px 12px" }}>
                                    <p style={{ fontSize:10, color:"var(--jk-muted)", fontWeight:600, marginBottom:3 }}>المشتركون</p>
                                    <p style={{ fontSize:22, fontWeight:800, color:"var(--jk-text)", fontVariantNumeric:"tabular-nums" }}>{emp.subscribers}</p>
                                  </div>
                                  <div style={{ background:"rgba(34,197,94,0.07)", borderRadius:12, padding:"10px 12px" }}>
                                    <p style={{ fontSize:10, color:"var(--jk-muted)", fontWeight:600, marginBottom:3 }}>الإيراد</p>
                                    <p style={{ fontSize:17, fontWeight:800, color:C.success, fontVariantNumeric:"tabular-nums" }}>{canRev?`$${formatNumber(emp.revenue,0)}`:"—"}</p>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}

                      {/* Full performance table */}
                      <div className="jk-table-wrap">
                        <div style={{ padding:"14px 20px", display:"flex", alignItems:"center", gap:8, borderBottom:"1px solid var(--jk-divider)" }}>
                          <Medal size={14} style={{ color:C.warning }}/>
                          <p style={{ fontSize:14.5, fontWeight:800, color:"var(--jk-text)", letterSpacing:"-0.01em" }}>لوحة الأداء الكاملة</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="jk-table w-full">
                            <thead>
                              <tr>{["#","الموظف","المشتركون","النشطون","الإيراد USD","التجديدات","الاسترداد","متوسط القيمة"].map(h=><th key={h}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                              {empPerf.map((emp,i)=>(
                                <tr key={emp.name}>
                                  <td className="text-center w-10">{["🥇","🥈","🥉"][i]??<span style={{ fontSize:11, fontWeight:700, color:"var(--jk-muted)" }}>{i+1}</span>}</td>
                                  <td><span style={{ fontWeight:700, color:"var(--jk-text)" }}>{emp.name}</span></td>
                                  <td className="text-center font-bold tabular-nums">{emp.subscribers}</td>
                                  <td className="text-center"><span className="jk-chip active">{emp.active}</span></td>
                                  <td className="tabular-nums font-black" style={{ color:C.success }}>{canRev?`$${formatNumber(emp.revenue,0)}`:"—"}</td>
                                  <td className="tabular-nums text-center">{emp.renewals}</td>
                                  <td className="tabular-nums text-center" style={{ color:emp.refunds>0?C.danger:"var(--jk-muted)" }}>{emp.refunds}</td>
                                  <td className="tabular-nums" style={{ color:"var(--jk-muted)" }}>{canRev?`$${formatNumber(emp.avgValue,0)}`:"—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Charts */}
                      <div className="an-emp-chart-grid">
                        {canRev && (
                          <Shell title="مقارنة الإيراد" sub="بين الموظفين" bar={C.success} height={280}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={empPerf.slice(0,8)} margin={{ top:10, right:8, left:-8, bottom:0 }}>
                                <defs>
                                  <linearGradient id="eRG" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={C.success} stopOpacity={0.9}/>
                                    <stop offset="100%" stopColor={C.cyan} stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="2 4" stroke={C.grid} vertical={false}/>
                                <XAxis dataKey="name" tick={TICK} interval={0} angle={-15} textAnchor="end" height={42}/>
                                <YAxis tick={TICK}/>
                                <Tooltip content={<DarkTip prefix="$"/>}/>
                                <Bar dataKey="revenue" name="الإيراد" radius={[5,5,0,0]} fill="url(#eRG)"/>
                              </BarChart>
                            </ResponsiveContainer>
                          </Shell>
                        )}
                        <Shell title="مشتركو كل موظف" sub="عدد المشتركين" bar={C.primary} height={280}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={empPerf.slice(0,8)} margin={{ top:10, right:8, left:-8, bottom:0 }}>
                              <CartesianGrid strokeDasharray="2 4" stroke={C.grid} vertical={false}/>
                              <XAxis dataKey="name" tick={TICK} interval={0} angle={-15} textAnchor="end" height={42}/>
                              <YAxis tick={TICK}/>
                              <Tooltip content={<DarkTip/>}/>
                              <Bar dataKey="subscribers" name="المشتركون" radius={[5,5,0,0]}>
                                {empPerf.slice(0,8).map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </Shell>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* ══════════════════ INSIGHTS ══════════════════ */}
              {tab==="insights" && (
                <motion.div key="ins" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} transition={{ duration:0.22 }} style={{ display:"flex", flexDirection:"column", gap:18 }}>

                  {/* Health score banner */}
                  <div className="an-health-grid">
                    {/* Score dark card */}
                    <motion.div variants={fadeUp}
                      style={{ borderRadius:22, padding:"24px", background:`linear-gradient(145deg, ${C.dark1}, ${C.dark2})`, border:"1px solid rgba(255,255,255,0.07)", boxShadow:"0 12px 44px rgba(8,14,28,0.55)", position:"relative", overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"space-between", gap:16 }}>
                      <div style={{ position:"absolute", top:-30, right:-30, width:120, height:120, borderRadius:"50%", background:`radial-gradient(circle, ${health.color}28 0%, transparent 70%)`, pointerEvents:"none" }}/>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:40, height:40, borderRadius:13, background:`${health.color}22`, border:`1px solid ${health.color}38`, display:"flex", alignItems:"center", justifyContent:"center", color:health.color }}>
                          <Sparkles size={18}/>
                        </div>
                        <div>
                          <p style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"rgba(255,255,255,0.35)" }}>مؤشر صحة المنصة</p>
                          <p style={{ fontSize:12.5, fontWeight:600, color:"rgba(255,255,255,0.55)", marginTop:1 }}>Health Score</p>
                        </div>
                      </div>
                      <div>
                        <p style={{ fontSize:56, fontWeight:900, color:"#fff", letterSpacing:"-0.045em", lineHeight:1, fontVariantNumeric:"tabular-nums" }}>{health.score}</p>
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:10 }}>
                          <div style={{ flex:1, height:4, background:"rgba(255,255,255,0.10)", borderRadius:999, overflow:"hidden" }}>
                            <motion.div initial={{ width:0 }} animate={{ width:`${health.score}%` }} transition={{ duration:1.1, ease:"easeOut" }} style={{ height:"100%", background:health.color, borderRadius:999 }}/>
                          </div>
                          <span style={{ fontSize:12, fontWeight:700, color:health.color, flexShrink:0 }}>{health.label}</span>
                        </div>
                      </div>
                    </motion.div>

                    {/* BI metric cards */}
                    {[
                      { title:"معدل الاحتفاظ", value:`${kpi.retention.toFixed(1)}%`, level:kpi.retention>=70?"success":kpi.retention>=50?"warning":"critical", desc:kpi.retention>=70?"ممتاز — معدل احتفاظ صحي":kpi.retention>=50?"متوسط — يحتاج تحسين":"منخفض — يجب التدخل" },
                      { title:"معدل الانسحاب", value:`${kpi.churn.toFixed(1)}%`,    level:kpi.churn<=2?"success":kpi.churn<=5?"warning":"critical", desc:kpi.churn<=2?"ممتاز — انسحاب منخفض":kpi.churn<=5?"متوسط — متابعة مستمرة":"مرتفع — يحتاج مراجعة" },
                    ].map(item=>{
                      const cfgMap = { success:{bg:"var(--success-bg)",color:C.success,border:"rgba(34,197,94,0.22)"}, warning:{bg:"var(--warning-bg)",color:C.warning,border:"rgba(245,158,11,0.22)"}, critical:{bg:"var(--danger-bg)",color:C.danger,border:"rgba(239,68,68,0.22)"} } as const;
                      const c = cfgMap[item.level as keyof typeof cfgMap];
                      return (
                        <motion.div key={item.title} variants={fadeUp}
                          style={{ background:c.bg, borderRadius:22, padding:"22px 24px", border:`1.5px solid ${c.border}` }}>
                          <p style={{ fontSize:10.5, color:c.color, fontWeight:700, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.09em" }}>{item.title}</p>
                          <p style={{ fontSize:44, fontWeight:900, color:c.color, fontVariantNumeric:"tabular-nums", lineHeight:1, letterSpacing:"-0.04em" }}>{item.value}</p>
                          <p style={{ fontSize:12.5, color:"var(--jk-muted)", marginTop:12, lineHeight:1.55 }}>{item.desc}</p>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Mini stats */}
                  <div className="an-secondary-grid">
                    <Mini label="ARPU"              value={canRev?`$${formatNumber(kpi.arpu,0)}`:"—"}     sub="متوسط إيراد المشترك"  color={C.primary}/>
                    <Mini label="إجمالي المشتركين"  value={formatNumber(kpi.total)}                       sub="منذ البداية"           color={C.primary} rawVal={kpi.total}/>
                    <Mini label="المنسحبون"         value={formatNumber(kpi.withdrawn)}                   sub="إجمالي منسحب"          color={C.danger}  rawVal={kpi.withdrawn}/>
                    <Mini label="معدل التحويل"      value={`${kpi.conv.toFixed(1)}%`}                    sub="نشط من إجمالي"         color={C.cyan}/>
                  </div>

                  {/* Smart alerts */}
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                      <div style={{ width:34, height:34, borderRadius:11, background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.22)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <Lightbulb size={15} style={{ color:C.warning }}/>
                      </div>
                      <h3 style={{ fontSize:15, fontWeight:800, color:"var(--jk-text)", margin:0, letterSpacing:"-0.01em" }}>التنبيهات الذكية</h3>
                      {insights.length>0 && (
                        <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:999, background:"rgba(245,158,11,0.12)", color:C.warning, border:"1px solid rgba(245,158,11,0.22)" }}>
                          {insights.length} تنبيه
                        </span>
                      )}
                    </div>
                    {insightsLoading ? (
                      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                        {Array(4).fill(0).map((_,i)=><Bone key={i} h={70} r={16}/>)}
                      </div>
                    ) : insights.length===0 ? (
                      <div className="jk-empty py-16">
                        <div className="jk-empty-icon"><CheckCircle2 size={24}/></div>
                        <p className="jk-empty-title">كل شيء يسير بشكل جيد!</p>
                        <p className="jk-empty-sub">لا توجد تنبيهات حالياً</p>
                      </div>
                    ) : (
                      <motion.div variants={stagger} initial="hidden" animate="show" style={{ display:"flex", flexDirection:"column", gap:10 }}>
                        {(["critical","warning","info","success"] as const).map(level=>{
                          const group = insights.filter(ins=>ins.level===level);
                          if (!group.length) return null;
                          return group.map(ins=><InsightCard key={ins.id} insight={ins}/>);
                        })}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
