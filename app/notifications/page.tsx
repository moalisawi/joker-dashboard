"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import {
  Bell, CheckCheck, SlidersHorizontal,
  Search, X, RefreshCw,
} from "lucide-react";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import NotificationCard from "@/components/notifications/NotificationCard";
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

// ─── timestamp helper ─────────────────────────────────────────────────────────

function toMs(val: unknown): number {
  if (!val) return 0;
  if (typeof val === "object" && val !== null) {
    if ("toMillis" in val) return (val as { toMillis(): number }).toMillis();
    if ("seconds"  in val) return (val as { seconds: number }).seconds * 1000;
  }
  return 0;
}

// ─── grouping ─────────────────────────────────────────────────────────────────

interface Group { label: string; items: AppNotification[] }

function groupByDate(items: AppNotification[]): Group[] {
  const now       = Date.now();
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

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

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
    try {
      await alertEngineService.runAll();
    } finally {
      setRunningAlerts(false);
    }
  }

  return (
    <ProtectedLayout>
      <div className="p-5 md:p-7 max-w-4xl mx-auto space-y-5">

        {/* header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <Bell size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800">الإشعارات</h1>
              <p className="text-xs text-slate-400">مركز الإشعارات — تحديث فوري</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunAlerts}
              disabled={runningAlerts}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition disabled:opacity-60"
            >
              <RefreshCw size={13} className={runningAlerts ? "animate-spin" : ""} />
              فحص التنبيهات
            </button>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                  text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition"
              >
                <CheckCheck size={13} />
                قراءة الكل ({unread})
              </button>
            )}
          </div>
        </div>

        {/* stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="غير مقروء"  value={unread}    color="text-blue-600" />
          <StatCard label="حرج"         value={critical}  color="text-red-600" />
          <StatCard label="مالية"       value={financial} color="text-emerald-600" />
          <StatCard label="أمان"        value={security}  color="text-amber-600" />
        </div>

        {/* filters toggle */}
        <div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition mb-2"
          >
            <SlidersHorizontal size={14} />
            {showFilters ? "إخفاء الفلاتر" : "فلترة الإشعارات"}
            {activeFilters && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">نشط</span>
            )}
          </button>

          {showFilters && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
              {/* search */}
              <div className="relative">
                <Search size={13} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="بحث في الإشعارات..."
                  value={filters.search ?? ""}
                  onChange={(e) => setFilter("search", e.target.value || undefined)}
                  className="w-full border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 placeholder:text-slate-400"
                  dir="rtl"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {/* unread toggle */}
                <button
                  onClick={() => setFilter("unread", filters.unread ? undefined : true)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                    filters.unread
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  غير مقروء فقط
                </button>

                <select
                  value={filters.category ?? ""}
                  onChange={(e) => setFilter("category", (e.target.value as NotificationCategory) || undefined)}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">كل الفئات</option>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>

                <select
                  value={filters.severity ?? ""}
                  onChange={(e) => setFilter("severity", (e.target.value as NotificationSeverity) || undefined)}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">كل مستويات الخطورة</option>
                  {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>

                <input
                  type="date"
                  value={filters.dateFrom ?? ""}
                  onChange={(e) => setFilter("dateFrom", e.target.value || undefined)}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600 bg-white focus:outline-none"
                />
                <input
                  type="date"
                  value={filters.dateTo ?? ""}
                  onChange={(e) => setFilter("dateTo", e.target.value || undefined)}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600 bg-white focus:outline-none"
                />

                {activeFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition font-medium"
                  >
                    <X size={12} /> مسح
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* notification list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="text-slate-300 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
            <Bell size={36} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">
              {activeFilters ? "لا توجد إشعارات تطابق الفلاتر" : "لا توجد إشعارات"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <section key={group.label}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs font-bold uppercase tracking-wide ${
                    group.label.includes("حرج") ? "text-red-600" : "text-slate-500"
                  }`}>
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs text-slate-400">{group.items.length}</span>
                </div>
                <div className="space-y-2">
                  {group.items.map((n) => (
                    <NotificationCard
                      key={n.id}
                      notification={n}
                      currentUid={uid}
                      onMarkRead={handleMarkRead}
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
