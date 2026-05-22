"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, Monitor, Smartphone, Tablet,
  RefreshCw, Search, AlertTriangle, LogOut,
  Clock, Wifi, WifiOff, X, Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore }    from "@/store/authStore";
import ProtectedLayout     from "@/components/layout/ProtectedLayout";
import PageHeader          from "@/components/layout/PageHeader";
import ConfirmDialog       from "@/components/ui/ConfirmDialog";
import { useSessions }     from "@/hooks/useSessions";
import { canViewSessions } from "@/lib/permissionGuards";
import { logLoginSession } from "@/lib/sessionLogger";
import { toast }           from "@/lib/toast";
import type { LoginSession, FailedLoginAttempt, DeviceType } from "@/types";

// ─── helpers ──────────────────────────────────────────────────────────────────

function toMs(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "object" && v !== null) {
    if ("toMillis" in v) return (v as { toMillis(): number }).toMillis();
    if ("seconds"  in v) return (v as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function fmtRelative(v: unknown): string {
  const ms = toMs(v);
  if (!ms) return "—";
  const d = Date.now() - ms;
  if (d <       60_000) return "الآن";
  if (d <    3_600_000) return `منذ ${Math.floor(d / 60_000)} دق`;
  if (d <   86_400_000) return `منذ ${Math.floor(d / 3_600_000)} س`;
  return `منذ ${Math.floor(d / 86_400_000)} يوم`;
}

function fmtDateTime(v: unknown): string {
  const ms = toMs(v);
  if (!ms) return "—";
  return new Date(ms).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
}

function fmtDuration(s: LoginSession): string {
  let secs = s.sessionDuration;
  if (!secs) {
    const start = toMs(s.loginAt);
    const end   = toMs(s.logoutAt) || (s.isActive ? Date.now() : 0);
    if (start && end) secs = Math.floor((end - start) / 1000);
  }
  if (!secs || secs < 0) return "—";
  if (secs < 60)   return `${secs} ث`;
  if (secs < 3600) return `${Math.floor(secs / 60)} دق`;
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return m ? `${h} س ${m} دق` : `${h} ساعة`;
}

// ─── status ───────────────────────────────────────────────────────────────────

type StatusInfo = { label: string; textColor: string; bgColor: string; dotColor: string; online: boolean };

function getStatus(s: LoginSession): StatusInfo {
  const raw      = (s.status as string) || (s.isActive ? "active" : "logged_out");
  const diffMin  = (Date.now() - toMs(s.lastSeenAt)) / 60_000;

  if (raw === "logged_out") return { label: "خرج",        textColor: "#6b7280", bgColor: "#f1f5f9",         dotColor: "#9ca3af", online: false };
  if (raw === "suspicious") return { label: "مشبوه",      textColor: "#F59E0B", bgColor: "#fff7ed",         dotColor: "#F59E0B", online: false };
  if (raw === "active" || s.isActive) {
    if (diffMin < 5)  return { label: "متصل الآن",       textColor: "#5B5FEF", bgColor: "#ecfdf5",         dotColor: "#5B5FEF", online: true  };
    if (diffMin < 30) return { label: "نشطة",             textColor: "#5B5FEF", bgColor: "#eff6ff",         dotColor: "#5B5FEF", online: false };
    return                   { label: "منتهية",           textColor: "#6B7280", bgColor: "#f9fafb",         dotColor: "#9CA3AF", online: false };
  }
  return { label: "منتهية", textColor: "#6B7280", bgColor: "#f9fafb", dotColor: "#9CA3AF", online: false };
}

const ROLE_META: Record<string, { label: string; color: string }> = {
  owner:    { label: "مالك",   color: "#F59E0B" },
  admin:    { label: "مدير",   color: "#5B5FEF" },
  employee: { label: "موظف",   color: "#6B7280" },
};

function DeviceIcon({ device }: { device: DeviceType }) {
  if (device === "mobile") return <Smartphone size={13} className="text-blue-500"   />;
  if (device === "tablet") return <Tablet     size={13} className="text-violet-500" />;
  return                          <Monitor    size={13} className="text-slate-400"  />;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, iconBg, pulse = false }: {
  label: string; value: number; icon: React.ReactNode; iconBg: string; pulse?: boolean;
}) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border-soft)",
      borderRadius: 16, boxShadow: "var(--shadow-card)", padding: "14px 16px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
        {pulse && value > 0 && (
          <span className="absolute inset-0 rounded-xl animate-ping opacity-25" style={{ background: iconBg }} />
        )}
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>{value}</p>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 500 }}>{label}</p>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow({ cols = 7 }: { cols?: number }) {
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 rounded-lg bg-slate-100 animate-pulse" style={{ width: `${50 + i * 8}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Session detail modal ─────────────────────────────────────────────────────

function DetailModal({ session, currentUid, onClose, onRevoke }: {
  session: LoginSession; currentUid: string; onClose: () => void; onRevoke: () => void;
}) {
  const si      = getStatus(session);
  const role    = ROLE_META[session.role] ?? { label: session.role, color: "#6B7280" };
  const canKick = si.online && session.uid !== currentUid;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 6 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white"
                 style={{ background: role.color }}>
              {(session.displayName || session.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 leading-tight">{session.displayName || "—"}</p>
              <p className="text-xs text-slate-400">{session.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100">
            <X size={17} />
          </button>
        </div>

        {/* body */}
        <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* badges */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ color: si.textColor, background: si.bgColor }}>
              <span className={`w-1.5 h-1.5 rounded-full ${si.online ? "animate-pulse" : ""}`}
                    style={{ background: si.dotColor }} />
              {si.label}
            </span>
            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold text-white"
                  style={{ background: role.color }}>
              {role.label}
            </span>
          </div>

          <InfoSection title="التوقيت">
            <InfoRow label="تسجيل الدخول"  value={`${fmtRelative(session.loginAt)} · ${fmtDateTime(session.loginAt)}`} />
            <InfoRow label="آخر نشاط"       value={`${fmtRelative(session.lastSeenAt)} · ${fmtDateTime(session.lastSeenAt)}`} />
            {session.logoutAt && <InfoRow label="وقت الخروج" value={fmtDateTime(session.logoutAt)} />}
            <InfoRow label="مدة الجلسة"    value={fmtDuration(session)} />
          </InfoSection>

          <InfoSection title="الشبكة">
            <InfoRow label="عنوان IP"  value={<span className="font-mono text-xs">{session.ipAddress}</span>} />
            {session.country && <InfoRow label="الدولة"  value={session.country} />}
            {session.city    && <InfoRow label="المدينة" value={session.city}    />}
          </InfoSection>

          <InfoSection title="الجهاز">
            <InfoRow label="النوع"
                     value={<span className="flex items-center gap-1.5"><DeviceIcon device={session.device} />
                       {session.device === "desktop" ? "حاسوب" : session.device === "mobile" ? "هاتف" : "لوحي"}
                     </span>}
            />
            <InfoRow label="المتصفح" value={`${session.browser}${session.browserVersion ? ` ${session.browserVersion}` : ""}`} />
            <InfoRow label="النظام"  value={`${session.os}${session.osVersion ? ` ${session.osVersion}` : ""}`} />
          </InfoSection>

          {session.userAgent && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">معرّف المتصفح</p>
              <p className="text-[10px] font-mono text-slate-400 break-all leading-relaxed bg-slate-50 rounded-lg p-2">
                {session.userAgent}
              </p>
            </div>
          )}
        </div>

        {/* footer */}
        {canKick && (
          <div className="px-5 py-3 border-t border-slate-100">
            <button
              onClick={onRevoke}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-all"
            >
              <LogOut size={14} />
              تسجيل خروج إجباري
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{title}</p>
      <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-slate-50/60 gap-3">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-xs text-slate-700 font-semibold text-left">{value}</span>
    </div>
  );
}

// ─── Sessions table row ───────────────────────────────────────────────────────

function SessionRow({ session, currentUid, onClick }: {
  session: LoginSession; currentUid: string; onClick: () => void;
}) {
  const si   = getStatus(session);
  const role = ROLE_META[session.role] ?? { label: session.role, color: "#6B7280" };
  const self = session.uid === currentUid;

  return (
    <tr
      className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Employee */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
               style={{ background: role.color }}>
            {(session.displayName || session.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate leading-tight">
              {session.displayName || "—"}
              {self && <span className="mr-1.5 text-[9px] bg-blue-100 text-blue-600 font-bold px-1 py-0.5 rounded">أنت</span>}
            </p>
            <p className="text-xs text-slate-400 truncate">{session.email}</p>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ color: si.textColor, background: si.bgColor }}>
          <span className={`w-1.5 h-1.5 rounded-full ${si.online ? "animate-pulse" : ""}`}
                style={{ background: si.dotColor }} />
          {si.label}
        </span>
      </td>

      {/* Login time */}
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-sm text-slate-600">{fmtRelative(session.loginAt)}</p>
        <p className="text-xs text-slate-400 mt-0.5">{fmtDateTime(session.loginAt)}</p>
      </td>

      {/* Last seen */}
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-sm text-slate-500">{fmtRelative(session.lastSeenAt)}</p>
      </td>

      {/* Duration */}
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-sm font-mono text-slate-500">{fmtDuration(session)}</p>
      </td>

      {/* Device */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <DeviceIcon device={session.device} />
          <div>
            <p className="text-sm text-slate-600">{session.browser}{session.browserVersion ? ` ${session.browserVersion}` : ""}</p>
            <p className="text-xs text-slate-400">{session.os}</p>
          </div>
        </div>
      </td>

      {/* IP */}
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-sm font-mono text-slate-500">{session.ipAddress}</p>
        {session.country && (
          <p className="text-xs text-slate-400 mt-0.5">{session.city ? `${session.city}, ` : ""}{session.country}</p>
        )}
      </td>
    </tr>
  );
}

// ─── Failed attempts table row ────────────────────────────────────────────────

function FailedRow({ a }: { a: FailedLoginAttempt }) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-sm text-slate-600">{fmtRelative(a.attemptedAt)}</p>
        <p className="text-xs text-slate-400">{fmtDateTime(a.attemptedAt)}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-mono text-slate-600">{a.email || "—"}</p>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-sm font-mono text-slate-500">{a.ipAddress}</p>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <DeviceIcon device={a.device as DeviceType} />
          <div>
            <p className="text-sm text-slate-600">{a.browser}</p>
            <p className="text-xs text-slate-400">{a.os}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
          {a.reason}
        </span>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const router    = useRouter();
  const { user, loading: authLoading } = useAuthStore();
  const {
    sessions, failed, summary, loading, loadingFailed, error,
    fetchSessions, fetchFailed, revokeUser,
  } = useSessions();

  const [tab,          setTab]          = useState<"sessions" | "failed">("sessions");
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "active" | "logged_out">("all");
  const [detail,       setDetail]       = useState<LoginSession | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<LoginSession | null>(null);
  const [revoking,     setRevoking]     = useState(false);

  const fetchRef  = useRef(fetchSessions);
  const failedRef = useRef(fetchFailed);
  fetchRef.current  = fetchSessions;
  failedRef.current = fetchFailed;

  // access guard
  useEffect(() => {
    if (!authLoading && user && !canViewSessions(user)) router.replace("/");
  }, [user, authLoading, router]);

  // initial load + auto-refresh every 60s
  useEffect(() => {
    if (authLoading || !user || !canViewSessions(user)) return;
    let retry: ReturnType<typeof setTimeout>;

    logLoginSession().finally(() => {
      fetchRef.current();
      retry = setTimeout(() => fetchRef.current(), 2500);
    });

    const interval = setInterval(() => fetchRef.current(), 60_000);
    return () => { clearTimeout(retry); clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.uid]);

  // load failed when tab opens
  useEffect(() => {
    if (tab === "failed" && failed.length === 0 && !loadingFailed) failedRef.current();
  }, [tab, failed.length, loadingFailed]);

  // filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return sessions.filter((s) => {
      if (statusFilter !== "all") {
        const si = getStatus(s);
        if (statusFilter === "online"     && !si.online)                               return false;
        if (statusFilter === "active"     && !(si.online || si.label === "نشطة"))      return false;
        if (statusFilter === "logged_out" && si.label !== "خرج")                       return false;
      }
      if (!q) return true;
      return (
        s.email.toLowerCase().includes(q) ||
        s.displayName.toLowerCase().includes(q) ||
        s.ipAddress.includes(q) ||
        s.browser.toLowerCase().includes(q) ||
        (s.country ?? "").toLowerCase().includes(q)
      );
    });
  }, [sessions, statusFilter, search]);

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    const ok = await revokeUser(revokeTarget.uid);
    setRevoking(false);
    setRevokeTarget(null);
    setDetail(null);
    if (ok) { toast.success("تم إلغاء جميع جلسات المستخدم"); fetchRef.current(); }
    else    toast.error("فشل إلغاء الجلسة — حاول مرة أخرى");
  }

  if (!authLoading && (!user || !canViewSessions(user))) return null;

  return (
    <ProtectedLayout>
      <div className="p-6 space-y-5 max-w-[1400px] mx-auto" dir="rtl">

        {/* Header */}
        <PageHeader
          title="سجل الجلسات"
          subtitle={`${sessions.length} جلسة · ${summary.onlineNow} متصل الآن`}
          actions={
            <div className="flex items-center gap-2">
              {loading && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Activity size={11} className="animate-pulse text-blue-500" />
                  يتحدث تلقائياً
                </span>
              )}
              <button
                onClick={() => fetchRef.current()}
                disabled={loading}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                  borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  color: "var(--text-secondary)", fontFamily: "inherit",
                  opacity: loading ? 0.5 : 1, transition: "all .25s",
                }}
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                تحديث
              </button>
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="جلسات نشطة"
            value={summary.totalActive}
            icon={<Shield size={18} className="text-blue-600" />}
            iconBg="#eff6ff"
          />
          <StatCard
            label="متصلون الآن"
            value={summary.onlineNow}
            icon={<Wifi size={18} className="text-emerald-600" />}
            iconBg="#ecfdf5"
            pulse
          />
          <StatCard
            label="دخول اليوم"
            value={summary.todayLogins}
            icon={<Clock size={18} className="text-violet-600" />}
            iconBg="#f5f3ff"
          />
          <StatCard
            label="محاولات فاشلة"
            value={summary.failedToday}
            icon={<AlertTriangle size={17} className="text-amber-600" />}
            iconBg="#fffbeb"
          />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border-soft)" }}>
          {([
            { key: "sessions", label: `الجلسات (${sessions.length})` },
            { key: "failed",   label: `المحاولات الفاشلة (${summary.failedToday})` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: "none", border: "none", fontFamily: "inherit",
                borderBottom: tab === key ? `2px solid var(--jk-blue)` : "2px solid transparent",
                color: tab === key ? "var(--jk-blue)" : "var(--text-muted)",
                marginBottom: -1, transition: "all .15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Sessions tab ─────────────────────────────────────────────────── */}
        {tab === "sessions" && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-2.5">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث بالاسم أو IP أو المتصفح أو الدولة..."
                  style={{
                    width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 10, padding: "8px 12px 8px 36px", fontSize: 13,
                    color: "var(--text-primary)", outline: "none", fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{
                display: "flex", background: "var(--surface-2)", border: "1px solid var(--border)",
                borderRadius: 10, padding: 4, gap: 2,
              }}>
                {([
                  { key: "all",        label: "الكل" },
                  { key: "online",     label: "متصل" },
                  { key: "active",     label: "نشطة" },
                  { key: "logged_out", label: "خرج"  },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    style={{
                      padding: "5px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit", border: "none", transition: "all .15s",
                      background: statusFilter === key ? "var(--jk-blue)" : "transparent",
                      color: statusFilter === key ? "#fff" : "var(--text-muted)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertTriangle size={15} className="shrink-0" />
                {error}
              </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {loading && sessions.length === 0 ? (
                <table className="w-full"><tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</tbody></table>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Shield size={32} className="text-slate-200" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-500">لا توجد جلسات بعد</p>
                    <p className="text-xs text-slate-400 mt-1">ستظهر الجلسات تلقائياً — اضغط تحديث إذا لم تظهر خلال ثوانٍ</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {["الموظف", "الحالة", "وقت الدخول", "آخر نشاط", "المدة", "الجهاز / المتصفح", "IP / الموقع"].map((h) => (
                          <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-slate-500 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => (
                        <SessionRow key={s.id} session={s} currentUid={user!.uid} onClick={() => setDetail(s)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 text-center">
              {filtered.length} من {sessions.length} جلسة — يتحدث تلقائياً كل دقيقة
            </p>
          </>
        )}

        {/* ── Failed tab ──────────────────────────────────────────────────── */}
        {tab === "failed" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {loadingFailed ? (
              <table className="w-full"><tbody>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}</tbody></table>
            ) : failed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <WifiOff size={28} className="text-slate-200" />
                <p className="text-sm font-semibold text-slate-500">لا توجد محاولات فاشلة مسجلة</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {["وقت المحاولة", "البريد الإلكتروني", "عنوان IP", "الجهاز / المتصفح", "السبب"].map((h) => (
                        <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {failed.map((a) => <FailedRow key={a.id} a={a} />)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {detail && (
          <DetailModal
            session={detail}
            currentUid={user!.uid}
            onClose={() => setDetail(null)}
            onRevoke={() => { setRevokeTarget(detail); setDetail(null); }}
          />
        )}
      </AnimatePresence>

      {/* Revoke confirm */}
      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="تسجيل خروج إجباري"
        description={`هل تريد إلغاء جميع جلسات "${revokeTarget?.displayName || revokeTarget?.email || ""}"؟ سيتم تسجيل خروجه من جميع الأجهزة.`}
        confirmLabel="تأكيد الإلغاء"
        loading={revoking}
        destructive
      />
    </ProtectedLayout>
  );
}
