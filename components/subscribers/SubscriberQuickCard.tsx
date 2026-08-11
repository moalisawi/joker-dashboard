"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ExternalLink, Phone, Calendar, 
  TrendingUp, DollarSign, Clock, User} from "lucide-react";
import { useSubscriberCardStore } from "@/store/subscriberCardStore";
import { useAuthStore } from "@/store/authStore";
import { useActiveEmployees } from "@/features/users/hooks";
import EmployeeNameChip from "@/components/employees/EmployeeNameChip";
import { formatNumber, formatDate } from "@/lib/utils";
import type { Subscriber } from "@/types";

// ── helpers ───────────────────────────────────────────────────────────────────

const PALETTE = ["#5B5FEF","#22C55E","#EF4444","#3B82F6","#F59E0B","#8B5CF6","#06B6D4"];

function avatarColor(name: string) {
  return PALETTE[(name?.charCodeAt(0) ?? 0) % PALETTE.length];
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("") || "؟";
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  نشط:           { label: "نشط",           color: "#22C55E", bg: "#ECFDF3" },
  "ينتهي قريباً": { label: "ينتهي قريباً", color: "#D97706", bg: "#FFFBEB" },
  منتهي:         { label: "منتهي",         color: "#EF4444", bg: "#FEF2F2" },
  موقوف:         { label: "موقوف",         color: "#D97706", bg: "#FFFBEB" },
  متجمد:         { label: "متجمد",         color: "#3B82F6", bg: "#EFF6FF" },
  منسحب:         { label: "منسحب",         color: "#9CA3AF", bg: "#F1F5F9" },
};

function getDisplayStatus(s: Subscriber) {
  if (s.freezeData?.isFrozen)             return "متجمد";
  if (s.subscriptionStatus === "paused")  return "موقوف";
  if (s.subscriptionState === "withdrawn") return "منسحب";
  return s.status || "نشط";
}

// ── KPI cell ──────────────────────────────────────────────────────────────────

function KpiCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <span className="text-sm font-black tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[10px] font-medium text-center" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

// ── Row detail ────────────────────────────────────────────────────────────────

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{icon}</span>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span className="font-semibold mr-auto" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

// ── Card body ─────────────────────────────────────────────────────────────────

function CardContent({ subscriber: s }: { subscriber: Subscriber }) {
  const router  = useRouter();
  const close   = useSubscriberCardStore((st) => st.close);
  const { can } = useAuthStore();
  const canRev  = can("canViewRevenue");

  const { data: employees = [] } = useActiveEmployees();
  const empUid = employees.find(
    (e) => (e.employeeName || e.name) === s.convincedBy
  )?.uid;

  const status   = getDisplayStatus(s);
  const statusMeta = STATUS_META[status] ?? STATUS_META["نشط"];
  const color    = avatarColor(s.name);

  const daysColor =
    s.daysRemaining <= 0   ? "#EF4444" :
    s.daysRemaining <= 7   ? "#F59E0B" :
    s.daysRemaining <= 30  ? "#D97706" : "#22C55E";

  function goProfile() {
    close();
    router.push(`/subscribers/${s.id}`);
  }

  return (
    <div style={{ width: 320 }}>
      {/* close */}
      <button
        onClick={close}
        className="absolute top-3 left-3 p-1.5 rounded-lg opacity-40 hover:opacity-80 transition-opacity"
        style={{ color: "var(--text-secondary)" }}
      >
        <X size={14} />
      </button>

      <div className="p-5">
        {/* ── header ── */}
        <div className="flex items-start gap-3 mb-4">
          <div
            className="h-14 w-14 rounded-xl flex items-center justify-center text-lg font-black text-white shrink-0"
            style={{ background: color }}
          >
            {initials(s.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black leading-tight" style={{ color: "var(--text-primary)" }}>
              {s.name}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: statusMeta.bg, color: statusMeta.color }}
              >
                {statusMeta.label}
              </span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "var(--jk-accent-bg)", color: "var(--jk-primary)" }}
              >
                {s.package}
              </span>
            </div>
          </div>
        </div>

        {/* ── KPIs ── */}
        {canRev && (
          <div
            className="grid grid-cols-3 gap-1 mb-4 py-3 rounded-xl"
            style={{ background: "var(--surface-2, #F8FAFC)", border: "1px solid var(--border)" }}
          >
            <KpiCell label="المحصّل"   value={`$${formatNumber(s.paidAmountUSD, 0)}`}      color="#22C55E" />
            <KpiCell label="المتبقي"   value={`$${formatNumber(s.remainingAmountUSD, 0)}`}  color="#F59E0B" />
            <KpiCell label="الإجمالي"  value={`$${formatNumber(s.totalPriceUSD, 0)}`}       color="#5B5FEF" />
          </div>
        )}

        {/* ── details ── */}
        <div className="space-y-2 mb-4">
          {s.phone && (
            <DetailRow
              icon={<Phone size={12} />}
              label=""
              value={
                <span dir="ltr">{s.dialCode}{s.phone}</span>
              }
            />
          )}
          <DetailRow
            icon={<Calendar size={12} />}
            label="الانتهاء"
            value={formatDate(s.expiryDate)}
          />
          {status === "نشط" || status === "ينتهي قريباً" ? (
            <DetailRow
              icon={<Clock size={12} />}
              label="المتبقي"
              value={
                <span style={{ color: daysColor, fontWeight: 700 }}>
                  {s.daysRemaining > 0 ? `${s.daysRemaining} يوم` : `متأخر ${Math.abs(s.daysRemaining)} يوم`}
                </span>
              }
            />
          ) : null}
          {s.payment && (
            <DetailRow
              icon={<DollarSign size={12} />}
              label="طريقة الدفع"
              value={s.payment}
            />
          )}
          {s.convincedBy && (
            <DetailRow
              icon={<User size={12} />}
              label="الموظف"
              value={
                <EmployeeNameChip
                  name={s.convincedBy}
                  uid={empUid}
                  className="font-semibold"
                  style={{ color: "var(--text-primary)", fontSize: 12 }}
                />
              }
            />
          )}
          {s.source && (
            <DetailRow icon={<TrendingUp size={12} />} label="المصدر" value={s.source} />
          )}
        </div>

        {/* ── actions ── */}
        <div className="flex gap-2">
          <button
            onClick={goProfile}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#5B5FEF,#4F46E5)" }}
          >
            <ExternalLink size={12} />
            فتح الملف الكامل
          </button>
          <button
            onClick={close}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
            style={{
              background: "var(--surface-2, #F8FAFC)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Overlay ───────────────────────────────────────────────────────────────────

export default function SubscriberQuickCard() {
  const { subscriber, close } = useSubscriberCardStore();

  useEffect(() => {
    if (!subscriber) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [subscriber, close]);

  return (
    <AnimatePresence>
      {subscriber && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 200, background: "rgba(16,20,26,.45)", backdropFilter: "blur(3px)" }}
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.92, y: 12  }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative rounded-2xl overflow-hidden"
            style={{
              background:  "var(--surface, #FFFFFF)",
              border:      "1px solid var(--border, #E5E7EB)",
              boxShadow:   "0 24px 60px rgba(16,20,26,.28)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent subscriber={subscriber} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
