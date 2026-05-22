"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, Monitor, Smartphone, Tablet,
  RefreshCw, Search, AlertTriangle, LogOut,
  Clock, Wifi, WifiOff, X, Activity, Radio,
  Users, TrendingUp, Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore }         from "@/store/authStore";
import ProtectedLayout          from "@/components/layout/ProtectedLayout";
import PageHeader               from "@/components/layout/PageHeader";
import ConfirmDialog            from "@/components/ui/ConfirmDialog";
import { useSessions }          from "@/hooks/useSessions";
import { useRealtimeMetrics }   from "@/hooks/useRealtimeMetrics";
import { canViewSessions }      from "@/lib/permissionGuards";
import { logLoginSession }      from "@/lib/sessionLogger";
import { toast }                from "@/lib/toast";
import type { LoginSession, FailedLoginAttempt, DeviceType } from "@/types";

// ─── Timestamp helpers ────────────────────────────────────────────────────────

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

// ─── Session status ───────────────────────────────────────────────────────────

type StatusInfo = {
  label:     string;
  textColor: string;
  bgColor:   string;
  dotColor:  string;
  online:    boolean;
};

function getStatus(s: LoginSession): StatusInfo {
  const raw     = (s.status as string) || (s.isActive ? "active" : "logged_out");
  const diffMin = (Date.now() - toMs(s.lastSeenAt)) / 60_000;

  if (raw === "logged_out") return { label: "خرج",       textColor: "#6b7280", bgColor: "#f1f5f9", dotColor: "#9ca3af", online: false };
  if (raw === "suspicious") return { label: "مشبوه",     textColor: "#F59E0B", bgColor: "#fff7ed", dotColor: "#F59E0B", online: false };
  if (raw === "active" || s.isActive) {
    if (diffMin < 5)  return { label: "متصل الآن",  textColor: "#059669", bgColor: "#ecfdf5", dotColor: "#10b981", online: true  };
    if (diffMin < 30) return { label: "نشطة",        textColor: "#5B5FEF", bgColor: "#eff6ff", dotColor: "#5B5FEF", online: false };
    return                   { label: "منتهية",      textColor: "#6B7280", bgColor: "#f9fafb", dotColor: "#9CA3AF", online: false };
  }
  return { label: "منتهية", textColor: "#6B7280", bgColor: "#f9fafb", dotColor: "#9CA3AF", online: false };
}

const ROLE_META: Record<string, { label: string; color: string }> = {
  owner:    { label: "مالك",  color: "#F59E0B" },
  admin:    { label: "مدير",  color: "#5B5FEF" },
  employee: { label: "موظف",  color: "#6B7280" },
};

function DeviceIcon({ device }: { device: DeviceType }) {
  if (device === "mobile") return <Smartphone size={13} style={{ color: "#3B82F6" }}  />;
  if (device === "tablet") return <Tablet     size={13} style={{ color: "#8B5CF6" }} />;
  return                          <Monitor    size={13} style={{ color: "#9CA3AF" }} />;
}

// ─── LIVE indicator ───────────────────────────────────────────────────────────

function LiveBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{
        background: connected ? "#ecfdf5" : "#f9fafb",
        color:      connected ? "#059669" : "#9ca3af",
        border:     `1px solid ${connected ? "rgba(16,185,129,0.25)" : "rgba(156,163,175,0.25)"}`,
      }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${connected ? "animate-pulse" : ""}`}
        style={{ background: connected ? "#10b981" : "#9ca3af" }}
      />
      {connected ? "LIVE" : "غير متصل"}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, iconBg, pulse = false, live = false, subtitle,
}: {
  label: string; value: number; icon: React.ReactNode; iconBg: string;
  pulse?: boolean; live?: boolean; subtitle?: string;
}) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border-light)",
      borderRadius: 20, boxShadow: "var(--shadow-card)", padding: "16px 18px",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
           style={{ background: iconBg }}>
        {pulse && value > 0 && (
          <span className="absolute inset-0 rounded-xl animate-ping opacity-20"
                style={{ background: iconBg }} />
        )}
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)", lineHeight: 1 }}>{value}</p>
          {live && value > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider"
                  style={{ background: "#ecfdf5", color: "#059669" }}>
              LIVE
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginTop: 2 }}>{label}</p>
        {subtitle && <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow({ cols = 7 }: { cols?: number }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--border-soft)" }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "12px 16px" }}>
          <div className="animate-pulse" style={{
            height: 12, borderRadius: 6,
            background: "var(--border-soft)", width: `${45 + i * 7}%`,
          }} />
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
  const canKick = session.uid !== currentUid;

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
        style={{
          background: "var(--surface)", border: "1px solid var(--border-light)",
          borderRadius: 24, boxShadow: "var(--shadow-modal)",
          width: "100%", maxWidth: 440, overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--border-soft)",
        }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white"
                 style={{ background: role.color }}>
              {(session.displayName || session.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
                {session.displayName || "—"}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{session.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "var(--text-muted)" }}
          >
            <X size={17} />
          </button>
        </div>

        {/* body */}
        <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="flex items-center gap-2 flex-wrap">
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
            {session.isSuspicious && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{ background: "#fff7ed", color: "#F59E0B" }}>
                <AlertTriangle size={10} /> مشبوه
              </span>
            )}
          </div>

          <InfoSection title="التوقيت">
            <InfoRow label="تسجيل الدخول" value={`${fmtRelative(session.loginAt)} · ${fmtDateTime(session.loginAt)}`} />
            <InfoRow label="آخر نشاط"      value={`${fmtRelative(session.lastSeenAt)} · ${fmtDateTime(session.lastSeenAt)}`} />
            {session.logoutAt && <InfoRow label="وقت الخروج" value={fmtDateTime(session.logoutAt)} />}
            <InfoRow label="مدة الجلسة"   value={fmtDuration(session)} />
          </InfoSection>

          <InfoSection title="الشبكة">
            <InfoRow label="عنوان IP" value={<span className="font-mono text-xs">{session.ipAddress}</span>} />
            {session.country && <InfoRow label="الدولة"  value={session.country} />}
            {session.city    && <InfoRow label="المدينة" value={session.city}    />}
          </InfoSection>

          <InfoSection title="الجهاز">
            <InfoRow label="النوع"
                     value={
                       <span className="flex items-center gap-1.5">
                         <DeviceIcon device={session.device} />
                         {session.device === "desktop" ? "حاسوب" : session.device === "mobile" ? "هاتف" : "لوحي"}
                       </span>
                     } />
            <InfoRow label="المتصفح" value={`${session.browser}${session.browserVersion ? ` ${session.browserVersion}` : ""}`} />
            <InfoRow label="النظام"  value={`${session.os}${session.osVersion ? ` ${session.osVersion}` : ""}`} />
          </InfoSection>

          {session.userAgent && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                معرّف المتصفح
              </p>
              <p style={{
                fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)",
                wordBreak: "break-all", lineHeight: 1.6,
                background: "var(--surface-secondary)", borderRadius: 8, padding: 8,
              }}>
                {session.userAgent}
              </p>
            </div>
          )}
        </div>

        {/* footer */}
        {canKick && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-soft)" }}>
            <button
              onClick={onRevoke}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, padding: "9px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600,
                color: "#EF4444", background: "#FEF2F2", border: "1px solid rgba(239,68,68,0.25)",
                cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
              }}
            >
              <LogOut size={14} />
              تسجيل خروج إجباري من جميع الأجهزة
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
      <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
        {title}
      </p>
      <div style={{ borderRadius: 12, border: "1px solid var(--border-soft)", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 12px", background: "var(--surface-secondary)",
      borderBottom: "1px solid var(--border-soft)", gap: 12,
    }}>
      <span style={{ fontSize: 12, color: "var(--text-secondary)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600, textAlign: "left" }}>{value}</span>
    </div>
  );
}

// ─── Session table row ────────────────────────────────────────────────────────

function SessionRow({ session, currentUid, onClick }: {
  session: LoginSession; currentUid: string; onClick: () => void;
}) {
  const si   = getStatus(session);
  const role = ROLE_META[session.role] ?? { label: session.role, color: "#6B7280" };
  const self = session.uid === currentUid;

  return (
    <tr
      style={{ borderBottom: "1px solid var(--border-soft)", cursor: "pointer", transition: "background .15s" }}
      onClick={onClick}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-hover, #f8fafc)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {/* User */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
               style={{ background: role.color }}>
            {(session.displayName || session.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}
               className="truncate">
              {session.displayName || "—"}
              {self && (
                <span style={{
                  marginRight: 6, fontSize: 9, background: "rgba(91,95,239,0.12)",
                  color: "#5B5FEF", fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                }}>
                  أنت
                </span>
              )}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }} className="truncate">{session.email}</p>
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
      <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
        <p style={{ fontSize: 13, color: "var(--text-primary)" }}>{fmtRelative(session.loginAt)}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{fmtDateTime(session.loginAt)}</p>
      </td>

      {/* Last seen */}
      <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fmtRelative(session.lastSeenAt)}</p>
      </td>

      {/* Duration */}
      <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
        <p style={{ fontSize: 13, fontFamily: "monospace", color: "var(--text-secondary)" }}>
          {fmtDuration(session)}
        </p>
      </td>

      {/* Device */}
      <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
        <div className="flex items-center gap-1.5">
          <DeviceIcon device={session.device} />
          <div>
            <p style={{ fontSize: 13, color: "var(--text-primary)" }}>
              {session.browser}{session.browserVersion ? ` ${session.browserVersion}` : ""}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{session.os}</p>
          </div>
        </div>
      </td>

      {/* IP */}
      <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
        <p style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>
          {session.ipAddress}
        </p>
        {session.country && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {session.city ? `${session.city}, ` : ""}{session.country}
          </p>
        )}
      </td>
    </tr>
  );
}

// ─── Failed attempts table row ────────────────────────────────────────────────

function FailedRow({ a }: { a: FailedLoginAttempt }) {
  return (
    <tr
      style={{ borderBottom: "1px solid var(--border-soft)", transition: "background .15s" }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-hover, #f8fafc)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
        <p style={{ fontSize: 13, color: "var(--text-primary)" }}>{fmtRelative(a.attemptedAt)}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{fmtDateTime(a.attemptedAt)}</p>
      </td>
      <td style={{ padding: "11px 16px" }}>
        <p style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>
          {a.email || "—"}
        </p>
      </td>
      <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
        <p style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>
          {a.ipAddress}
        </p>
      </td>
      <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
        <div className="flex items-center gap-1.5">
          <DeviceIcon device={a.device as DeviceType} />
          <div>
            <p style={{ fontSize: 13, color: "var(--text-primary)" }}>{a.browser}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.os}</p>
          </div>
        </div>
      </td>
      <td style={{ padding: "11px 16px" }}>
        <span style={{
          display: "inline-flex", padding: "3px 10px", borderRadius: 999,
          fontSize: 12, fontWeight: 600, background: "#FEF2F2", color: "#EF4444",
          border: "1px solid rgba(239,68,68,0.20)",
        }}>
          {a.reason}
        </span>
      </td>
    </tr>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, subtitle }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  title: string; subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
           style={{ background: "#F1F5F9" }}>
        <Icon size={24} style={{ color: "#9CA3AF" }} />
      </div>
      <div className="text-center">
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)" }}>{title}</p>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, maxWidth: 280 }}>{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const router   = useRouter();
  const { user, loading: authLoading } = useAuthStore();
  const {
    sessions, failed, summary, loading, loadingFailed, error,
    fetchSessions, fetchFailed, revokeUser,
  } = useSessions();
  const rtMetrics = useRealtimeMetrics();

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

  // Access guard
  useEffect(() => {
    if (!authLoading && user && !canViewSessions(user)) router.replace("/");
  }, [user, authLoading, router]);

  // Initial load + auto-refresh every 10s (faster than legacy 60s)
  useEffect(() => {
    if (authLoading || !user || !canViewSessions(user)) return;
    let retry: ReturnType<typeof setTimeout>;

    logLoginSession().finally(() => {
      fetchRef.current();
      retry = setTimeout(() => fetchRef.current(), 2500);
    });

    const interval = setInterval(() => fetchRef.current(), 10_000);
    return () => { clearTimeout(retry); clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.uid]);

  // Load failed attempts when tab opens
  useEffect(() => {
    if (tab === "failed" && failed.length === 0 && !loadingFailed) failedRef.current();
  }, [tab, failed.length, loadingFailed]);

  // Merge RTDB live online count into summary (RTDB is more accurate than REST)
  const mergedSummary = useMemo(() => ({
    ...summary,
    onlineNow: rtMetrics.isConnected ? rtMetrics.onlineNow : summary.onlineNow,
  }), [summary, rtMetrics]);

  // Filter sessions
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return sessions.filter((s) => {
      if (statusFilter !== "all") {
        const si = getStatus(s);
        if (statusFilter === "online"     && !si.online)                          return false;
        if (statusFilter === "active"     && !(si.online || si.label === "نشطة")) return false;
        if (statusFilter === "logged_out" && si.label !== "خرج")                  return false;
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
    if (ok) {
      toast.success("تم إلغاء جميع جلسات المستخدم وسيُسجَّل خروجه تلقائياً");
      fetchRef.current();
    } else {
      toast.error("فشل إلغاء الجلسة — حاول مرة أخرى");
    }
  }

  if (!authLoading && (!user || !canViewSessions(user))) return null;

  return (
    <ProtectedLayout>
      <div className="p-6 space-y-5 max-w-[1400px] mx-auto" dir="rtl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <PageHeader
          title="مراقبة الجلسات"
          subtitle={`${sessions.length} جلسة · ${mergedSummary.onlineNow} متصل الآن`}
          actions={
            <div className="flex items-center gap-3">
              <LiveBadge connected={rtMetrics.isConnected} />
              {loading && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Activity size={11} className="animate-pulse text-blue-500" />
                  يتحدث
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

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="جلسات نشطة"
            value={mergedSummary.totalActive}
            icon={<Shield size={18} className="text-blue-600" />}
            iconBg="#eff6ff"
          />
          <StatCard
            label="متصلون الآن"
            value={mergedSummary.onlineNow}
            icon={<Wifi size={18} className="text-emerald-600" />}
            iconBg="#ecfdf5"
            pulse
            live={rtMetrics.isConnected}
            subtitle={rtMetrics.isConnected ? "مباشر" : undefined}
          />
          <StatCard
            label="دخول اليوم"
            value={mergedSummary.todayLogins}
            icon={<Clock size={18} className="text-violet-600" />}
            iconBg="#f5f3ff"
          />
          <StatCard
            label="محاولات فاشلة"
            value={mergedSummary.failedToday}
            icon={<AlertTriangle size={17} className="text-amber-600" />}
            iconBg="#fffbeb"
          />
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border-soft)" }}>
          {([
            { key: "sessions", label: `الجلسات (${sessions.length})` },
            { key: "failed",   label: `المحاولات الفاشلة (${mergedSummary.failedToday})` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: "none", border: "none", fontFamily: "inherit",
                borderBottom: tab === key ? "2px solid #5B5FEF" : "2px solid transparent",
                color: tab === key ? "#5B5FEF" : "var(--text-muted)",
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
                <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: "var(--text-muted)" }} />
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
                display: "flex", background: "var(--surface-secondary, #f8fafc)",
                border: "1px solid var(--border)", borderRadius: 10, padding: 4, gap: 2,
              }}>
                {([
                  { key: "all",        label: "الكل"   },
                  { key: "online",     label: "متصل"   },
                  { key: "active",     label: "نشطة"   },
                  { key: "logged_out", label: "خرج"    },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    style={{
                      padding: "5px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit", border: "none", transition: "all .15s",
                      background: statusFilter === key ? "#5B5FEF" : "transparent",
                      color:      statusFilter === key ? "#fff" : "var(--text-muted)",
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
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border-light)",
              borderRadius: 20, boxShadow: "var(--shadow-card)", overflow: "hidden",
            }}>
              {loading && sessions.length === 0 ? (
                <table className="w-full">
                  <tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
                </table>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={Shield}
                  title="لا توجد جلسات بعد"
                  subtitle="ستظهر الجلسات تلقائياً — اضغط تحديث إذا لم تظهر خلال ثوانٍ"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ background: "var(--surface-secondary, #f8fafc)", borderBottom: "1px solid var(--border-light)" }}>
                      <tr>
                        {["الموظف", "الحالة", "وقت الدخول", "آخر نشاط", "المدة", "الجهاز / المتصفح", "IP / الموقع"].map((h) => (
                          <th key={h} style={{
                            padding: "11px 16px", textAlign: "right", fontSize: 11,
                            fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap",
                            textTransform: "uppercase", letterSpacing: "0.05em",
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {filtered.map((s) => (
                          <SessionRow
                            key={s.id}
                            session={s}
                            currentUid={user!.uid}
                            onClick={() => setDetail(s)}
                          />
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
              {filtered.length} من {sessions.length} جلسة
              {rtMetrics.isConnected
                ? " · مزامنة مباشرة مع RTDB"
                : " · يتحدث كل 10 ثوانٍ"}
            </p>
          </>
        )}

        {/* ── Failed attempts tab ────────────────────────────────────────── */}
        {tab === "failed" && (
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border-light)",
            borderRadius: 20, boxShadow: "var(--shadow-card)", overflow: "hidden",
          }}>
            {loadingFailed ? (
              <table className="w-full">
                <tbody>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}</tbody>
              </table>
            ) : failed.length === 0 ? (
              <EmptyState
                icon={WifiOff}
                title="لا توجد محاولات فاشلة مسجلة"
                subtitle="المحاولات الفاشلة للدخول ستظهر هنا"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "var(--surface-secondary, #f8fafc)", borderBottom: "1px solid var(--border-light)" }}>
                    <tr>
                      {["وقت المحاولة", "البريد الإلكتروني", "عنوان IP", "الجهاز / المتصفح", "السبب"].map((h) => (
                        <th key={h} style={{
                          padding: "11px 16px", textAlign: "right", fontSize: 11,
                          fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap",
                          textTransform: "uppercase", letterSpacing: "0.05em",
                        }}>
                          {h}
                        </th>
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

      {/* ── Session detail modal ──────────────────────────────────────────── */}
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

      {/* ── Force logout confirm ──────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="تسجيل خروج إجباري"
        description={`هل تريد إلغاء جميع جلسات "${revokeTarget?.displayName || revokeTarget?.email || ""}"؟ سيتم تسجيل خروجه فوراً من جميع الأجهزة.`}
        confirmLabel="تأكيد الإلغاء"
        loading={revoking}
        destructive
      />
    </ProtectedLayout>
  );
}
