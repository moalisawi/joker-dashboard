"use client";

import { useMemo } from "react";
import type { Subscriber } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { callSubscriberOperation } from "@/lib/clientOperations";
import {
  formatDate, formatNumber, daysSince,
} from "@/lib/utils";
import { PauseCircle, PlayCircle, User, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface Props {
  subscribers: Subscriber[];
  onProfile:  (s: Subscriber) => void;
  onEdit:     (s: Subscriber) => void;
  onRefresh?: () => void;
}

export default function PausedSubscribersSection({
  subscribers, onProfile, onEdit,
}: Props) {
  const { user, can } = useAuthStore();
  const canRev = can("canViewRevenue");
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [confirmId, setConfirmId]   = useState<string | null>(null);

  const paused = useMemo(
    () => subscribers.filter((s) => s.subscriptionStatus === "paused"),
    [subscribers]
  );

  if (paused.length === 0) return null;

  async function handleResume(s: Subscriber) {
    if (!user) return;
    setConfirmId(null);
    setResumingId(s.id);
    try {
      await callSubscriberOperation("resumePausedSubscription", {
        subscriberId: s.id,
      });
      toast.success(`تم استئناف اشتراك ${s.name}`);
    } catch (err) {
      toast.error("فشل الاستئناف: " + (err instanceof Error ? err.message : "حدث خطأ"));
    } finally {
      setResumingId(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 bg-amber-50/60 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <PauseCircle size={18} className="text-amber-600" />
          <h3 className="font-bold text-slate-800">الاشتراكات الموقوفة</h3>
          <span className="text-xs font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
            {paused.length}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          مدة الإيقاف لا تُحسب من الاشتراك — المشترك يستأنف من تاريخ العودة
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-amber-50/40 text-slate-500 text-xs font-semibold">
              <th className="px-4 py-3 text-right">المشترك</th>
              <th className="px-4 py-3 text-right">الباقة</th>
              <th className="px-4 py-3 text-right">تاريخ الإيقاف</th>
              <th className="px-4 py-3 text-right">سبب الإيقاف</th>
              <th className="px-4 py-3 text-right">أيام موقوف</th>
              <th className="px-4 py-3 text-right">أيام متبقية</th>
              {canRev && <th className="px-4 py-3 text-right">المتبقي مالياً</th>}
              <th className="px-4 py-3 text-right">من أوقفه</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {paused.map((s) => {
              const pausedDays = daysSince(s.pausedAt);
              return (
                <tr key={s.id} className="border-b border-amber-50 hover:bg-amber-50/30 transition">
                  <td className="px-4 py-3">
                    <p
                      className="font-semibold text-slate-800 cursor-pointer hover:text-blue-600 transition-colors"
                      onClick={() => onProfile(s)}
                    >
                      {s.name}
                    </p>
                    <p className="text-xs text-slate-500 font-mono" dir="ltr">
                      {s.dialCode}{s.phone}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                      s.package === "فضية" ? "pkg-silver" : "pkg-gold"
                    }`}>
                      {s.package}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                    {s.pausedAt
                      ? formatDate((s.pausedAt as { toDate?: () => Date }).toDate?.()?.toISOString().split("T")[0] ?? "")
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-40 truncate" title={s.pauseReason || ""}>
                    {s.pauseReason || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                      {pausedDays} يوم
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      {s.remainingDaysAtPause ?? 0} يوم
                    </span>
                  </td>
                  {canRev && (
                    <td className="px-4 py-3 text-xs text-amber-700 font-semibold">
                      ${formatNumber(s.remainingAmountUSD, 2)}
                    </td>
                  )}
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {s.pausedBy ? (
                      <span className="flex items-center gap-1">
                        <User size={11} /> {s.pausedBy.slice(0, 8)}…
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => setConfirmId(s.id)}
                        disabled={resumingId === s.id}
                        className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {resumingId === s.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <PlayCircle size={12} />}
                        استئناف
                      </button>
                      <button
                        onClick={() => onProfile(s)}
                        className="px-2 py-1 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded text-xs transition"
                      >
                        ملف
                      </button>
                      {can("canEdit") && (
                        <button
                          onClick={() => onEdit(s)}
                          className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs transition"
                        >
                          تعديل
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
      <div className="px-5 py-3 bg-amber-50/40 rounded-b-2xl border-t border-amber-100 flex items-center justify-between text-xs text-slate-500">
        <span>
          إجمالي الأيام المجمّدة:{" "}
          <strong className="text-amber-700">
            {paused.reduce((sum, s) => sum + (s.remainingDaysAtPause ?? 0), 0)} يوم
          </strong>
        </span>
        {canRev && (
          <span>
            متبقي مالي موقوف:{" "}
            <strong className="text-amber-700">
              ${formatNumber(paused.reduce((sum, s) => sum + s.remainingAmountUSD, 0), 2)}
            </strong>
          </span>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(confirmId)}
        onClose={() => setConfirmId(null)}
        onConfirm={() => {
          const s = paused.find((p) => p.id === confirmId);
          if (s) handleResume(s);
        }}
        loading={Boolean(resumingId)}
        title="استئناف الاشتراك"
        description={`هل تريد استئناف اشتراك "${paused.find((p) => p.id === confirmId)?.name ?? ""}"؟`}
        confirmLabel="استئناف"
      />
    </div>
  );
}
