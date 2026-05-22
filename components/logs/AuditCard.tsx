"use client";

import { useState } from "react";
import {
  UserPlus, UserMinus, UserCog, RefreshCw,
  Snowflake, PlayCircle, Trash2,
  CreditCard, Undo2,
  Shield, ShieldAlert, LogIn, LogOut,
  Download, Settings2, BarChart2,
  Activity, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Info, XCircle,
} from "lucide-react";
import type { NormalizedAuditLog, AuditSeverity } from "@/types";
import DiffView         from "./DiffView";
import EmployeeNameChip from "@/components/employees/EmployeeNameChip";

// ─── label / icon maps ───────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  subscriber_created:          "إضافة مشترك",
  subscriber_updated:          "تعديل مشترك",
  subscriber_renewed:          "تجديد اشتراك",
  subscriber_frozen:           "تجميد اشتراك",
  subscriber_resumed:          "استئناف اشتراك",
  subscriber_withdrawn:        "انسحاب مشترك",
  subscriber_expired:          "انتهاء اشتراك",
  subscriber_deleted:          "حذف مشترك",
  payment_created:             "دفعة جديدة",
  payment_updated:             "تعديل دفعة",
  refund_created:              "استرداد مالي",
  refund_updated:              "تعديل استرداد",
  user_created:                "إنشاء مستخدم",
  user_updated:                "تعديل مستخدم",
  role_changed:                "تغيير دور",
  permissions_changed:         "تعديل صلاحيات",
  account_activated:           "تفعيل حساب",
  account_suspended:           "تعليق حساب",
  account_disabled:            "تعطيل حساب",
  login_success:               "تسجيل دخول",
  login_failed:                "فشل دخول",
  logout:                      "تسجيل خروج",
  analytics_exported:          "تصدير التحليلات",
  settings_updated:            "تعديل الإعدادات",
  data_imported:               "استيراد بيانات",
  data_exported:               "تصدير بيانات",
  // legacy
  payment_added:               "إضافة دفعة",
  payment_transaction_created: "معاملة دفع جديدة",
  subscriber_refund_created:   "استرداد مشترك",
  analytics_recalculated:      "إعادة احتساب التحليلات",
};

const ACTION_ICON: Record<string, React.ReactNode> = {
  subscriber_created:   <UserPlus   size={15} />,
  subscriber_updated:   <UserCog    size={15} />,
  subscriber_renewed:   <RefreshCw  size={15} />,
  subscriber_frozen:    <Snowflake  size={15} />,
  subscriber_resumed:   <PlayCircle size={15} />,
  subscriber_withdrawn: <UserMinus  size={15} />,
  subscriber_deleted:   <Trash2     size={15} />,
  payment_created:      <CreditCard size={15} />,
  payment_updated:      <CreditCard size={15} />,
  refund_created:       <Undo2      size={15} />,
  refund_updated:       <Undo2      size={15} />,
  user_created:         <UserPlus   size={15} />,
  user_updated:         <UserCog    size={15} />,
  role_changed:         <Shield     size={15} />,
  permissions_changed:  <Shield     size={15} />,
  account_activated:    <CheckCircle2 size={15} />,
  account_suspended:    <ShieldAlert  size={15} />,
  account_disabled:     <XCircle      size={15} />,
  login_success:        <LogIn      size={15} />,
  login_failed:         <ShieldAlert size={15} />,
  logout:               <LogOut     size={15} />,
  analytics_exported:   <Download   size={15} />,
  settings_updated:     <Settings2  size={15} />,
  data_exported:        <Download   size={15} />,
  analytics_recalculated: <BarChart2 size={15} />,
};

// ─── severity styling ────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<AuditSeverity, { bg: string; color: string; border: string; dot: string }> = {
  success:  { bg: "rgba(91,95,239,.14)", color: "#5B5FEF", border: "rgba(91,95,239,.32)", dot: "#5B5FEF" },
  info:     { bg: "rgba(59,130,246,.14)", color: "#3B82F6", border: "rgba(59,130,246,.30)", dot: "#3B82F6" },
  warning:  { bg: "rgba(245,158,11,.14)", color: "#F59E0B", border: "rgba(245,158,11,.32)", dot: "#F59E0B" },
  critical: { bg: "rgba(239,68,68,.12)", color: "#EF4444", border: "rgba(239,68,68,.30)", dot: "#EF4444" },
};

const SEVERITY_ICON: Record<AuditSeverity, React.ReactNode> = {
  success:  <CheckCircle2 size={13} />,
  info:     <Info         size={13} />,
  warning:  <AlertTriangle size={13} />,
  critical: <XCircle      size={13} />,
};

const CATEGORY_LABELS: Record<string, string> = {
  subscriber: "مشترك",
  financial:  "مالي",
  user:       "مستخدم",
  auth:       "أمان",
  system:     "نظام",
};

const ROLE_LABELS: Record<string, string> = {
  owner:    "المالك",
  admin:    "مدير",
  employee: "موظف",
};

// ─── timestamp helpers ───────────────────────────────────────────────────────

function toMs(val: unknown): number {
  if (!val) return 0;
  if (typeof val === "object" && val !== null) {
    if ("toMillis" in val) return (val as { toMillis(): number }).toMillis();
    if ("seconds"  in val) return (val as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function relativeTime(ms: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s <  60)  return "منذ لحظات";
  if (s < 3600) return `منذ ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} ساعة`;
  if (s < 172800) return "الأمس";
  if (s < 604800) return `منذ ${Math.floor(s / 86400)} أيام`;
  return new Date(ms).toLocaleDateString("ar-EG");
}

function fullDateTime(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("ar-EG", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ─── component ────────────────────────────────────────────────────────────────

interface AuditCardProps {
  log: NormalizedAuditLog;
}

export default function AuditCard({ log }: AuditCardProps) {
  const [expanded, setExpanded] = useState(false);

  const severity = (log.severity ?? "info") as AuditSeverity;
  const ms       = toMs(log.createdAt);
  const action   = log.action;
  const category = log.category ?? "system";

  const hasDiff     = !!(log.previousData || log.newData);
  const hasFinancial = !!log.financialData?.amountUSD;
  const hasMetadata  = log.metadata && Object.keys(log.metadata).length > 0;
  const hasDetails   = hasDiff || hasMetadata;

  const sev = SEVERITY_STYLE[severity];

  return (
    <div
      className="group relative transition-all duration-200"
      style={{
        background: "var(--jk-surface)",
        border: `1px solid var(--jk-border)`,
        borderRadius: 22,
        boxShadow: "var(--jk-shadow-card)",
      }}
    >
      <div className="px-4 py-3 pr-5">
        {/* top row */}
        <div className="flex items-start gap-3">
          {/* icon */}
          <div
            className="shrink-0 flex items-center justify-center mt-0.5"
            style={{ width: 36, height: 36, borderRadius: "50%", background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}
          >
            {ACTION_ICON[action] ?? <Activity size={15} />}
          </div>

          {/* main content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {/* action badge */}
              <span className="inline-flex items-center gap-1" style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}`, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                {SEVERITY_ICON[severity]}
                {ACTION_LABELS[action] ?? action}
              </span>

              {/* category badge */}
              <span style={{ background: "var(--jk-panel)", color: "var(--jk-muted)", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500 }}>
                {CATEGORY_LABELS[category] ?? category}
              </span>

              {/* financial badge */}
              {hasFinancial && (
                <span style={{
                  padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                  background: log.financialData!.impactType === "negative" ? "rgba(239,68,68,.12)" : "rgba(91,95,239,.14)",
                  color:      log.financialData!.impactType === "negative" ? "#EF4444"               : "#5B5FEF",
                }}>
                  {log.financialData!.impactType === "negative" ? "−" : "+"}
                  ${log.financialData!.amountUSD!.toFixed(2)}
                  {log.financialData!.currency && log.financialData!.currency !== "USD"
                    ? ` (${log.financialData!.currency})`
                    : ""}
                </span>
              )}
            </div>

            {/* description */}
            {log._description && (
              <p className="truncate" style={{ fontSize: 13, color: "var(--jk-text)", fontWeight: 500 }}>
                {log._description}
              </p>
            )}

            {/* meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1" style={{ fontSize: 11.5, color: "var(--jk-subtle)" }}>
              {log._performedByName && (
                <EmployeeNameChip
                  name={log._performedByName}
                  uid={log.performedBy?.uid}
                  className="font-semibold"
                />
              )}
              {log._performedByRole && (
                <span>{ROLE_LABELS[log._performedByRole] ?? log._performedByRole}</span>
              )}
              {log._entityName && log._entityName !== log._description && (
                <>
                  <span style={{ color: "var(--jk-subtle)" }}>·</span>
                  <span style={{ color: "var(--jk-muted)" }}>{log._entityName}</span>
                </>
              )}
            </div>
          </div>

          {/* timestamp + expand */}
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span
              title={fullDateTime(ms)}
              className="whitespace-nowrap cursor-default"
              style={{ fontSize: 11.5, color: "var(--jk-subtle)" }}
            >
              {relativeTime(ms)}
            </span>
            {hasDetails && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-0.5 transition-colors"
                style={{ fontSize: 11.5, color: "var(--jk-muted)", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {expanded ? "إخفاء" : "التفاصيل"}
              </button>
            )}
          </div>
        </div>

        {/* expanded details */}
        {expanded && hasDetails && (
          <div className="mt-3 pt-3 space-y-3" style={{ borderTop: "1px solid var(--jk-divider)" }}>
            {/* diff */}
            {hasDiff && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--jk-muted)", marginBottom: 6 }}>التغييرات</p>
                <DiffView
                  previousData={log.previousData}
                  newData={log.newData}
                  changedFields={log.changedFields}
                />
              </div>
            )}

            {/* metadata */}
            {hasMetadata && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--jk-muted)", marginBottom: 6 }}>البيانات الإضافية</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1" style={{ background: "var(--jk-panel)", borderRadius: 14, padding: 12 }}>
                  {Object.entries(log.metadata!).map(([k, v]) => {
                    if (v === null || v === undefined) return null;
                    return (
                      <div key={k} style={{ fontSize: 12 }}>
                        <span style={{ color: "var(--jk-subtle)" }}>{k}: </span>
                        <span style={{ color: "var(--jk-text)", fontWeight: 500 }}>
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* full timestamp */}
            <p style={{ fontSize: 11.5, color: "var(--jk-subtle)" }}>
              {fullDateTime(ms)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
