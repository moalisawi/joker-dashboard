"use client";

import { useState } from "react";
import type { Subscriber } from "@/types";
import { freezeService } from "@/services";
import { callSubscriberOperation } from "@/lib/clientOperations";

interface FreezeModalProps {
  subscriber: Subscriber;
  isOpen: boolean;
  onClose: () => void;
  onFrozen?: () => void;
  currentUser: { uid: string; displayName: string };
}

export default function FreezeModal({
  subscriber,
  isOpen,
  onClose,
  onFrozen,
  currentUser,
}: FreezeModalProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  // Calculate remaining days
  const today = new Date().toISOString().split("T")[0];
  const remainingDays = freezeService.calculateRemainingDays(
    today,
    subscriber.expiryDate
  );
  const daysUsed = subscriber.duration - remainingDays;

  const handleFreeze = async () => {
    try {
      setLoading(true);
      setError("");

      if (!reason.trim()) {
        setError("Please provide a freeze reason");
        return;
      }

      await callSubscriberOperation("freezeSubscription", {
        subscriberId: subscriber.id,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });

      setReason("");
      setNotes("");
      onFrozen?.();
      onClose();
    } catch (err: any) {
      console.error("Error freezing subscription:", err);
      setError(err.message || "Failed to freeze subscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-xl">❄️</span>
          </div>
          <div>
            <h2 className="font-bold text-slate-800">تجميد الاشتراك</h2>
            <p className="text-sm text-slate-500">{subscriber.name}</p>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-3 mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">تاريخ الاشتراك:</span>
            <span className="font-semibold text-slate-800">{subscriber.startDate}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">تاريخ الانتهاء الأصلي:</span>
            <span className="font-semibold text-slate-800">{subscriber.expiryDate}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">الأيام المتبقية:</span>
            <span className="font-semibold text-blue-600">{remainingDays} يوم</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">الأيام المستخدمة:</span>
            <span className="font-semibold text-slate-800">{daysUsed} يوم</span>
          </div>
          <div className="border-t border-blue-100 pt-3 mt-3">
            <p className="text-xs text-slate-600">
              سيتم الحفاظ على {remainingDays} يوم عند استئناف الاشتراك
            </p>
          </div>
        </div>

        {/* Reason */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            سبب التجميد *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: إجازة مؤقتة"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            ملاحظات إضافية (اختيارية)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={handleFreeze}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جاري...
              </>
            ) : (
              <>❄️ تجميد</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
