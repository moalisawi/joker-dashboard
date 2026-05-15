"use client";

import { useState, useMemo } from "react";
import type { Subscriber, Currency } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { useRefunds } from "@/hooks/useRefunds";
import { withdrawalService } from "@/services";
import { callSubscriberOperation } from "@/lib/clientOperations";
import { formatNumber, formatDate } from "@/lib/utils";
import { X, AlertCircle, CheckCircle, UserMinus, Calendar, DollarSign } from "lucide-react";
import { toast } from "@/lib/toast";

interface Props {
  subscriber: Subscriber;
  exchangeRates: Record<string, number>;
  onClose: () => void;
  onSaved: () => void;
}

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "USD", label: "دولار USD" },
  { value: "EGP", label: "جنيه EGP" },
  { value: "JOD", label: "دينار JOD" },
  { value: "ILS", label: "شيكل ILS" },
];

export default function WithdrawModal({ subscriber: s, exchangeRates, onClose, onSaved }: Props) {
  const { user, can } = useAuthStore();
  const { refunds } = useRefunds({ subscriberId: s.id });

  const [reason, setReason]               = useState(s.withdrawalReason || "");
  const [notes, setNotes]                 = useState("");
  const [refundAmount, setRefundAmount]   = useState("");
  const [refundCurrency, setRefundCurrency] = useState<Currency>(s.currencyOriginal || "USD");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [done, setDone]                   = useState(false);

  // ─── Computed financial values ─────────────────────────────────────────────
  const refundRate    = exchangeRates[refundCurrency] ?? 1;
  const refundRaw     = parseFloat(refundAmount || "0");
  const refundUSD     = refundRaw > 0 ? refundRaw / refundRate : 0;

  const prevRefundUSD = useMemo(
    () => refunds.reduce((s, r) => s + (r.refundAmountUSD || 0), 0),
    [refunds]
  );
  const totalPriceUSD = s.totalPriceUSD || 0;
  const paidUSD       = s.paidAmountUSD || 0;
  const netUSD        = paidUSD - prevRefundUSD;
  const maxRefundable = Math.max(0, netUSD);
  const newTotalRefundUSD = prevRefundUSD + refundUSD;

  // ─── Time accounting ────────────────────────────────────────────────────────
  const today        = new Date().toISOString().split("T")[0];
  const activeDays   = withdrawalService.calcDaysUsed(s.date || s.startDate || today);
  const remainDays   = withdrawalService.calcRemainingDays(s.expiryDate, today);

  // ─── Validation flags ──────────────────────────────────────────────────────
  const alreadyWithdrawn = s.subscriptionState === "withdrawn";
  const refundExceedsNet = refundUSD > maxRefundable + 0.005;
  const refundExceedsPaid = newTotalRefundUSD > paidUSD + 0.005;
  const hasRefund = refundRaw > 0;

  // ─── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !can("canWithdraw")) return;

    if (!reason.trim()) {
      setError("يجب تحديد سبب الانسحاب");
      return;
    }
    if (alreadyWithdrawn) {
      setError("الاشتراك منسحب مسبقاً");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await callSubscriberOperation("withdrawSubscriber", {
        subscriberId:    s.id,
        reason:          reason.trim(),
        notes:           notes.trim() || undefined,
        refundAmount:    hasRefund ? refundRaw     : undefined,
        refundCurrency:  hasRefund ? refundCurrency : undefined,
        exchangeRate:    hasRefund ? refundRate     : undefined,
      });

      setDone(true);
      toast.success("تم تسجيل الانسحاب بنجاح");
      setTimeout(() => { onSaved(); onClose(); }, 1400);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
              <UserMinus size={16} className="text-rose-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">تسجيل الانسحاب</h3>
              <p className="text-xs text-slate-500">{s.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
            <X size={18} />
          </button>
        </div>

        {/* Already withdrawn notice */}
        {alreadyWithdrawn && (
          <div className="mx-5 mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 flex gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-slate-400" />
            هذا المشترك منسحب مسبقاً. يمكنك إضافة استرداد إضافي فقط.
          </div>
        )}

        {done ? (
          <div className="flex flex-col items-center justify-center py-14">
            <CheckCircle className="text-emerald-500 mb-3" size={48} />
            <h4 className="font-bold text-slate-800 mb-1">تم تسجيل الانسحاب</h4>
            <p className="text-sm text-slate-500">جاري الإغلاق...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* ── Time summary ──────────────────────────────────────────────── */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">الملخص الزمني</span>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center text-xs">
                <div>
                  <p className="text-slate-400 mb-0.5">بداية الاشتراك</p>
                  <p className="font-semibold text-slate-700">{formatDate(s.date || s.startDate)}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-0.5">تاريخ الانتهاء</p>
                  <p className="font-semibold text-slate-700">{formatDate(s.expiryDate)}</p>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <p className="text-slate-400 mb-0.5">أيام استُخدمت</p>
                  <p className="font-bold text-slate-800 text-base">{activeDays}</p>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <p className="text-slate-400 mb-0.5">أيام متبقية</p>
                  <p className="font-bold text-amber-700 text-base">{remainDays}</p>
                </div>
              </div>
            </div>

            {/* ── Financial summary ────────────────────────────────────────── */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">الملخص المالي</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">السعر الكلي</p>
                  <p className="font-bold text-slate-800">${formatNumber(totalPriceUSD, 2)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">المدفوع</p>
                  <p className="font-bold text-blue-600">${formatNumber(paidUSD, 2)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">استردادات سابقة</p>
                  <p className="font-bold text-amber-600">${formatNumber(prevRefundUSD, 2)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">قابل للرد</p>
                  <p className="font-bold text-emerald-600">${formatNumber(maxRefundable, 2)}</p>
                </div>
              </div>

              {/* Previous refunds list */}
              {refunds.length > 0 && (
                <div className="mt-3 bg-white rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 mb-2">استردادات سابقة ({refunds.length}):</p>
                  <div className="space-y-1">
                    {refunds.map((r) => (
                      <div key={r.id} className="flex justify-between text-xs text-slate-600">
                        <span>{r.refundDate}</span>
                        <span className="font-semibold text-rose-600">-${formatNumber(r.refundAmountUSD, 2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Withdrawal reason ────────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                سبب الانسحاب <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="مثال: لم أعد بحاجة للخدمة"
                className="form-input w-full resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                ملاحظات إضافية <span className="text-slate-400">(اختياري)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="أي تفاصيل إضافية..."
                className="form-input w-full resize-none"
              />
            </div>

            {/* ── Refund section (optional) ────────────────────────────────── */}
            <div className="border border-dashed border-slate-200 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 mb-3">
                الاسترداد <span className="text-slate-400 font-normal">(اختياري — اتركه فارغاً إذا لا يوجد استرداد)</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">مبلغ الاسترداد</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="0.00"
                    className="form-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">العملة</label>
                  <select
                    value={refundCurrency}
                    onChange={(e) => setRefundCurrency(e.target.value as Currency)}
                    className="form-input w-full"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Refund preview */}
              {hasRefund && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs space-y-1.5">
                  <div className="flex justify-between text-blue-800">
                    <span>الاسترداد بالدولار:</span>
                    <span className="font-bold">${formatNumber(refundUSD, 2)}</span>
                  </div>
                  <div className="flex justify-between text-blue-800">
                    <span>سعر الصرف المستخدم:</span>
                    <span className="font-bold">
                      1 {refundCurrency} = {formatNumber(1 / refundRate, 4)} USD
                    </span>
                  </div>
                  <div className="flex justify-between text-blue-800">
                    <span>إجمالي الاستردادات بعد التنفيذ:</span>
                    <span className="font-bold">${formatNumber(newTotalRefundUSD, 2)}</span>
                  </div>
                  <p className="text-blue-600 pt-1 border-t border-blue-100">
                    💡 يُسجَّل هذا الاسترداد في شهر اليوم فقط. لا تتأثر بيانات الأشهر السابقة.
                  </p>
                </div>
              )}
            </div>

            {/* ── Warnings ─────────────────────────────────────────────────── */}
            {refundExceedsNet && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex gap-2">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                ⚠️ مبلغ الاسترداد (${formatNumber(refundUSD, 2)}) يتجاوز الصافي المتاح للرد (${formatNumber(maxRefundable, 2)}).
              </div>
            )}
            {refundExceedsPaid && !refundExceedsNet && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700 flex gap-2">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                ⚠️ إجمالي الاستردادات (${formatNumber(newTotalRefundUSD, 2)}) يتجاوز ما دفعه المشترك (${formatNumber(paidUSD, 2)}).
              </div>
            )}

            {/* ── Actions ──────────────────────────────────────────────────── */}
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={loading || !can("canWithdraw")}
                className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري التنفيذ...
                  </>
                ) : (
                  <>
                    <UserMinus size={16} />
                    تنفيذ الانسحاب{hasRefund ? ` + رد $${formatNumber(refundUSD, 2)}` : ""}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
