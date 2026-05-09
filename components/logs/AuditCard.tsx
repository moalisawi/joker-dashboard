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
import DiffView from "./DiffView";

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

const SEVERITY_BADGE: Record<AuditSeverity, string> = {
  success:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  info:     "bg-blue-100    text-blue-700    border-blue-200",
  warning:  "bg-amber-100   text-amber-700   border-amber-200",
  critical: "bg-red-100     text-red-700     border-red-200",
};

const SEVERITY_ICON: Record<AuditSeverity, React.ReactNode> = {
  success:  <CheckCircle2 size={13} />,
  info:     <Info         size={13} />,
  warning:  <AlertTriangle size={13} />,
  critical: <XCircle      size={13} />,
};

const SEVERITY_DOT: Record<AuditSeverity, string> = {
  success:  "bg-emerald-500",
  info:     "bg-blue-500",
  warning:  "bg-amber-500",
  critical: "bg-red-500",
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

  return (
    <div
      className={`group relative bg-white rounded-xl border transition-all duration-200
        hover:shadow-md hover:-translate-y-px
        ${severity === "critical" ? "border-red-200 hover:border-red-300" :
          severity === "warning"  ? "border-amber-200 hover:border-amber-300" :
          severity === "success"  ? "border-emerald-200 hover:border-emerald-300" :
          "border-slate-100 hover:border-slate-200"}`}
    >
      {/* left accent bar */}
      <div className={`absolute top-0 right-0 w-1 h-full rounded-r-xl ${SEVERITY_DOT[severity]}`} />

      <div className="px-4 py-3 pr-5">
        {/* top row */}
        <div className="flex items-start gap-3">
          {/* icon */}
          <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5
            ${SEVERITY_BADGE[severity].split(" ").slice(0,2).join(" ")}`}>
            {ACTION_ICON[action] ?? <Activity size={15} />}
          </div>

          {/* main content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {/* action badge */}
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold border ${SEVERITY_BADGE[severity]}`}>
                {SEVERITY_ICON[severity]}
                {ACTION_LABELS[action] ?? action}
              </span>

              {/* category badge */}
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                {CATEGORY_LABELS[category] ?? category}
              </span>

              {/* financial badge */}
              {hasFinancial && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  log.financialData!.impactType === "negative"
                    ? "bg-red-50 text-red-600"
                    : "bg-emerald-50 text-emerald-700"
                }`}>
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
              <p className="text-sm text-slate-700 font-medium truncate">
                {log._description}
              </p>
            )}

            {/* meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-400">
              {log._performedByName && (
                <span className="font-semibold text-slate-600">
                  {log._performedByName}
                </span>
              )}
              {log._performedByRole && (
                <span>{ROLE_LABELS[log._performedByRole] ?? log._performedByRole}</span>
              )}
              {log._entityName && log._entityName !== log._description && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500">{log._entityName}</span>
                </>
              )}
            </div>
          </div>

          {/* timestamp + expand */}
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span
              title={fullDateTime(ms)}
              className="text-xs text-slate-400 whitespace-nowrap cursor-default"
            >
              {relativeTime(ms)}
            </span>
            {hasDetails && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-0.5 transition-colors"
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {expanded ? "إخفاء" : "التفاصيل"}
              </button>
            )}
          </div>
        </div>

        {/* expanded details */}
        {expanded && hasDetails && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
            {/* diff */}
            {hasDiff && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">التغييرات</p>
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
                <p className="text-xs font-semibold text-slate-500 mb-1">البيانات الإضافية</p>
                <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-x-4 gap-y-1">
                  {Object.entries(log.metadata!).map(([k, v]) => {
                    if (v === null || v === undefined) return null;
                    return (
                      <div key={k} className="text-xs">
                        <span className="text-slate-400">{k}: </span>
                        <span className="text-slate-700 font-medium">
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* full timestamp */}
            <p className="text-xs text-slate-400">
              {fullDateTime(ms)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
