"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useEmployeeCardStore }    from "@/store/employeeCardStore";
import { useEmployee }             from "@/features/users/hooks";
import { useSalesEmployeeDetail }  from "@/features/sales/hooks/useSalesEmployeeDetail";
import { useTeams }                from "@/hooks/useTeams";
import { useAuthStore }            from "@/store/authStore";
import EmployeeStatusBadge         from "@/components/ui/EmployeeStatusBadge";
import { formatNumber }            from "@/lib/utils";
import {
  X, ExternalLink, Mail, Phone, Users2,
  Users, TrendingUp, DollarSign, RefreshCw,
} from "lucide-react";

// ─── tokens ───────────────────────────────────────────────────────────────────

const ACC = {
  indigo:  "#5B5FEF",
  emerald: "#5B5FEF",
  amber:   "#F59E0B",
  rose:    "#EF4444",
  sky:     "#3B82F6",
  purple:  "#3B82F6",
};

const GRADIENTS = [
  `linear-gradient(135deg,${ACC.indigo},${ACC.purple})`,
  `linear-gradient(135deg,${ACC.emerald},${ACC.sky})`,
  `linear-gradient(135deg,${ACC.amber},${ACC.rose})`,
  `linear-gradient(135deg,${ACC.purple},${ACC.rose})`,
  `linear-gradient(135deg,${ACC.sky},${ACC.indigo})`,
];

const ROLE_META: Record<string, { label: string; color: string }> = {
  owner:       { label: "مالك",       color: ACC.amber  },
  admin:       { label: "مدير",       color: ACC.indigo },
  team_leader: { label: "قائد فريق", color: ACC.purple },
  sales:       { label: "مبيعات",    color: ACC.emerald },
  followup:    { label: "متابعة",    color: ACC.sky     },
};

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "؟";
}

function avatarGrad(uid: string) {
  return GRADIENTS[uid.charCodeAt(0) % GRADIENTS.length];
}

// ─── KPI row ──────────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <span className="text-base font-black tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[10px] font-medium text-center leading-tight"
        style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function CardContent({ uid }: { uid: string }) {
  const router  = useRouter();
  const close   = useEmployeeCardStore((s) => s.close);
  const { can } = useAuthStore();
  const canRev  = can("canViewRevenue");

  const { data: employee, isLoading: empLoad } = useEmployee(uid);
  const { metrics, isLoading: mLoad }          = useSalesEmployeeDetail(uid);
  const { data: teams = [] }                   = useTeams();

  const isLoading = empLoad || mLoad;

  const team     = teams.find((t) => t.id === employee?.teamId);
  const roleMeta = ROLE_META[employee?.employeeRole ?? "sales"] ?? ROLE_META.sales;
  const grad     = avatarGrad(uid);
  const convRate = metrics ? Math.round(metrics.conversionRate * 100) : 0;
  const isActive = employee?.status === "active" || employee?.active;

  function goProfile() {
    close();
    router.push(`/admin/employees/${uid}`);
  }

  return (
    <div style={{ width: 320 }}>
      {/* gradient bar */}
      

      {/* close btn */}
      <button
        onClick={close}
        className="absolute top-3 left-3 p-1.5 rounded-lg opacity-40 hover:opacity-80 transition-opacity"
        style={{ color: "var(--text-secondary)" }}>
        <X size={14} />
      </button>

      {isLoading ? (
        <div className="p-6 space-y-3 animate-pulse">
          <div className="flex gap-3 items-center">
            <div className="h-14 w-14 rounded-xl" style={{ background: "var(--surface-2)" }} />
            <div className="flex-1 space-y-2">
              <div className="h-4 rounded" style={{ background: "var(--surface-2)" }} />
              <div className="h-3 w-2/3 rounded" style={{ background: "var(--surface-2)" }} />
            </div>
          </div>
          <div className="h-12 rounded-xl" style={{ background: "var(--surface-2)" }} />
        </div>
      ) : !employee ? (
        <div className="p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          الموظف غير موجود
        </div>
      ) : (
        <div className="p-5">
          {/* header */}
          <div className="flex items-start gap-3 mb-4">
            <div
              className="h-14 w-14 rounded-xl flex items-center justify-center text-lg font-black text-white shrink-0"
              style={{ background: grad }}>
              {initials(employee.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black leading-tight truncate"
                style={{ color: "var(--text-primary)" }}>
                {employee.name}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${roleMeta.color}15`, color: roleMeta.color }}>
                  {roleMeta.label}
                </span>
                <EmployeeStatusBadge active={!!isActive} status={employee.status} />
              </div>
            </div>
          </div>

          {/* contact */}
          <div className="space-y-1.5 mb-4">
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <Mail size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span className="truncate">{employee.email}</span>
            </div>
            {employee.phone && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <Phone size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <span>{employee.phone}</span>
              </div>
            )}
            {team && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <Users2 size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <span>{team.name}</span>
              </div>
            )}
          </div>

          {/* KPIs */}
          {metrics && (
            <div className="grid grid-cols-4 gap-1 mb-4 py-3 rounded-xl"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <Stat label="مشترك"   value={String(metrics.subscribers)}     color={ACC.indigo}  />
              <Stat label="نشط"     value={String(metrics.active)}           color={ACC.emerald} />
              <Stat label="تحويل"   value={`${convRate}%`}
                color={convRate >= 70 ? ACC.emerald : convRate >= 40 ? ACC.amber : ACC.rose} />
              <Stat label="إيرادات"
                value={canRev ? `$${formatNumber(metrics.revenue, 0)}` : "—"}
                color={ACC.amber} />
            </div>
          )}

          {/* actions */}
          <div className="flex gap-2">
            <button
              onClick={goProfile}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
              style={{ background: `linear-gradient(135deg,${ACC.indigo},${ACC.purple})` }}>
              <ExternalLink size={12} />
              فتح الملف الكامل
            </button>
            <button
              onClick={close}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Overlay (rendered once in ProtectedLayout) ───────────────────────────────

export default function EmployeeQuickCard() {
  const { uid, close } = useEmployeeCardStore();

  useEffect(() => {
    if (!uid) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [uid, close]);

  return (
    <AnimatePresence>
      {uid && (
        /* backdrop */
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 200, background: "rgba(16,20,26,.45)", backdropFilter: "blur(3px)" }}
          onClick={close}>

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.92, y: 12  }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative rounded-2xl overflow-hidden"
            style={{
              background:   "var(--surface)",
              border:       "1px solid var(--border)",
              boxShadow:    "0 24px 60px rgba(16,20,26,.28)",
            }}
            onClick={(e) => e.stopPropagation()}>
            <CardContent uid={uid} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
