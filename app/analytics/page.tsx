"use client";
export const dynamic = "force-dynamic";

import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import { useSubscribers } from "@/hooks/useSubscribers";
import { usePayments } from "@/hooks/usePayments";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { formatNumber, ARABIC_MONTHS, RESIDENCE_COUNTRIES, PHONE_COUNTRIES } from "@/lib/utils";
import { TEAMS } from "@/lib/permissions";
import Link from "next/link";
import {
  Users, DollarSign, TrendingUp, CreditCard,
  RefreshCw, ArrowUpRight, Activity, Zap,
} from "lucide-react";

// ── Theme tokens ──────────────────────────────────────────────────────────────
const LIGHT = {
  bg:         "var(--page-bg)",
  card:       "var(--surface)",
  cardBorder: "rgba(15,23,42,0.08)",
  cardShadow: "0 1px 3px rgba(15,23,42,0.05), 0 4px 12px rgba(15,23,42,0.04)",
  headerBg:   "rgba(255,255,255,0.7)",
  divider:    "rgba(15,23,42,0.07)",
  textPri:    "var(--text-primary)",
  textSec:    "#64748b",
  textMut:    "#94a3b8",
  grid:       "rgba(15,23,42,0.05)",
  tick:       "#94a3b8",
  tooltip:    "#0f172a",
  glow:       false,
};

const DARK = {
  bg:         "#070c18",
  card:       "rgba(255,255,255,0.035)",
  cardBorder: "rgba(255,255,255,0.07)",
  cardShadow: "none",
  headerBg:   "rgba(255,255,255,0.03)",
  divider:    "rgba(255,255,255,0.07)",
  textPri:    "#f1f5f9",
  textSec:    "#64748b",
  textMut:    "#334155",
  grid:       "rgba(255,255,255,0.04)",
  tick:       "#475569",
  tooltip:    "#0f172a",
  glow:       true,
};

const CHART_COLORS = [
  "#6366f1","#10b981","#f59e0b","#f43f5e",
  "#38bdf8","#8b5cf6","#14b8a6","#f97316","#a3e635","#e879f9",
];

const ACC = {
  indigo:  "#6366f1",
  emerald: "#10b981",
  sky:     "#38bdf8",
  amber:   "#f59e0b",
  violet:  "#8b5cf6",
  rose:    "#f43f5e",
  teal:    "#14b8a6",
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
    <div className="rounded-xl border px-3 py-2.5 text-xs shadow-2xl"
      style={{ background: "#0f172a", borderColor: "rgba(255,255,255,0.08)", minWidth: 120 }}>
      {lbl && <p className="mb-1.5 font-semibold text-slate-400">{lbl}</p>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5 tabular-nums text-white">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color || p.fill }} />
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
    <div className="rounded-xl border px-3 py-2.5 text-xs shadow-2xl"
      style={{ background: "#0f172a", borderColor: "rgba(255,255,255,0.08)" }}>
      <p className="mb-1 font-semibold text-slate-400">{p.name}</p>
      <p className="tabular-nums text-white">
        {formatNumber(p.value)}{p.payload?.percent ? ` · ${(p.payload.percent * 100).toFixed(1)}%` : ""}
      </p>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  icon, label: lbl, value, sub, accent, spark, t,
}: {
  icon: React.ReactNode; label: string; value: string;
  sub?: string; accent: string; spark: number[];
  t: typeof LIGHT;
}) {
  const sparkData = spark.map((v) => ({ v }));
  return (
    <motion.div variants={fadeUp} transition={tran}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
      className="relative overflow-hidden rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: t.card, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardShadow }}>

      {t.glow && (
        <div className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full opacity-10 blur-2xl"
          style={{ background: accent }} />
      )}

      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${accent}18`, border: `1px solid ${accent}28` }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
        <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: `${ACC.emerald}15`, color: ACC.emerald }}>
          <ArrowUpRight size={10} />نمو
        </span>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: t.textMut }}>
          {lbl}
        </p>
        <p className="mt-1 text-2xl font-black tabular-nums tracking-tight" style={{ color: t.textPri }}>
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs" style={{ color: t.textSec }}>{sub}</p>}
      </div>

      <div className="h-10" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
            <defs>
              <linearGradient id={`sg${lbl}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={accent} stopOpacity={t.glow ? 0.3 : 0.15} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={1.5}
              fill={`url(#sg${lbl})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// ── Chart Shell ───────────────────────────────────────────────────────────────
function Shell({
  title, subtitle, accent, height = 300, children, t,
}: {
  title: string; subtitle?: string; accent?: string;
  height?: number; children: React.ReactNode; t: typeof LIGHT;
}) {
  return (
    <motion.div variants={fadeUp} transition={tran}
      className="relative overflow-hidden rounded-2xl"
      style={{ background: t.card, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardShadow }}>
      {accent && t.glow && (
        <div className="pointer-events-none absolute -top-12 left-1/2 h-32 w-48 -translate-x-1/2 rounded-full opacity-[0.07] blur-3xl"
          style={{ background: accent }} />
      )}
      <div className="flex items-center justify-between border-b px-5 py-4"
        style={{ borderColor: t.divider }}>
        <div>
          <h3 className="text-sm font-bold" style={{ color: t.textPri }}>{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs" style={{ color: t.textSec }}>{subtitle}</p>}
        </div>
        {accent && (
          <div className="h-2 w-2 rounded-full" style={{ background: accent }} />
        )}
      </div>
      <div className="p-5" dir="ltr" style={{ height }}>
        {children}
      </div>
    </motion.div>
  );
}

// ── Legend Pill ───────────────────────────────────────────────────────────────
function LegendPill({ color, label: lbl, value, t }: { color: string; label: string; value: number; t: typeof LIGHT }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="text-xs" style={{ color: t.textSec }}>{lbl}</span>
      <span className="ml-auto text-xs font-bold tabular-nums" style={{ color: t.textPri }}>{value}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { can }  = useAuthStore();
  const { dark } = useThemeStore();
  const canRev   = can("canViewRevenue");
  const t        = dark ? DARK : LIGHT;

  const { subscribers, loading } = useSubscribers();
  const { payments }             = usePayments();

  const TICK = { fontFamily: "inherit", fontSize: 11, fill: t.tick };

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
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d   = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return {
        label:   ARABIC_MONTHS[d.getMonth()].slice(0, 3),
        revenue: +(revMap[key] || 0).toFixed(2),
        count:   cntMap[key] || 0,
      };
    });
  }, [payments]);

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

  const teamData = useMemo(() =>
    TEAMS.map((team) => {
      const group = subscribers.filter((s) => s.team === team || s.convincedBy === team);
      return {
        name:    team,
        مشتركون: group.length,
        إيراد:   +group.reduce((s, x) => s + (x.netAmountUSD || 0), 0).toFixed(0),
      };
    }), [subscribers]);

  const recentPayments = useMemo(() => [...payments].slice(0, 8), [payments]);
  const sparkRevenue   = monthly.map((m) => m.revenue);
  const sparkCount     = monthly.map((m) => m.count);

  const now = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

  return (
    <ProtectedLayout>
      <div className="min-h-full transition-colors duration-300" style={{ background: t.bg }}>
        <div className="mx-auto max-w-screen-2xl p-5 md:p-7 lg:p-8">

          {/* ── Header ── */}
          <motion.div initial="hidden" animate="show" variants={stagger}
            className="mb-8 flex items-center justify-between">
            <motion.div variants={fadeUp} transition={tran}>
              <div className="mb-1 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: `${ACC.indigo}18`, border: `1px solid ${ACC.indigo}28` }}>
                  <Activity size={16} style={{ color: ACC.indigo }} />
                </div>
                <h1 className="text-xl font-black tracking-tight" style={{ color: t.textPri }}>
                  لوحة التحليلات
                </h1>
                <span className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                  style={{ background: `${ACC.emerald}12`, borderColor: `${ACC.emerald}25`, color: ACC.emerald }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  مباشر
                </span>
              </div>
              <p className="text-sm" style={{ color: t.textSec }}>
                {formatNumber(kpi.total)} مشترك · آخر تحديث {now}
              </p>
            </motion.div>
          </motion.div>

          {/* ── Loading ── */}
          {loading ? (
            <div className="flex items-center justify-center py-40">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={22} className="animate-spin" style={{ color: ACC.indigo }} />
                <p className="text-sm" style={{ color: t.textSec }}>جاري تحميل البيانات…</p>
              </div>
            </div>
          ) : (
            <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-5">

              {/* ── KPI Cards ── */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard t={t} icon={<Users size={18} />} accent={ACC.indigo}
                  label="إجمالي المشتركين" value={formatNumber(kpi.total)}
                  sub={`${kpi.active} نشط · ${kpi.withdrawn} منسحب`} spark={sparkCount} />
                <KpiCard t={t} icon={<TrendingUp size={18} />} accent={ACC.emerald}
                  label="صافي الإيراد"
                  value={canRev ? `$${formatNumber(kpi.net, 0)}` : "—"}
                  sub={canRev ? "USD · محصّل فعلياً" : undefined} spark={sparkRevenue} />
                <KpiCard t={t} icon={<DollarSign size={18} />} accent={ACC.sky}
                  label="إجمالي المحصّل"
                  value={canRev ? `$${formatNumber(kpi.paid, 0)}` : "—"}
                  sub={canRev ? "قبل الاسترداد" : undefined} spark={sparkRevenue} />
                <KpiCard t={t} icon={<CreditCard size={18} />} accent={ACC.amber}
                  label="متبقي أقساط"
                  value={canRev ? `$${formatNumber(kpi.rem, 0)}` : "—"}
                  sub={canRev ? "أقساط مستحقة" : undefined} spark={sparkCount} />
              </div>

              {/* ── Revenue Area ── */}
              <Shell t={t} title={canRev ? "الإيرادات الشهرية (USD)" : "الدفعات الشهرية"}
                subtitle="آخر 12 شهراً" accent={ACC.indigo} height={260}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={ACC.indigo} stopOpacity={dark ? 0.25 : 0.12} />
                        <stop offset="100%" stopColor={ACC.indigo} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                    <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={TICK} axisLine={false} tickLine={false} />
                    <Tooltip content={(p) => <DarkTip {...p} prefix={canRev ? "$" : ""} />}
                      cursor={{ stroke: `${ACC.indigo}50`, strokeWidth: 1 }} />
                    <Area type="monotone" dataKey={canRev ? "revenue" : "count"}
                      name={canRev ? "الإيراد" : "الدفعات"}
                      stroke={ACC.indigo} strokeWidth={2} fill="url(#revGrad)"
                      dot={false} activeDot={{ r: 4, fill: ACC.indigo, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Shell>

              {/* ── Country + Methods ── */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Shell t={t} title="المشتركون حسب الدولة" subtitle="أعلى 8 دول" accent={ACC.sky} height={320}>
                  <div className="flex h-full gap-4">
                    <ResponsiveContainer width="55%" height="100%">
                      <PieChart>
                        <Pie data={countryData} dataKey="value" nameKey="name"
                          cx="50%" cy="50%" innerRadius={58} outerRadius={95}
                          paddingAngle={2} isAnimationActive>
                          {countryData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={0} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-1 flex-col justify-center gap-2 overflow-hidden">
                      {countryData.slice(0, 7).map((d, i) => (
                        <LegendPill key={d.name} t={t}
                          color={CHART_COLORS[i % CHART_COLORS.length]}
                          label={d.name} value={d.value} />
                      ))}
                    </div>
                  </div>
                </Shell>

                <Shell t={t} title="طرق الدفع" subtitle="عدد الدفعات لكل طريقة" accent={ACC.emerald} height={320}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={methodData} layout="vertical"
                      margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
                      <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={TICK} axisLine={false} tickLine={false} width={90} />
                      <Tooltip content={<DarkTip />} cursor={{ fill: "rgba(128,128,128,0.05)" }} />
                      <Bar dataKey="value" name="الدفعات" radius={[0, 6, 6, 0]} maxBarSize={18}>
                        {methodData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Shell>
              </div>

              {/* ── Package + Team ── */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Shell t={t} title="توزيع الباقات" subtitle="فضية مقابل ذهبية" height={260}>
                  <div className="flex h-full items-center gap-6">
                    <ResponsiveContainer width="55%" height="100%">
                      <PieChart>
                        <Pie data={packageData} dataKey="value" nameKey="name"
                          cx="50%" cy="50%" innerRadius={52} outerRadius={88}
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
                              <span style={{ color: d.color }} className="font-semibold">{d.name}</span>
                              <span className="font-bold tabular-nums" style={{ color: t.textPri }}>
                                {d.value} · {pct}%
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: t.cardBorder }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, background: d.color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Shell>

                <Shell t={t} title="أداء الفريق" subtitle="عدد المشتركين لكل فريق" accent={ACC.violet} height={260}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teamData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                      <XAxis dataKey="name" tick={{ ...TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<DarkTip />} cursor={{ fill: "rgba(128,128,128,0.05)" }} />
                      <Bar dataKey="مشتركون" radius={[6, 6, 0, 0]} maxBarSize={40}>
                        {teamData.map((_, i) => (
                          <Cell key={i} fill={[ACC.violet, ACC.sky, ACC.teal][i % 3]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Shell>
              </div>

              {/* ── Source + Recent Payments ── */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

                {/* Source bars */}
                <motion.div variants={fadeUp} transition={tran}
                  className="overflow-hidden rounded-2xl lg:col-span-2"
                  style={{ background: t.card, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardShadow }}>
                  <div className="border-b px-5 py-4" style={{ borderColor: t.divider }}>
                    <h3 className="text-sm font-bold" style={{ color: t.textPri }}>مصادر الاشتراك</h3>
                    <p className="mt-0.5 text-xs" style={{ color: t.textSec }}>من أين جاء المشتركون</p>
                  </div>
                  <div className="space-y-3 p-5">
                    {sourceData.length === 0 ? (
                      <p className="py-6 text-center text-sm" style={{ color: t.textSec }}>لا بيانات</p>
                    ) : sourceData.map((d, i) => {
                      const pct = sourceData[0]?.value
                        ? Math.round((d.value / sourceData[0].value) * 100) : 0;
                      return (
                        <div key={d.name}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span style={{ color: t.textSec }}>{d.name}</span>
                            <span className="font-bold tabular-nums" style={{ color: t.textPri }}>{d.value}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: t.cardBorder }}>
                            <motion.div
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, delay: i * 0.08, ease: "easeOut" }}
                              className="h-full rounded-full"
                              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Recent payments */}
                <motion.div variants={fadeUp} transition={tran}
                  className="overflow-hidden rounded-2xl lg:col-span-3"
                  style={{ background: t.card, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardShadow }}>
                  <div className="flex items-center justify-between border-b px-5 py-4"
                    style={{ borderColor: t.divider }}>
                    <div>
                      <h3 className="text-sm font-bold" style={{ color: t.textPri }}>آخر الدفعات</h3>
                      <p className="mt-0.5 text-xs" style={{ color: t.textSec }}>أحدث {recentPayments.length} دفعة</p>
                    </div>
                    <Zap size={14} style={{ color: ACC.amber }} />
                  </div>
                  <div>
                    {recentPayments.length === 0 ? (
                      <p className="py-10 text-center text-sm" style={{ color: t.textSec }}>لا توجد دفعات</p>
                    ) : recentPayments.map((p, i) => (
                      <div key={p.id}
                        className="flex items-center justify-between px-5 py-3 transition-colors"
                        style={{ borderTop: i > 0 ? `1px solid ${t.divider}` : "none" }}>
                        <div className="min-w-0">
                          {p.subscriberId
                            ? <Link href={`/subscribers/${p.subscriberId}`}
                                className="truncate text-sm font-semibold block hover:underline"
                                style={{ color: t.textPri }}>
                                {p.subscriberName || "—"}
                              </Link>
                            : <p className="truncate text-sm font-semibold" style={{ color: t.textPri }}>
                                {p.subscriberName || "—"}
                              </p>
                          }
                          <p className="text-xs" style={{ color: t.textSec }}>
                            {p.paymentMethod || "—"} · {toDateStr(p.date).slice(0, 10) || "—"}
                          </p>
                        </div>
                        {canRev && (
                          <span className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums"
                            style={{ background: `${ACC.emerald}12`, color: ACC.emerald }}>
                            ${formatNumber(p.amountUSD || 0, 2)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>

            </motion.div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
