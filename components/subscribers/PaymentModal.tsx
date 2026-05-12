"use client";

import { useState, useRef } from "react";
import type { Subscriber, Currency } from "@/types";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/storage";
import { useAuthStore } from "@/store/authStore";
import { callSubscriberOperation } from "@/lib/clientOperations";
import { formatNumber, todayString } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/permissions";
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

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(subscriber.currencyOriginal || "USD");
  const [method, setMethod] = useState(subscriber.payment || "");
  const [date, setDate] = useState(todayString());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const rate = exchangeRates[currency] || 1;
  const amountUSD = parseFloat(amount || "0") / rate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setLoading(true);

    try {
      const amt = parseFloat(amount);

      // Upload receipt
      let receiptUrl: string | null = null;
      const file = fileRef.current?.files?.[0];
      if (file) {
        const storageRef = ref(storage, `receipts/${subscriber.id}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        receiptUrl = await getDownloadURL(storageRef);
      }

      await callSubscriberOperation("addPayment", {
        subscriberId: subscriber.id,
        amountOriginal: amt,
        currencyOriginal: currency,
        exchangeRate: rate,
        paymentMethod: method,
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
                <option value="USD">دولار USD</option>
                <option value="EGP">جنيه EGP</option>
                <option value="JOD">دينار JOD</option>
                <option value="ILS">شيكل ILS</option>
              </select>
            </div>
          </div>

          {parseFloat(amount) > 0 && currency !== "USD" && (
            <p className="text-xs text-slate-400">≈ ${formatNumber(amountUSD, 2)}</p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">طريقة الدفع</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="form-input w-full">
              <option value="">اختر...</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

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
