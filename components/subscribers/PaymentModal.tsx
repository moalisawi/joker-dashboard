"use client";

import { useState, useRef, useEffect } from "react";
import type { Subscriber, Currency } from "@/types";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/storage";
import { useAuthStore } from "@/store/authStore";
import { callSubscriberOperation } from "@/lib/clientOperations";
import { formatNumber, todayString } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/permissions";
import { useActiveMethodsForResidenceQuery } from "@/features/paymentMethods/hooks/useActiveMethodsForResidenceQuery";
import { getAllowedCurrencies, CURRENCY_LABELS } from "@/features/paymentMethods/utils/countryMapping";
import { useBillingOverview } from "@/features/billing/hooks";
import { allocatePaymentToInstallments } from "@/lib/subscriberLifecycle";
import { formatDate } from "@/lib/utils";
import { X, ArrowLeft, AlertTriangle } from "lucide-react";

interface Props {
  subscriber: Subscriber;
  exchangeRates: Record<string, number>;
  onClose: () => void;
  onSaved: () => void;
}

export default function PaymentModal({ subscriber, exchangeRates, onClose, onSaved }: Props) {
  const { user } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [amount,        setAmount]        = useState("");
  const [currency,      setCurrency]      = useState<Currency>(subscriber.currencyOriginal || "USD");
  const [method,        setMethod]        = useState(subscriber.payment || "");
  const [methodId,      setMethodId]      = useState("");
  const [date,          setDate]          = useState(todayString());
  const [notes,         setNotes]         = useState("");
  const [reference,     setReference]     = useState("");
  const [installmentId, setInstallmentId] = useState("");
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");

  // Open instalments, so a payment can be pointed at a specific one. Empty for
  // a subscriber with no schedule, which collapses the control away entirely.
  const { currentInvoice, installments } = useBillingOverview(
    subscriber as unknown as { id: string; currentCycleId?: string | null; currentInvoiceId?: string | null }
  );
  const openInstallments = installments.filter(
    (i) => i.status !== "paid" && i.status !== "waived" && i.status !== "cancelled"
  );

  const { methods: firestoreMethods, isLoading: methodsLoading } =
    useActiveMethodsForResidenceQuery(subscriber.residence);

  // Allowed currencies based on selected Firestore method
  const selectedFirestoreMethod = firestoreMethods.find((m) => m.id === methodId);
  const allowedCurrencies = selectedFirestoreMethod
    ? getAllowedCurrencies(selectedFirestoreMethod.supportedCurrencies)
    : ["USD", "EGP", "JOD", "ILS"] as Currency[];

  // If current currency not allowed, reset to first allowed
  useEffect(() => {
    if (selectedFirestoreMethod && !allowedCurrencies.includes(currency as typeof allowedCurrencies[number])) {
      setCurrency(allowedCurrencies[0] as Currency);
    }
  }, [methodId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rate      = exchangeRates[currency] || 1;
  const amountUSD = parseFloat(amount || "0") / rate;

  /**
   * What this payment will do, before it is saved.
   *
   * The modal used to show only the current balance, so the operator pressed
   * save and found out afterwards. Every financial action in this workspace now
   * states its own effect first — and the overpayment guard on the server is
   * mirrored here so the rejection is visible before the round trip, not as a
   * red error after it.
   */
  const impact = (() => {
    const paidBefore = subscriber.paidAmountUSD;
    const total      = subscriber.totalPriceUSD;
    const paidAfter  = paidBefore + (Number.isFinite(amountUSD) ? amountUSD : 0);
    const remainingAfter = Math.max(0, total - paidAfter);
    return {
      paidBefore,
      paidAfter,
      remainingBefore: subscriber.remainingAmountUSD,
      remainingAfter,
      settlesInvoice: total > 0 && remainingAfter <= 0.01,
      // Matches OVERPAY_TOLERANCE_USD in lib/subscriberFinance.
      overpays: total > 0 && paidAfter > total + 0.01,
    };
  })();

  const allocationPreview = (() => {
    if (!(amountUSD > 0) || openInstallments.length === 0) return [];
    return allocatePaymentToInstallments(
      amountUSD,
      openInstallments.map((i) => ({
        id: i.id ?? "",
        installmentNumber: i.installmentNumber,
        dueDate: i.dueDate,
        amountUSD: i.amountUSD,
        paidUSD: i.paidUSD,
        status: i.status,
      })),
      installmentId || null
    ).allocations;
  })();

  function handleMethodChange(value: string) {
    if (!value) {
      setMethod("");
      setMethodId("");
      return;
    }
    // Check if it's a Firestore method id
    const fm = firestoreMethods.find((m) => m.id === value);
    if (fm) {
      setMethod(fm.name);
      setMethodId(fm.id);
    } else {
      // Static fallback
      setMethod(value);
      setMethodId("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setLoading(true);

    try {
      const amt = parseFloat(amount);

      let receiptUrl: string | null = null;
      const file = fileRef.current?.files?.[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024)
          throw new Error("حجم الملف يتجاوز الحد المسموح (5MB)");
        const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        if (!allowed.includes(file.type))
          throw new Error("نوع الملف غير مقبول — JPG أو PNG أو PDF فقط");
        const storageRef = ref(storage, `receipts/${subscriber.id}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        receiptUrl = await getDownloadURL(storageRef);
      }

      await callSubscriberOperation("addPayment", {
        subscriberId:    subscriber.id,
        amountOriginal:  amt,
        currencyOriginal: currency,
        exchangeRate:    rate,
        paymentMethod:   method,
        paymentMethodId: methodId || undefined,
        receiptUrl,
        receiptFileName: file?.name ?? null,
        externalReference: reference.trim() || null,
        installmentId:   installmentId || undefined,
        date,
        notes,
      });

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  // Determine select value: if Firestore method selected use id, else use method string
  const selectValue = methodId || method;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">إضافة دفعة</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-4 pb-2">
          <div className="bg-slate-50 rounded-xl p-3 text-sm">
            <p className="font-bold text-slate-800">{subscriber.name}</p>
            <p className="text-slate-500 text-xs">
              المدفوع: ${formatNumber(subscriber.paidAmountUSD, 2)} |
              المتبقي: ${formatNumber(subscriber.remainingAmountUSD, 2)}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}

          {/* Payment method */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">طريقة الدفع</label>
            <select
              value={selectValue}
              onChange={(e) => handleMethodChange(e.target.value)}
              className="form-input w-full"
            >
              <option value="">اختر...</option>
              {!methodsLoading && firestoreMethods.length > 0 ? (
                <>
                  <optgroup label="طرق الدفع المتاحة">
                    {firestoreMethods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                </>
              ) : (
                PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)
              )}
            </select>
            {methodsLoading && (
              <p className="text-xs text-slate-400 mt-1">جاري تحميل طرق الدفع...</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">المبلغ</label>
              <input type="number" required min="0.01" step="0.01" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="form-input w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">العملة</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}
                className="form-input w-full">
                {allowedCurrencies.map((c) => (
                  <option key={c} value={c}>{CURRENCY_LABELS[c] ?? c}</option>
                ))}
              </select>
            </div>
          </div>

          {parseFloat(amount) > 0 && currency !== "USD" && (
            <p className="text-xs text-slate-400">≈ ${formatNumber(amountUSD, 2)}</p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">تاريخ الدفع</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input w-full" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">ملاحظات</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="form-input w-full" />
          </div>

          {/* Target instalment — only shown when there is a schedule to target. */}
          {openInstallments.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                تخصيص الدفعة
                <span className="mr-1 font-normal opacity-60">(افتراضياً على أقدم قسط مستحق)</span>
              </label>
              <select value={installmentId} onChange={(e) => setInstallmentId(e.target.value)} className="form-input w-full">
                <option value="">توزيع تلقائي — الأقدم أولاً</option>
                {openInstallments.map((i) => (
                  <option key={i.id} value={i.id ?? ""}>
                    قسط #{i.installmentNumber} — {formatDate(i.dueDate)} — متبقٍ $
                    {formatNumber(Math.max(0, i.amountUSD - i.paidUSD), 2)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              رقم التحويل / المرجع الخارجي
              <span className="mr-1 font-normal opacity-60">(اختياري)</span>
            </label>
            <input type="text" dir="ltr" value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="TRX-..." className="form-input w-full" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">وصل الدفع</label>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf"
              className="text-sm text-slate-600" />
            <p className="text-[11px] text-slate-400 mt-1">
              الدفعة تُحتسب مالياً فور الحفظ؛ الوصل يُسجَّل «بانتظار المراجعة» حتى يعتمده مسؤول.
            </p>
          </div>

          {/* ── Impact preview ── */}
          {amountUSD > 0 && (
            <div className="rounded-xl p-3 space-y-2"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <p className="text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
                أثر هذه الدفعة
              </p>
              <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
                <span>المدفوع</span>
                <span className="flex items-center gap-1.5 tabular-nums">
                  <span style={{ color: "var(--text-muted)" }}>${formatNumber(impact.paidBefore, 2)}</span>
                  <ArrowLeft size={11} />
                  <b style={{ color: "#22C55E" }}>${formatNumber(impact.paidAfter, 2)}</b>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
                <span>المتبقي</span>
                <span className="flex items-center gap-1.5 tabular-nums">
                  <span style={{ color: "var(--text-muted)" }}>${formatNumber(impact.remainingBefore, 2)}</span>
                  <ArrowLeft size={11} />
                  <b style={{ color: impact.remainingAfter > 0.01 ? "#F59E0B" : "#22C55E" }}>
                    ${formatNumber(impact.remainingAfter, 2)}
                  </b>
                </span>
              </div>

              {allocationPreview.length > 0 && (
                <div className="pt-2 border-t space-y-1" style={{ borderColor: "var(--border)" }}>
                  {allocationPreview.map((a) => (
                    <div key={a.installmentId} className="flex items-center justify-between text-[11px]"
                      style={{ color: "var(--text-secondary)" }}>
                      <span>قسط #{a.installmentNumber}</span>
                      <span className="tabular-nums">
                        ${formatNumber(a.appliedUSD, 2)}
                        <span className="mr-1.5" style={{ color: a.status === "paid" ? "#22C55E" : "#F59E0B" }}>
                          {a.status === "paid" ? "مكتمل" : "جزئي"}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {currentInvoice && impact.settlesInvoice && (
                <p className="text-[11px] font-semibold" style={{ color: "#22C55E" }}>
                  ستصبح الفاتورة {currentInvoice.invoiceNumber} مدفوعة بالكامل.
                </p>
              )}

              {impact.overpays && (
                <p className="flex items-start gap-1.5 text-[11px] font-semibold" style={{ color: "#EF4444" }}>
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  المبلغ يتجاوز إجمالي الاشتراك — سيرفضه الخادم.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading || impact.overpays}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition-all">
              {loading ? "جاري الحفظ..." : "حفظ الدفعة"}
            </button>
            <button type="button" onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
