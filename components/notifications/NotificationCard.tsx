"use client";

import {
  CheckCircle2, AlertTriangle, Info, XCircle,
  UserPlus, UserMinus, RefreshCw, Snowflake,
  PlayCircle, CreditCard, Undo2, Shield,
  ShieldAlert, LogIn, Bell, Settings2,
  Archive, Check, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import type { AppNotification, NotificationSeverity } from "@/types";

// ─── severity config ──────────────────────────────────────────────────────────

const SEV: Record<NotificationSeverity, {
  bg: string; border: string; badge: string; dot: string; icon: React.ReactNode;
}> = {
  success:  {
    bg: "bg-emerald-50", border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
    icon: <CheckCircle2 size={14} />,
  },
  info:     {
    bg: "bg-blue-50",    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
    icon: <Info size={14} />,
  },
  warning:  {
    bg: "bg-amber-50",   border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    icon: <AlertTriangle size={14} />,
  },
  critical: {
    bg: "bg-red-50",     border: "border-red-200",
    badge: "bg-red-100 text-red-700",
    dot: "bg-red-500",
    icon: <XCircle size={14} />,
  },
};

// ─── type icons ───────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ReactNode> = {
  renewal_created:        <RefreshCw   size={15} />,
  subscription_frozen:    <Snowflake   size={15} />,
  subscription_resumed:   <PlayCircle  size={15} />,
  withdrawal_created:     <UserMinus   size={15} />,
  refund_created:         <Undo2       size={15} />,
  high_refund_activity:   <Undo2       size={15} />,
  revenue_drop:           <CreditCard  size={15} />,
  login_failed:           <ShieldAlert size={15} />,
  suspicious_activity:    <ShieldAlert size={15} />,
  unusual_refunds:        <ShieldAlert size={15} />,
  role_changed:           <Shield      size={15} />,
  permission_changed:     <Shield      size={15} />,
  account_suspended:      <ShieldAlert size={15} />,
  account_disabled:       <XCircle     size={15} />,
  account_activated:      <CheckCircle2 size={15} />,
  user_created:           <UserPlus    size={15} />,
  user_disabled:          <UserMinus   size={15} />,
  subscription_expiring:  <AlertTriangle size={15} />,
};

const CATEGORY_LABELS: Record<string, string> = {
  operational: "تشغيلي",
  financial:   "مالي",
  security:    "أمان",
  user:        "مستخدمون",
  insight:     "رؤية",
};

// ─── timestamp helper ─────────────────────────────────────────────────────────

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
  if (s <  60)   return "الآن";
  if (s < 3600)  return `منذ ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} ساعة`;
  if (s < 172800) return "الأمس";
  return new Date(ms).toLocaleDateString("ar-EG");
}

// ─── component ────────────────────────────────────────────────────────────────

interface NotificationCardProps {
  notification: AppNotification;
  currentUid:   string;
  onMarkRead:   (id: string) => void;
  onArchive:    (id: string) => void;
  compact?:     boolean;
}

export default function NotificationCard({
  notification: n,
  currentUid,
  onMarkRead,
  onArchive,
  compact = false,
}: NotificationCardProps) {
  const sev     = (n.severity ?? "info") as NotificationSeverity;
  const cfg     = SEV[sev];
  const isRead  = n.readBy?.includes(currentUid) ?? false;
  const ms      = toMs(n.createdAt);

  const icon = TYPE_ICON[n.type] ?? <Bell size={15} />;

  const inner = (
    <div
      className={`group relative rounded-xl border transition-all duration-150
        ${isRead
          ? "bg-white border-slate-100 hover:border-slate-200"
          : `${cfg.bg} ${cfg.border} hover:shadow-md`
        }
        ${compact ? "p-3" : "p-4"}
      `}
    >
      {/* unread dot */}
      {!isRead && (
        <div className={`absolute top-3 left-3 w-2 h-2 rounded-full ${cfg.dot}`} />
      )}

      <div className={`flex items-start gap-3 ${!isRead ? "pr-1" : ""}`}>
        {/* icon */}
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5
          ${isRead ? "bg-slate-100 text-slate-500" : `${cfg.badge}`}`}>
          {icon}
        </div>

        {/* content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <p className={`text-sm font-semibold leading-snug ${isRead ? "text-slate-600" : "text-slate-800"}`}>
              {n.title}
            </p>
            <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap mt-0.5">
              {relativeTime(ms)}
            </span>
          </div>

          {!compact && n.description && n.description !== n.title && (
            <p className="text-xs text-slate-500 leading-relaxed mb-2">{n.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* category badge */}
            <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-medium
              ${isRead ? "bg-slate-100 text-slate-400" : cfg.badge}`}>
              {cfg.icon}
              {CATEGORY_LABELS[n.category] ?? n.category}
            </span>

            {/* financial badge */}
            {n.financialData?.amountUSD && n.financialData.amountUSD > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                ${n.financialData.amountUSD.toFixed(2)}
              </span>
            )}

            {/* performer */}
            {n.performedBy?.name && !compact && (
              <span className="text-xs text-slate-400">
                بواسطة {n.performedBy.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* action row */}
      <div className={`flex items-center justify-between mt-3 pt-2.5 border-t
        ${isRead ? "border-slate-100" : "border-white/60"}
        opacity-0 group-hover:opacity-100 transition-opacity
        ${compact ? "hidden" : "flex"}`}>
        <div className="flex items-center gap-2">
          {n.actionUrl && (
            <Link
              href={n.actionUrl}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition"
            >
              <ExternalLink size={11} /> عرض التفاصيل
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isRead && (
            <button
              onClick={() => onMarkRead(n.id)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition"
              title="تحديد كمقروء"
            >
              <Check size={12} /> قراءة
            </button>
          )}
          <button
            onClick={() => onArchive(n.id)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition"
            title="أرشفة"
          >
            <Archive size={12} /> أرشفة
          </button>
        </div>
      </div>
    </div>
  );

  return inner;
}
