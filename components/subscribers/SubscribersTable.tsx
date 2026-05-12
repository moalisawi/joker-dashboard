"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import type { Subscriber } from "@/types";
import { formatNumber, formatDate, getWhatsAppLink } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { Search } from "lucide-react";

interface Props {
  subscribers: Subscriber[];
  onProfile: (s: Subscriber) => void;
  onEdit: (s: Subscriber) => void;
  onWithdraw: (s: Subscriber) => void;
  onDelete: (id: string, name: string) => void;
  onAddPayment: (s: Subscriber) => void;
  onRenew: (s: Subscriber) => void;
  onPause: (s: Subscriber) => void;
  onFreeze?: (s: Subscriber) => void;
  onResume?: (s: Subscriber) => void;
}

export default function SubscribersTable({
  subscribers,
  onProfile,
  onEdit,
  onWithdraw,
  onDelete,
  onAddPayment,
  onRenew,
  onPause,
  onFreeze,
  onResume,
}: Props) {
  const { can } = useAuthStore();
  const canRev = can("canViewRevenue");

  const [search, setSearch] = useState("");
  const [filterEmp, setFilterEmp] = useState("");
  const [filterPkg, setFilterPkg] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Exclude paused (→ PausedSubscribersSection) and frozen (→ FrozenSubscribersSection)
  const activeSubs = useMemo(
    () =>
      subscribers.filter(
        (s) => s.subscriptionStatus !== "paused" && s.freezeData?.isFrozen !== true
      ),
    [subscribers]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return activeSubs.filter(
      (s) =>
        (!q ||
          s.name?.toLowerCase().includes(q) ||
          s.phone?.includes(q)) &&
        (!filterEmp || s.convincedBy === filterEmp) &&
        (!filterPkg || s.package === filterPkg) &&
        (!filterStatus || s.status === filterStatus)
    );
  }, [subscribers, search, filterEmp, filterPkg, filterStatus]);

  const statusClass = useCallback((status: string) => {
    if (status === "نشط") return "status-active";
    if (status === "ينتهي قريباً") return "status-expiring";
    if (status === "منتهي") return "status-expired";
    if (status === "متجمد") return "status-frozen";
    return "status-withdrawn";
  }, []);

  const empClass = useCallback((emp: string) => {
    if (emp === "حنان") return "badge-hanan";
    if (emp === "ميار") return "badge-mayar";
    return "badge-medo";
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      {/* Filters */}
      <div className="p-4 border-b border-slate-50 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-xl pr-8 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <select value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 bg-white">
          <option value="">كل الموظفين</option>
          {["حنان","ميار","ميدو"].map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filterPkg} onChange={(e) => setFilterPkg(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 bg-white">
          <option value="">كل الباقات</option>
          <option value="فضية">فضية</option>
          <option value="ذهبية">ذهبية</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 bg-white">
          <option value="">كل الحالات</option>
          <option value="نشط">نشط</option>
          <option value="ينتهي قريباً">ينتهي قريباً</option>
          <option value="منتهي">منتهي</option>
          <option value="منسحب">منسحب</option>
          <option value="متجمد">متجمد</option>
        </select>
        <span className="text-xs text-slate-400">{filtered.length} من {activeSubs.length}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs font-semibold">
              <th className="px-4 py-3 text-right">#</th>
              <th className="px-4 py-3 text-right">التاريخ</th>
              <th className="px-4 py-3 text-right">الاسم</th>
              <th className="px-4 py-3 text-right">الهاتف</th>
              <th className="px-4 py-3 text-right">الباقة</th>
              {canRev && <th className="px-4 py-3 text-right">المبلغ</th>}
              {canRev && <th className="px-4 py-3 text-right">المدفوع</th>}
              {canRev && <th className="px-4 py-3 text-right">الصافي</th>}
              <th className="px-4 py-3 text-right">الانتهاء</th>
              <th className="px-4 py-3 text-right">الحالة</th>
              <th className="px-4 py-3 text-right">الموظف</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-slate-400">
                  لا توجد بيانات
                </td>
              </tr>
            )}
            {filtered.map((s, i) => {
              const is15Day =
                s.daysRemaining > 7 &&
                s.daysRemaining <= 15 &&
                s.subscriptionState !== "withdrawn";

              const totalUSD = s.totalPriceUSD || s.netAmountUSD;
              const payPct = totalUSD > 0 ? Math.min(100, (s.paidAmountUSD / totalUSD) * 100) : 100;
              const isPartial = s.remainingAmountUSD > 0.01;

              const renewalBadge = s.isRenewal
                ? s.isUpgrade ? " ⬆️" : s.isDowngrade ? " ⬇️" : " 🔄"
                : "";

              return (
                <tr
                  key={s.id}
                  className={`border-b border-slate-50 hover:bg-blue-50/30 transition duration-100 ${is15Day ? "bg-amber-50/30" : ""}`}
                >
                  <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{formatDate(s.date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/subscribers/${s.id}`}
                      className="flex items-center gap-2 group"
                    >
                      <span className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg text-[10px] font-black text-white"
                        style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)" }}>
                        {(s.name || "؟").split(" ").map((w: string) => w[0]).slice(0,2).join("").toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <span className="text-sm font-semibold group-hover:text-blue-600 transition-colors block">
                          {s.name || "-"}
                        </span>
                        {s.team && (
                          <span className="text-[10px] text-slate-400">{s.team}</span>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono whitespace-nowrap" dir="ltr">
                    {s.dialCode} {s.phone}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap ${s.package === "فضية" ? "pkg-silver" : "pkg-gold"}`}>
                        {s.package}{renewalBadge}
                      </span>
                      {s.renewalCount > 0 && (
                        <span className="text-[10px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-bold" title={`جُدِّد ${s.renewalCount} مرة`}>
                          🔄{s.renewalCount}
                        </span>
                      )}
                    </div>
                  </td>
                  {canRev && (
                    <td className="px-4 py-3 text-slate-700 text-xs whitespace-nowrap">
                      {s.currencyOriginal !== "USD" && s.totalPrice
                        ? <><span className="font-semibold">{formatNumber(s.totalPrice, 2)}</span> <span className="text-slate-400 text-[10px]">{s.currencyOriginal}</span><br/><span className="text-slate-400">≈${formatNumber(s.totalPriceUSD, 2)}</span></>
                        : `$${formatNumber(s.totalPriceUSD, 2)}`}
                    </td>
                  )}
                  {canRev && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-semibold text-emerald-700 text-xs">${formatNumber(s.paidAmountUSD, 2)}</span>
                      {isPartial && (
                        <span className="text-xs text-amber-600 mr-1">/ ${formatNumber(s.remainingAmountUSD, 2)}</span>
                      )}
                      <div className="pay-bar">
                        <div className={`pay-bar-fill ${isPartial ? "partial" : ""}`} style={{ width: `${payPct}%` }} />
                      </div>
                    </td>
                  )}
                  {canRev && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-emerald-700 text-xs">${formatNumber(s.netAmountUSD, 2)}</span>
                      {(s.refundAmountUSD ?? 0) > 0 && (
                        <div className="text-rose-500 text-[10px]">-${formatNumber(s.refundAmountUSD ?? 0, 2)}</div>
                      )}
                      {s.renewalCount > 0 && s.lifetimeValueUSD > s.netAmountUSD && (
                        <div className="text-cyan-600 text-[10px]" title="إجمالي العمر">
                          LTV ${formatNumber(s.lifetimeValueUSD, 0)}
                        </div>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{formatDate(s.expiryDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${statusClass(s.status)}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${empClass(s.convincedBy)}`}>
                      {s.convincedBy || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {can("canEdit") && (
                        <button onClick={() => onEdit(s)}
                          className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs transition">
                          تعديل
                        </button>
                      )}
                      {can("canCreate") && s.subscriptionState !== "withdrawn" && (
                        <button onClick={() => onRenew(s)}
                          className="px-2 py-1 rounded bg-cyan-50 text-cyan-700 hover:bg-cyan-100 text-xs transition">
                          🔄
                        </button>
                      )}
                      {can("canCreate") && s.subscriptionState !== "withdrawn" && (
                        <button onClick={() => onAddPayment(s)}
                          className="px-2 py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs transition">
                          دفعة
                        </button>
                      )}
                      <button onClick={() => onProfile(s)}
                        className="px-2 py-1 rounded bg-slate-50 text-slate-600 hover:bg-slate-100 text-xs transition">
                        تفاصيل
                      </button>
                      <a href={getWhatsAppLink(s.dialCode, s.phone)} target="_blank" rel="noopener"
                        className="px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 text-xs transition">
                        📱
                      </a>
                      {can("canWithdraw") && s.subscriptionState !== "withdrawn" && s.daysRemaining > 0 && (
                        <button
                          onClick={() => onPause(s)}
                          className="px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs transition"
                        >
                          ⏸ إيقاف
                        </button>
                      )}
                      {can("canWithdraw") && s.subscriptionState !== "withdrawn" && s.status === "نشط" && !s.freezeData?.isFrozen && (
                        <button
                          onClick={() => onFreeze?.(s)}
                          className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs transition"
                          title="تجميد مؤقت مع حفظ الأيام"
                        >
                          ❄️ تجميد
                        </button>
                      )}
                      {can("canWithdraw") && s.freezeData?.isFrozen && (
                        <button
                          onClick={() => onResume?.(s)}
                          className="px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 text-xs transition"
                          title="استئناف الاشتراك"
                        >
                          ▶️ استئناف
                        </button>
                      )}
                      {can("canWithdraw") && (
                        <button onClick={() => onWithdraw(s)}
                          className={`px-2 py-1 rounded text-xs transition ${
                            s.subscriptionState === "withdrawn"
                              ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                          }`}>
                          {s.subscriptionState === "withdrawn" ? "انسحاب✓" : "انسحاب"}
                        </button>
                      )}
                      {can("canDelete") && (
                        <button onClick={() => onDelete(s.id, s.name)}
                          className="px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 text-xs transition">
                          حذف
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
    </div>
  );
}
