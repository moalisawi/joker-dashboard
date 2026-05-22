"use client";

import { useState } from "react";
import type { Subscriber, Currency } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { callSubscriberOperation } from "@/lib/clientOperations";
import { calculateExpiry, todayString, formatDate, formatNumber } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/permissions";
import { useEmployeeNames } from "@/hooks/useEmployeeNames";
import { useActiveMethodsForResidenceQuery } from "@/features/paymentMethods/hooks/useActiveMethodsForResidenceQuery";
import { getAllowedCurrencies, CURRENCY_LABELS } from "@/features/paymentMethods/utils/countryMapping";
import { X, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  subscriber: Subscriber;
  exchangeRates: Record<string, number>;
  onClose: () => void;
  onSaved: () => void;
}

export default function RenewalModal({ subscriber: s, exchangeRates, onClose, onSaved }: Props) {
  const { user } = useAuthStore();
  const employeeNames = useEmployeeNames();

  // Form state
  const [pkg, setPkg]             = useState<"فضية" | "ذهبية">(s.package);
  const [duration, setDuration]   = useState("30");
  const [currency, setCurrency]   = useState<Currency>(s.currencyOriginal || "USD");
  const [totalPrice, setTotalPrice] = useState("");
  const [initPayment, setInitPayment] = useState("");
  const [payment, setPayment]         = useState(s.payment || "");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [renewedBy, setRenewedBy] = useState("");
  const [renewalDate, setRenewalDate] = useState(todayString());
  const [notes, setNotes]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  // Derived
  const { methods: firestoreMethods, isLoading: methodsLoading } =
    useActiveMethodsForResidenceQuery(s.residence);

  const selectedFirestoreMethod = firestoreMethods.find((m) => m.id === paymentMethodId);
  const allowedCurrencies = selectedFirestoreMethod
    ? getAllowedCurrencies(selectedFirestoreMethod.supportedCurrencies)
    : ["USD", "EGP", "JOD", "ILS"] as Currency[];

  function handleMethodChange(value: string) {
    if (!value) { setPayment(""); setPaymentMethodId(""); return; }
    const fm = firestoreMethods.find((m) => m.id === value);
    if (fm) { setPayment(fm.name); setPaymentMethodId(fm.id); }
    else     { setPayment(value);  setPaymentMethodId(""); }
  }

  const lockedRate     = exchangeRates[currency] || 1;
  const totalPriceN    = parseFloat(totalPrice) || 0;
  const totalPriceUSD  = totalPriceN / lockedRate;
  const isWithdrawn    = s.subscriptionState === "withdrawn";
  const isActive       = !isWithdrawn && s.daysRemaining >= 0;
  const isExpired      = !isWithdrawn && s.daysRemaining < 0;

  // New start date logic
  const newStartDate   = isActive ? s.expiryDate : renewalDate;
  const newEndDate     = calculateExpiry(newStartDate, Number(duration));

  const isUpgrade   = s.package === "فضية" && pkg === "ذهبية";
  const isDowngrade = s.package === "ذهبية" && pkg === "فضية";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setLoading(true);

    try {
      const dur          = Number(duration);
      const initStr      = initPayment.trim();
      const paidAmount   = initStr === "" ? totalPriceN : parseFloat(initStr) || 0;
      const remaining    = Math.max(0, totalPriceN - paidAmount);
      const paidUSD      = paidAmount / lockedRate;
      const remainingUSD = remaining / lockedRate;
      const by           = renewedBy || user.employeeName || user.name || "";

      await callSubscriberOperation("renewSubscription", {
        subscriberId:    s.id,
        package:         pkg,
        duration:        dur,
        currency,
        totalPrice:      totalPriceN,
        paidAmount,
        paymentMethod:   payment,
        paymentMethodId: paymentMethodId || undefined,
        renewalDate,
        exchangeRate:    lockedRate,
        notes,
        renewedByName:   by,
      });

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  // ── Status badge ──────────────────────────────────────────────────────
  const statusBadge = isWithdrawn
    ? <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">منسحب</span>
    : isExpired
    ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">منتهي منذ {Math.abs(s.daysRemaining)} يوم</span>
    : <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">نشط · {s.daysRemaining} يوم متبقٍ</span>;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <RefreshCw size={18} className="text-cyan-600" />
            <h3 className="font-bold text-slate-800 text-lg">
              {isWithdrawn ? "إعادة تفعيل المشترك" : "تجديد الاشتراك"}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {/* Current subscription info */}
          <div className="bg-slate-50 rounded-2xl p-4 mb-5 border border-slate-200">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-black text-slate-800 text-base">{s.name}</p>
                <p className="text-slate-500 text-sm font-mono" dir="ltr">{s.dialCode}{s.phone}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {statusBadge}
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${s.package === "فضية" ? "pkg-silver" : "pkg-gold"}`}>
                  {s.package}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="bg-white rounded-xl p-2.5 border border-slate-100">
                <p className="text-slate-400 mb-0.5">تاريخ الانتهاء</p>
                <p className="font-bold text-slate-700">{formatDate(s.expiryDate)}</p>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-slate-100">
                <p className="text-slate-400 mb-0.5">عدد التجديدات</p>
                <p className="font-bold text-slate-700">{s.renewalCount || 0} مرة</p>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-slate-100">
                <p className="text-slate-400 mb-0.5">المتبقي</p>
                <p className="font-bold text-amber-600">${formatNumber(s.remainingAmountUSD, 2)}</p>
              </div>
            </div>

            {/* Start date logic explanation */}
            <div className={`mt-3 rounded-xl p-2.5 text-xs font-medium ${
              isWithdrawn ? "bg-rose-50 text-rose-700 border border-rose-200"
              : isActive   ? "bg-blue-50 text-blue-700 border border-blue-200"
                           : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}>
              {isWithdrawn && "⚡ إعادة تفعيل — سيبدأ الاشتراك من تاريخ التجديد المحدد"}
              {isActive    && `▶ الاشتراك نشط — سيبدأ الجديد من نهاية الحالي (${formatDate(s.expiryDate)})`}
              {isExpired   && "⏰ الاشتراك منتهٍ — سيبدأ الجديد من تاريخ التجديد المحدد"}
            </div>
          </div>

          {/* Reactivation warning */}
          {isWithdrawn && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
              سيتم إلغاء حالة الانسحاب وإعادة تفعيل المشترك تلقائياً عند حفظ التجديد.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
            )}

            {/* Renewal date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  {isActive ? "تاريخ التجديد (للسجل)" : "تاريخ بداية الاشتراك الجديد"}
                </label>
                <input type="date" required value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                  className="form-input" />
                {isActive && (
                  <p className="text-xs text-blue-600 mt-1">
                    الاشتراك سيمتد من {formatDate(s.expiryDate)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">المدة</label>
                <select required value={duration} onChange={(e) => setDuration(e.target.value)}
                  className="form-input">
                  <option value="">اختر...</option>
                  <option value="30">شهر (30 يوم)</option>
                  <option value="60">شهرين (60 يوم)</option>
                  <option value="90">3 أشهر</option>
                  <option value="180">6 أشهر</option>
                  <option value="365">سنة</option>
                </select>
                {duration && (
                  <p className="text-xs text-slate-400 mt-1">
                    ينتهي: {formatDate(newEndDate)}
                  </p>
                )}
              </div>
            </div>

            {/* Package */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">الباقة الجديدة</label>
              <div className="flex gap-3">
                {(["فضية", "ذهبية"] as const).map((p) => (
                  <label key={p} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="ren_pkg" value={p}
                      checked={pkg === p} onChange={() => setPkg(p)} />
                    <span className={`text-sm px-3 py-1.5 rounded-xl font-bold ${p === "فضية" ? "pkg-silver" : "pkg-gold"}`}>
                      {p}
                    </span>
                  </label>
                ))}
              </div>
              {isUpgrade && (
                <div className="flex items-center gap-2 mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <TrendingUp size={14} /> ترقية من فضية إلى ذهبية
                </div>
              )}
              {isDowngrade && (
                <div className="flex items-center gap-2 mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <TrendingDown size={14} /> تخفيض من ذهبية إلى فضية
                </div>
              )}
            </div>

            {/* Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">العملة</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="form-input">
                  {allowedCurrencies.map((c) => (
                    <option key={c} value={c}>{CURRENCY_LABELS[c] ?? c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  السعر الكلي ({currency})
                </label>
                <input type="number" required min="0" step="0.01" value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                  className="form-input" />
                {totalPriceN > 0 && currency !== "USD" && (
                  <p className="text-xs text-slate-400 mt-1">≈ ${totalPriceUSD.toFixed(2)}</p>
                )}
              </div>
            </div>

            {/* Initial payment */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                المبلغ المدفوع الآن (فارغ = كامل السعر)
              </label>
              <input type="number" min="0" step="0.01" value={initPayment}
                placeholder={`فارغ = ${totalPrice || 0} (دفع كامل)`}
                onChange={(e) => setInitPayment(e.target.value)}
                className="form-input" />
              {initPayment && parseFloat(initPayment) < totalPriceN && (
                <p className="text-xs text-amber-600 mt-1">
                  متبقي: {formatNumber(totalPriceN - parseFloat(initPayment), 2)} {currency}
                </p>
              )}
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">طريقة الدفع</label>
              <select
                value={paymentMethodId || payment}
                onChange={(e) => handleMethodChange(e.target.value)}
                className="form-input"
              >
                <option value="">اختر...</option>
                {!methodsLoading && firestoreMethods.length > 0 ? (
                  firestoreMethods.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))
                ) : (
                  PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)
                )}
              </select>
              {methodsLoading && (
                <p className="text-xs text-slate-400 mt-1">جاري تحميل طرق الدفع...</p>
              )}
            </div>

            {/* Renewed by */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                من قام بالتجديد (للتتبع فقط)
              </label>
              <select value={renewedBy} onChange={(e) => setRenewedBy(e.target.value)}
                className="form-input">
                <option value="">اختر...</option>
                {employeeNames.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">ملاحظات</label>
              <textarea value={notes} rows={2}
                onChange={(e) => setNotes(e.target.value)}
                className="form-input resize-none" />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading}
                className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2">
                {loading ? (
                  <><RefreshCw size={16} className="animate-spin" /> جاري الحفظ...</>
                ) : (
                  isWithdrawn ? "إعادة التفعيل" : "حفظ التجديد"
                )}
              </button>
              <button type="button" onClick={onClose}
                className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
