"use client";

import { useState } from "react";
import type { Subscriber } from "@/types";
import { freezeService } from "@/services";

interface ResumeModalProps {
  subscriber: Subscriber;
  isOpen: boolean;
  onClose: () => void;
  onResumed?: () => void;
  currentUser: { uid: string; displayName: string };
}

export default function ResumeModal({
  subscriber,
  isOpen,
  onClose,
  onResumed,
  currentUser,
}: ResumeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !subscriber.freezeData?.isFrozen) return null;

  const freezeData = subscriber.freezeData;
  const freezeDuration = freezeService.getFreezeDuration(freezeData);
  const today = new Date().toISOString().split("T")[0];
  const newExpiryDate = freezeService.addDaysToDate(today, freezeData.remainingDays);

  // Get freeze date
  const frozenAtDate = (freezeData.frozenAt as any)?.toDate?.() || new Date(freezeData.frozenAt as any);
  const frozenAtString = frozenAtDate.toISOString().split("T")[0];

  const handleResume = async () => {
    try {
      setLoading(true);
      setError("");

      await freezeService.resume({
        subscriberId: subscriber.id,
        resumedBy: currentUser.uid,
        resumedByName: currentUser.displayName,
      });

      onResumed?.();
      onClose();
    } catch (err: any) {
      console.error("Error resuming subscription:", err);
      setError(err.message || "Failed to resume subscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-xl">▶️</span>
          </div>
          <div>
            <h2 className="font-bold text-slate-800">استئناف الاشتراك</h2>
            <p className="text-sm text-slate-500">{subscriber.name}</p>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-3 mb-6 p-4 bg-green-50 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">تم التجميد في:</span>
            <span className="font-semibold text-slate-800">{frozenAtString}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">مدة التجميد:</span>
            <span className="font-semibold text-slate-800">{freezeDuration} أيام</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">سبب التجميد:</span>
            <span className="font-semibold text-slate-800">
              {freezeData.freezeReason || "—"}
            </span>
          </div>
          <div className="border-t border-green-100 pt-3 mt-3">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-600">الأيام المحفوظة:</span>
              <span className="font-semibold text-green-600">{freezeData.remainingDays} يوم</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">تاريخ الانتهاء الجديد:</span>
              <span className="font-semibold text-green-600">{newExpiryDate}</span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            ✓ سيتم استئناف الاشتراك اليوم وإضافة {freezeData.remainingDays} يوم محفوظ
          </p>
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
            onClick={handleResume}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جاري...
              </>
            ) : (
              <>▶️ استئناف</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
