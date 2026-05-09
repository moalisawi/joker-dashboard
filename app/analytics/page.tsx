"use client";

import { useMemo } from "react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis,
  ResponsiveContainer, AreaChart, Area,
  CartesianGrid, Tooltip,
} from "recharts";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import { useSubscribers } from "@/hooks/useSubscribers";
import { usePayments } from "@/hooks/usePayments";
import { useAuthStore } from "@/store/authStore";
import { formatNumber, ARABIC_MONTHS, RESIDENCE_COUNTRIES, PHONE_COUNTRIES } from "@/lib/utils";
import { Users, DollarSign, TrendingUp, CreditCard, RefreshCw, BarChart3 } from "lucide-react";

/* ─── Palette ────────────────────────────────────────────────────────────── */
const COLORS = [
  "#3b82f6","#10b981","#f59e0b","#8b5cf6",
  "#f97316","#ec4899","#14b8a6","#ef4444",
  "#6366f1","#84cc16","#a855f7","#06b6d4",
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function residenceLabel(v: string) {
  return (
    RESIDENCE_COUNTRIES.find((c) => c.value === v)?.name ||
    PHONE_COUNTRIES.find((c) => c.iso === v)?.name ||
    v || "غير محدد"
  );
}

function topN<T extends { value: number }>(arr: T[], n: number): T[] {
  return [...arr].sort((a, b) => b.value - a.value).slice(0, n);
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function KpiCard({
  icon, label, value, sub, iconBg, iconColor,
}: {
  icon: React.ReactNode; label: string; value: string;
  sub?: string; iconBg: string; iconColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 flex items-center gap-4 border border-[rgba(15,23,42,0.08)] shadow-[0_1px_3px_rgba(15,23,42,0.05),_0_4px_12px_rgba(15,23,42,0.04)]">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-slate-400 tracking-wide uppercase truncate" style={{ fontSize: "0.68rem" }}>
          {label}
        </p>
        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums leading-tight mt-0.5">
          {value}
        </p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ChartCard({
  title, subtitle, accentCls, children, height = 280,
}: {
  title: string; subtitle?: string; accentCls: string;
  children: React.ReactNode; height?: number;
}) {
  return (
    <div
      className={`
        bg-white rounded-2xl overflow-hidden
        border border-t-[3px] ${accentCls}
        border-l-[rgba(15,23,42,0.07)] border-r-[rgba(15,23,42,0.07)] border-b-[rgba(15,23,42,0.07)]
        shadow-[0_1px_3px_rgba(15,23,42,0.05),_0_4px_12px_rgba(15,23,42,0.04)]
        hover:shadow-[0_4px_16px_rgba(15,23,42,0.09),_0_10px_30px_rgba(15,23,42,0.06)]
        transition-shadow duration-200
      `}
    >
      <div className="px-5 py-4 border-b border-slate-100/80">
        <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5" dir="ltr" style={{ height }}>
        {children}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTooltip({ active, payload, label, prefix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white text-xs px-3 py-2.5 rounded-xl shadow-2xl border border-white/10 min-w-[100px]">
      {label && <p className="font-bold text-slate-300 mb-1.5">{label}</p>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color || p.fill || "#3b82f6" }} />
          <span className="tabular-nums">
            {p.name ? `${p.name}: ` : ""}
            {prefix}{formatNumber(p.value as number, prefix ? 2 : 0)}
          </span>
        </p>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-slate-900 text-white text-xs px-3 py-2.5 rounded-xl shadow-2xl border border-white/10">
      <p className="font-bold text-slate-300 mb-1">{p.name}</p>
      <p className="tabular-nums">
        {formatNumber(p.value)} ({p.payload?.percent ? `${(p.payload.percent * 100).toFixed(1)}%` : ""})
      </p>
    </div>
  );
}

const TICK_STYLE = { fontFamily: "Cairo, sans-serif", fontSize: 11, fill: "#94a3b8" };
const GRID_STROKE = "rgba(15,23,42,0.05)";

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const { can } = useAuthStore();
  const canRev = can("canViewRevenue");
  const { subscribers, loading } = useSubscribers();
  const { payments } = usePayments();

  /* KPI totals */
  const kpi = useMemo(() => ({
    total:   subscribers.length,
    net:     subscribers.reduce((s, x) => s + x.netAmountUSD, 0),
    paid:    subscribers.reduce((s, x) => s + x.paidAmountUSD, 0),
    rem:     subscribers.filter((s) => s.subscriptionState !== "withdrawn")
                        .reduce((s, x) => s + x.remainingAmountUSD, 0),
  }), [subscribers]);

  /* Chart 1: subscribers by country (top 10) */
  const countryData = useMemo(() => {
    const map: Record<string, number> = {};
    subscribers.forEach((s) => {
      const k = residenceLabel(s.residence);
      map[k] = (map[k] || 0) + 1;
    });
    return topN(Object.entries(map).map(([name, value]) => ({ name, value })), 10);
  }, [subscribers]);

  /* Chart 2: payments by method */
  const paymentMethodData = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach((p) => {
      const k = p.paymentMethod || "غير محدد";
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [payments]);

  /* Chart 3: subscribers by source (top 8) */
  const sourceData = useMemo(() => {
    const map: Record<string, number> = {};
    subscribers.forEach((s) => {
      const k = s.source || "غير محدد";
      map[k] = (map[k] || 0) + 1;
    });
    return topN(Object.entries(map).map(([name, value]) => ({ name, value })), 8);
  }, [subscribers]);

  /* Chart 4: monthly revenue last 12 months */
  const monthlyRevData = useMemo(() => {
    const revenueMap: Record<string, number> = {};
    const countMap:   Record<string, number> = {};
    payments.forEach((p) => {
      // p.date may be a Firestore Timestamp, a Date, or a YYYY-MM-DD string
      let dateStr: string;
      const raw = p.date as unknown;
      if (typeof raw === "string") {
        dateStr = raw;
      } else if (raw && typeof (raw as { toDate?: () => Date }).toDate === "function") {
        dateStr = (raw as { toDate: () => Date }).toDate().toISOString().split("T")[0];
      } else if (raw instanceof Date) {
        dateStr = raw.toISOString().split("T")[0];
      } else {
        dateStr = "";
      }
      const key = dateStr.slice(0, 7);
      if (key) {
        revenueMap[key] = (revenueMap[key] || 0) + (p.amountUSD || 0);
        countMap[key]   = (countMap[key] || 0) + 1;
      }
    });
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d   = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const mo  = ARABIC_MONTHS[d.getMonth()].slice(0, 3);
      return {
        label: `${mo} ${String(d.getFullYear()).slice(2)}`,
        revenue: +(revenueMap[key] || 0).toFixed(2),
        count:   countMap[key] || 0,
      };
    });
  }, [payments]);

  /* Chart 5: package distribution */
  const packageData = useMemo(() => [
    { name: "فضية", value: subscribers.filter((s) => s.package === "فضية").length },
    { name: "ذهبية", value: subscribers.filter((s) => s.package === "ذهبية").length },
  ], [subscribers]);

  /* Chart 6: team performance */
  const teamData = useMemo(() => {
    const employees = ["حنان", "ميار", "ميدو"];
    return employees.map((emp) => {
      const data = subscribers.filter((s) => s.convincedBy === emp);
      return {
        name: emp,
        مشتركون: data.length,
        إيراد: +data.reduce((s, x) => s + x.netAmountUSD, 0).toFixed(2),
      };
    });
  }, [subscribers]);

  const lastUpdate = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

  return (
    <ProtectedLayout>
      <div className="p-5 md:p-8 max-w-screen-2xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-600/10">
                <BarChart3 size={16} className="text-blue-600" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">التحليلات</h1>
            </div>
            <p className="text-slate-400 text-sm font-medium">
              {formatNumber(kpi.total)} مشترك · آخر تحديث {lastUpdate}
            </p>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw size={24} className="text-blue-500 animate-spin" />
              <p className="text-slate-400 text-sm">جاري تحميل البيانات...</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
              <KpiCard
                icon={<Users size={20} />}
                iconBg="bg-blue-50" iconColor="text-blue-600"
                label="إجمالي المشتركين"
                value={formatNumber(kpi.total)}
              />
              <KpiCard
                icon={<TrendingUp size={20} />}
                iconBg="bg-emerald-50" iconColor="text-emerald-600"
                label="صافي الإيراد"
                value={canRev ? `$${formatNumber(kpi.net, 2)}` : "—"}
              />
              <KpiCard
                icon={<DollarSign size={20} />}
                iconBg="bg-sky-50" iconColor="text-sky-600"
                label="إجمالي المحصّل"
                value={canRev ? `$${formatNumber(kpi.paid, 2)}` : "—"}
              />
              <KpiCard
                icon={<CreditCard size={20} />}
                iconBg="bg-amber-50" iconColor="text-amber-600"
                label="متبقي أقساط"
                value={canRev ? `$${formatNumber(kpi.rem, 2)}` : "—"}
              />
            </div>

            {/* ── Charts Row 1 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

              {/* Country Pie */}
              <ChartCard
                title="المشتركون حسب الدولة"
                subtitle="توزيع أعلى 10 دول إقامة"
                accentCls="border-t-blue-500"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={countryData}
                      dataKey="value"
                      nameKey="name"
                      cx="40%" cy="50%"
                      outerRadius={100}
                      paddingAngle={2}
                      isAnimationActive
                    >
                      {countryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Payment Methods Bar */}
              <ChartCard
                title="الدفعات حسب طريقة الدفع"
                subtitle="عدد الدفعات لكل طريقة"
                accentCls="border-t-emerald-500"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentMethodData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="name" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(15,23,42,0.04)" }} />
                    <Bar dataKey="value" name="الدفعات" radius={[6, 6, 0, 0]}>
                      {paymentMethodData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Source Doughnut */}
              <ChartCard
                title="المشتركون حسب المصدر"
                subtitle="من أين جاء المشتركون (أعلى 8)"
                accentCls="border-t-violet-500"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceData}
                      dataKey="value"
                      nameKey="name"
                      cx="40%" cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      isAnimationActive
                    >
                      {sourceData.map((_, i) => (
                        <Cell key={i} fill={COLORS[(i + 4) % COLORS.length]} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Monthly Revenue Area */}
              <ChartCard
                title={canRev ? "الإيرادات الشهرية (USD)" : "الدفعات الشهرية"}
                subtitle="آخر 12 شهر"
                accentCls="border-t-orange-500"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyRevData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f97316" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={(props) => <DarkTooltip {...props} prefix={canRev ? "$" : ""} />}
                      cursor={{ stroke: "rgba(249,115,22,0.3)", strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey={canRev ? "revenue" : "count"}
                      name={canRev ? "الإيراد" : "الدفعات"}
                      stroke="#f97316"
                      strokeWidth={2.5}
                      fill="url(#revGrad)"
                      dot={false}
                      activeDot={{ r: 5, fill: "#f97316", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* ── Charts Row 2 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">

              {/* Package Doughnut */}
              <ChartCard
                title="توزيع الباقات"
                subtitle="فضية مقابل ذهبية"
                accentCls="border-t-amber-500"
                height={240}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={packageData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={4}
                      isAnimationActive
                    >
                      <Cell fill="#94a3b8" strokeWidth={0} />
                      <Cell fill="#f59e0b" strokeWidth={0} />
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Team Performance Bar */}
              <ChartCard
                title="أداء الفريق (عدد المشتركين)"
                subtitle="توزيع المشتركين على الموظفين"
                accentCls="border-t-teal-500"
                height={240}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="name" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(15,23,42,0.04)" }} />
                    <Bar dataKey="مشتركون" radius={[8, 8, 0, 0]}>
                      <Cell fill="#8b5cf6" />
                      <Cell fill="#14b8a6" />
                      <Cell fill="#f97316" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </ProtectedLayout>
  );
}
