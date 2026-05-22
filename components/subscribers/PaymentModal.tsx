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
import { X } from "lucide-react";

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
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");

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

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">وصل الدفع</label>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf"
              className="text-sm text-slate-600" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
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
