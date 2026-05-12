"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { motion } from "framer-motion";
import Link from "next/link";
import { db } from "@/lib/firestore";
import {
  normalizeSubscriber, formatDate, formatNumber, formatDateTime,
  getWhatsAppLink, RESIDENCE_COUNTRIES, PHONE_COUNTRIES,
} from "@/lib/utils";
import { usePayments } from "@/hooks/usePayments";
import { useRefunds } from "@/hooks/useRefunds";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import SubscriberModal from "@/components/subscribers/SubscriberModal";
import RenewalModal from "@/components/subscribers/RenewalModal";
import PaymentModal from "@/components/subscribers/PaymentModal";
import type { Subscriber } from "@/types";
import {
  ArrowRight, Edit, RefreshCw, DollarSign, Phone,
  Globe, Calendar, Clock, CreditCard, TrendingUp,
  Star, MessageCircle, AlertCircle, CheckCircle2,
  XCircle, PauseCircle, Snowflake,
} from "lucide-react";

// ── Theme tokens ──────────────────────────────────────────────────────────────
const LT = {
  bg:      "var(--page-bg)",
  card:    "var(--surface)",
  card2:   "var(--surface-2)",
  border:  "rgba(15,23,42,0.08)",
  divider: "rgba(15,23,42,0.06)",
  t1:      "var(--text-primary)",
  t2:      "#64748b",
  t3:      "#94a3b8",
  shadow:  "0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.05)",
};
const DT = {
  bg:      "#070c18",
  card:    "rgba(255,255,255,0.04)",
  card2:   "rgba(255,255,255,0.025)",
  border:  "rgba(255,255,255,0.08)",
  divider: "rgba(255,255,255,0.05)",
  t1:      "#f1f5f9",
  t2:      "#64748b",
  t3:      "#334155",
  shadow:  "none",
};

const ACC = { indigo:"#6366f1", emerald:"#10b981", amber:"#f59e0b", rose:"#f43f5e", sky:"#38bdf8" };
const fadeUp = { hidden:{opacity:0,y:14}, show:{opacity:1,y:0} };
const stagger = { show:{transition:{staggerChildren:0.06}} };
const tran = { duration:0.38, ease:"easeOut" } as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function residenceLabel(v: string) {
  return RESIDENCE_COUNTRIES.find((c) => c.value === v)?.name
      || PHONE_COUNTRIES.find((c) => c.iso === v)?.name
      || v || "—";
}

function toDateStr(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof (raw as {toDate?:()=>Date}).toDate === "function")
    return (raw as {toDate:()=>Date}).toDate().toISOString().slice(0,10);
  if (raw instanceof Date) return raw.toISOString().slice(0,10);
  return "";
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0,2).join("").toUpperCase() || "؟";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "نشط")         return <CheckCircle2 size={14} className="text-emerald-500" />;
  if (status === "ينتهي قريباً") return <AlertCircle  size={14} className="text-amber-500" />;
  if (status === "منتهي")       return <XCircle       size={14} className="text-rose-500" />;
  if (status === "موقوف")       return <PauseCircle   size={14} className="text-orange-500" />;
  if (status === "متجمد")       return <Snowflake     size={14} className="text-sky-500" />;
  return <XCircle size={14} className="text-slate-400" />;
}

function statusColor(status: string) {
  if (status === "نشط")          return ACC.emerald;
  if (status === "ينتهي قريباً") return ACC.amber;
  if (status === "منتهي")        return ACC.rose;
  if (status === "موقوف")        return "#f97316";
  if (status === "متجمد")        return ACC.sky;
  return "#64748b";
}

// ── Mini KPI Card ─────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, accent, t }:{
  icon:React.ReactNode; label:string; value:string; accent:string; t:typeof LT;
}) {
  return (
    <motion.div variants={fadeUp} transition={tran}
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
      <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl"
        style={{ background:`${accent}18`, border:`1px solid ${accent}28` }}>
        <span style={{ color:accent }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider truncate" style={{ color:t.t3 }}>{label}</p>
        <p className="text-lg font-black tabular-nums leading-tight" style={{ color:t.t1 }}>{value}</p>
      </div>
    </motion.div>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────
function Section({ title, children, t }:{
  title:string; children:React.ReactNode; t:typeof LT;
}) {
  return (
    <motion.div variants={fadeUp} transition={tran}
      className="rounded-2xl overflow-hidden"
      style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
      <div className="px-5 py-3.5 border-b" style={{ borderColor:t.divider }}>
        <h2 className="text-sm font-bold" style={{ color:t.t1 }}>{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

// ── Info Row ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value, t }:{ label:string; value:React.ReactNode; t:typeof LT }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0"
      style={{ borderColor:t.divider }}>
      <span className="text-xs" style={{ color:t.t2 }}>{label}</span>
      <span className="text-xs font-semibold text-left" style={{ color:t.t1 }}>{value}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SubscriberProfilePage() {
  const params   = useParams();
  const router   = useRouter();
  const id       = typeof params.id === "string" ? params.id : "";
  const { dark } = useThemeStore();
  const t        = dark ? DT : LT;
  const { can, exchangeRates } = useAuthStore();
  const canRev   = can("canViewRevenue");

  const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
  const [notFound,   setNotFound]   = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState<"edit"|"renew"|"pay"|null>(null);

  const { payments } = usePayments({ subscriberId: id });
  const { refunds }  = useRefunds({ subscriberId: id });

  useEffect(() => {
    if (!id) return;
    const ref = doc(db, "subscribers", id);
    const unsub = onSnapshot(ref,
      (snap) => {
        if (!snap.exists()) { setNotFound(true); setLoading(false); return; }
        setSubscriber(normalizeSubscriber({ id: snap.id, ...snap.data() } as Record<string,unknown>&{id:string}));
        setLoading(false);
      },
      () => { setNotFound(true); setLoading(false); }
    );
    return () => unsub();
  }, [id]);

  const onSaved = useCallback(() => setModal(null), []);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ProtectedLayout>
        <div className="min-h-full flex items-center justify-center" style={{ background:t.bg }}>
          <RefreshCw size={22} className="animate-spin" style={{ color:ACC.indigo }} />
        </div>
      </ProtectedLayout>
    );
  }

  if (notFound || !subscriber) {
    return (
      <ProtectedLayout>
        <div className="min-h-full flex flex-col items-center justify-center gap-4" style={{ background:t.bg }}>
          <AlertCircle size={40} style={{ color:ACC.rose }} />
          <p style={{ color:t.t1 }} className="font-bold text-lg">المشترك غير موجود</p>
          <Link href="/" className="text-sm px-4 py-2 rounded-xl" style={{ background:ACC.indigo, color:"#fff" }}>
            العودة للرئيسية
          </Link>
        </div>
      </ProtectedLayout>
    );
  }

  const s = subscriber;
  const sc = statusColor(s.status);
  const totalPaid = payments.reduce((sum, p) => sum + (p.amountUSD || 0), 0);
  const totalRefunded = refunds.reduce((sum, r) => sum + (r.refundAmountUSD || 0), 0);
  const lastPayment = payments[0];
  const daysRem = s.daysRemaining;

  return (
    <ProtectedLayout>
      <div className="min-h-full transition-colors duration-300" style={{ background:t.bg }}>
        <div className="mx-auto max-w-5xl p-5 md:p-7">
          <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-5">

            {/* ── Back ── */}
            <motion.div variants={fadeUp} transition={tran}>
              <button onClick={() => router.back()}
                className="flex items-center gap-2 text-sm font-medium transition-colors"
                style={{ color:t.t2 }}>
                <ArrowRight size={15} />
                العودة
              </button>
            </motion.div>

            {/* ── Profile Header ── */}
            <motion.div variants={fadeUp} transition={tran}
              className="rounded-2xl overflow-hidden"
              style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>

              {/* Top accent bar */}
              <div className="h-1.5 w-full" style={{ background:`linear-gradient(90deg, ${ACC.indigo}, ${ACC.sky})` }} />

              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="h-20 w-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
                      style={{ background:`linear-gradient(135deg, ${ACC.indigo}, ${ACC.sky})` }}>
                      {initials(s.name)}
                    </div>
                    <div className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full border-2 flex items-center justify-center"
                      style={{ background:t.card, borderColor:t.border }}>
                      <StatusIcon status={s.status} />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start gap-2 mb-2">
                      <h1 className="text-xl font-black" style={{ color:t.t1 }}>{s.name}</h1>
                      {/* Status badge */}
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                        style={{ background:`${sc}15`, color:sc, border:`1px solid ${sc}30` }}>
                        <StatusIcon status={s.status} />
                        {s.status}
                      </span>
                      {/* Package */}
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.package === "ذهبية" ? "pkg-gold" : "pkg-silver"}`}>
                        {s.package}
                      </span>
                      {/* Team */}
                      {s.team && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background:`${ACC.indigo}12`, color:ACC.indigo, border:`1px solid ${ACC.indigo}25` }}>
                          {s.team}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs" style={{ color:t.t2 }}>
                      {(s.dialCode || s.phone) && (
                        <a href={getWhatsAppLink(s.dialCode, s.phone)} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 transition-colors hover:text-emerald-500">
                          <Phone size={12} />{s.dialCode} {s.phone}
                        </a>
                      )}
                      {s.residence && (
                        <span className="flex items-center gap-1.5">
                          <Globe size={12} />{residenceLabel(s.residence)}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Calendar size={12} />انضم {formatDate(s.date)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={12} />
                        ينتهي {formatDate(s.expiryDate)}
                        {daysRem > 0
                          ? <span style={{ color:daysRem <= 7 ? ACC.rose : daysRem <= 15 ? ACC.amber : ACC.emerald }}>
                              ({daysRem} يوم)
                            </span>
                          : <span style={{ color:ACC.rose }}>(منتهي)</span>
                        }
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {can("canEdit") && (
                      <button onClick={() => setModal("edit")}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background:`${ACC.indigo}15`, color:ACC.indigo, border:`1px solid ${ACC.indigo}25` }}>
                        <Edit size={13} />تعديل
                      </button>
                    )}
                    {can("canCreate") && s.subscriptionState !== "withdrawn" && (
                      <button onClick={() => setModal("renew")}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background:`${ACC.emerald}15`, color:ACC.emerald, border:`1px solid ${ACC.emerald}25` }}>
                        <RefreshCw size={13} />تجديد
                      </button>
                    )}
                    {can("canCreate") && (
                      <button onClick={() => setModal("pay")}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background:`${ACC.amber}15`, color:ACC.amber, border:`1px solid ${ACC.amber}25` }}>
                        <DollarSign size={13} />دفعة
                      </button>
                    )}
                    {s.dialCode && s.phone && (
                      <a href={getWhatsAppLink(s.dialCode, s.phone)} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background:"rgba(37,211,102,0.12)", color:"#25d366", border:"1px solid rgba(37,211,102,0.25)" }}>
                        <MessageCircle size={13} />واتساب
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <KpiCard t={t} accent={ACC.emerald} icon={<DollarSign size={16}/>}
                label="إجمالي المدفوع"
                value={canRev ? `$${formatNumber(totalPaid,0)}` : "—"} />
              <KpiCard t={t} accent={ACC.indigo} icon={<RefreshCw size={16}/>}
                label="عدد التجديدات"
                value={String(s.renewalCount || 0)} />
              <KpiCard t={t} accent={daysRem > 7 ? ACC.emerald : ACC.rose} icon={<Clock size={16}/>}
                label="الأيام المتبقية"
                value={daysRem > 0 ? `${daysRem} يوم` : "منتهي"} />
              <KpiCard t={t} accent={ACC.amber} icon={<CreditCard size={16}/>}
                label="طريقة الدفع"
                value={s.payment || lastPayment?.paymentMethod || "—"} />
            </div>

            {/* ── Subscription + Personal ── */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Section t={t} title="تفاصيل الاشتراك">
                <InfoRow t={t} label="تاريخ الاشتراك" value={formatDate(s.date)} />
                <InfoRow t={t} label="تاريخ الانتهاء" value={formatDate(s.expiryDate)} />
                <InfoRow t={t} label="المدة (أيام)" value={String(s.duration)} />
                <InfoRow t={t} label="الباقة" value={
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${s.package==="ذهبية"?"pkg-gold":"pkg-silver"}`}>
                    {s.package}
                  </span>
                } />
                <InfoRow t={t} label="الفريق" value={s.team || "غير محدد"} />
                <InfoRow t={t} label="أقنعه" value={s.convincedBy || "—"} />
                <InfoRow t={t} label="قبض الفلوس" value={s.paidShift || "—"} />
                <InfoRow t={t} label="المصدر" value={s.source || "—"} />
                {s.source === "ترشيح" && s.referrer && (
                  <InfoRow t={t} label="المرشِّح" value={s.referrer} />
                )}
                {canRev && (
                  <>
                    <InfoRow t={t} label="المبلغ الكلي"
                      value={`$${formatNumber(s.totalPriceUSD,2)}`} />
                    <InfoRow t={t} label="المدفوع"
                      value={<span style={{ color:ACC.emerald }}>${formatNumber(s.paidAmountUSD,2)}</span>} />
                    {s.remainingAmountUSD > 0.01 && (
                      <InfoRow t={t} label="المتبقي"
                        value={<span style={{ color:ACC.amber }}>${formatNumber(s.remainingAmountUSD,2)}</span>} />
                    )}
                    {totalRefunded > 0 && (
                      <InfoRow t={t} label="المسترد"
                        value={<span style={{ color:ACC.rose }}>-${formatNumber(totalRefunded,2)}</span>} />
                    )}
                    <InfoRow t={t} label="الصافي"
                      value={<span className="font-black" style={{ color:ACC.emerald }}>${formatNumber(s.netAmountUSD,2)}</span>} />
                    <InfoRow t={t} label="العملة الأصلية" value={`${s.currencyOriginal} (${formatNumber(s.totalPrice,2)})`} />
                  </>
                )}
              </Section>

              <Section t={t} title="المعلومات الشخصية">
                <InfoRow t={t} label="الاسم الكامل" value={s.name} />
                {s.age && <InfoRow t={t} label="العمر" value={`${s.age} سنة`} />}
                <InfoRow t={t} label="الإقامة" value={residenceLabel(s.residence)} />
                {s.dialCode && s.phone && (
                  <InfoRow t={t} label="الهاتف" value={
                    <span dir="ltr">{s.dialCode} {s.phone}</span>
                  } />
                )}
                <InfoRow t={t} label="حالة الاشتراك"
                  value={<span style={{ color:sc }}>{s.status}</span>} />
                {s.renewalCount > 0 && (
                  <InfoRow t={t} label="عدد التجديدات" value={`${s.renewalCount} مرة`} />
                )}
                {s.lifetimeValueUSD > 0 && canRev && (
                  <InfoRow t={t} label="القيمة الإجمالية (LTV)"
                    value={<span className="font-black" style={{ color:ACC.indigo }}>${formatNumber(s.lifetimeValueUSD,0)}</span>} />
                )}
                {s.notes && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor:t.divider }}>
                    <p className="text-xs font-medium mb-1" style={{ color:t.t3 }}>ملاحظات</p>
                    <p className="text-xs leading-relaxed" style={{ color:t.t2 }}>{s.notes}</p>
                  </div>
                )}
              </Section>
            </div>

            {/* ── Payment History ── */}
            <Section t={t} title={`سجل الدفعات (${payments.length})`}>
              {payments.length === 0 ? (
                <p className="py-6 text-center text-sm" style={{ color:t.t2 }}>لا توجد دفعات</p>
              ) : (
                <div className="overflow-x-auto -mx-5">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom:`1px solid ${t.divider}` }}>
                        {["التاريخ","المبلغ","العملة","طريقة الدفع","النوع","وصل"].map((h) => (
                          <th key={h} className="px-5 py-2.5 text-right font-semibold" style={{ color:t.t3 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} style={{ borderBottom:`1px solid ${t.divider}` }}
                          className="transition-colors">
                          <td className="px-5 py-3 whitespace-nowrap" style={{ color:t.t1 }}>
                            {toDateStr(p.date)}
                          </td>
                          <td className="px-5 py-3 font-bold tabular-nums whitespace-nowrap"
                            style={{ color:ACC.emerald }}>
                            {canRev ? `$${formatNumber(p.amountUSD,2)}` : "—"}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap" style={{ color:t.t2 }}>
                            {p.currencyOriginal} {canRev && p.amountOriginal !== p.amountUSD
                              ? `(${formatNumber(p.amountOriginal,2)})` : ""}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap" style={{ color:t.t2 }}>
                            {p.paymentMethod || "—"}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                              style={{
                                background: p.isInitialPayment ? `${ACC.indigo}15` : p.isRenewalPayment ? `${ACC.emerald}15` : `${ACC.amber}15`,
                                color:      p.isInitialPayment ? ACC.indigo : p.isRenewalPayment ? ACC.emerald : ACC.amber,
                              }}>
                              {p.isInitialPayment ? "أولية" : p.isRenewalPayment ? "تجديد" : "دفعة"}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {p.receiptUrl
                              ? <a href={p.receiptUrl} target="_blank" rel="noreferrer"
                                  className="text-xs font-medium" style={{ color:ACC.sky }}>عرض</a>
                              : <span style={{ color:t.t3 }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* ── Renewals ── */}
            {s.renewals && s.renewals.length > 0 && (
              <Section t={t} title={`سجل التجديدات (${s.renewals.length})`}>
                <div className="space-y-3">
                  {[...s.renewals].reverse().map((r, i) => (
                    <div key={i}
                      className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                      style={{ background:t.card2, border:`1px solid ${t.divider}` }}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black"
                        style={{ background:`${ACC.indigo}15`, color:ACC.indigo }}>
                        {s.renewals.length - i}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${r.package==="ذهبية"?"pkg-gold":"pkg-silver"}`}>
                            {r.package}
                          </span>
                          <span className="text-xs" style={{ color:t.t2 }}>
                            {r.startDate} → {r.endDate} ({r.duration} يوم)
                          </span>
                        </div>
                        {canRev && (
                          <p className="text-xs mt-1 font-semibold" style={{ color:ACC.emerald }}>
                            ${formatNumber(r.paidAmountUSD,2)}
                            {r.remainingAmountUSD > 0.01 &&
                              <span style={{ color:ACC.amber }}> / متبقي ${formatNumber(r.remainingAmountUSD,2)}</span>}
                          </p>
                        )}
                      </div>
                      <div className="text-xs shrink-0" style={{ color:t.t3 }}>
                        {r.payment} · {r.convincedBy}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Refunds ── */}
            {refunds.length > 0 && (
              <Section t={t} title={`الاستردادات (${refunds.length})`}>
                <div className="space-y-2">
                  {refunds.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-2.5 border-b last:border-0"
                      style={{ borderColor:t.divider }}>
                      <div>
                        <p className="text-xs font-semibold" style={{ color:t.t1 }}>{r.refundDate}</p>
                        <p className="text-xs" style={{ color:t.t2 }}>{r.refundReason || "—"}</p>
                      </div>
                      {canRev && (
                        <span className="text-xs font-bold" style={{ color:ACC.rose }}>
                          -${formatNumber(r.refundAmountUSD,2)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

          </motion.div>
        </div>
      </div>

      {/* ── Modals ── */}
      {modal === "edit" && (
        <SubscriberModal mode="edit" subscriber={s} exchangeRates={exchangeRates}
          onClose={() => setModal(null)} onSaved={onSaved} />
      )}
      {modal === "renew" && (
        <RenewalModal subscriber={s} exchangeRates={exchangeRates}
          onClose={() => setModal(null)} onSaved={onSaved} />
      )}
      {modal === "pay" && (
        <PaymentModal subscriber={s} exchangeRates={exchangeRates}
          onClose={() => setModal(null)} onSaved={onSaved} />
      )}
    </ProtectedLayout>
  );
}
