"use client";

import { useMemo, useState } from "react";
import { CHART_PALETTE, STATUS_COLORS } from "@/lib/statusColors";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useSubscribers } from "@/hooks/useSubscribers";
import { usePayments } from "@/hooks/usePayments";
import { useAuthStore } from "@/store/authStore";
import { formatNumber, ARABIC_MONTHS, RESIDENCE_COUNTRIES, PHONE_COUNTRIES } from "@/lib/utils";
import { useTeams } from "@/hooks/useTeams";
import Link from "next/link";
import {
  Users, DollarSign, TrendingUp, CreditCard,
  RefreshCw, ArrowUpRight, Activity, Zap,
  Medal, Lightbulb, AlertTriangle, CheckCircle2, Info, XCircle,
  Download,
} from "lucide-react";
import { useEmployeePerformance } from "@/hooks/useEmployeePerformance";
import { useDashboardMetrics }    from "@/hooks/useDashboardMetrics";
import { useRefunds }             from "@/hooks/useRefunds";
import { canExportReports }       from "@/lib/permissionGuards";
import {
  exportSubscribersCSV, exportPaymentsCSV, exportEmployeePerformanceCSV,
  exportSubscribersByMonthCSV,
} from "@/lib/analytics/reports";
import type { Insight } from "@/lib/analytics/insights";

// ── Premium Analytics Palette ─────────────────────────────────────────────────
const P = {
  bg:         "#F5F6FA",
  card:       "#FFFFFF",
  border:     "#E5E7EB",
  divider:    "#F3F4F6",
  primary:    "#4F46FF",
  primarySoft:"#6B7CFF",
  darkCard1:  "#0B1020",
  darkCard2:  "#1A2745",
  textMain:   "#111827",
  textMuted:  "#6B7280",
  success:    "#22C55E",
  warning:    "#F59E0B",
  danger:     "#EF4444",
  grid:       "#F3F4F6",
  tick:       "#9CA3AF",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _LIGHT = {}; // kept for compatibility — use P instead
const t = { textPri: P.textMain, textSec: P.textMuted, divider: P.border, grid: P.grid, tick: P.tick };

const CHART_COLORS = [
  "#4F46FF","#22C55E","#F59E0B","#EF4444",
  "#8B5CF6","#06B6D4","#F97316","#6B7CFF",
];

const ACC = {
  indigo:  "#4F46FF",
  emerald: "#22C55E",
  sky:     "#06B6D4",
  amber:   "#F59E0B",
  violet:  "#8B5CF6",
  rose:    "#EF4444",
  teal:    "#14B8A6",
};

// ── Animations ────────────────────────────────────────────────────────────────
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.07 } } };
const tran = { duration: 0.4, ease: "easeOut" } as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function resLabel(v: string) {
  return (
    RESIDENCE_COUNTRIES.find((c) => c.value === v)?.name ||
    PHONE_COUNTRIES.find((c) => c.iso === v)?.name ||
    v || "غير محدد"
  );
}
function topN<T extends { value: number }>(arr: T[], n: number): T[] {
  return [...arr].sort((a, b) => b.value - a.value).slice(0, n);
}
function toDateStr(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof (raw as { toDate?: () => Date }).toDate === "function")
    return (raw as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return "";
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTip({ active, payload, label: lbl, prefix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: P.darkCard1, border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 14, padding: "10px 14px", minWidth: 130,
      boxShadow: "0 8px 32px rgba(0,0,0,0.40)",
    }}>
      {lbl && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 600, marginBottom: 6 }}>{lbl}</p>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: p.color || p.fill }} />
          {p.name ? `${p.name}: ` : ""}{prefix}{formatNumber(p.value as number, prefix ? 2 : 0)}
        </p>
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
      background: P.darkCard1, border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 14, padding: "10px 14px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.40)",
    }}>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 600, marginBottom: 4 }}>{p.name}</p>
      <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
        {formatNumber(p.value)}{p.payload?.percent ? ` · ${(p.payload.percent * 100).toFixed(1)}%` : ""}
      </p>
    </div>
  );
}

// ── Featured Stat Card — dark gradient (main revenue metric) ─────────────────
function FeaturedStatCard({ icon, label: lbl, value, sub, trend, spark }: {
  icon: React.ReactNode; label: string; value: string;
  sub?: string; trend?: number; spark: number[];
}) {
  const sparkData = spark.map((v) => ({ v }));
  const isUp = (trend ?? 0) >= 0;
  return (
    <motion.div variants={fadeUp} transition={tran}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      style={{
        position: "relative", overflow: "hidden", borderRadius: 24,
        padding: "28px 24px 20px",
        display: "flex", flexDirection: "column", gap: 20,
        background: `linear-gradient(145deg, ${P.darkCard1} 0%, ${P.darkCard2} 100%)`,
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 8px 32px rgba(11,16,32,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}>

      {/* Blue glow orb */}
      <div style={{
        position:"absolute", top:-40, right:-40, width:160, height:160,
        borderRadius:"50%",
        background:"radial-gradient(circle, rgba(79,70,255,0.35) 0%, transparent 70%)",
        pointerEvents:"none",
      }}/>
      {/* Secondary purple orb */}
      <div style={{
        position:"absolute", bottom:-30, left:-20, width:120, height:120,
        borderRadius:"50%",
        background:"radial-gradient(circle, rgba(107,124,255,0.20) 0%, transparent 70%)",
        pointerEvents:"none",
      }}/>

      {/* Header: icon + trend */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", position:"relative" }}>
        <div style={{
          width:46, height:46, borderRadius:14, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"center",
          background:"rgba(79,70,255,0.25)", border:"1px solid rgba(79,70,255,0.40)",
          color: P.primarySoft,
        }}>{icon}</div>
        {trend != null && (
          <span style={{
            display:"flex", alignItems:"center", gap:4,
            borderRadius:999, padding:"5px 11px", fontSize:11, fontWeight:700,
            background: isUp ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)",
            color: isUp ? P.success : P.danger,
            border: `1px solid ${isUp ? "rgba(34,197,94,0.30)" : "rgba(239,68,68,0.30)"}`,
          }}>
            <ArrowUpRight size={10} style={{ transform: isUp ? "none" : "rotate(90deg)" }}/>
            {isUp ? "+" : ""}{trend.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Text */}
      <div style={{ position:"relative" }}>
        <p style={{ fontSize:11, fontWeight:600, letterSpacing:"0.09em", textTransform:"uppercase",
          color:"rgba(255,255,255,0.40)", marginBottom:8 }}>{lbl}</p>
        <p style={{ fontSize:32, fontWeight:900, color:"#FFFFFF",
          letterSpacing:"-0.03em", lineHeight:1, fontVariantNumeric:"tabular-nums" }}>{value}</p>
        {sub && <p style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:6, fontWeight:500 }}>{sub}</p>}
      </div>

      {/* Sparkline */}
      <div style={{ height:52, position:"relative" }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData} margin={{ top:0, bottom:0, left:0, right:0 }}>
            <defs>
              <linearGradient id="featSpk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={P.primary} stopOpacity={0.50}/>
                <stop offset="100%" stopColor={P.primary} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area type="monotoneX" dataKey="v" stroke={P.primarySoft} strokeWidth={2}
              fill="url(#featSpk)" dot={false} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// ── Stat Card — white premium ─────────────────────────────────────────────────
function StatCard({ icon, label: lbl, value, sub, trend, accent, spark, accentLight }: {
  icon: React.ReactNode; label: string; value: string;
  sub?: string; trend?: number; accent: string; accentLight?: string; spark: number[];
}) {
  const sparkData = spark.map((v) => ({ v }));
  const isUp = (trend ?? 0) >= 0;
  const aLight = accentLight ?? `${accent}18`;
  return (
    <motion.div variants={fadeUp} transition={tran}
      whileHover={{ y: -3, boxShadow: "0 12px 40px rgba(0,0,0,0.10)", transition: { duration: 0.2 } }}
      style={{
        position:"relative", overflow:"hidden", borderRadius:22,
        padding:"22px 20px 16px",
        display:"flex", flexDirection:"column", gap:16,
        background: P.card,
        border: `1px solid ${P.border}`,
        boxShadow:"0 1px 3px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.04)",
      }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <div style={{
          width:42, height:42, borderRadius:13, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"center",
          background: aLight, color: accent,
        }}>{icon}</div>
        {trend != null && (
          <span style={{
            display:"flex", alignItems:"center", gap:3,
            borderRadius:999, padding:"4px 10px", fontSize:11, fontWeight:700,
            background: isUp ? "rgba(34,197,94,0.09)" : "rgba(239,68,68,0.09)",
            color: isUp ? P.success : P.danger,
          }}>
            <ArrowUpRight size={10} style={{ transform: isUp ? "none" : "rotate(90deg)" }}/>
            {isUp ? "+" : ""}{trend.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Text */}
      <div>
        <p style={{ fontSize:11, fontWeight:500, color: P.textMuted, marginBottom:6 }}>{lbl}</p>
        <p style={{ fontSize:28, fontWeight:900, color: P.textMain,
          letterSpacing:"-0.03em", lineHeight:1, fontVariantNumeric:"tabular-nums" }}>{value}</p>
        {sub && <p style={{ fontSize:11.5, color: P.textMuted, marginTop:5, fontWeight:400 }}>{sub}</p>}
      </div>

      {/* Mini spark */}
      <div style={{ height:38 }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData} margin={{ top:0, bottom:0, left:0, right:0 }}>
            <defs>
              <linearGradient id={`spk${lbl.replace(/\s/g,"")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.18}/>
                <stop offset="100%" stopColor={accent} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area type="monotoneX" dataKey="v" stroke={accent} strokeWidth={1.75}
              fill={`url(#spk${lbl.replace(/\s/g,"")})`} dot={false} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// ── Chart Shell ───────────────────────────────────────────────────────────────
function Shell({
  title, subtitle, right, height = 300, children, noPad,
}: {
  title: string; subtitle?: string; right?: React.ReactNode;
  height?: number; children: React.ReactNode; noPad?: boolean;
}) {
  return (
    <motion.div variants={fadeUp} transition={tran}
      style={{
        overflow:"hidden", borderRadius:22,
        background: P.card, border:`1px solid ${P.border}`,
        boxShadow:"0 1px 3px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.04)",
      }}>
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"16px 22px 14px",
        borderBottom:`1px solid ${P.divider}`,
      }}>
        <div>
          <p style={{ fontSize:15, fontWeight:800, color: P.textMain, letterSpacing:"-0.015em" }}>{title}</p>
          {subtitle && <p style={{ fontSize:12, color: P.textMuted, marginTop:2, fontWeight:400 }}>{subtitle}</p>}
        </div>
        {right}
      </div>
      <div style={{ padding: noPad ? 0 : 22, height }} dir="ltr">
        {children}
      </div>
    </motion.div>
  );
}

// ── Legend Pill ───────────────────────────────────────────────────────────────
function LegendPill({ color, label: lbl, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ width:8, height:8, borderRadius:"50%", flexShrink:0, background: color }} />
      <span style={{ fontSize:12, color: P.textMuted, flex:1 }}>{lbl}</span>
      <span style={{ fontSize:12, fontWeight:700, fontVariantNumeric:"tabular-nums", color: P.textMain }}>{value}</span>
    </div>
  );
}

// ── Insight card ─────────────────────────────────────────────────────────────
function InsightCard({ insight }: { insight: Insight }) {
  const cfg: Record<string, { icon: React.ReactNode; bg: string; border: string; color: string }> = {
    info:     { icon:<Info size={14}/>,          bg:"rgba(79,70,255,0.06)",  border:"rgba(79,70,255,0.15)",  color: P.primary  },
    warning:  { icon:<AlertTriangle size={14}/>, bg:"rgba(245,158,11,0.07)", border:"rgba(245,158,11,0.18)", color: P.warning  },
    critical: { icon:<XCircle size={14}/>,       bg:"rgba(239,68,68,0.06)",  border:"rgba(239,68,68,0.16)",  color: P.danger   },
    success:  { icon:<CheckCircle2 size={14}/>,  bg:"rgba(34,197,94,0.06)",  border:"rgba(34,197,94,0.16)",  color: P.success  },
  };
  const c = cfg[insight.level] ?? cfg.info;
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:12, borderRadius:16, padding:"14px 16px",
      background: c.bg, border:`1px solid ${c.border}` }}>
      <div style={{ marginTop:1, flexShrink:0, color: c.color }}>{c.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:13.5, fontWeight:700, color: P.textMain }}>{insight.title}</p>
        <p style={{ fontSize:12, marginTop:3, lineHeight:1.6, color: P.textMuted }}>{insight.description}</p>
      </div>
      {insight.value && (
        <span style={{ flexShrink:0, fontSize:13, fontWeight:800, fontVariantNumeric:"tabular-nums", color: c.color }}>{insight.value}</span>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type TabKey = "overview" | "employees" | "insights";

export default function AnalyticsPage() {
  const { can, user } = useAuthStore();
  const canRev        = can("canViewRevenue");
  const canExport     = canExportReports(user);
  // t kept for any remaining legacy refs
  const t = { textPri: P.textMain, textSec: P.textMuted, divider: P.border, grid: P.divider, tick: P.tick };
  const [tab, setTab]               = useState<TabKey>("overview");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const { subscribers, loading } = useSubscribers();
  const { payments }             = usePayments();
  const { refunds }              = useRefunds();
  const { data: _rawTeams = [] } = useTeams(false);
  const allTeams                 = _rawTeams.filter(t => t.active !== false);
  const { performance: empPerf, loading: empLoading } = useEmployeePerformance();
  const { insights, loading: metricsLoading }         = useDashboardMetrics();

  const TICK = { fontFamily: "inherit", fontSize: 10.5, fill: P.tick, fontWeight: 500 };

  // ── Data ────────────────────────────────────────────────────────────────────
  const monthly = useMemo(() => {
    const revMap: Record<string, number> = {};
    const cntMap: Record<string, number> = {};
    payments.forEach((p) => {
      const key = toDateStr(p.date).slice(0, 7);
      if (key) {
        revMap[key] = (revMap[key] || 0) + (p.amountUSD || 0);
        cntMap[key] = (cntMap[key] || 0) + 1;
      }
    });
    // طرح الاسترداد من الإيراد الشهري الصافي
    refunds.forEach((r) => {
      const key = toDateStr(r.refundDate).slice(0, 7);
      if (key) revMap[key] = (revMap[key] || 0) - (r.refundAmountUSD || 0);
    });
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d   = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return {
        label:   ARABIC_MONTHS[d.getMonth()].slice(0, 3),
        revenue: +(Math.max(0, revMap[key] || 0)).toFixed(2),
        count:   cntMap[key] || 0,
      };
    });
  }, [payments, refunds]);

  const kpi = useMemo(() => ({
    total:     subscribers.length,
    net:       subscribers.reduce((s, x) => s + (x.netAmountUSD || 0), 0),
    paid:      subscribers.reduce((s, x) => s + (x.paidAmountUSD || 0), 0),
    rem:       subscribers.filter((s) => s.subscriptionState !== "withdrawn")
                          .reduce((s, x) => s + (x.remainingAmountUSD || 0), 0),
    active:    subscribers.filter((s) => s.subscriptionState !== "withdrawn" && s.subscriptionStatus !== "paused").length,
    withdrawn: subscribers.filter((s) => s.subscriptionState === "withdrawn").length,
  }), [subscribers]);

  const countryData = useMemo(() => {
    const map: Record<string, number> = {};
    subscribers.forEach((s) => { const k = resLabel(s.residence); map[k] = (map[k] || 0) + 1; });
    return topN(Object.entries(map).map(([name, value]) => ({ name, value })), 8);
  }, [subscribers]);

  const methodData = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach((p) => { const k = p.paymentMethod || "غير محدد"; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [payments]);

  const sourceData = useMemo(() => {
    const map: Record<string, number> = {};
    subscribers.forEach((s) => { const k = s.source || "غير محدد"; map[k] = (map[k] || 0) + 1; });
    return topN(Object.entries(map).map(([name, value]) => ({ name, value })), 6);
  }, [subscribers]);

  const packageData = useMemo(() => [
    { name: "فضية",  value: subscribers.filter((s) => s.package === "فضية").length,  color: "#94a3b8" },
    { name: "ذهبية", value: subscribers.filter((s) => s.package === "ذهبية").length, color: ACC.amber },
  ], [subscribers]);

  const teamData = useMemo(() => {
    // Group by subscriber.team field — works even without Firestore team docs
    const map: Record<string, { مشتركون: number; نشطون: number; إيراد: number; id: string }> = {};
    subscribers.forEach((s) => {
      const key = s.team?.trim();
      if (!key) return;
      if (!map[key]) {
        const firestoreTeam = allTeams.find((t) => t.name === key);
        map[key] = { مشتركون: 0, نشطون: 0, إيراد: 0, id: firestoreTeam?.id ?? "" };
      }
      map[key].مشتركون++;
      if (s.subscriptionState !== "withdrawn") map[key].نشطون++;
      map[key].إيراد = +(map[key].إيراد + (s.netAmountUSD || 0)).toFixed(0);
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.مشتركون - a.مشتركون);
  }, [subscribers, allTeams]);

  const recentPayments = useMemo(() =>
    [...payments]
      .sort((a, b) => (toDateStr(b.date) > toDateStr(a.date) ? 1 : -1))
      .slice(0, 8),
  [payments]);
  const sparkRevenue   = monthly.map((m) => m.revenue);
  const sparkCount     = monthly.map((m) => m.count);

  const now = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

  return (
    <ProtectedLayout>
      <div className="min-h-full" style={{ background: P.bg }}>
        <div className="mx-auto max-w-screen-2xl p-5 md:p-7 lg:p-8">

          {/* ── Header ── */}
          <PageHeader
            title="التحليلات"
            subtitle={
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                مباشر · {formatNumber(kpi.total)} مشترك
              </span>
            }
            actions={canExport ? (
              <div className="flex flex-wrap justify-end gap-2 items-center">
                <div className="flex items-center gap-1.5 rounded-xl border overflow-hidden"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <input
                    type="month"
                    value={selectedMonth}
                    max={new Date().toISOString().slice(0, 7)}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-2 text-xs bg-transparent outline-none"
                    style={{ color: "var(--text-primary)" }}
                  />
                  <button
                    onClick={() => exportSubscribersByMonthCSV(subscribers, selectedMonth)}
                    disabled={!selectedMonth}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 transition-opacity"
                    style={{ background: "linear-gradient(135deg,#E8B570,#E8B570)" }}>
                    <Download size={12}/> تصدير الشهر
                  </button>
                </div>
                <button onClick={() => exportSubscribersCSV(subscribers)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#83A2DB,#83A2DB)" }}>
                  <Download size={12}/> تصدير الكل
                </button>
                <button onClick={() => exportPaymentsCSV(payments, refunds)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#83A2DB,#9DB4D6)" }}>
                  <Download size={12}/> تصدير الدفعات
                </button>
              </div>
            ) : undefined}
          />

          {/* ── Tab navigation ── */}
          <div style={{
            display:"flex", gap:4, padding:6, borderRadius:999, width:"fit-content", marginBottom:28,
            background: P.card, border:`1px solid ${P.border}`,
            boxShadow:"0 1px 3px rgba(0,0,0,0.04)",
          }}>
            {([
              { key:"overview",   label:"نظرة عامة",       icon:<Activity size={13}/> },
              { key:"employees",  label:"الموظفون",         icon:<Medal size={13}/> },
              { key:"insights",   label:"التنبيهات الذكية", icon:<Lightbulb size={13}/> },
            ] as { key: TabKey; label: string; icon: React.ReactNode }[]).map((tb) => (
              <button key={tb.key} onClick={() => setTab(tb.key)}
                style={{
                  display:"flex", alignItems:"center", gap:6,
                  padding:"8px 18px", borderRadius:999, border:"none",
                  fontSize:12.5, fontWeight:600, cursor:"pointer",
                  transition:"all .18s ease",
                  background: tab === tb.key ? P.primary : "transparent",
                  color:      tab === tb.key ? "#FFFFFF" : P.textMuted,
                  boxShadow:  tab === tb.key ? `0 4px 14px rgba(79,70,255,0.35)` : "none",
                }}>
                {tb.icon}{tb.label}
              </button>
            ))}
          </div>

          {/* ── Loading ── */}
          {loading ? (
            <div className="flex items-center justify-center py-40">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={22} className="animate-spin" style={{ color: P.primary }} />
                <p className="text-sm" style={{ color: t.textSec }}>جاري تحميل البيانات…</p>
              </div>
            </div>
          ) : (
            <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-5">

            {/* ════════════════ OVERVIEW TAB ════════════════ */}
            {tab === "overview" && <>

              {/* ── 2-column layout: left (stats+chart) / right (donut+teams) ── */}
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-start">

                {/* ═══ LEFT COLUMN ═══ */}
                <div className="flex flex-col gap-5">

                  {/* 2×2 stat cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <FeaturedStatCard
                      icon={<TrendingUp size={20}/>}
                      label="صافي الإيراد"
                      value={canRev ? `$${formatNumber(kpi.net,0)}` : "—"}
                      sub={canRev ? "USD · إجمالي محصّل" : undefined}
                      spark={sparkRevenue}
                    />
                    <StatCard
                      icon={<Users size={18}/>}
                      accent={P.primary} accentLight="rgba(79,70,255,0.10)"
                      label="المشتركون النشطون"
                      value={formatNumber(kpi.active)}
                      sub={`من ${formatNumber(kpi.total)} مشترك`}
                      spark={sparkCount}
                    />
                    <StatCard
                      icon={<DollarSign size={18}/>}
                      accent={P.success} accentLight="rgba(34,197,94,0.10)"
                      label="إجمالي المحصّل"
                      value={canRev ? `$${formatNumber(kpi.paid,0)}` : "—"}
                      sub={canRev ? "قبل الاسترداد" : undefined}
                      spark={sparkRevenue}
                    />
                    <StatCard
                      icon={<CreditCard size={18}/>}
                      accent={P.warning} accentLight="rgba(245,158,11,0.10)"
                      label="متبقي أقساط"
                      value={canRev ? `$${formatNumber(kpi.rem,0)}` : "—"}
                      sub={canRev ? "أقساط مستحقة" : undefined}
                      spark={sparkCount}
                    />
                  </div>

                  {/* Monthly trend chart — smooth area with glow */}
                  <Shell
                    title={canRev ? "الإيرادات الشهرية" : "الدفعات الشهرية"}
                    subtitle="آخر 12 شهراً"
                    right={
                      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                        <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color: P.textMuted, fontWeight:500 }}>
                          <span style={{ width:10, height:10, borderRadius:3, background: P.primary, display:"inline-block" }}/>
                          {canRev ? "الإيراد" : "الدفعات"}
                        </span>
                        <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color: P.textMuted, fontWeight:500 }}>
                          <span style={{ width:10, height:10, borderRadius:3, background: P.warning, display:"inline-block" }}/>
                          العدد
                        </span>
                      </div>
                    }
                    height={260}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthly} margin={{ top:12, right:4, left:-16, bottom:0 }}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={P.primary} stopOpacity={0.22}/>
                            <stop offset="100%" stopColor={P.primary} stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="cntGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={P.warning} stopOpacity={0.18}/>
                            <stop offset="100%" stopColor={P.warning} stopOpacity={0}/>
                          </linearGradient>
                          <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="blur"/>
                            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="0" stroke={P.divider} vertical={false}/>
                        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false}/>
                        <YAxis tick={TICK} axisLine={false} tickLine={false}/>
                        <Tooltip content={(p) => <DarkTip {...p} prefix={canRev ? "$" : ""}/>}
                          cursor={{ stroke:`${P.primary}30`, strokeWidth:1 }}/>
                        <Area type="monotone" dataKey={canRev ? "revenue" : "count"}
                          name={canRev ? "الإيراد" : "الدفعات"}
                          stroke={P.primary} strokeWidth={2.5} fill="url(#revGrad)"
                          dot={false} activeDot={{ r:5, fill:P.primary, strokeWidth:2, stroke:"#fff" }}/>
                        <Area type="monotone" dataKey="count" name="العدد"
                          stroke={P.warning} strokeWidth={2} fill="url(#cntGrad)"
                          dot={false} activeDot={{ r:4, fill:P.warning, strokeWidth:2, stroke:"#fff" }}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </Shell>

                  {/* Sources + Payment Methods row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                    {/* Subscription sources */}
                    <Shell title="مصادر الاشتراك" subtitle="من أين جاء المشتركون">
                      <div className="flex flex-col gap-3 pb-1">
                        {sourceData.length === 0 ? (
                          <p className="py-6 text-center text-sm" style={{ color: "var(--jk-muted)" }}>لا بيانات</p>
                        ) : sourceData.map((d, i) => {
                          const pct = sourceData[0]?.value
                            ? Math.round((d.value / sourceData[0].value) * 100) : 0;
                          return (
                            <div key={d.name}>
                              <div className="mb-1.5 flex justify-between text-xs">
                                <span style={{ color: "var(--jk-muted)", fontWeight: 500 }}>{d.name}</span>
                                <span className="font-bold tabular-nums" style={{ color: "var(--jk-text)" }}>{d.value}</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full"
                                style={{ background: "rgba(16,20,26,0.06)" }}>
                                <motion.div
                                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.7, delay: i * 0.07, ease: "easeOut" }}
                                  className="h-full rounded-full"
                                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Shell>

                    {/* Recent payments */}
                    <Shell
                      title="آخر الدفعات"
                      subtitle={`أحدث ${recentPayments.length} دفعة`}
                      right={<Zap size={14} style={{ color: ACC.amber }} />}
                      noPad
                    >
                      <div>
                        {recentPayments.length === 0 ? (
                          <p className="py-10 text-center text-sm" style={{ color: "var(--jk-muted)" }}>لا توجد دفعات</p>
                        ) : recentPayments.slice(0, 6).map((p, i) => (
                          <div key={p.id}
                            className="flex items-center justify-between px-5 py-3"
                            style={{
                              borderTop: i > 0 ? "1px solid rgba(16,20,26,0.05)" : "none",
                              transition: "background .1s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#FAFBFC")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >
                            <div className="min-w-0">
                              {p.subscriberId
                                ? <Link href={`/subscribers/${p.subscriberId}`}
                                    className="text-sm font-semibold block hover:underline truncate"
                                    style={{ color: "var(--jk-text)" }}>
                                    {p.subscriberName || "—"}
                                  </Link>
                                : <p className="text-sm font-semibold truncate" style={{ color: "var(--jk-text)" }}>
                                    {p.subscriberName || "—"}
                                  </p>
                              }
                              <p className="text-xs" style={{ color: "var(--jk-muted)" }}>
                                {p.paymentMethod || "—"} · {toDateStr(p.date).slice(0, 10) || "—"}
                              </p>
                            </div>
                            {canRev && (
                              <span className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums"
                                style={{ background: "rgba(34,197,94,0.10)", color: "#22C55E" }}>
                                ${formatNumber(p.amountUSD || 0, 2)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </Shell>

                  </div>
                </div>
                {/* ═══ END LEFT COLUMN ═══ */}

                {/* ═══ RIGHT COLUMN ═══ */}
                <div className="flex flex-col gap-5">

                  {/* Country distribution donut */}
                  <Shell title="توزيع المشتركين" subtitle="حسب الدولة" height={290}>
                    <div className="flex h-full gap-4">
                      <ResponsiveContainer width="50%" height="100%">
                        <PieChart>
                          <Pie data={countryData} dataKey="value" nameKey="name"
                            cx="50%" cy="50%" innerRadius={52} outerRadius={88}
                            paddingAngle={2} isAnimationActive>
                            {countryData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={0} />
                            ))}
                          </Pie>
                          <Tooltip content={<PieTip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-1 flex-col justify-center gap-2.5 overflow-hidden">
                        {countryData.slice(0, 6).map((d, i) => (
                          <div key={d.name} className="flex items-center gap-2">
                            <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                              background: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="text-xs truncate flex-1" style={{ color: "var(--jk-muted)" }}>{d.name}</span>
                            <span className="text-xs font-bold tabular-nums" style={{ color: "var(--jk-text)" }}>{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Shell>

                  {/* Package distribution */}
                  <Shell title="توزيع الباقات" subtitle="فضية مقابل ذهبية" height={200}>
                    <div className="flex h-full items-center gap-5">
                      <ResponsiveContainer width="45%" height="100%">
                        <PieChart>
                          <Pie data={packageData} dataKey="value" nameKey="name"
                            cx="50%" cy="50%" innerRadius={42} outerRadius={72}
                            paddingAngle={4} isAnimationActive>
                            {packageData.map((d) => (
                              <Cell key={d.name} fill={d.color} strokeWidth={0} />
                            ))}
                          </Pie>
                          <Tooltip content={<PieTip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-1 flex-col gap-4">
                        {packageData.map((d) => {
                          const pct = kpi.total ? Math.round((d.value / kpi.total) * 100) : 0;
                          return (
                            <div key={d.name}>
                              <div className="mb-1.5 flex justify-between text-xs">
                                <span style={{ color: d.color, fontWeight: 700 }}>{d.name}</span>
                                <span className="font-bold tabular-nums" style={{ color: "var(--jk-text)" }}>
                                  {d.value} · {pct}%
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full"
                                style={{ background: "rgba(16,20,26,0.06)" }}>
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%`, background: d.color }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Shell>

                  {/* Team performance */}
                  <motion.div variants={fadeUp} transition={tran}
                    style={{ overflow:"hidden", borderRadius:22, background: P.card, border:`1px solid ${P.border}`,
                      boxShadow:"0 1px 3px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.04)" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"16px 22px 14px", borderBottom:`1px solid ${P.divider}` }}>
                      <div>
                        <p style={{ fontSize:15, fontWeight:800, color: P.textMain, letterSpacing:"-0.015em" }}>أداء الفرق</p>
                        <p style={{ fontSize:12, color: P.textMuted, marginTop:2 }}>المشتركون حسب الفريق</p>
                      </div>
                      <Link href="/admin/teams" style={{
                        fontSize:12, fontWeight:600, padding:"5px 12px", borderRadius:999,
                        background:`rgba(79,70,255,0.08)`, color: P.primary, border:`1px solid rgba(79,70,255,0.18)`,
                        textDecoration:"none", transition:"all .15s ease",
                      }}>إدارة ←</Link>
                    </div>

                    {teamData.length === 0 ? (
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 0" }}>
                        <p style={{ fontSize:13, color: P.textMuted }}>لا توجد فرق</p>
                      </div>
                    ) : (
                      <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:6 }}>
                        {teamData.slice(0,5).map((td, i) => {
                          const colors = [P.primary,"#22C55E","#F59E0B","#EF4444","#8B5CF6"];
                          const color = colors[i % colors.length];
                          const maxSubs = teamData[0]?.["مشتركون"] || 1;
                          const pct = Math.round((td["مشتركون"] / maxSubs) * 100);
                          const inner = (
                            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                  <div style={{ width:30, height:30, borderRadius:9, flexShrink:0,
                                    background:`${color}14`, border:`1px solid ${color}24`,
                                    display:"flex", alignItems:"center", justifyContent:"center",
                                    fontSize:11, fontWeight:800, color }}>{td.name.charAt(0)}</div>
                                  <span style={{ fontSize:13, fontWeight:700, color: P.textMain }}>{td.name}</span>
                                </div>
                                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                                  <span style={{ fontSize:11, color: P.textMuted }}>{td["مشتركون"]} م</span>
                                  <span style={{ fontSize:11, fontWeight:700, color: P.success }}>{td["نشطون"]} ن</span>
                                  {canRev && <span style={{ fontSize:12, fontWeight:800, color: P.textMain, fontVariantNumeric:"tabular-nums" }}>${formatNumber(td["إيراد"],0)}</span>}
                                </div>
                              </div>
                              <div style={{ height:4, background: P.divider, borderRadius:999, overflow:"hidden" }}>
                                <div style={{ height:"100%", borderRadius:999, background: color,
                                  width:`${pct}%`, transition:"width .7s ease" }}/>
                              </div>
                            </div>
                          );
                          return td.id
                            ? <Link key={td.name} href={`/admin/teams/${td.id}`}
                                style={{ display:"block", padding:"10px 8px", borderRadius:14, border:"1px solid transparent",
                                  textDecoration:"none", transition:"all .15s ease" }}
                                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background="#F8F9FF"; el.style.borderColor=`rgba(79,70,255,0.10)`; }}
                                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background="transparent"; el.style.borderColor="transparent"; }}>
                                {inner}
                              </Link>
                            : <div key={td.name} style={{ padding:"10px 8px", borderRadius:14 }}>{inner}</div>;
                        })}
                      </div>
                    )}
                  </motion.div>

                  {/* Payment methods bar */}
                  <Shell title="طرق الدفع" subtitle="عدد الدفعات" height={260}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={methodData} layout="vertical"
                        margin={{ top:4, right:4, left:4, bottom:0 }}>
                        <CartesianGrid strokeDasharray="0" stroke={P.divider} horizontal={false}/>
                        <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} allowDecimals={false}/>
                        <YAxis type="category" dataKey="name" tick={{ ...TICK, fontSize:10 }} axisLine={false} tickLine={false} width={80}/>
                        <Tooltip content={<DarkTip/>} cursor={{ fill:`${P.primary}06` }}/>
                        <Bar dataKey="value" name="الدفعات" radius={[0,6,6,0]} maxBarSize={14}>
                          {methodData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Shell>

                </div>
                {/* ═══ END RIGHT COLUMN ═══ */}

              </div>

            </> /* end overview tab */}

            {/* ════════════════ EMPLOYEES TAB ════════════════ */}
            {tab === "employees" && (
              <motion.div variants={fadeUp} transition={tran} className="space-y-5">
                {/* Export button */}
                {canExport && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => exportEmployeePerformanceCSV(subscribers)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold"
                      style={{ background: "linear-gradient(135deg,#83A2DB,#9DB4D6)" }}>
                      <Download size={13}/> تصدير CSV
                    </button>
                  </div>
                )}

                {empLoading ? (
                  <div className="flex justify-center py-20">
                    <RefreshCw size={20} className="animate-spin" style={{ color: P.primary }}/>
                  </div>
                ) : empPerf.length === 0 ? (
                  <div className="text-center py-20" style={{ color: t.textSec }}>
                    لا توجد بيانات أداء موظفين
                  </div>
                ) : (
                  <>
                    {/* Leaderboard table */}
                    <div className="rounded-[22px] overflow-hidden"
                      style={{ background: "#FFFFFF", border: "1px solid rgba(16,20,26,0.07)", boxShadow: "0 1px 2px rgba(16,20,26,0.04), 0 8px 20px -8px rgba(16,20,26,0.07)" }}>
                      <div className="px-5 py-4 flex items-center gap-2"
                        style={{ borderBottom: "1px solid rgba(16,20,26,0.06)" }}>
                        <Medal size={15} style={{ color: ACC.amber }}/>
                        <p style={{ fontSize: 14.5, fontWeight: 800, color: "var(--jk-text)", letterSpacing: "-0.01em" }}>لوحة الأداء</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ background: "#F7F8FA", borderBottom: "1px solid rgba(16,20,26,0.06)" }}>
                              {["#","الموظف","المشتركون","النشطون","الإيراد USD","التجديدات","الاسترداد","متوسط القيمة"].map((h) => (
                                <th key={h} className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider"
                                  style={{ color: "var(--jk-muted)" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y" style={{ borderColor: t.divider }}>
                            {empPerf.map((emp, i) => {
                              const medal = ["🥇","🥈","🥉"][i];
                              return (
                                <tr key={emp.name} className="transition-colors hover:bg-slate-50">
                                  <td className="px-4 py-3 text-base text-center w-10">{medal ?? <span className="text-xs font-bold" style={{ color: t.textSec }}>{i+1}</span>}</td>
                                  <td className="px-4 py-3">
                                    <span className="font-bold text-sm" style={{ color: t.textPri }}>{emp.name}</span>
                                  </td>
                                  <td className="px-4 py-3 font-bold tabular-nums text-center" style={{ color: t.textPri }}>{emp.subscribers}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                                      style={{ background: `${ACC.emerald}15`, color: ACC.emerald }}>{emp.active}</span>
                                  </td>
                                  <td className="px-4 py-3 tabular-nums font-black" style={{ color: ACC.emerald }}>
                                    {canRev ? `$${formatNumber(emp.revenue, 0)}` : "—"}
                                  </td>
                                  <td className="px-4 py-3 tabular-nums text-center" style={{ color: t.textPri }}>{emp.renewals}</td>
                                  <td className="px-4 py-3 tabular-nums text-center" style={{ color: emp.refunds > 0 ? ACC.rose : t.textSec }}>{emp.refunds}</td>
                                  <td className="px-4 py-3 tabular-nums" style={{ color: t.textSec }}>
                                    {canRev ? `$${formatNumber(emp.avgValue, 0)}` : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Performance bar chart */}
                    {canRev && (
                      <Shell title="مقارنة الإيراد بين الموظفين" height={260}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={empPerf.slice(0,8)} margin={{ top:8, right:8, left:-8, bottom:0 }}>
                            <CartesianGrid strokeDasharray="2 4" stroke="rgba(16,20,26,0.05)" vertical={false}/>
                            <XAxis dataKey="name" tick={TICK} interval={0} angle={-15} textAnchor="end"/>
                            <YAxis tick={TICK}/>
                            <Tooltip content={<DarkTip prefix="$"/>}/>
                            <Bar dataKey="revenue" name="الإيراد" fill={ACC.violet} radius={[4,4,0,0]}/>
                          </BarChart>
                        </ResponsiveContainer>
                      </Shell>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* ════════════════ INSIGHTS TAB ════════════════ */}
            {tab === "insights" && (
              <motion.div variants={fadeUp} transition={tran} className="space-y-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <Lightbulb size={16} style={{ color: ACC.amber }}/>
                  <h3 className="text-base font-bold" style={{ color: t.textPri }}>التنبيهات الذكية</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: `${ACC.amber}18`, color: ACC.amber }}>
                    {insights.length} تنبيه
                  </span>
                </div>

                {metricsLoading ? (
                  <div className="flex justify-center py-20">
                    <RefreshCw size={20} className="animate-spin" style={{ color: P.primary }}/>
                  </div>
                ) : insights.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-20">
                    <CheckCircle2 size={40} className="text-emerald-400 opacity-60"/>
                    <p className="font-bold text-sm" style={{ color: t.textPri }}>كل شيء يسير بشكل جيد!</p>
                    <p className="text-xs" style={{ color: t.textSec }}>لا توجد تنبيهات حالياً</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Critical first */}
                    {(["critical","warning","info","success"] as const).map((level) => {
                      const group = insights.filter((i) => i.level === level);
                      if (!group.length) return null;
                      return (
                        <div key={level} className="space-y-2">
                          {group.map((insight) => (
                            <InsightCard key={insight.id} insight={insight}/>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            </motion.div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
