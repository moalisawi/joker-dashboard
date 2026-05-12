"use client";

import { useState } from "react";
import type { Subscriber } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { callSubscriberOperation } from "@/lib/clientOperations";
import { formatDate, formatNumber } from "@/lib/utils";
import { X, PauseCircle } from "lucide-react";

interface Props {
  subscriber: Subscriber;
  onClose: () => void;
  onSaved: () => void;
}

export default function PauseModal({ subscriber: s, onClose, onSaved }: Props) {
  const { user } = useAuthStore();
  const [reason, setReason] = useState("");
  const [notes, setNotes]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setLoading(true);

    try {
      await callSubscriberOperation("pauseSubscription", {
        subscriberId: s.id,
        reason: reason.trim(),
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
          <div className="flex items-center gap-2">
            <PauseCircle size={18} className="text-amber-500" />
            <h3 className="font-bold text-slate-800">إيقاف الاشتراك</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
            <X size={18} />
          </button>
        </div>

        {/* Subscriber summary */}
        <div className="px-5 pt-4 pb-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="font-bold text-slate-800">{s.name}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className={`px-2 py-0.5 rounded font-bold ${s.package === "فضية" ? "pkg-silver" : "pkg-gold"}`}>
                {s.package}
              </span>
              <span>ينتهي: {formatDate(s.expiryDate)}</span>
              <span className="text-amber-700 font-semibold">
                سيُجمَّد {Math.max(0, s.daysRemaining)} يوم متبقٍ
              </span>
            </div>
          </div>

          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            عند إعادة التفعيل، سيبدأ الاشتراك من تاريخ العودة ويمتد{" "}
            <strong>{Math.max(0, s.daysRemaining)} يوم</strong> كاملة بغض النظر عن مدة الإيقاف.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              سبب الإيقاف <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: سفر مؤقت، ظروف مادية..."
              className="form-input"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">ملاحظات إضافية</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="form-input resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <PauseCircle size={16} />
              {loading ? "جاري الإيقاف..." : "تأكيد الإيقاف"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
