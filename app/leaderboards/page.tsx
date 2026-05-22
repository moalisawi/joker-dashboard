"use client";

import { motion } from "framer-motion";
import ProtectedLayout  from "@/components/layout/ProtectedLayout";
import PageHeader       from "@/components/layout/PageHeader";
import LeaderboardCard  from "@/features/leaderboards/components/LeaderboardCard";
import PeriodSelector   from "@/features/leaderboards/components/PeriodSelector";
import { useLeaderboards } from "@/features/leaderboards/hooks/useLeaderboards";
import { useAuthStore } from "@/store/authStore";
import { formatNumber } from "@/lib/utils";
import {
  Trophy, Users, DollarSign, Target,
  RefreshCw, TrendingUp, AlertCircle,
} from "lucide-react";

const ACC = { indigo:"#5B5FEF", emerald:"#5B5FEF", amber:"#F59E0B", rose:"#EF4444" };
const tran = { duration:0.3, ease:"easeOut" } as const;
const fadeUp = { initial:{ opacity:0, y:12 }, animate:{ opacity:1, y:0, transition:tran } };
const stagger = { animate:{ transition:{ staggerChildren:0.07 } } };

function pct(v: number) { return `${Math.round(v * 100)}%`; }

export default function LeaderboardsPage() {
  const { can, user }                          = useAuthStore();
  const canRev                                 = can("canViewRevenue");
  const { data, period, setPeriod, isLoading } = useLeaderboards();

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
        <div className="mx-auto max-w-6xl px-4 py-7 md:px-8 space-y-7">

          {/* ── Header ── */}
          <PageHeader
            title="لوحة المتصدرين"
            subtitle="أداء الموظفين والفرق حسب الفترة الزمنية"
            actions={<PeriodSelector value={period} onChange={setPeriod}/>}
          />

          {/* ── Sales Leaderboards ── */}
          <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-4">
            <motion.div {...fadeUp}>
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2"
                style={{ color:"var(--text-primary)" }}>
                <Users size={14} style={{ color:ACC.indigo }}/>
                قسم المبيعات
              </h2>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-3">
              <motion.div {...fadeUp}>
                <LeaderboardCard
                  title="الأعلى أرباحًا"
                  icon={<DollarSign size={14}/>}
                  accent={ACC.emerald}
                  entries={data?.salesByRevenue ?? []}
                  format={(v) => canRev ? `$${formatNumber(v, 0)}` : "—"}
                  subFormat={(v) => String(v)}
                  subLabel="مشترك:"
                  linkPrefix="/sales"
                  isLoading={isLoading}
                />
              </motion.div>

              <motion.div {...fadeUp}>
                <LeaderboardCard
                  title="الأكثر مشتركين"
                  icon={<Users size={14}/>}
                  accent={ACC.indigo}
                  entries={data?.salesBySubscribers ?? []}
                  format={(v) => String(v)}
                  subFormat={(v) => String(v)}
                  subLabel="نشط:"
                  linkPrefix="/sales"
                  isLoading={isLoading}
                />
              </motion.div>

              <motion.div {...fadeUp}>
                <LeaderboardCard
                  title="أعلى معدل تحويل"
                  icon={<Target size={14}/>}
                  accent={ACC.amber}
                  entries={data?.salesByConversion ?? []}
                  format={(v) => pct(v)}
                  subFormat={(v) => String(v)}
                  subLabel="مشترك:"
                  linkPrefix="/sales"
                  isLoading={isLoading}
                />
              </motion.div>
            </div>
          </motion.div>

          {/* ── Divider ── */}
          <div className="h-px" style={{ background:"var(--border)" }}/>

          {/* ── Teams Leaderboards ── */}
          <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-4">
            <motion.div {...fadeUp}>
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2"
                style={{ color:"var(--text-primary)" }}>
                <TrendingUp size={14} style={{ color:ACC.emerald }}/>
                فرق المتابعة
              </h2>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-3">
              <motion.div {...fadeUp}>
                <LeaderboardCard
                  title="الأكثر نشاطًا"
                  icon={<Users size={14}/>}
                  accent={ACC.emerald}
                  entries={data?.teamsByActive ?? []}
                  format={(v) => String(v)}
                  subLabel="مشترك"
                  isLoading={isLoading}
                />
              </motion.div>

              <motion.div {...fadeUp}>
                <LeaderboardCard
                  title="الأكثر تجديدات"
                  icon={<RefreshCw size={14}/>}
                  accent={ACC.indigo}
                  entries={data?.teamsByRenewals ?? []}
                  format={(v) => String(v)}
                  subLabel="تجديد"
                  isLoading={isLoading}
                />
              </motion.div>

              <motion.div {...fadeUp}>
                <LeaderboardCard
                  title="أعلى احتفاظ"
                  icon={<TrendingUp size={14}/>}
                  accent={ACC.amber}
                  entries={data?.teamsByRetention ?? []}
                  format={(v) => pct(v)}
                  isLoading={isLoading}
                />
              </motion.div>
            </div>
          </motion.div>

          {/* ── Empty state for no data period ── */}
          {!isLoading && data && (
            Object.values(data).every((arr) => arr.length === 0)
          ) && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Trophy size={40} style={{ color:"var(--text-muted)", opacity:0.4 }}/>
              <p className="text-sm font-semibold" style={{ color:"var(--text-muted)" }}>
                لا توجد بيانات لهذه الفترة
              </p>
            </div>
          )}

        </div>
      </div>
    </ProtectedLayout>
  );
}
