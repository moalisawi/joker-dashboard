"use client";

import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ProtectedLayout          from "@/components/layout/ProtectedLayout";
import SalesMonthlyTrendChart   from "@/features/sales/components/SalesMonthlyTrendChart";
import SalesSubscriberList      from "@/features/sales/components/SalesSubscriberList";
import { useSalesEmployeeDetail } from "@/features/sales/hooks/useSalesEmployeeDetail";
import { useAuthStore }         from "@/store/authStore";
import { formatNumber }         from "@/lib/utils";
import {
  ArrowRight, Users, DollarSign, TrendingUp,
  RefreshCw, Target, AlertCircle,
} from "lucide-react";

const ACC = { indigo:"#5B5FEF", emerald:"#5B5FEF", amber:"#F59E0B", rose:"#EF4444", sky:"#3B82F6" };
const tran = { duration:0.32, ease:"easeOut" } as const;
const stagger = { animate:{ transition:{ staggerChildren:0.06 } } };
const fadeUp = { initial:{ opacity:0, y:14 }, animate:{ opacity:1, y:0, transition:tran } };

function Kpi({ label, value, sub, accent, icon }: {
  label: string; value: string; sub?: string; accent: string; icon: React.ReactNode;
}) {
  return (
    <motion.div {...fadeUp}
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
      <div className="h-10 w-10 flex items-center justify-center rounded-xl shrink-0"
        style={{ background:`${accent}18`, border:`1px solid ${accent}28` }}>
        <span style={{ color:accent }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide"
          style={{ color:"var(--text-muted)" }}>{label}</p>
        <p className="text-lg font-black tabular-nums" style={{ color:"var(--text-primary)" }}>{value}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color:"var(--text-muted)" }}>{sub}</p>}
      </div>
    </motion.div>
  );
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0,2).join("").toUpperCase() || "?";
}

export default function SalesEmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const uid    = typeof params.employeeId === "string" ? params.employeeId : "";

  const { can, user }                      = useAuthStore();
  const canRev                             = can("canViewRevenue");
  const { metrics, subscribers, isLoading } = useSalesEmployeeDetail(uid);

  const canView = user?.role === "owner" || user?.role === "admin";
  if (!canView) {
    return (
      <ProtectedLayout>
        <div className="min-h-full flex flex-col items-center justify-center gap-3"
          style={{ background:"var(--page-bg)" }}>
          <AlertCircle size={36} style={{ color:ACC.rose }}/>
          <p className="font-bold" style={{ color:"var(--text-primary)" }}>غير مصرح</p>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="min-h-full" style={{ background:"var(--page-bg)" }}>
        <div className="mx-auto max-w-5xl px-4 py-7 md:px-8">
          <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-6">

            {/* ── Back ── */}
            <motion.div {...fadeUp}>
              <button onClick={() => router.back()}
                className="flex items-center gap-2 text-sm font-medium"
                style={{ color:"var(--text-muted)" }}>
                <ArrowRight size={15}/>العودة
              </button>
            </motion.div>

            {/* ── Profile header ── */}
            {isLoading ? (
              <div className="animate-pulse h-32 rounded-2xl" style={{ background:"var(--surface)" }}/>
            ) : !metrics ? (
              <div className="flex flex-col items-center gap-3 py-20">
                <AlertCircle size={36} style={{ color:ACC.rose }}/>
                <p style={{ color:"var(--text-primary)" }}>الموظف غير موجود</p>
              </div>
            ) : (
              <>
                <motion.div {...fadeUp}
                  className="rounded-2xl overflow-hidden"
                  style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
                  <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
                    <div className="h-20 w-20 rounded-2xl flex items-center justify-center
                      text-2xl font-black text-white shrink-0"
                      style={{ background:`linear-gradient(135deg,${ACC.indigo},${ACC.amber})` }}>
                      {initials(metrics.name)}
                    </div>
                    <div>
                      <h1 className="text-xl font-black" style={{ color:"var(--text-primary)" }}>
                        {metrics.name}
                      </h1>
                      <p className="text-sm mt-0.5" style={{ color:"var(--text-muted)" }}>
                        {metrics.email}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                          style={{ background:`${ACC.indigo}15`, color:ACC.indigo, border:`1px solid ${ACC.indigo}28` }}>
                          موظف مبيعات
                        </span>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                          style={{ background:`${ACC.emerald}15`, color:ACC.emerald, border:`1px solid ${ACC.emerald}28` }}>
                          {metrics.active} مشترك نشط
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* ── KPI strip ── */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  <Kpi label="المشتركون" value={String(metrics.subscribers)}
                    accent={ACC.indigo} icon={<Users size={16}/>}/>
                  <Kpi label="نشط" value={String(metrics.active)}
                    accent={ACC.emerald} icon={<TrendingUp size={16}/>}/>
                  <Kpi label="التحويل" value={`${Math.round(metrics.conversionRate * 100)}%`}
                    accent={metrics.conversionRate >= 0.7 ? ACC.emerald : metrics.conversionRate >= 0.4 ? ACC.amber : ACC.rose}
                    icon={<Target size={16}/>}/>
                  <Kpi label="الأرباح"
                    value={canRev ? `$${formatNumber(metrics.revenue, 0)}` : "—"}
                    sub={canRev ? `متوسط $${formatNumber(metrics.avgValue, 0)}` : undefined}
                    accent={ACC.amber} icon={<DollarSign size={16}/>}/>
                  <Kpi label="الدخل الأولي"
                    value={canRev ? `$${formatNumber(metrics.initialRevenue, 0)}` : "—"}
                    accent={ACC.sky ?? "#3B82F6"} icon={<DollarSign size={16}/>}/>
                  <Kpi label="التجديدات" value={String(metrics.renewals)}
                    accent={ACC.rose} icon={<RefreshCw size={16}/>}/>
                </div>

                {/* ── Trend chart ── */}
                <motion.div {...fadeUp}
                  className="rounded-2xl overflow-hidden"
                  style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
                  <div className="px-5 py-4 border-b" style={{ borderColor:"var(--border)" }}>
                    <h2 className="text-sm font-bold" style={{ color:"var(--text-primary)" }}>
                      الاكتساب الشهري (آخر 6 أشهر)
                    </h2>
                  </div>
                  <div className="p-5">
                    <SalesMonthlyTrendChart data={metrics.trend} canRev={canRev} height={220}/>
                  </div>
                </motion.div>

                {/* ── Conversion bar detail ── */}
                <motion.div {...fadeUp}
                  className="rounded-2xl p-5"
                  style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold" style={{ color:"var(--text-primary)" }}>
                      معدل التحويل
                    </h2>
                    <span className="text-lg font-black"
                      style={{ color: metrics.conversionRate >= 0.7 ? ACC.emerald : metrics.conversionRate >= 0.4 ? ACC.amber : ACC.rose }}>
                      {Math.round(metrics.conversionRate * 100)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background:"var(--surface-2)" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, metrics.conversionRate * 100)}%`,
                        background: metrics.conversionRate >= 0.7 ? ACC.emerald : metrics.conversionRate >= 0.4 ? ACC.amber : ACC.rose,
                      }}/>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px]"
                    style={{ color:"var(--text-muted)" }}>
                    <span>{metrics.active} نشط من {metrics.subscribers}</span>
                    <span>{metrics.refunds} استرداد</span>
                  </div>
                </motion.div>

                {/* ── Subscribers list ── */}
                <motion.div {...fadeUp}>
                  <SalesSubscriberList subscribers={subscribers} canRev={canRev}/>
                </motion.div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
