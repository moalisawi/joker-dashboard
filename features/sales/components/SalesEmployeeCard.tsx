"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { formatNumber } from "@/lib/utils";
import type { SalesEmployeeMetrics } from "@/features/sales/lib/salesMetrics";
import { Users, TrendingUp, DollarSign, RefreshCw, ArrowLeft } from "lucide-react";
import EmployeeNameChip from "@/components/employees/EmployeeNameChip";

const ACC = { indigo:"#83A2DB", emerald:"#83A2DB", amber:"#E8B570", rose:"#CE6969" };

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#83A2DB,#9DB4D6)",
  "linear-gradient(135deg,#83A2DB,#83A2DB)",
  "linear-gradient(135deg,#E8B570,#E8B570)",
  "linear-gradient(135deg,#CE6969,#CE6969)",
  "linear-gradient(135deg,#9DB4D6,#83A2DB)",
];

interface Props {
  metrics: SalesEmployeeMetrics;
  rank:    number;
  canRev:  boolean;
}

export default function SalesEmployeeCard({ metrics: m, rank, canRev }: Props) {
  const grad = AVATAR_GRADIENTS[(rank - 1) % AVATAR_GRADIENTS.length];
  const convPct = Math.round(m.conversionRate * 100);

  return (
    <motion.div
      initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.3, delay: rank * 0.06, ease:"easeOut" }}
      className="rounded-2xl overflow-hidden transition-all hover:scale-[1.01]"
      style={{
        background:  "var(--surface)",
        border:      "1px solid var(--border)",
        boxShadow:   "var(--shadow-card)",
      }}>

      {/* Top accent */}
      

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center
            text-lg font-black text-white shrink-0"
            style={{ background: grad }}>
            {initials(m.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <EmployeeNameChip
                name={m.name}
                uid={m.uid}
                className="text-sm font-bold truncate"
                style={{ color: "var(--text-primary)" }}
              />
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background:`${ACC.indigo}15`, color:ACC.indigo }}>
                #{rank}
              </span>
            </div>
            <p className="text-[11px] mt-0.5 truncate" style={{ color:"var(--text-muted)" }}>
              {m.email}
            </p>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="rounded-xl p-3" style={{ background:"var(--surface-2)" }}>
            <p className="text-[10px] font-medium mb-1" style={{ color:"var(--text-muted)" }}>
              المشتركين
            </p>
            <p className="text-lg font-black tabular-nums" style={{ color:"var(--text-primary)" }}>
              {m.subscribers}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color:ACC.emerald }}>
              {m.active} نشط
            </p>
          </div>
          <div className="rounded-xl p-3" style={{ background:"var(--surface-2)" }}>
            <p className="text-[10px] font-medium mb-1" style={{ color:"var(--text-muted)" }}>
              الأرباح
            </p>
            <p className="text-lg font-black tabular-nums" style={{ color:canRev ? ACC.emerald : "var(--text-muted)" }}>
              {canRev ? `$${formatNumber(m.revenue, 0)}` : "—"}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color:"var(--text-muted)" }}>
              {canRev ? `متوسط $${formatNumber(m.avgValue, 0)}` : ""}
            </p>
          </div>
        </div>

        {/* Conversion bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold" style={{ color:"var(--text-secondary)" }}>
              معدل التحويل
            </span>
            <span className="text-[11px] font-bold tabular-nums"
              style={{ color: convPct >= 70 ? ACC.emerald : convPct >= 40 ? ACC.amber : ACC.rose }}>
              {convPct}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background:"var(--surface-2)" }}>
            <div className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, convPct)}%`,
                background: convPct >= 70 ? ACC.emerald : convPct >= 40 ? ACC.amber : ACC.rose,
              }}/>
          </div>
        </div>

        {/* Footer stats */}
        <div className="flex items-center justify-between text-[11px]"
          style={{ color:"var(--text-muted)" }}>
          <span className="flex items-center gap-1">
            <RefreshCw size={10}/>{m.renewals} تجديد
          </span>
          {canRev && (
            <span className="flex items-center gap-1">
              <DollarSign size={10}/>${formatNumber(m.initialRevenue, 0)} أولي
            </span>
          )}
        </div>
      </div>

      {/* View link */}
      <Link href={`/sales/${m.uid}`}
        className="flex items-center justify-between px-5 py-3 border-t text-xs font-bold
          transition-colors hover:opacity-70"
        style={{ borderColor:"var(--border)", color:ACC.indigo }}>
        عرض الملف الكامل
        <ArrowLeft size={13}/>
      </Link>
    </motion.div>
  );
}
