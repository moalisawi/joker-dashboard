"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,  CreditCard, Calendar, Clock, RotateCcw,
  Pencil, Snowflake, Play, PauseCircle, UserMinus, Trash2,
  MessageCircle, User, TrendingUp, Hash, MapPin, Banknote, Eye, Star} from "lucide-react";
import { formatDate, formatNumber, getWhatsAppLink } from "@/lib/utils";
import type { Subscriber } from "@/types";

type ModalType = "profile" | "edit" | "renew" | "payment" | "withdraw" | "pause" | "freeze" | "resume" | null;

interface Props {
  subscriber: Subscriber | null;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  canWithdraw: boolean;
  canDelete: boolean;
  canViewRevenue: boolean;
  onOpenModal: (m: ModalType, s: Subscriber) => void;
  onDelete: (s: Subscriber) => void;
  onResumePause: (s: Subscriber) => void;
  loadingId: string | null;
}

function getStatusMeta(s: Subscriber) {
  if (s.freezeData?.isFrozen)            return { label: "متجمد",        color: "#3B82F6", bg: "rgba(59,130,246,0.1)",  pulse: false };
  if (s.subscriptionStatus === "paused") return { label: "موقوف",        color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  pulse: false };
  if (s.subscriptionState === "withdrawn") return { label: "منسحب",      color: "#9CA3AF", bg: "rgba(156,163,175,0.1)", pulse: false };
  if (s.daysRemaining <= 0)              return { label: "منتهي",        color: "#EF4444", bg: "rgba(239,68,68,0.1)",   pulse: false };
  if (s.daysRemaining <= 7)              return { label: "ينتهي قريباً", color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  pulse: true  };
  return                                        { label: "نشط",          color: "#22C55E", bg: "rgba(34,197,94,0.1)",   pulse: true  };
}

const PALETTE = ["#5B5FEF","#8B5CF6","#06B6D4","#22C55E","#EF4444","#F59E0B","#EC4899","#14B8A6"];
function avatarColor(name: string) {
  return PALETTE[(name?.charCodeAt(0) ?? 0) % PALETTE.length];
}
function avatarInitials(name: string) {
  return (name || "؟").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
}

function InfoRow({ icon, label, value, valueColor }: { icon: React.ReactNode; label: string; value: React.ReactNode; valueColor?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid rgba(238,242,247,0.8)" }}>
      <span style={{ color: "var(--jk-subtle)", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 12, color: "var(--jk-subtle)", flex: 1 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: valueColor ?? "var(--jk-text)" }}>{value}</span>
    </div>
  );
}

function ActionBtn({ icon, label, color, bg, onClick, disabled }: {
  icon: React.ReactNode; label: string; color: string; bg: string;
  onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        padding: "12px 8px", borderRadius: 14, border: "1px solid",
        borderColor: `${color}22`, background: bg, color,
        fontSize: 11, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, flex: "1 1 0", minWidth: 0,
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 16px ${color}22`; } }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function SubscriberDrawer({
  subscriber: s, open, onClose, canEdit, canWithdraw, canDelete,
  canViewRevenue, onOpenModal, onDelete, onResumePause, loadingId,
}: Props) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const status = s ? getStatusMeta(s) : null;
  const isFrozen   = s?.freezeData?.isFrozen ?? false;
  const isPaused   = s?.subscriptionStatus === "paused";
  const isWithdrawn = s?.subscriptionState === "withdrawn";
  const isActive   = s ? (!isFrozen && !isPaused && !isWithdrawn) : false;
  const payPct     = s && s.totalPriceUSD > 0 ? Math.min(100, (s.paidAmountUSD / s.totalPriceUSD) * 100) : 100;
  const isPartial  = (s?.remainingAmountUSD ?? 0) > 0.01;

  return (
    <AnimatePresence>
      {open && s && (
        <>
          {/* Backdrop */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0, zIndex: 1000,
              background: "rgba(10,12,30,0.35)",
              backdropFilter: "blur(4px)",
            }}
          />

          {/* Drawer Panel */}
          <motion.div
            key="drawer-panel"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            style={{
              position: "fixed", top: 0, insetInlineStart: 0,
              height: "100dvh", width: "min(420px, 92vw)", zIndex: 1001,
              background: "#FFFFFF",
              borderStartEndRadius: 28, borderEndEndRadius: 28,
              boxShadow: "8px 0 48px rgba(15,23,42,0.18)",
              display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* ── Header ─────────────────────────────────────────────── */}
            <div style={{
              padding: "20px 20px 0",
              background: "linear-gradient(160deg, #F8FAFF 0%, #EEF0FF 100%)",
              borderBottom: "1px solid var(--jk-divider)",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                {/* Avatar + identity */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ position: "relative" }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: "50%",
                      background: `linear-gradient(135deg, ${avatarColor(s.name)}, ${avatarColor(s.name)}aa)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 800, color: "#fff",
                      boxShadow: `0 6px 20px ${avatarColor(s.name)}44`,
                    }}>
                      {avatarInitials(s.name)}
                    </div>
                    {/* Status dot */}
                    <span style={{
                      position: "absolute", bottom: 1, insetInlineEnd: 1,
                      width: 12, height: 12, borderRadius: "50%",
                      background: status?.color, border: "2px solid #fff",
                    }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "var(--jk-text)", lineHeight: 1.2 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "var(--jk-subtle)", direction: "ltr", marginTop: 3 }}>
                      {s.dialCode} {s.phone}
                    </div>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 5, marginTop: 5,
                      padding: "3px 10px", borderRadius: 999,
                      background: status?.bg, color: status?.color,
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {status?.pulse && (
                        <span style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: status.color, flexShrink: 0,
                          animation: "pulse-dot 1.5s ease-in-out infinite",
                        }} />
                      )}
                      {status?.label}
                    </div>
                  </div>
                </div>

                {/* Close */}
                <button
                  onClick={onClose}
                  style={{
                    width: 32, height: 32, borderRadius: 10, border: "1px solid var(--jk-divider)",
                    background: "#fff", cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center", color: "var(--jk-subtle)",
                    flexShrink: 0,
                  }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Quick stats row */}
              <div style={{ display: "flex", gap: 8, paddingBottom: 16 }}>
                {[
                  { icon: <Star size={12}/>, label: s.package, color: s.package === "ذهبية" ? "#F59E0B" : "#6B7280" },
                  { icon: <Clock size={12}/>, label: isWithdrawn || isPaused || isFrozen ? "—" : `${Math.max(0, s.daysRemaining)} يوم`, color: s.daysRemaining <= 7 && isActive ? "#EF4444" : "var(--jk-muted)" },
                  { icon: <Calendar size={12}/>, label: formatDate(s.expiryDate) || "—", color: "var(--jk-muted)" },
                ].map((item, i) => (
                  <div key={i} style={{
                    flex: 1, display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 10px", borderRadius: 10,
                    background: "rgba(255,255,255,0.7)", border: "1px solid rgba(238,242,247,0.8)",
                    fontSize: 11, fontWeight: 600, color: item.color,
                  }}>
                    <span style={{ color: item.color, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Scrollable body ────────────────────────────────────── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

              {/* Info rows */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--jk-subtle)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                  معلومات الاشتراك
                </div>
                <InfoRow icon={<Hash size={13}/>}    label="الخطة"          value={s.package} />
                <InfoRow icon={<Calendar size={13}/>} label="تاريخ البدء"   value={formatDate(s.date) || "—"} />
                <InfoRow icon={<Calendar size={13}/>} label="تاريخ الانتهاء" value={
                  isFrozen && s.freezeData?.originalExpiryDate ? s.freezeData.originalExpiryDate : formatDate(s.expiryDate) || "—"
                } />
                <InfoRow icon={<MapPin size={13}/>}  label="الإقامة"        value={s.residence || "—"} />
                {s.convincedBy && (
                  <InfoRow icon={<User size={13}/>} label="موظف الخدمة" value={s.convincedBy} />
                )}
                {s.source && (
                  <InfoRow icon={<TrendingUp size={13}/>} label="المصدر" value={s.source} />
                )}
              </div>

              {/* Revenue section */}
              {canViewRevenue && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--jk-subtle)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                    التفاصيل المالية
                  </div>
                  <InfoRow icon={<Banknote size={13}/>} label="إجمالي السعر"
                    value={`$${formatNumber(s.totalPriceUSD, 2)}`} />
                  <InfoRow icon={<CreditCard size={13}/>} label="المدفوع"
                    value={`$${formatNumber(s.paidAmountUSD, 2)}`} valueColor="#22C55E" />
                  {isPartial && (
                    <InfoRow icon={<Clock size={13}/>} label="المتبقي"
                      value={`$${formatNumber(s.remainingAmountUSD, 2)}`} valueColor="#F59E0B" />
                  )}
                  <InfoRow icon={<TrendingUp size={13}/>} label="الصافي"
                    value={`$${formatNumber(s.netAmountUSD, 2)}`} valueColor="#5B5FEF" />

                  {/* Payment progress bar */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--jk-subtle)", marginBottom: 5 }}>
                      <span>تقدم السداد</span>
                      <span style={{ fontWeight: 700, color: payPct === 100 ? "#22C55E" : "#F59E0B" }}>{payPct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: "#EEF2F7", overflow: "hidden" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${payPct}%` }}
                        transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
                        style={{
                          height: "100%", borderRadius: 999,
                          background: payPct === 100 ? "linear-gradient(90deg,#22C55E,#4ADE80)" : "linear-gradient(90deg,#F59E0B,#FCD34D)",
                        }}
                      />
                    </div>
                  </div>

                  {s.renewalCount > 0 && (
                    <InfoRow icon={<RotateCcw size={13}/>} label="التجديدات"
                      value={`${s.renewalCount} مرة`} valueColor="#06B6D4" />
                  )}
                </div>
              )}

              {/* Notes */}
              {s.notes && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--jk-subtle)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    ملاحظات
                  </div>
                  <div style={{
                    padding: "12px 14px", borderRadius: 14,
                    background: "#FFFBEB", border: "1px solid rgba(245,158,11,0.2)",
                    fontSize: 13, color: "var(--jk-text)", lineHeight: 1.6,
                  }}>
                    {s.notes}
                  </div>
                </div>
              )}
            </div>

            {/* ── Actions footer ─────────────────────────────────────── */}
            <div style={{
              padding: "14px 20px",
              borderTop: "1px solid var(--jk-divider)",
              background: "#FAFBFF",
              flexShrink: 0,
            }}>
              {/* Row 1 */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <ActionBtn icon={<Eye size={15}/>}      label="ملف كامل"   color="#5B5FEF"  bg="rgba(91,95,239,0.07)"  onClick={() => onOpenModal("profile", s)} />
                {canEdit && isActive && (
                  <ActionBtn icon={<Pencil size={15}/>}  label="تعديل"     color="#111827"  bg="rgba(17,24,39,0.05)"   onClick={() => onOpenModal("edit", s)} />
                )}
                {canEdit && (
                  <ActionBtn icon={<RotateCcw size={15}/>} label="تجديد"  color="#06B6D4"  bg="rgba(6,182,212,0.07)"  onClick={() => onOpenModal("renew", s)} />
                )}
                {canEdit && (
                  <ActionBtn icon={<CreditCard size={15}/>} label="دفعة"  color="#22C55E"  bg="rgba(34,197,94,0.07)"  onClick={() => onOpenModal("payment", s)} />
                )}
              </div>
              {/* Row 2 */}
              <div style={{ display: "flex", gap: 8 }}>
                <ActionBtn
                  icon={<MessageCircle size={15}/>} label="واتساب"
                  color="#22C55E" bg="rgba(34,197,94,0.07)"
                  onClick={() => window.open(getWhatsAppLink(s.dialCode, s.phone))}
                />
                {canEdit && (isFrozen
                  ? <ActionBtn icon={<Play size={15}/>}      label="استئناف"   color="#3B82F6" bg="rgba(59,130,246,0.07)"  onClick={() => onOpenModal("resume", s)} />
                  : isActive && <ActionBtn icon={<Snowflake size={15}/>} label="تجميد" color="#3B82F6" bg="rgba(59,130,246,0.07)" onClick={() => onOpenModal("freeze", s)} />
                )}
                {canEdit && (isPaused
                  ? <ActionBtn icon={<Play size={15}/>} label="استئناف" color="#F59E0B" bg="rgba(245,158,11,0.07)" onClick={() => onResumePause(s)} disabled={loadingId !== null} />
                  : isActive && <ActionBtn icon={<PauseCircle size={15}/>} label="إيقاف" color="#F59E0B" bg="rgba(245,158,11,0.07)" onClick={() => onOpenModal("pause", s)} />
                )}
                {canWithdraw && isActive && (
                  <ActionBtn icon={<UserMinus size={15}/>} label="انسحاب" color="#EF4444" bg="rgba(239,68,68,0.07)" onClick={() => onOpenModal("withdraw", s)} />
                )}
                {canDelete && (
                  <ActionBtn icon={<Trash2 size={15}/>} label="حذف" color="#EF4444" bg="rgba(239,68,68,0.07)"
                    onClick={() => onDelete(s)} disabled={loadingId !== null} />
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
