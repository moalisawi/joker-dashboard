"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ProtectedLayout     from "@/components/layout/ProtectedLayout";
import PageHeader          from "@/components/layout/PageHeader";
import SalesEmployeeCard   from "@/features/sales/components/SalesEmployeeCard";
import { useSalesEmployees } from "@/features/sales/hooks/useSalesEmployees";
import { useAuthStore }    from "@/store/authStore";
import { formatNumber }    from "@/lib/utils";
import {
  Users, DollarSign, TrendingUp, RefreshCw,
  LayoutGrid, List, AlertCircle,
} from "lucide-react";

const ACC = { indigo:"#83A2DB", emerald:"#83A2DB", amber:"#E8B570", rose:"#CE6969" };
const tran = { duration:0.32, ease:"easeOut" } as const;

function KpiStrip({ label, value, accent, icon }: {
  label: string; value: string; accent: string; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
      <div className="h-10 w-10 flex items-center justify-center rounded-xl shrink-0"
        style={{ background:`${accent}18`, border:`1px solid ${accent}28` }}>
        <span style={{ color:accent }}>{icon}</span>
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color:"var(--text-muted)" }}>{label}</p>
        <p className="text-lg font-black tabular-nums" style={{ color:"var(--text-primary)" }}>{value}</p>
      </div>
    </div>
  );
}

export default function SalesListPage() {
  const { can, user }            = useAuthStore();
  const canRev                   = can("canViewRevenue");
  const { data, isLoading }      = useSalesEmployees();
  const [view, setView]          = useState<"grid"|"table">("grid");

  const totalSubs    = data.reduce((n, m) => n + m.subscribers, 0);
  const totalRev     = data.reduce((n, m) => n + m.revenue, 0);
  const totalActive  = data.reduce((n, m) => n + m.active, 0);
  const totalRenew   = data.reduce((n, m) => n + m.renewals, 0);

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
        <div className="mx-auto max-w-6xl px-4 py-7 md:px-8 space-y-6">

          {/* ── Header ── */}
          <PageHeader
            title="المبيعات"
            subtitle="أداء فريق المبيعات والإحصائيات"
            actions={
              <div className="flex items-center gap-1 p-1 rounded-xl"
                style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
                {([["grid","grid"],["table","list"]] as const).map(([key]) => (
                  <button key={key} onClick={() => setView(key)}
                    className="p-2 rounded-lg transition-all"
                    style={{
                      background: view === key ? `${ACC.indigo}18` : "transparent",
                      color:      view === key ? ACC.indigo : "var(--text-muted)",
                    }}>
                    {key === "grid" ? <LayoutGrid size={15}/> : <List size={15}/>}
                  </button>
                ))}
              </div>
            }
          />

          {/* ── KPI strip ── */}
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
            transition={{ ...tran, delay:0.1 }}
            className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiStrip label="إجمالي المشتركين" value={String(totalSubs)}
              accent={ACC.indigo} icon={<Users size={17}/>}/>
            <KpiStrip label="المشتركون النشطون" value={String(totalActive)}
              accent={ACC.emerald} icon={<TrendingUp size={17}/>}/>
            <KpiStrip label="الأرباح الكلية"
              value={canRev ? `$${formatNumber(totalRev, 0)}` : "—"}
              accent={ACC.amber} icon={<DollarSign size={17}/>}/>
            <KpiStrip label="إجمالي التجديدات" value={String(totalRenew)}
              accent={ACC.rose} icon={<RefreshCw size={17}/>}/>
          </motion.div>

          {/* ── Employee cards / table ── */}
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
              {[1,2,3].map((i) => (
                <div key={i} className="h-72 rounded-2xl" style={{ background:"var(--surface)" }}/>
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20">
              <Users size={36} style={{ color:"var(--text-muted)" }}/>
              <p className="text-sm" style={{ color:"var(--text-muted)" }}>
                لا يوجد موظفو مبيعات حتى الآن
              </p>
            </div>
          ) : view === "grid" ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.map((m, i) => (
                <SalesEmployeeCard key={m.uid} metrics={m} rank={i + 1} canRev={canRev}/>
              ))}
            </div>
          ) : (
            /* Table view */
            <div className="rounded-2xl overflow-hidden"
              style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom:"1px solid var(--divider)" }}>
                      {["#","الاسم","المشتركون","نشط","معدل التحويل",
                        canRev?"الأرباح":"","التجديدات",""].map((h, i) => (
                        h !== undefined && <th key={i}
                          className="px-5 py-3 text-right font-semibold"
                          style={{ color:"var(--text-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((m, i) => (
                      <tr key={m.uid} className="transition-colors hover:bg-[#83A2DB08]"
                        style={{ borderBottom:"1px solid var(--divider)" }}>
                        <td className="px-5 py-3 font-black tabular-nums" style={{ color:ACC.indigo }}>
                          {i + 1}
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-semibold" style={{ color:"var(--text-primary)" }}>{m.name}</p>
                          <p className="text-[10px]" style={{ color:"var(--text-muted)" }}>{m.email}</p>
                        </td>
                        <td className="px-5 py-3 font-bold tabular-nums" style={{ color:"var(--text-primary)" }}>
                          {m.subscribers}
                        </td>
                        <td className="px-5 py-3 font-bold tabular-nums" style={{ color:ACC.emerald }}>
                          {m.active}
                        </td>
                        <td className="px-5 py-3 font-bold tabular-nums"
                          style={{ color: m.conversionRate >= 0.7 ? ACC.emerald : m.conversionRate >= 0.4 ? ACC.amber : ACC.rose }}>
                          {Math.round(m.conversionRate * 100)}%
                        </td>
                        {canRev && (
                          <td className="px-5 py-3 font-bold tabular-nums" style={{ color:ACC.emerald }}>
                            ${formatNumber(m.revenue, 0)}
                          </td>
                        )}
                        <td className="px-5 py-3 tabular-nums" style={{ color:"var(--text-secondary)" }}>
                          {m.renewals}
                        </td>
                        <td className="px-5 py-3">
                          <a href={`/sales/${m.uid}`}
                            className="text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
                            style={{ background:`${ACC.indigo}15`, color:ACC.indigo }}>
                            عرض
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
