"use client";

import { useMemo } from "react";
import type { Subscriber } from "@/types";
import { freezeService } from "@/services";
import { useAuthStore } from "@/store/authStore";
import { formatDate, formatNumber } from "@/lib/utils";
import { Snowflake, PlayCircle } from "lucide-react";

interface Props {
  subscribers: Subscriber[];
  onProfile: (s: Subscriber) => void;
  onResume: (s: Subscriber) => void;
  onEdit?: (s: Subscriber) => void;
}

export default function FrozenSubscribersSection({
  subscribers,
  onProfile,
  onResume,
  onEdit,
}: Props) {
  const { can } = useAuthStore();
  const canRev = can("canViewRevenue");

  const frozen = useMemo(
    () => subscribers.filter((s) => s.freezeData?.isFrozen === true),
    [subscribers]
  );

  if (frozen.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-blue-200 shadow-sm mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-blue-100 bg-blue-50/60 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Snowflake size={18} className="text-blue-600" />
          <h3 className="font-bold text-slate-800">الاشتراكات المتجمدة</h3>
          <span className="text-xs font-bold bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
            {frozen.length}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          الأيام المتبقية محفوظة — الاشتراك يستأنف من تاريخ الإعادة
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-50/40 text-slate-500 text-xs font-semibold">
              <th className="px-4 py-3 text-right">المشترك</th>
              <th className="px-4 py-3 text-right">الباقة</th>
              <th className="px-4 py-3 text-right">تاريخ التجميد</th>
              <th className="px-4 py-3 text-right">سبب التجميد</th>
              <th className="px-4 py-3 text-right">أيام متجمد</th>
              <th className="px-4 py-3 text-right">أيام محفوظة</th>
              <th className="px-4 py-3 text-right">الانتهاء الأصلي</th>
              {canRev && <th className="px-4 py-3 text-right">المتبقي مالياً</th>}
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {frozen.map((s) => {
              const fd = s.freezeData!;
              const frozenDays = freezeService.getFreezeDuration(fd);
              const frozenAtStr = fd.frozenAt
                ? ((fd.frozenAt as any)?.toDate?.() || new Date(fd.frozenAt as any))
                    .toISOString()
                    .split("T")[0]
                : null;

              return (
                <tr
                  key={s.id}
                  className="border-b border-blue-50 hover:bg-blue-50/30 transition"
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onProfile(s)}
                      className="flex items-center gap-2 group"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "start" }}
                    >
                      <span className="h-8 w-8 shrink-0 flex items-center justify-center rounded-xl text-[10px] font-black text-white"
                        style={{ background: "linear-gradient(135deg,#5B5FEF,#4338CA)", boxShadow: "0 2px 6px rgba(91,95,239,.28)", letterSpacing: "0.04em" }}>
                        {(s.name || "؟").split(" ").map((w: string) => w[0]).slice(0,2).join("").toUpperCase()}
                      </span>
                      <div>
                        <p className="font-semibold text-sm group-hover:text-indigo-500 transition-colors" style={{ color: "var(--jk-text)" }}>{s.name}</p>
                        <p className="text-xs font-mono" style={{ color: "var(--jk-muted)" }} dir="ltr">{s.dialCode}{s.phone}</p>
                      </div>
                    </button>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold ${
                        s.package === "فضية" ? "pkg-silver" : "pkg-gold"
                      }`}
                    >
                      {s.package}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                    {frozenAtStr ? formatDate(frozenAtStr) : "—"}
                  </td>

                  <td
                    className="px-4 py-3 text-xs text-slate-600 max-w-40 truncate"
                    title={fd.freezeReason || ""}
                  >
                    {fd.freezeReason || "—"}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {frozenDays} يوم
                    </span>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                      {fd.remainingDays} يوم
                    </span>
                  </td>

                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                    {fd.originalExpiryDate ? formatDate(fd.originalExpiryDate) : "—"}
                  </td>

                  {canRev && (
                    <td className="px-4 py-3 text-xs text-amber-700 font-semibold">
                      ${formatNumber(s.remainingAmountUSD, 2)}
                    </td>
                  )}

                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {can("canWithdraw") && (
                        <button
                          onClick={() => onResume(s)}
                          className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-semibold transition"
                        >
                          <PlayCircle size={12} /> استئناف
                        </button>
                      )}
                      <button
                        onClick={() => onProfile(s)}
                        className="px-2 py-1 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded text-xs transition"
                      >
                        ملف
                      </button>
                      {can("canEdit") && onEdit && (
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
      <div className="px-5 py-3 bg-blue-50/40 rounded-b-2xl border-t border-blue-100 flex items-center justify-between text-xs text-slate-500">
        <span>
          إجمالي الأيام المحفوظة:{" "}
          <strong className="text-blue-700">
            {frozen.reduce((sum, s) => sum + (s.freezeData?.remainingDays ?? 0), 0)} يوم
          </strong>
        </span>
        <span>
          متوسط مدة التجميد:{" "}
          <strong className="text-blue-700">
            {frozen.length > 0
              ? Math.round(
                  frozen.reduce((sum, s) => sum + freezeService.getFreezeDuration(s.freezeData), 0) /
                    frozen.length
                )
              : 0}{" "}
            يوم
          </strong>
        </span>
        {canRev && (
          <span>
            متبقي مالي متجمد:{" "}
            <strong className="text-blue-700">
              ${formatNumber(frozen.reduce((sum, s) => sum + s.remainingAmountUSD, 0), 2)}
            </strong>
          </span>
        )}
      </div>
    </div>
  );
}
