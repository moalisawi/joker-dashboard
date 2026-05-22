"use client";

import { useState, useMemo } from "react";
import {
  Bell, CheckCheck, SlidersHorizontal,
  Search, X, RefreshCw, Check, Archive,
  ExternalLink,
} from "lucide-react";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { notificationService } from "@/services/notification.service";
import { alertEngineService } from "@/services/alert-engine.service";
import type {
  AppNotification,
  NotificationCategory,
  NotificationSeverity,
  NotificationFilters,
} from "@/types";
import {
  CheckCircle2, AlertTriangle, Info, XCircle,
  UserPlus, UserMinus, Snowflake, PlayCircle,
  CreditCard, Undo2, Shield, ShieldAlert, Settings2,
} from "lucide-react";
import Link from "next/link";

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
  if (s <  60)    return "الآن";
  if (s < 3600)   return `منذ ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400)  return `منذ ${Math.floor(s / 3600)} ساعة`;
  if (s < 172800) return "الأمس";
  return new Date(ms).toLocaleDateString("ar-EG");
}

// ─── severity config ──────────────────────────────────────────────────────────

type SevCfg = { iconBg: string; iconColor: string; dot: string; icon: React.ReactNode; label: string };

const SEV: Record<NotificationSeverity, SevCfg> = {
  success:  { iconBg: "#D1FAE5", iconColor: "#5B5FEF", dot: "#5B5FEF", label: "ناجح",    icon: <CheckCircle2 size={14} /> },
  info:     { iconBg: "#DBEAFE", iconColor: "#5B5FEF", dot: "#5B5FEF", label: "معلومة",  icon: <Info         size={14} /> },
  warning:  { iconBg: "#FEF3C7", iconColor: "#F59E0B", dot: "#F59E0B", label: "تحذير",  icon: <AlertTriangle size={14} /> },
  critical: { iconBg: "#FEE2E2", iconColor: "#EF4444", dot: "#EF4444", label: "حرج",    icon: <XCircle      size={14} /> },
};

const SEV_DARK: Record<NotificationSeverity, SevCfg> = {
  success:  { iconBg: "rgba(16,185,129,.15)", iconColor: "#34D399", dot: "#5B5FEF", label: "ناجح",   icon: <CheckCircle2 size={14} /> },
  info:     { iconBg: "rgba(59,130,246,.15)", iconColor: "#5B5FEF", dot: "#5B5FEF", label: "معلومة", icon: <Info         size={14} /> },
  warning:  { iconBg: "rgba(245,158,11,.15)", iconColor: "#F59E0B", dot: "#F59E0B", label: "تحذير", icon: <AlertTriangle size={14} /> },
  critical: { iconBg: "rgba(239,68,68,.15)",  iconColor: "#EF4444", dot: "#EF4444", label: "حرج",   icon: <XCircle      size={14} /> },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  renewal_created:        <RefreshCw    size={15} />,
  subscription_frozen:    <Snowflake    size={15} />,
  subscription_resumed:   <PlayCircle   size={15} />,
  withdrawal_created:     <UserMinus    size={15} />,
  refund_created:         <Undo2        size={15} />,
  high_refund_activity:   <Undo2        size={15} />,
  revenue_drop:           <CreditCard   size={15} />,
  login_failed:           <ShieldAlert  size={15} />,
  suspicious_activity:    <ShieldAlert  size={15} />,
  unusual_refunds:        <ShieldAlert  size={15} />,
  role_changed:           <Shield       size={15} />,
  permission_changed:     <Shield       size={15} />,
  account_suspended:      <ShieldAlert  size={15} />,
  account_disabled:       <XCircle      size={15} />,
  account_activated:      <CheckCircle2 size={15} />,
  user_created:           <UserPlus     size={15} />,
  user_disabled:          <UserMinus    size={15} />,
  subscription_expiring:  <AlertTriangle size={15} />,
};

const CATEGORY_LABELS: Record<string, string> = {
  operational: "تشغيلي",
  financial:   "مالي",
  security:    "أمان",
  user:        "مستخدمون",
  insight:     "رؤية",
};

// ─── inline notification card ─────────────────────────────────────────────────

function NotifCard({
  n,
  uid,
  onRead,
  onArchive,
}: {
  n: AppNotification;
  uid: string;
  onRead: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const sev    = (n.severity ?? "info") as NotificationSeverity;
  const cfg    = SEV[sev];
  const isRead = n.readBy?.includes(uid) ?? false;
  const ms     = toMs(n.createdAt);
  const icon   = TYPE_ICON[n.type] ?? <Bell size={15} />;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid ${isRead ? "var(--border-soft)" : "var(--border)"}`,
        borderRadius: 14,
        padding: "14px 16px",
        transition: "box-shadow .15s ease, border-color .15s ease",
        position: "relative",
      }}
      className="group hover:shadow-[var(--shadow-hover)]"
    >
      {/* unread dot */}
      {!isRead && (
        <span style={{
          position: "absolute", top: 14, insetInlineStart: 14,
          width: 7, height: 7, borderRadius: "50%",
          background: cfg.dot,
        }} />
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingInlineStart: !isRead ? 4 : 0 }}>
        {/* icon */}
        <div style={{
          flexShrink: 0, width: 34, height: 34, borderRadius: 10,
          background: isRead ? "var(--surface-2)" : cfg.iconBg,
          color: isRead ? "var(--text-muted)" : cfg.iconColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginTop: 1,
        }}>
          {icon}
        </div>

        {/* text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
            <p style={{
              fontSize: 13.5, fontWeight: 600, lineHeight: 1.35,
              color: isRead ? "var(--text-secondary)" : "var(--text-primary)",
              margin: 0,
            }}>{n.title}</p>
            <span style={{ fontSize: 11.5, color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }}>
              {relativeTime(ms)}
            </span>
          </div>

          {n.description && n.description !== n.title && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55, margin: "0 0 8px" }}>
              {n.description}
            </p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, padding: "2px 7px", borderRadius: 6, fontWeight: 600,
              background: isRead ? "var(--surface-2)" : cfg.iconBg,
              color: isRead ? "var(--text-muted)" : cfg.iconColor,
            }}>
              {cfg.icon}
              {CATEGORY_LABELS[n.category] ?? n.category}
            </span>

            {n.financialData?.amountUSD && n.financialData.amountUSD > 0 && (
              <span style={{
                fontSize: 11, padding: "2px 7px", borderRadius: 6, fontWeight: 700,
                background: "var(--surface-2)", color: "var(--text-secondary)",
              }}>
                ${n.financialData.amountUSD.toFixed(2)}
              </span>
            )}

            {n.performedBy?.name && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                بواسطة {n.performedBy.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* actions — appear on hover */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: 10, paddingTop: 10,
        borderTop: "1px solid var(--border-soft)",
      }} className="opacity-0 group-hover:opacity-100 transition-opacity">
        <div>
          {n.actionUrl && (
            <Link
              href={n.actionUrl}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--jk-blue)", fontWeight: 600, textDecoration: "none" }}
            >
              <ExternalLink size={11} /> عرض التفاصيل
            </Link>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!isRead && (
            <button
              onClick={() => onRead(n.id)}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
            >
              <Check size={12} /> قراءة
            </button>
          )}
          <button
            onClick={() => onArchive(n.id)}
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
          >
            <Archive size={12} /> أرشفة
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── grouping ─────────────────────────────────────────────────────────────────

interface Group { label: string; items: AppNotification[] }

function groupByDate(items: AppNotification[]): Group[] {
  const todayStart     = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const yesterdayStart = todayStart - 86_400_000;

  const buckets: Record<string, AppNotification[]> = {
    critical:  [],
    today:     [],
    yesterday: [],
    earlier:   [],
  };

  for (const n of items) {
    if (n.severity === "critical") { buckets.critical.push(n); continue; }
    const ms = toMs(n.createdAt);
    if (ms >= todayStart)          buckets.today.push(n);
    else if (ms >= yesterdayStart) buckets.yesterday.push(n);
    else                           buckets.earlier.push(n);
  }

  const LABELS: Record<string, string> = {
    critical:  "⚡ حرج",
    today:     "اليوم",
    yesterday: "الأمس",
    earlier:   "سابقاً",
  };

  return Object.entries(buckets)
    .filter(([, list]) => list.length > 0)
    .map(([key, list]) => ({ label: LABELS[key] ?? key, items: list }));
}

// ─── filter matching ──────────────────────────────────────────────────────────

function matches(n: AppNotification, f: NotificationFilters, uid: string): boolean {
  if (f.unread && n.readBy?.includes(uid)) return false;
  if (f.category && n.category !== f.category) return false;
  if (f.severity && n.severity !== f.severity) return false;
  if (f.search) {
    const s = f.search.toLowerCase();
    if (
      !n.title.toLowerCase().includes(s) &&
      !n.description.toLowerCase().includes(s) &&
      !(n.entityName ?? "").toLowerCase().includes(s)
    ) return false;
  }
  if (f.dateFrom || f.dateTo) {
    const ms = toMs(n.createdAt);
    if (f.dateFrom && ms < new Date(f.dateFrom).getTime()) return false;
    if (f.dateTo   && ms > new Date(f.dateTo + "T23:59:59").getTime()) return false;
  }
  return true;
}

// ─── constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: NotificationCategory; label: string }[] = [
  { value: "operational", label: "تشغيلي" },
  { value: "financial",   label: "مالي" },
  { value: "security",    label: "أمان" },
  { value: "user",        label: "مستخدمون" },
  { value: "insight",     label: "رؤية" },
];

const SEVERITIES: { value: NotificationSeverity; label: string }[] = [
  { value: "success",  label: "ناجح" },
  { value: "info",     label: "معلومة" },
  { value: "warning",  label: "تحذير" },
  { value: "critical", label: "حرج" },
];

// ─── stat mini card ───────────────────────────────────────────────────────────

function MiniStat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border-soft)",
      borderRadius: 14,
      padding: "14px 18px",
      boxShadow: "var(--shadow-card)",
      display: "flex", flexDirection: "column", gap: 2,
    }}>
      <span style={{ fontSize: 22, fontWeight: 900, color: accent, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { user }                = useAuthStore();
  const { notifications, loading, markReadLocally, markAllReadLocally, archiveLocally } =
    useNotificationStore();

  const uid = user?.uid ?? "";

  const [filters, setFilters]         = useState<NotificationFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [runningAlerts, setRunningAlerts] = useState(false);

  function setFilter<K extends keyof NotificationFilters>(k: K, v: NotificationFilters[K]) {
    setFilters((f) => ({ ...f, [k]: v }));
  }
  function clearFilters() { setFilters({}); }

  const activeFilters = Object.values(filters).some(Boolean);

  const filtered = useMemo(
    () => notifications.filter((n) => matches(n, filters, uid)),
    [notifications, filters, uid]
  );
  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const unread    = notifications.filter((n) => !n.readBy?.includes(uid)).length;
  const critical  = notifications.filter((n) => n.severity === "critical").length;
  const financial = notifications.filter((n) => n.category === "financial").length;
  const security  = notifications.filter((n) => n.category === "security").length;

  function handleMarkRead(id: string) {
    markReadLocally(id, uid);
    notificationService.markAsRead(id, uid).catch(console.warn);
  }
  function handleMarkAll() {
    const ids = notifications.filter((n) => !n.readBy?.includes(uid)).map((n) => n.id);
    markAllReadLocally(uid);
    notificationService.markAllAsRead(ids, uid).catch(console.warn);
  }
  function handleArchive(id: string) {
    archiveLocally(id);
    notificationService.archiveNotification(id).catch(console.warn);
  }
  async function handleRunAlerts() {
    setRunningAlerts(true);
    try { await alertEngineService.runAll(); }
    finally { setRunningAlerts(false); }
  }

  return (
    <ProtectedLayout>
      <div style={{ padding: "20px 28px 40px", maxWidth: 860, margin: "0 auto" }}>

        {/* ── header ────────────────────────────────────────────────────── */}
        <PageHeader
          title="الإشعارات"
          subtitle={unread > 0 ? `${unread} إشعار غير مقروء` : "كل الإشعارات مقروءة"}
          actions={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={handleRunAlerts}
                disabled={runningAlerts}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                  color: "var(--text-secondary)", background: "var(--surface)",
                  border: "1px solid var(--border)", cursor: "pointer",
                  transition: "all .25s ease", fontFamily: "inherit",
                  opacity: runningAlerts ? 0.6 : 1,
                }}
              >
                <RefreshCw size={12} className={runningAlerts ? "animate-spin" : ""} />
                فحص التنبيهات
              </button>
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                    color: "#fff", background: "#000000",
                    border: "none", cursor: "pointer",
                    boxShadow: "var(--shadow-icon-btn)", transition: "all .25s ease",
                    fontFamily: "inherit",
                  }}
                >
                  <CheckCheck size={12} />
                  تعليم الكل كمقروء ({unread})
                </button>
              )}
            </div>
          }
        />

        {/* ── stats row ─────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          <MiniStat label="غير مقروء"  value={unread}    accent="var(--jk-blue)" />
          <MiniStat label="حرج"         value={critical}  accent="var(--jk-red)" />
          <MiniStat label="مالية"       value={financial} accent="#5B5FEF" />
          <MiniStat label="أمان"        value={security}  accent="var(--jk-warn)" />
        </div>

        {/* ── filter bar ────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setShowFilters((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)",
              background: "none", border: "none", cursor: "pointer",
              padding: "0 0 10px", fontFamily: "inherit", transition: "color .15s",
            }}
          >
            <SlidersHorizontal size={13} />
            {showFilters ? "إخفاء الفلاتر" : "فلترة الإشعارات"}
            {activeFilters && (
              <span style={{
                fontSize: 10.5, padding: "1px 7px", borderRadius: 20, fontWeight: 700,
                background: "var(--jk-blue)", color: "#fff",
              }}>نشط</span>
            )}
          </button>

          {showFilters && (
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--border-soft)",
              borderRadius: 14,
              padding: "14px 16px",
              boxShadow: "var(--shadow-panel)",
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              {/* search */}
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", insetInlineEnd: 12, color: "var(--text-muted)", pointerEvents: "none" }} />
                <input
                  type="text"
                  placeholder="بحث في الإشعارات..."
                  value={filters.search ?? ""}
                  onChange={(e) => setFilter("search", e.target.value || undefined)}
                  dir="rtl"
                  style={{
                    width: "100%", border: "1px solid var(--border)", borderRadius: 10,
                    paddingInlineEnd: 34, paddingInlineStart: 12, paddingTop: 8, paddingBottom: 8,
                    fontSize: 13, background: "var(--surface-2)", color: "var(--text-primary)",
                    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {/* unread toggle */}
                <button
                  onClick={() => setFilter("unread", filters.unread ? undefined : true)}
                  style={{
                    padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: filters.unread ? "#5B5FEF" : "var(--surface-2)",
                    color: filters.unread ? "#fff" : "var(--text-secondary)",
                    border: `1px solid ${filters.unread ? "#5B5FEF" : "var(--border)"}`,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  غير مقروء فقط
                </button>

                <select
                  value={filters.category ?? ""}
                  onChange={(e) => setFilter("category", (e.target.value as NotificationCategory) || undefined)}
                  style={{
                    border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px",
                    fontSize: 12, color: "var(--text-secondary)", background: "var(--surface-2)",
                    outline: "none", fontFamily: "inherit",
                  }}
                >
                  <option value="">كل الفئات</option>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>

                <select
                  value={filters.severity ?? ""}
                  onChange={(e) => setFilter("severity", (e.target.value as NotificationSeverity) || undefined)}
                  style={{
                    border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px",
                    fontSize: 12, color: "var(--text-secondary)", background: "var(--surface-2)",
                    outline: "none", fontFamily: "inherit",
                  }}
                >
                  <option value="">كل مستويات الخطورة</option>
                  {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>

                <input
                  type="date"
                  value={filters.dateFrom ?? ""}
                  onChange={(e) => setFilter("dateFrom", e.target.value || undefined)}
                  style={{
                    border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px",
                    fontSize: 12, color: "var(--text-secondary)", background: "var(--surface-2)",
                    outline: "none", fontFamily: "inherit",
                  }}
                />
                <input
                  type="date"
                  value={filters.dateTo ?? ""}
                  onChange={(e) => setFilter("dateTo", e.target.value || undefined)}
                  style={{
                    border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px",
                    fontSize: 12, color: "var(--text-secondary)", background: "var(--surface-2)",
                    outline: "none", fontFamily: "inherit",
                  }}
                />

                {activeFilters && (
                  <button
                    onClick={clearFilters}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      fontSize: 12, color: "var(--jk-red)", background: "none",
                      border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit",
                    }}
                  >
                    <X size={11} /> مسح الفلاتر
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── notification list ──────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
            <RefreshCw size={22} style={{ color: "var(--text-muted)" }} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border-soft)",
            borderRadius: 16,
            padding: "60px 20px",
            textAlign: "center",
            boxShadow: "var(--shadow-card)",
          }}>
            <Bell size={32} style={{ color: "var(--border)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
              {activeFilters ? "لا توجد إشعارات تطابق الفلاتر" : "لا توجد إشعارات"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {grouped.map((group) => (
              <section key={group.label}>
                {/* group label */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em",
                    color: group.label.includes("حرج") ? "var(--jk-red)" : "var(--text-muted)",
                  }}>
                    {group.label}
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{group.items.length}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {group.items.map((n) => (
                    <NotifCard
                      key={n.id}
                      n={n}
                      uid={uid}
                      onRead={handleMarkRead}
                      onArchive={handleArchive}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
