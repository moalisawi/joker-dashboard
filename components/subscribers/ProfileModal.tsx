"use client";

import { useState, useEffect } from "react";
import {
  collection, query, where, orderBy, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { useAuthStore } from "@/store/authStore";
import {
  formatNumber, formatDate, formatDateTime, getWhatsAppLink, RESIDENCE_COUNTRIES, PHONE_COUNTRIES,
} from "@/lib/utils";
import type { Subscriber } from "@/types";
import { X, ExternalLink, PauseCircle, Snowflake } from "lucide-react";
import { freezeService } from "@/services";

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
    value ||
    "-"
  );
}

export default function ProfileModal({
  subscriber: s,
  onClose,
  onEdit,
  onRenew,
  onAddPayment,
}: Props) {
  const { can } = useAuthStore();
  const canRev = can("canViewRevenue");

  const [payments, setPayments] = useState<Payment[]>([]);
  const [payLoading, setPayLoading] = useState(true);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    async function loadPayments() {
      setPayLoading(true);
      setPayError("");
      try {
        const q = query(
          collection(db, "payments"),
          where("subscriberId", "==", s.id),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment)));
      } catch (err) {
        setPayError(err instanceof Error ? err.message : "تعذر التحميل");
      } finally {
        setPayLoading(false);
      }
    }
    loadPayments();
  }, [s.id]);

  const statusClass =
    s.status === "نشط"           ? "status-active"
    : s.status === "ينتهي قريباً" ? "status-expiring"
    : s.status === "منسحب"        ? "status-withdrawn"
    : s.status === "موقوف"        ? "status-paused"
    : s.status === "متجمد"        ? "status-frozen"
    : "status-expired";

  // Days counter derived values
  const isPaused    = s.subscriptionStatus === "paused";
  const isFrozen    = s.freezeData?.isFrozen === true;
  const isWithdrawn = s.subscriptionState === "withdrawn";
  const daysLeft    = isPaused
    ? (s.remainingDaysAtPause ?? 0)
    : isFrozen
    ? (s.freezeData?.remainingDays ?? 0)
    : s.daysRemaining;

  // Progress bar: how much of the subscription period has elapsed
  const startMs  = s.date ? new Date(s.date).getTime() : 0;
  const endMs    = s.expiryDate ? new Date(s.expiryDate).getTime() : 0;
  const totalMs  = endMs - startMs;
  const elapsed  = totalMs > 0
    ? Math.min(100, Math.max(0, ((Date.now() - startMs) / totalMs) * 100))
    : 0;
  const remaining = 100 - elapsed;

  // Color scheme based on urgency
  const urgency =
    isWithdrawn ? "withdrawn"
    : isPaused  ? "paused"
    : isFrozen  ? "frozen"
    : daysLeft < 0   ? "expired"
    : daysLeft <= 7  ? "critical"
    : daysLeft <= 15 ? "warning"
    : "ok";

  const urgencyConfig = {
    ok:        { ring: "border-emerald-400", bg: "bg-emerald-50",  num: "text-emerald-700", bar: "bg-emerald-500",  label: "يوم متبقٍ",        sub: "" },
    warning:   { ring: "border-amber-400",   bg: "bg-amber-50",    num: "text-amber-700",   bar: "bg-amber-400",    label: "يوم متبقٍ",        sub: "ينتهي قريباً" },
    critical:  { ring: "border-red-400",     bg: "bg-red-50",      num: "text-red-700",     bar: "bg-red-500",      label: "يوم متبقٍ",        sub: "انتبه!" },
    expired:   { ring: "border-slate-300",   bg: "bg-slate-50",    num: "text-slate-500",   bar: "bg-slate-300",    label: "يوم منذ الانتهاء", sub: "منتهٍ" },
    paused:    { ring: "border-amber-300",   bg: "bg-amber-50",    num: "text-amber-700",   bar: "bg-amber-300",    label: "يوم مجمّد",        sub: "موقوف" },
    frozen:    { ring: "border-blue-400",    bg: "bg-blue-50",     num: "text-blue-700",    bar: "bg-blue-400",     label: "يوم محفوظ",        sub: "متجمد" },
    withdrawn: { ring: "border-slate-300",   bg: "bg-slate-50",    num: "text-slate-400",   bar: "bg-slate-200",    label: "",                 sub: "منسحب" },
  }[urgency];

  const displayDays = Math.abs(daysLeft);

  const totalUSD  = s.totalPriceUSD || s.netAmountUSD || 0;
  const paidUSD   = s.paidAmountUSD ?? 0;
  const remUSD    = s.remainingAmountUSD ?? 0;
  const payPct    = totalUSD > 0 ? Math.min(100, (paidUSD / totalUSD) * 100) : 100;
  const isPartial = remUSD > 0.01;

  const totalPriceOrig = s.totalPrice ?? (s.totalPriceUSD * s.lockedRate);
  const origCurrency   = s.currencyOriginal || "USD";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black text-slate-800 truncate">{s.name || "-"}</h2>
              <p className="text-sm text-slate-500 font-mono mt-0.5" dir="ltr">
                {s.dialCode} {s.phone}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap shrink-0">
              <span className={`text-sm px-3 py-1 rounded-lg font-bold ${s.package === "فضية" ? "pkg-silver" : "pkg-gold"}`}>
                {s.package}
                {s.isRenewal
                  ? s.isUpgrade   ? " ⬆️"
                  : s.isDowngrade ? " ⬇️"
                  : " 🔄"
                  : ""}
              </span>
              <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusClass}`}>
                {s.status}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition mr-2">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">

          {/* ── Days Remaining Counter ─────────────────────────────── */}
          <div className={`${urgencyConfig.bg} border-2 ${urgencyConfig.ring} rounded-2xl p-4`}>
            <div className="flex items-center gap-5">

              {/* Big number */}
              <div className="text-center shrink-0">
                {isPaused && (
                  <PauseCircle size={14} className="text-amber-500 mx-auto mb-1" />
                )}
                <p className={`text-5xl font-black leading-none ${urgencyConfig.num}`}>
                  {isWithdrawn ? "—" : displayDays}
                </p>
                <p className={`text-xs font-semibold mt-1 ${urgencyConfig.num} opacity-80`}>
                  {urgencyConfig.label}
                </p>
                {urgencyConfig.sub && (
                  <span className={`text-[10px] font-bold mt-1 inline-block px-1.5 py-0.5 rounded-full ${
                    urgency === "ok"       ? "bg-emerald-200 text-emerald-800"
                    : urgency === "paused" ? "bg-amber-200 text-amber-800"
                    : urgency === "warning"? "bg-amber-200 text-amber-800"
                    : "bg-red-200 text-red-800"
                  }`}>
                    {urgencyConfig.sub}
                  </span>
                )}
              </div>

              {/* Progress bar + dates */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1.5">
                  <span>بداية: {formatDate(s.date)}</span>
                  <span>نهاية: {formatDate(s.expiryDate)}</span>
                </div>

                {/* Timeline bar */}
                <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
                  {/* Elapsed (consumed) */}
                  <div
                    className={`absolute right-0 h-full ${urgencyConfig.bar} opacity-30 transition-all duration-700`}
                    style={{ width: `${elapsed}%` }}
                  />
                  {/* Remaining */}
                  <div
                    className={`absolute left-0 h-full ${urgencyConfig.bar} transition-all duration-700`}
                    style={{ width: `${isPaused ? remaining : remaining}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                  <span>
                    {isPaused ? (
                      <span className="text-amber-600 font-semibold">⏸ مجمّد منذ {urgency === "paused" ? "" : ""}</span>
                    ) : isFrozen ? (
                      <span className="text-blue-600 font-semibold">❄️ متجمد</span>
                    ) : (
                      <span>{Math.round(elapsed)}% مضى</span>
                    )}
                  </span>
                  <span className={`font-semibold ${urgencyConfig.num}`}>
                    {isWithdrawn
                      ? "اشتراك منتهٍ بانسحاب"
                      : isPaused
                      ? `${displayDays} يوم مجمّدة`
                      : isFrozen
                      ? `${displayDays} يوم محفوظة`
                      : daysLeft >= 0
                      ? `${displayDays} يوم متبقٍ`
                      : `انتهى منذ ${displayDays} يوم`}
                  </span>
                </div>

                {/* Duration info */}
                <p className="text-[10px] text-slate-400 mt-1.5">
                  مدة الاشتراك: {s.duration} يوم
                  {s.renewalCount > 0 && ` · جُدِّد ${s.renewalCount} مرة`}
                  {s.totalPausedDays ? ` · موقوف سابقاً ${s.totalPausedDays} يوم` : ""}
                  {isFrozen && s.freezeData?.frozenAt
                    ? ` · متجمد منذ ${freezeService.getFreezeDuration(s.freezeData)} يوم`
                    : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Pause notice */}
          {isPaused && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <PauseCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800">
                <p className="font-bold mb-0.5">الاشتراك موقوف</p>
                {s.pauseReason && <p>السبب: {s.pauseReason}</p>}
                <p className="text-amber-600 mt-0.5">
                  عند الاستئناف ستُمنح المشترك {s.remainingDaysAtPause} يوم كاملة من تاريخ العودة.
                </p>
              </div>
            </div>
          )}

          {/* Freeze notice */}
          {isFrozen && s.freezeData && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Snowflake size={15} className="text-blue-600 shrink-0" />
                <p className="font-bold text-blue-800 text-sm">الاشتراك متجمد</p>
                <span className="mr-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                  {freezeService.getFreezeDuration(s.freezeData)} يوم متجمد
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-blue-500 mb-0.5">تاريخ التجميد</p>
                  <p className="font-semibold text-blue-900">
                    {s.freezeData.frozenAt
                      ? formatDate(
                          ((s.freezeData.frozenAt as any)?.toDate?.() || new Date(s.freezeData.frozenAt as any))
                            .toISOString()
                            .split("T")[0]
                        )
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-blue-500 mb-0.5">الأيام المحفوظة</p>
                  <p className="font-bold text-blue-700 text-base">{s.freezeData.remainingDays} يوم</p>
                </div>
                <div>
                  <p className="text-blue-500 mb-0.5">تاريخ الانتهاء الأصلي</p>
                  <p className="font-semibold text-blue-900">
                    {s.freezeData.originalExpiryDate ? formatDate(s.freezeData.originalExpiryDate) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-blue-500 mb-0.5">سبب التجميد</p>
                  <p className="font-semibold text-blue-900">{s.freezeData.freezeReason || "—"}</p>
                </div>
                {s.freezeData.freezeNotes && (
                  <div className="col-span-2">
                    <p className="text-blue-500 mb-0.5">ملاحظات</p>
                    <p className="font-semibold text-blue-900">{s.freezeData.freezeNotes}</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-blue-600 mt-3 border-t border-blue-100 pt-2">
                عند الاستئناف سيُضاف {s.freezeData.remainingDays} يوم محفوظ من تاريخ الاستئناف.
              </p>
            </div>
          )}

          {/* Freeze resume history */}
          {!isFrozen && s.freezeData?.resumedAt && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Snowflake size={13} className="text-slate-400" />
                <p className="text-xs font-bold text-slate-600">سجل التجميد</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <p className="text-slate-400 mb-0.5">تاريخ الاستئناف</p>
                  <p className="font-semibold">
                    {formatDate(
                      ((s.freezeData.resumedAt as any)?.toDate?.() || new Date(s.freezeData.resumedAt as any))
                        .toISOString()
                        .split("T")[0]
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 mb-0.5">الأيام التي استُعيدت</p>
                  <p className="font-semibold">{s.freezeData.remainingDays} يوم</p>
                </div>
                {s.freezeData.freezeReason && (
                  <div className="col-span-2">
                    <p className="text-slate-400 mb-0.5">سبب التجميد السابق</p>
                    <p className="font-semibold">{s.freezeData.freezeReason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Renewal info */}
          {s.isRenewal && (
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-cyan-700 mb-3">
                {s.isUpgrade ? "⬆️ ترقية" : s.isDowngrade ? "⬇️ تخفيض" : "🔄 تجديد"}
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-cyan-600 text-xs">الفريق الأصلي</p>
                  <p className="font-semibold text-cyan-900">{s.originalTeam || s.team || "-"}</p>
                </div>
                <div>
                  <p className="text-cyan-600 text-xs">المقنع الأصلي</p>
                  <p className="font-semibold text-cyan-900">{s.originalConvincedBy || s.convincedBy || "-"}</p>
                </div>
                {s.renewedBy && s.renewedBy !== s.convincedBy && (
                  <div>
                    <p className="text-cyan-600 text-xs">من قام بالتجديد</p>
                    <p className="font-semibold text-cyan-900">{s.renewedBy}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "الإقامة",        value: getResidenceLabel(s.residence) },
              { label: "تاريخ الاشتراك", value: formatDate(s.date) },
              { label: "تاريخ الانتهاء", value: formatDate(s.expiryDate) },
              { label: "المسؤول",         value: s.convincedBy || "-" },
              { label: "مصدر الاشتراك",  value: s.source || "-" },
              { label: "طريقة الدفع",    value: s.payment || "-" },
              { label: "مدة الاشتراك",   value: s.duration ? `${s.duration} يوم` : "-" },
              { label: "من قبض",          value: s.paidShift || "-" },
              { label: "العمر",            value: s.age ? `${s.age} سنة` : "-" },
            ].map((item) => (
              <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                <p className="font-semibold text-slate-800 text-sm">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Withdrawal info */}
          {s.subscriptionState === "withdrawn" && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-rose-700 mb-3">معلومات الانسحاب</h4>

              {s.withdrawalData ? (
                // ── New structured withdrawalData ──────────────────────────
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-rose-400 mb-0.5">تاريخ الانسحاب</p>
                      <p className="font-semibold text-rose-800">
                        {formatDateTime(s.withdrawalData.withdrawnAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-rose-400 mb-0.5">نفّذه</p>
                      <p className="font-semibold text-rose-800">
                        {s.withdrawalData.withdrawnByName || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-rose-400 mb-0.5">أيام استُخدمت</p>
                      <p className="font-semibold text-rose-800">{s.withdrawalData.activeDaysUsed} يوم</p>
                    </div>
                    <div>
                      <p className="text-rose-400 mb-0.5">أيام ضائعة</p>
                      <p className="font-semibold text-rose-800">{s.withdrawalData.remainingDays} يوم</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-rose-400 mb-0.5">سبب الانسحاب</p>
                      <p className="font-semibold text-rose-800">{s.withdrawalData.withdrawalReason || "—"}</p>
                    </div>
                    {s.withdrawalData.notes && (
                      <div className="col-span-2">
                        <p className="text-rose-400 mb-0.5">ملاحظات</p>
                        <p className="font-semibold text-rose-800">{s.withdrawalData.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Refund summary inside withdrawal */}
                  <div className={`rounded-lg p-3 text-xs ${
                    s.withdrawalData.refundIssued
                      ? "bg-white border border-rose-100"
                      : "bg-rose-100/50"
                  }`}>
                    {s.withdrawalData.refundIssued ? (
                      <div className="space-y-1">
                        <p className="font-bold text-rose-700 mb-1">✓ تم إصدار استرداد</p>
                        <div className="flex justify-between text-rose-700">
                          <span>المبلغ المسترد:</span>
                          <span className="font-bold">
                            ${formatNumber(s.withdrawalData.refundAmountUSD ?? 0, 2)}
                          </span>
                        </div>
                        {s.withdrawalData.refundCurrency !== "USD" && (
                          <div className="flex justify-between text-rose-600">
                            <span>بالعملة الأصلية:</span>
                            <span className="font-semibold">
                              {formatNumber(s.withdrawalData.refundAmount ?? 0, 2)} {s.withdrawalData.refundCurrency}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-rose-600 font-semibold">لا يوجد استرداد</p>
                    )}
                  </div>
                </div>
              ) : (
                // ── Legacy fallback (old records without withdrawalData) ────
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-rose-500">تاريخ الانسحاب</p>
                    <p className="font-semibold text-rose-800">{formatDate(s.withdrawnAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-rose-500">المسترد</p>
                    <p className="font-semibold text-rose-800">
                      {(s.refundAmountUSD ?? 0) > 0
                        ? `$${formatNumber(s.refundAmountUSD ?? 0, 2)}`
                        : "لا يوجد استرداد"}
                    </p>
                  </div>
                  {s.withdrawalReason && (
                    <div className="col-span-2">
                      <p className="text-xs text-rose-500">السبب</p>
                      <p className="font-semibold text-rose-800">{s.withdrawalReason}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Financial summary */}
          {canRev && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-slate-700 mb-3">الملخص المالي</h4>
              <div className="grid grid-cols-3 gap-3 text-center text-xs mb-3">
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-slate-500 mb-1">السعر الكلي</p>
                  <p className="text-base font-bold text-slate-800">${formatNumber(totalUSD, 2)}</p>
                  {origCurrency !== "USD" && totalPriceOrig && (
                    <p className="text-slate-400 text-[10px] mt-0.5">
                      {formatNumber(totalPriceOrig, 2)} {origCurrency}
                    </p>
                  )}
                </div>
                <div className="bg-emerald-50 rounded-lg p-2.5">
                  <p className="text-emerald-600 mb-1">محصّل</p>
                  <p className="text-base font-bold text-emerald-700">${formatNumber(paidUSD, 2)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-2.5">
                  <p className="text-amber-600 mb-1">متبقي</p>
                  <p className="text-base font-bold text-amber-700">${formatNumber(remUSD, 2)}</p>
                </div>
              </div>
              <div className="pay-bar" style={{ height: 8 }}>
                <div
                  className={`pay-bar-fill ${isPartial ? "partial" : ""}`}
                  style={{ width: `${payPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isPartial
                  ? `${Math.round(payPct)}% مدفوع`
                  : "✓ مدفوع بالكامل"}
              </p>
              {(s.refundAmountUSD ?? 0) > 0 && (
                <p className="text-xs text-rose-500 mt-1">
                  مسترد: ${formatNumber(s.refundAmountUSD ?? 0, 2)} — الصافي: ${formatNumber(s.netAmountUSD, 2)}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          {s.notes && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">ملاحظات</p>
              <p className="text-sm text-slate-700">{s.notes}</p>
            </div>
          )}

          {/* Renewal history */}
          {(s.renewalCount > 0 || s.renewals?.length > 0) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-700">تاريخ التجديدات</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-semibold">
                    {s.renewalCount} تجديد
                  </span>
                  {canRev && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                      LTV: ${formatNumber(s.lifetimeValueUSD, 2)}
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {(s.renewals || []).map((r, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">#{i + 1}</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${r.package === "فضية" ? "pkg-silver" : "pkg-gold"}`}>
                          {r.package}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          r.snapshotStatus === "active" ? "bg-emerald-100 text-emerald-700"
                          : r.snapshotStatus === "withdrawn" ? "bg-slate-100 text-slate-600"
                          : "bg-red-100 text-red-600"
                        }`}>
                          {r.snapshotStatus === "active" ? "كان نشطاً" : r.snapshotStatus === "withdrawn" ? "انسحب" : "انتهى"}
                        </span>
                      </div>
                      {canRev && (
                        <span className="text-xs font-bold text-emerald-700">
                          ${formatNumber(r.netAmountUSD, 2)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{formatDate(r.startDate)} ← {formatDate(r.endDate)}</span>
                      <span className="text-slate-300">·</span>
                      <span>{r.duration} يوم</span>
                      {canRev && r.remainingAmountUSD > 0.01 && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-amber-600">متبقٍ ${formatNumber(r.remainingAmountUSD, 2)}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {/* Current active subscription */}
                <div className="border border-blue-200 rounded-xl p-3 bg-blue-50/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">الحالي</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${s.package === "فضية" ? "pkg-silver" : "pkg-gold"}`}>
                        {s.package}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        s.status === "نشط" ? "bg-emerald-100 text-emerald-700"
                        : s.status === "منسحب" ? "bg-slate-100 text-slate-600"
                        : "bg-red-100 text-red-600"
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    {canRev && (
                      <span className="text-xs font-bold text-emerald-700">
                        ${formatNumber(s.netAmountUSD, 2)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{formatDate(s.date)} ← {formatDate(s.expiryDate)}</span>
                    <span className="text-slate-300">·</span>
                    <span>{s.duration} يوم</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment history */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-3">سجل الدفعات</h4>
            {payLoading ? (
              <p className="text-center text-slate-400 text-sm py-4">جاري التحميل...</p>
            ) : payError ? (
              <p className="text-center text-rose-400 text-sm py-4">{payError}</p>
            ) : payments.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-4">لا توجد دفعات مسجلة</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold">
                      <th className="px-3 py-2 text-right">التاريخ</th>
                      <th className="px-3 py-2 text-right">المبلغ</th>
                      <th className="px-3 py-2 text-right">العملة</th>
                      {canRev && <th className="px-3 py-2 text-right">USD</th>}
                      <th className="px-3 py-2 text-right">طريقة الدفع</th>
                      <th className="px-3 py-2 text-right">وصل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-600">{formatDate(p.date)}</td>
                        <td className="px-3 py-2 font-bold text-emerald-700">
                          {formatNumber(p.amountOriginal, 2)}
                          {p.isInitialPayment && (
                            <span className="text-indigo-500 text-[10px] mr-1">(أولية)</span>
                          )}
                          {p.isRenewalPayment && (
                            <span className="text-cyan-500 text-[10px] mr-1">(تجديد)</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{p.currencyOriginal}</td>
                        {canRev && (
                          <td className="px-3 py-2 text-slate-600">${formatNumber(p.amountUSD, 2)}</td>
                        )}
                        <td className="px-3 py-2 text-slate-500">{p.paymentMethod || "-"}</td>
                        <td className="px-3 py-2">
                          {p.receiptUrl ? (
                            <a
                              href={p.receiptUrl}
                              target="_blank"
                              rel="noopener"
                              className="flex items-center gap-1 text-indigo-600 hover:underline"
                            >
                              {p.receiptType === "image" ? "🖼️" : "📄"}
                              <ExternalLink size={10} />
                            </a>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {canRev && payments.length > 0 && (
                  <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                    <span>{payments.length} دفعة</span>
                    <span className="font-bold text-emerald-700">
                      المجموع: ${formatNumber(
                        payments.reduce((s, p) => s + p.amountUSD, 0),
                        2
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap pt-2 border-t border-slate-100">
            <a
              href={getWhatsAppLink(s.dialCode, s.phone)}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-bold transition"
            >
              📱 واتساب
            </a>
            {can("canCreate") && s.subscriptionState !== "withdrawn" && (
              <button
                onClick={() => { onClose(); onRenew(); }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-bold transition"
              >
                🔄 تجديد
              </button>
            )}
            {can("canEdit") && (
              <button
                onClick={() => { onClose(); onEdit(); }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition"
              >
                تعديل
              </button>
            )}
            {can("canCreate") && s.subscriptionState !== "withdrawn" && (
              <button
                onClick={() => { onClose(); onAddPayment(); }}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-bold transition"
              >
                إضافة دفعة
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
