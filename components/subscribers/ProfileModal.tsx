"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firestore";
import { useAuthStore } from "@/store/authStore";
import {
  formatNumber, formatDate, formatDateTime, getWhatsAppLink,
  RESIDENCE_COUNTRIES, PHONE_COUNTRIES,
} from "@/lib/utils";
import type { Subscriber } from "@/types";
import { freezeService } from "@/services";
import {
  X, ExternalLink, PauseCircle, Snowflake, Phone,
  MapPin, Calendar, User, CreditCard, Clock, Hash,
  TrendingUp, AlertTriangle, CheckCircle, RotateCcw,
  Pencil, MessageCircle, Banknote,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Payment {
  id: string;
  amountOriginal: number;
  currencyOriginal: string;
  amountUSD: number;
  paymentMethod?: string;
  date: string;
  notes?: string | null;
  receiptUrl?: string | null;
  receiptType?: string | null;
  isInitialPayment?: boolean;
  isRenewalPayment?: boolean;
  createdAt?: unknown;
}

interface Props {
  subscriber: Subscriber;
  onClose: () => void;
  onEdit: () => void;
  onRenew: () => void;
  onAddPayment: () => void;
}

function getResidenceLabel(value: string): string {
  return (
    RESIDENCE_COUNTRIES.find((c) => c.value === value)?.name ||
    PHONE_COUNTRIES.find((c) => c.iso === value)?.name ||
    value || "—"
  );
}

function getInitials(name: string) {
  return (name || "؟").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

/* ── Thin info row ── */
function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  if (!value || value === "-" || value === "—") return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderRadius: 12, background: "var(--jk-surface-secondary, #F8FAFC)" }}>
      <span style={{ color: "var(--jk-primary)", flexShrink: 0, opacity: 0.7 }}>{icon}</span>
      <span style={{ fontSize: 11, color: "var(--jk-muted)", flexShrink: 0, minWidth: 72 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--jk-text)", flex: 1, textAlign: "start", fontFamily: mono ? "monospace" : "inherit" }} dir={mono ? "ltr" : undefined}>{value}</span>
    </div>
  );
}

/* ── Stat mini card ── */
function MiniStat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "12px 8px", borderRadius: 14, background: `${color}12`, border: `1px solid ${color}28` }}>
      <p style={{ fontSize: 18, fontWeight: 800, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color, opacity: 0.7, marginTop: 2 }}>{sub}</p>}
      <p style={{ fontSize: 11, color: "var(--jk-muted)", marginTop: 4 }}>{label}</p>
    </div>
  );
}

export default function ProfileModal({ subscriber: s, onClose, onEdit, onRenew, onAddPayment }: Props) {
  const { can } = useAuthStore();
  const canRev  = can("canViewRevenue");

  const [payments, setPayments] = useState<Payment[]>([]);
  const [payLoading, setPayLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"info" | "payments" | "history">("info");

  useEffect(() => {
    let cancelled = false;
    async function loadPayments() {
      setPayLoading(true);
      try {
        const q = query(collection(db, "payments"), where("subscriberId", "==", s.id), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        if (!cancelled) setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment)));
      } catch { /* silent */ }
      finally { if (!cancelled) setPayLoading(false); }
    }
    loadPayments();
    return () => { cancelled = true; };
  }, [s.id]);

  /* ── Urgency state ── */
  const isPaused    = s.subscriptionStatus === "paused";
  const isFrozen    = s.freezeData?.isFrozen === true;
  const isWithdrawn = s.subscriptionState   === "withdrawn";
  const daysLeft    = isPaused ? (s.remainingDaysAtPause ?? 0) : isFrozen ? (s.freezeData?.remainingDays ?? 0) : s.daysRemaining;
  const displayDays = Math.abs(daysLeft);

  const urgency =
    isWithdrawn ? "withdrawn"
    : isPaused  ? "paused"
    : isFrozen  ? "frozen"
    : daysLeft < 0   ? "expired"
    : daysLeft <= 7  ? "critical"
    : daysLeft <= 15 ? "warning"
    : "ok";

  const urgencyPalette = {
    ok:        { color: "#22C55E", bg: "#ECFDF3", border: "rgba(34,197,94,.28)",  icon: <CheckCircle size={16} />, label: "يوم متبقٍ",        badge: "نشط" },
    warning:   { color: "#F59E0B", bg: "#FFFBEB", border: "rgba(245,158,11,.28)", icon: <AlertTriangle size={16} />, label: "يوم متبقٍ",      badge: "ينتهي قريباً" },
    critical:  { color: "#EF4444", bg: "#FEF2F2", border: "rgba(239,68,68,.28)",  icon: <AlertTriangle size={16} />, label: "يوم متبقٍ",      badge: "عاجل!" },
    expired:   { color: "#9CA3AF", bg: "#F1F5F9", border: "rgba(156,163,175,.28)", icon: <X size={16} />, label: "يوم منذ الانتهاء",        badge: "منتهٍ" },
    paused:    { color: "#F59E0B", bg: "#FFFBEB", border: "rgba(245,158,11,.28)", icon: <PauseCircle size={16} />, label: "يوم مجمّدة",       badge: "موقوف" },
    frozen:    { color: "#3B82F6", bg: "#EFF6FF", border: "rgba(59,130,246,.28)", icon: <Snowflake size={16} />,   label: "يوم محفوظ",        badge: "متجمد" },
    withdrawn: { color: "#9CA3AF", bg: "#F1F5F9", border: "rgba(156,163,175,.28)", icon: <User size={16} />,  label: "",                   badge: "منسحب" },
  }[urgency];

  /* ── Progress bar ── */
  const startMs = s.date ? new Date(s.date).getTime() : 0;
  const endMs   = s.expiryDate ? new Date(s.expiryDate).getTime() : 0;
  const elapsed = (endMs - startMs) > 0
    ? Math.min(100, Math.max(0, ((Date.now() - startMs) / (endMs - startMs)) * 100))
    : 0;

  /* ── Finance ── */
  const totalUSD = s.totalPriceUSD || s.netAmountUSD || 0;
  const paidUSD  = s.paidAmountUSD ?? 0;
  const remUSD   = s.remainingAmountUSD ?? 0;
  const payPct   = totalUSD > 0 ? Math.min(100, (paidUSD / totalUSD) * 100) : 100;

  const totalPriceOrig = s.totalPrice ?? (s.totalPriceUSD * s.lockedRate);
  const origCurrency   = s.currencyOriginal || "USD";

  /* ── Avatar gradient seed ── */
  const avatarColors = [
    ["#5B5FEF","#4338CA"], ["#22C55E","#16A34A"], ["#F59E0B","#D97706"],
    ["#EF4444","#DC2626"], ["#3B82F6","#2563EB"], ["#8B5CF6","#7C3AED"],
  ];
  const colorIdx = (s.name || "").charCodeAt(0) % avatarColors.length;
  const [c1, c2] = avatarColors[colorIdx];

  const tabs = [
    { id: "info" as const,     label: "المعلومات" },
    { id: "payments" as const, label: `الدفعات ${payLoading ? "" : `(${payments.length})`}` },
    { id: "history" as const,  label: "التجديدات", show: (s.renewalCount > 0 || (s.renewals?.length ?? 0) > 0) },
  ].filter((t) => t.show !== false);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        style={{ maxWidth: 640, width: "100%", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90dvh" }}
      >

        {/* ══ HEADER ══════════════════════════════════════════════════ */}
        <div style={{
          background: `linear-gradient(135deg, ${c1}18 0%, ${c2}0a 100%)`,
          borderBottom: "1px solid var(--jk-border)",
          padding: "20px 20px 0",
          flexShrink: 0,
        }}>
          {/* Top row: avatar + name + close */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
            {/* Avatar */}
            <div style={{
              width: 56, height: 56, borderRadius: 18, flexShrink: 0,
              background: `linear-gradient(135deg, ${c1}, ${c2})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 20, fontWeight: 800,
              boxShadow: `0 6px 20px ${c1}40`,
              letterSpacing: "0.04em",
            }}>
              {getInitials(s.name)}
            </div>

            {/* Name + phone */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--jk-text)", lineHeight: 1.1, marginBottom: 4, letterSpacing: "-0.01em" }}>
                {s.name || "—"}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Phone size={12} style={{ color: "var(--jk-muted)", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--jk-muted)", fontFamily: "monospace" }} dir="ltr">
                  {s.dialCode} {s.phone}
                </span>
                {s.residence && (
                  <>
                    <span style={{ color: "var(--jk-border)" }}>·</span>
                    <MapPin size={11} style={{ color: "var(--jk-muted)" }} />
                    <span style={{ fontSize: 12, color: "var(--jk-muted)" }}>{getResidenceLabel(s.residence)}</span>
                  </>
                )}
              </div>
              {/* Badges */}
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <span className={`${s.package === "فضية" ? "pkg-silver" : "pkg-gold"}`} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999 }}>
                  {s.package}
                  {s.isRenewal && (s.isUpgrade ? " ⬆" : s.isDowngrade ? " ⬇" : " ↺")}
                </span>
                <span style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 999,
                  background: urgencyPalette.bg, color: urgencyPalette.color,
                  border: `1px solid ${urgencyPalette.border}`, fontWeight: 700,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  {urgencyPalette.icon} {urgencyPalette.badge}
                </span>
                {s.renewalCount > 0 && (
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "#EFF6FF", color: "#3B82F6", border: "1px solid rgba(59,130,246,.25)", fontWeight: 700 }}>
                    جُدِّد {s.renewalCount}×
                  </span>
                )}
                {canRev && s.lifetimeValueUSD > 0 && (
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "#ECFDF3", color: "#16A34A", border: "1px solid rgba(34,197,94,.25)", fontWeight: 700 }}>
                    LTV ${formatNumber(s.lifetimeValueUSD, 0)}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: "var(--jk-surface-secondary, #F8FAFC)",
                border: "1px solid var(--jk-border)",
                color: "var(--jk-muted)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--jk-danger-bg, #FEF2F2)"; (e.currentTarget as HTMLElement).style.color = "var(--jk-danger, #EF4444)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--jk-surface-secondary, #F8FAFC)"; (e.currentTarget as HTMLElement).style.color = "var(--jk-muted)"; }}
            >
              <X size={15} />
            </button>
          </div>

          {/* ── Days counter hero strip ── */}
          <div style={{
            background: urgencyPalette.bg,
            border: `1px solid ${urgencyPalette.border}`,
            borderRadius: "14px 14px 0 0",
            padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 16,
          }}>
            {/* Big number */}
            <div style={{ textAlign: "center", flexShrink: 0, minWidth: 56 }}>
              <p style={{ fontSize: 40, fontWeight: 900, color: urgencyPalette.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {isWithdrawn ? "—" : displayDays}
              </p>
              {!isWithdrawn && (
                <p style={{ fontSize: 10, fontWeight: 600, color: urgencyPalette.color, opacity: 0.8 }}>
                  {urgencyPalette.label}
                </p>
              )}
            </div>

            {/* Progress + dates */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--jk-muted)", marginBottom: 5 }}>
                <span>بداية: {formatDate(s.date)}</span>
                <span>نهاية: {formatDate(s.expiryDate)}</span>
              </div>
              <div style={{ height: 8, background: "rgba(0,0,0,0.08)", borderRadius: 999, overflow: "hidden", position: "relative" }}>
                <div style={{
                  position: "absolute", right: 0, top: 0, height: "100%",
                  width: `${elapsed}%`,
                  background: urgencyPalette.color,
                  opacity: 0.25, transition: "width .8s ease",
                }} />
                <div style={{
                  position: "absolute", left: 0, top: 0, height: "100%",
                  width: `${100 - elapsed}%`,
                  background: urgencyPalette.color,
                  borderRadius: 999, transition: "width .8s ease",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 4 }}>
                <span style={{ color: "var(--jk-muted)" }}>
                  {isPaused ? "⏸ موقوف" : isFrozen ? "❄ متجمد" : `${Math.round(elapsed)}% مضى`}
                </span>
                <span style={{ color: urgencyPalette.color, fontWeight: 700 }}>
                  {isWithdrawn ? "انسحب"
                    : isPaused ? `${displayDays} يوم مجمّدة`
                    : isFrozen ? `${displayDays} يوم محفوظ`
                    : daysLeft >= 0 ? `${displayDays} يوم متبقٍ`
                    : `انتهى منذ ${displayDays} يوم`}
                </span>
              </div>
              {/* Duration meta */}
              <p style={{ fontSize: 10, color: "var(--jk-subtle, #9CA3AF)", marginTop: 3 }}>
                مدة الاشتراك {s.duration} يوم
                {s.totalPausedDays ? ` · موقوف سابقاً ${s.totalPausedDays} يوم` : ""}
                {isFrozen && s.freezeData?.frozenAt ? ` · متجمد منذ ${freezeService.getFreezeDuration(s.freezeData)} يوم` : ""}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, marginTop: 0, borderTop: `1px solid ${urgencyPalette.border}` }}>
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1, padding: "10px 8px", border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    color: active ? "var(--jk-primary)" : "var(--jk-muted)",
                    background: active ? "var(--jk-surface)" : "transparent",
                    borderBottom: active ? "2px solid var(--jk-primary)" : "2px solid transparent",
                    transition: "all .15s", fontFamily: "inherit",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ══ BODY ════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>

          {/* ── TAB: المعلومات ── */}
          {activeTab === "info" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Pause notice */}
              {isPaused && (
                <div style={{ background: "#FFFBEB", border: "1px solid rgba(245,158,11,.3)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10 }}>
                  <PauseCircle size={16} style={{ color: "#F59E0B", flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#92400E" }}>الاشتراك موقوف</p>
                    {s.pauseReason && <p style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}>السبب: {s.pauseReason}</p>}
                    <p style={{ fontSize: 11, color: "#D97706", marginTop: 3 }}>عند الاستئناف ستُمنح {s.remainingDaysAtPause} يوم كاملة.</p>
                  </div>
                </div>
              )}

              {/* Freeze notice */}
              {isFrozen && s.freezeData && (
                <div style={{ background: "#EFF6FF", border: "1px solid rgba(59,130,246,.3)", borderRadius: 14, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Snowflake size={15} style={{ color: "#3B82F6" }} />
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#1E40AF" }}>الاشتراك متجمد</p>
                    <span style={{ marginInlineStart: "auto", fontSize: 11, background: "#DBEAFE", color: "#1D4ED8", padding: "2px 10px", borderRadius: 999, fontWeight: 700 }}>
                      {freezeService.getFreezeDuration(s.freezeData)} يوم متجمد
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "تاريخ التجميد", value: s.freezeData.frozenAt ? formatDate(((s.freezeData.frozenAt as any)?.toDate?.() || new Date(s.freezeData.frozenAt as any)).toISOString().split("T")[0]) : "—" },
                      { label: "الأيام المحفوظة", value: `${s.freezeData.remainingDays} يوم` },
                      { label: "الانتهاء الأصلي", value: s.freezeData.originalExpiryDate ? formatDate(s.freezeData.originalExpiryDate) : "—" },
                      { label: "سبب التجميد", value: s.freezeData.freezeReason || "—" },
                    ].map((item) => (
                      <div key={item.label}>
                        <p style={{ fontSize: 10, color: "#60A5FA", marginBottom: 2 }}>{item.label}</p>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#1E3A8A" }}>{item.value}</p>
                      </div>
                    ))}
                    {s.freezeData.freezeNotes && (
                      <div style={{ gridColumn: "span 2" }}>
                        <p style={{ fontSize: 10, color: "#60A5FA", marginBottom: 2 }}>ملاحظات</p>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#1E3A8A" }}>{s.freezeData.freezeNotes}</p>
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: 10, color: "#3B82F6", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(59,130,246,.15)" }}>
                    عند الاستئناف سيُضاف {s.freezeData.remainingDays} يوم محفوظ من تاريخ الاستئناف.
                  </p>
                </div>
              )}

              {/* Freeze resume history */}
              {!isFrozen && s.freezeData?.resumedAt && (
                <div style={{ background: "var(--jk-surface-secondary, #F8FAFC)", border: "1px solid var(--jk-border)", borderRadius: 14, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Snowflake size={13} style={{ color: "var(--jk-muted)" }} />
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--jk-muted)" }}>سجل التجميد</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                    <div>
                      <p style={{ fontSize: 10, color: "var(--jk-subtle)" }}>تاريخ الاستئناف</p>
                      <p style={{ fontWeight: 600, color: "var(--jk-text)" }}>
                        {formatDate(((s.freezeData.resumedAt as any)?.toDate?.() || new Date(s.freezeData.resumedAt as any)).toISOString().split("T")[0])}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: "var(--jk-subtle)" }}>أيام استُعيدت</p>
                      <p style={{ fontWeight: 600, color: "var(--jk-text)" }}>{s.freezeData.remainingDays} يوم</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Withdrawal */}
              {isWithdrawn && (
                <div style={{ background: "#FEF2F2", border: "1px solid rgba(239,68,68,.28)", borderRadius: 14, padding: "12px 14px" }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "#991B1B", marginBottom: 10 }}>معلومات الانسحاب</p>
                  {s.withdrawalData ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[
                          { label: "تاريخ الانسحاب", value: formatDateTime(s.withdrawalData.withdrawnAt) },
                          { label: "نفّذه", value: s.withdrawalData.withdrawnByName || "—" },
                          { label: "أيام استُخدمت", value: `${s.withdrawalData.activeDaysUsed} يوم` },
                          { label: "أيام ضائعة", value: `${s.withdrawalData.remainingDays} يوم` },
                          { label: "سبب الانسحاب", value: s.withdrawalData.withdrawalReason || "—" },
                        ].map((item) => (
                          <div key={item.label} style={{ gridColumn: item.label === "سبب الانسحاب" ? "span 2" : undefined }}>
                            <p style={{ fontSize: 10, color: "#F87171", marginBottom: 2 }}>{item.label}</p>
                            <p style={{ fontSize: 12, fontWeight: 600, color: "#7F1D1D" }}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                      {/* Refund pill */}
                      <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 10, background: s.withdrawalData.refundIssued ? "#ECFDF3" : "#FEE2E2", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        {s.withdrawalData.refundIssued ? (
                          <>
                            <span style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>✓ تم الاسترداد</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#166534" }}>${formatNumber(s.withdrawalData.refundAmountUSD ?? 0, 2)}</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 12, color: "#991B1B", fontWeight: 600 }}>لا يوجد استرداد</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                      <div><p style={{ fontSize: 10, color: "#F87171" }}>تاريخ الانسحاب</p><p style={{ fontWeight: 600, color: "#7F1D1D" }}>{formatDate(s.withdrawnAt)}</p></div>
                      <div><p style={{ fontSize: 10, color: "#F87171" }}>المسترد</p><p style={{ fontWeight: 600, color: "#7F1D1D" }}>{(s.refundAmountUSD ?? 0) > 0 ? `$${formatNumber(s.refundAmountUSD ?? 0, 2)}` : "لا يوجد"}</p></div>
                      {s.withdrawalReason && <div style={{ gridColumn: "span 2" }}><p style={{ fontSize: 10, color: "#F87171" }}>السبب</p><p style={{ fontWeight: 600, color: "#7F1D1D" }}>{s.withdrawalReason}</p></div>}
                    </div>
                  )}
                </div>
              )}

              {/* Renewal info banner */}
              {s.isRenewal && (
                <div style={{ background: "#ECFEFF", border: "1px solid rgba(6,182,212,.28)", borderRadius: 14, padding: "10px 14px" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#0E7490", marginBottom: 6 }}>
                    {s.isUpgrade ? "⬆️ ترقية" : s.isDowngrade ? "⬇️ تخفيض" : "↺ تجديد"}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                    <div><p style={{ fontSize: 10, color: "#67E8F9" }}>الفريق الأصلي</p><p style={{ fontWeight: 600, color: "#164E63" }}>{s.originalTeam || s.team || "—"}</p></div>
                    <div><p style={{ fontSize: 10, color: "#67E8F9" }}>المقنع الأصلي</p><p style={{ fontWeight: 600, color: "#164E63" }}>{s.originalConvincedBy || s.convincedBy || "—"}</p></div>
                    {s.renewedBy && s.renewedBy !== s.convincedBy && (
                      <div><p style={{ fontSize: 10, color: "#67E8F9" }}>من جدّد</p><p style={{ fontWeight: 600, color: "#164E63" }}>{s.renewedBy}</p></div>
                    )}
                  </div>
                </div>
              )}

              {/* Info grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <InfoRow icon={<Calendar size={13} />} label="تاريخ الاشتراك" value={formatDate(s.date)} />
                <InfoRow icon={<Calendar size={13} />} label="تاريخ الانتهاء" value={formatDate(s.expiryDate)} />
                <InfoRow icon={<Clock size={13} />}    label="المدة"          value={s.duration ? `${s.duration} يوم` : ""} />
                <InfoRow icon={<MapPin size={13} />}   label="الإقامة"        value={getResidenceLabel(s.residence)} />
                <InfoRow icon={<User size={13} />}     label="المسؤول"        value={s.convincedBy || ""} />
                <InfoRow icon={<Hash size={13} />}     label="مصدر الاشتراك" value={s.source || ""} />
                <InfoRow icon={<CreditCard size={13} />} label="طريقة الدفع"  value={s.payment || ""} />
                <InfoRow icon={<User size={13} />}     label="من قبض"         value={s.paidShift || ""} />
                <InfoRow icon={<TrendingUp size={13} />} label="العمر"        value={s.age ? `${s.age} سنة` : ""} />
                {s.team && <InfoRow icon={<User size={13} />} label="الفريق" value={s.team} />}
              </div>

              {/* Notes */}
              {s.notes && (
                <div style={{ background: "var(--jk-surface-secondary, #F8FAFC)", border: "1px solid var(--jk-border)", borderRadius: 14, padding: "12px 14px" }}>
                  <p style={{ fontSize: 10, color: "var(--jk-subtle)", marginBottom: 4 }}>ملاحظات</p>
                  <p style={{ fontSize: 13, color: "var(--jk-text)" }}>{s.notes}</p>
                </div>
              )}

              {/* Financial summary */}
              {canRev && (
                <div style={{ background: "var(--jk-surface)", border: "1px solid var(--jk-border)", borderRadius: 16, padding: "14px 16px" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--jk-text)", marginBottom: 12 }}>الملخص المالي</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                    <MiniStat label="السعر الكلي" value={`$${formatNumber(totalUSD, 2)}`} color="#5B5FEF"
                      sub={origCurrency !== "USD" && totalPriceOrig ? `${formatNumber(totalPriceOrig, 0)} ${origCurrency}` : undefined} />
                    <MiniStat label="محصّل" value={`$${formatNumber(paidUSD, 2)}`} color="#22C55E" />
                    <MiniStat label="متبقي" value={`$${formatNumber(remUSD, 2)}`} color={remUSD > 0.01 ? "#F59E0B" : "#22C55E"} />
                  </div>
                  {/* Pay progress */}
                  <div style={{ height: 8, background: "#F1F5F9", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${payPct}%`,
                      background: remUSD > 0.01
                        ? "linear-gradient(90deg, #22C55E, #F59E0B)"
                        : "#22C55E",
                      borderRadius: 999, transition: "width .7s ease",
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--jk-muted)", marginTop: 4 }}>
                    <span>{Math.round(payPct)}% مدفوع</span>
                    {(s.refundAmountUSD ?? 0) > 0 && (
                      <span style={{ color: "#EF4444" }}>مسترد ${formatNumber(s.refundAmountUSD ?? 0, 2)} · صافي ${formatNumber(s.netAmountUSD, 2)}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: الدفعات ── */}
          {activeTab === "payments" && (
            <div>
              {payLoading ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--jk-muted)", fontSize: 13 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid var(--jk-border)", borderTopColor: "var(--jk-primary)", animation: "spin .7s linear infinite", margin: "0 auto 8px" }} />
                  جاري التحميل...
                </div>
              ) : payments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "var(--jk-muted)" }}>
                  <Banknote size={36} style={{ margin: "0 auto 8px", opacity: 0.25 }} />
                  <p style={{ fontSize: 13 }}>لا توجد دفعات مسجلة</p>
                </div>
              ) : (
                <>
                  <div style={{ border: "1px solid var(--jk-border)", borderRadius: 14, overflow: "hidden" }}>
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "var(--jk-surface-secondary, #F8FAFC)", color: "var(--jk-muted)", fontWeight: 600 }}>
                          <th style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid var(--jk-border)" }}>التاريخ</th>
                          <th style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid var(--jk-border)" }}>المبلغ</th>
                          <th style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid var(--jk-border)" }}>العملة</th>
                          {canRev && <th style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid var(--jk-border)" }}>USD</th>}
                          <th style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid var(--jk-border)" }}>طريقة الدفع</th>
                          <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: "1px solid var(--jk-border)" }}>وصل</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p, i) => (
                          <tr key={p.id} style={{ borderBottom: i < payments.length - 1 ? "1px solid var(--jk-divider, #EEF2F7)" : "none" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--jk-surface-secondary, #F8FAFC)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                          >
                            <td style={{ padding: "9px 12px", color: "var(--jk-muted)" }}>{formatDate(p.date)}</td>
                            <td style={{ padding: "9px 12px", fontWeight: 700, color: "#22C55E" }}>
                              {formatNumber(p.amountOriginal, 2)}
                              {p.isInitialPayment && <span style={{ color: "#5B5FEF", fontSize: 10, marginInlineStart: 4 }}>أولية</span>}
                              {p.isRenewalPayment && <span style={{ color: "#06B6D4", fontSize: 10, marginInlineStart: 4 }}>تجديد</span>}
                            </td>
                            <td style={{ padding: "9px 12px", color: "var(--jk-muted)" }}>{p.currencyOriginal}</td>
                            {canRev && <td style={{ padding: "9px 12px", color: "var(--jk-text)" }}>${formatNumber(p.amountUSD, 2)}</td>}
                            <td style={{ padding: "9px 12px", color: "var(--jk-muted)" }}>{p.paymentMethod || "—"}</td>
                            <td style={{ padding: "9px 12px", textAlign: "center" }}>
                              {p.receiptUrl ? (
                                <a href={p.receiptUrl} target="_blank" rel="noopener"
                                  style={{ color: "var(--jk-primary)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  {p.receiptType === "image" ? "🖼" : "📄"} <ExternalLink size={10} />
                                </a>
                              ) : <span style={{ color: "var(--jk-border)" }}>—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {canRev && (
                      <div style={{ padding: "8px 12px", background: "var(--jk-surface-secondary, #F8FAFC)", borderTop: "1px solid var(--jk-border)", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "var(--jk-muted)" }}>{payments.length} دفعة</span>
                        <span style={{ fontWeight: 700, color: "#22C55E" }}>
                          المجموع: ${formatNumber(payments.reduce((acc, p) => acc + p.amountUSD, 0), 2)}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── TAB: التجديدات ── */}
          {activeTab === "history" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(s.renewals || []).map((r, i) => (
                <div key={i} style={{
                  border: "1px solid var(--jk-border)", borderRadius: 14,
                  padding: "12px 14px",
                  background: "var(--jk-surface-secondary, #F8FAFC)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "var(--jk-muted)", background: "var(--jk-border)", padding: "1px 6px", borderRadius: 999 }}>#{i + 1}</span>
                      <span className={`${r.package === "فضية" ? "pkg-silver" : "pkg-gold"}`} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999 }}>{r.package}</span>
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 999, fontWeight: 600,
                        background: r.snapshotStatus === "active" ? "#ECFDF3" : r.snapshotStatus === "withdrawn" ? "#F1F5F9" : "#FEF2F2",
                        color:      r.snapshotStatus === "active" ? "#16A34A" : r.snapshotStatus === "withdrawn" ? "#6B7280"  : "#EF4444",
                      }}>
                        {r.snapshotStatus === "active" ? "كان نشطاً" : r.snapshotStatus === "withdrawn" ? "انسحب" : "انتهى"}
                      </span>
                    </div>
                    {canRev && <span style={{ fontSize: 12, fontWeight: 700, color: "#22C55E" }}>${formatNumber(r.netAmountUSD, 2)}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--jk-muted)", display: "flex", gap: 10 }}>
                    <span>{formatDate(r.startDate)} ← {formatDate(r.endDate)}</span>
                    <span>·</span>
                    <span>{r.duration} يوم</span>
                    {canRev && r.remainingAmountUSD > 0.01 && (
                      <><span>·</span><span style={{ color: "#F59E0B" }}>متبقٍ ${formatNumber(r.remainingAmountUSD, 2)}</span></>
                    )}
                  </div>
                </div>
              ))}
              {/* Current */}
              <div style={{
                border: "1px solid rgba(91,95,239,.25)", borderRadius: 14,
                padding: "12px 14px",
                background: "rgba(91,95,239,.04)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "var(--jk-primary)", background: "rgba(91,95,239,.12)", padding: "1px 6px", borderRadius: 999, fontWeight: 700 }}>الحالي</span>
                    <span className={`${s.package === "فضية" ? "pkg-silver" : "pkg-gold"}`} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999 }}>{s.package}</span>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 999, fontWeight: 600,
                      background: s.status === "نشط" ? "#ECFDF3" : s.status === "منسحب" ? "#F1F5F9" : "#FEF2F2",
                      color:      s.status === "نشط" ? "#16A34A" : s.status === "منسحب" ? "#6B7280"  : "#EF4444",
                    }}>{s.status}</span>
                  </div>
                  {canRev && <span style={{ fontSize: 12, fontWeight: 700, color: "#22C55E" }}>${formatNumber(s.netAmountUSD, 2)}</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--jk-muted)", display: "flex", gap: 10 }}>
                  <span>{formatDate(s.date)} ← {formatDate(s.expiryDate)}</span>
                  <span>·</span>
                  <span>{s.duration} يوم</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══ FOOTER ACTIONS ══════════════════════════════════════════ */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--jk-border)",
          display: "flex", gap: 8, flexWrap: "wrap",
          background: "var(--jk-surface)", flexShrink: 0,
        }}>
          <a
            href={getWhatsAppLink(s.dialCode, s.phone)}
            target="_blank" rel="noopener"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 16px", borderRadius: 999,
              background: "#22C55E", color: "#fff",
              fontSize: 12, fontWeight: 700, textDecoration: "none",
              boxShadow: "0 4px 12px rgba(34,197,94,.28)",
              transition: "all .15s",
            }}
          >
            <MessageCircle size={14} /> واتساب
          </a>

          {can("canCreate") && !isWithdrawn && (
            <button
              onClick={() => { onClose(); onRenew(); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 16px", borderRadius: 999, border: "none", cursor: "pointer",
                background: "#06B6D4", color: "#fff",
                fontSize: 12, fontWeight: 700,
                boxShadow: "0 4px 12px rgba(6,182,212,.28)",
              }}
            >
              <RotateCcw size={14} /> تجديد
            </button>
          )}

          {can("canEdit") && (
            <button
              onClick={() => { onClose(); onEdit(); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 16px", borderRadius: 999, border: "none", cursor: "pointer",
                background: "var(--jk-primary, #5B5FEF)", color: "#fff",
                fontSize: 12, fontWeight: 700,
                boxShadow: "0 4px 12px rgba(91,95,239,.28)",
              }}
            >
              <Pencil size={13} /> تعديل
            </button>
          )}

          {can("canCreate") && !isWithdrawn && (
            <button
              onClick={() => { onClose(); onAddPayment(); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 16px", borderRadius: 999, border: "1px solid var(--jk-border)",
                cursor: "pointer", background: "var(--jk-surface)",
                color: "var(--jk-text)", fontSize: 12, fontWeight: 600,
              }}
            >
              <CreditCard size={13} /> إضافة دفعة
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
