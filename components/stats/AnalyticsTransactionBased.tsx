"use client";

import { useState, useMemo } from "react";
import type { MonthlyAnalytics } from "@/types";
import { formatNumber, ARABIC_MONTHS, RESIDENCE_COUNTRIES, PHONE_COUNTRIES } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useMonthlyAnalytics, calculateAnalyticsSummary } from "@/hooks/useMonthlyAnalytics";
import { EMPLOYEES } from "@/lib/permissions";
import { SlidersHorizontal } from "lucide-react";

export default function AnalyticsTransactionBased() {
  const { can } = useAuthStore();
  const canRev = can("canViewRevenue");

  const [filterMonth, setFilterMonth] = useState("");
  const [filterEmp, setFilterEmp] = useState("");
  const [filterPkg, setFilterPkg] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [open, setOpen] = useState(false);

  // Fetch monthly analytics
  const { analytics, loading } = useMonthlyAnalytics();

  // Extract available months
  const months = useMemo(
    () => analytics.map((a) => a.month).sort().reverse(),
    [analytics]
  );

  // Filter analytics based on month selection
  const filteredAnalytics = useMemo(() => {
    if (!filterMonth) return analytics;
    return analytics.filter((a) => a.month === filterMonth);
  }, [analytics, filterMonth]);

  // Calculate totals from filtered analytics
  const totals = useMemo(() => {
    const summary = calculateAnalyticsSummary(filteredAnalytics);
    return {
      paymentCount: summary.totalPaymentCount,
      refundCount: summary.totalRefundCount,
      withdrawalCount: summary.totalWithdrawals,
      totalPayments: summary.totalPayments,
      totalRefunds: summary.totalRefunds,
      netRevenue: summary.netRevenue,
    };
  }, [filteredAnalytics]);

  // Employee breakdown
  const empStats = useMemo(() => {
    const byEmp: Record<string, any> = {};

    filteredAnalytics.forEach((analytics) => {
      if (analytics.byEmployee) {
        Object.entries(analytics.byEmployee).forEach(([emp, data]) => {
          if (!byEmp[emp]) {
            byEmp[emp] = {
              name: emp,
              paymentCount: 0,
              refundCount: 0,
              withdrawalCount: 0,
              netRevenue: 0,
            };
          }
          byEmp[emp].paymentCount += data.paymentCount || 0;
          byEmp[emp].refundCount += data.refundCount || 0;
          byEmp[emp].withdrawalCount += data.withdrawalCount || 0;
          byEmp[emp].netRevenue += data.netRevenueUSD || 0;
        });
      }
    });

    return Object.values(byEmp).sort((a, b) => b.netRevenue - a.netRevenue);
  }, [filteredAnalytics]);

  const maxEmpRev = Math.max(...empStats.map((e) => e.netRevenue), 1);

  // Package breakdown
  const pkgStats = useMemo(() => {
    const byPkg: Record<string, any> = {};

    filteredAnalytics.forEach((analytics) => {
      if (analytics.byPackage) {
        Object.entries(analytics.byPackage).forEach(([pkg, data]) => {
          if (!byPkg[pkg]) {
            byPkg[pkg] = {
              name: pkg,
              paymentCount: 0,
              refundCount: 0,
              netRevenue: 0,
            };
          }
          byPkg[pkg].paymentCount += data.paymentCount || 0;
          byPkg[pkg].refundCount += data.refundCount || 0;
          byPkg[pkg].netRevenue += data.netRevenueUSD || 0;
        });
      }
    });

    return Object.values(byPkg);
  }, [filteredAnalytics]);

  const hasFilters = filterMonth || filterEmp || filterPkg || filterCountry;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <p className="text-slate-500">جاري تحميل التحليلات...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <h3 className="font-bold text-slate-800">تحليلات المعاملات المالية</h3>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
            hasFilters
              ? "bg-blue-100 text-blue-700"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <SlidersHorizontal size={14} />
          فلاتر{hasFilters ? " ●" : ""}
        </button>
      </div>

      {/* Filters panel */}
      {open && (
        <div className="px-5 py-4 border-b border-slate-50 flex flex-wrap gap-3 bg-slate-50/50">
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="form-input w-auto"
          >
            <option value="">كل الأشهر</option>
            {months.map((m) => {
              const [y, mo] = m.split("-");
              return (
                <option key={m} value={m}>
                  {ARABIC_MONTHS[Number(mo) - 1]} {y}
                </option>
              );
            })}
          </select>

          <select
            value={filterEmp}
            onChange={(e) => setFilterEmp(e.target.value)}
            className="form-input w-auto"
          >
            <option value="">كل الموظفين</option>
            {EMPLOYEES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>

          <select
            value={filterPkg}
            onChange={(e) => setFilterPkg(e.target.value)}
            className="form-input w-auto"
          >
            <option value="">كل الباقات</option>
            <option value="فضية">فضية</option>
            <option value="ذهبية">ذهبية</option>
          </select>

          {hasFilters && (
            <button
              onClick={() => {
                setFilterMonth("");
                setFilterEmp("");
                setFilterPkg("");
                setFilterCountry("");
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2"
            >
              مسح الكل
            </button>
          )}
        </div>
      )}

      <div className="p-5">
        {/* Summary metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: "المدفوعات", value: formatNumber(totals.paymentCount), color: "text-green-700" },
            { label: "الاستردادات", value: formatNumber(totals.refundCount), color: "text-red-700" },
            { label: "المنسحبون", value: formatNumber(totals.withdrawalCount), color: "text-orange-700" },
            {
              label: "إجمالي المدفوعات",
              value: canRev ? `$${formatNumber(totals.totalPayments, 2)}` : "—",
              color: "text-blue-700",
            },
            {
              label: "صافي الإيراد",
              value: canRev ? `$${formatNumber(totals.netRevenue, 2)}` : "—",
              color: "text-emerald-700",
            },
          ].map((c) => (
            <div key={c.label} className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">{c.label}</p>
              <p className={`text-lg font-black ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Employee breakdown */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
              أداء الموظفين
            </h4>
            {empStats.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">لا توجد بيانات</p>
            ) : (
              <div className="space-y-3">
                {empStats.map((e) => (
                  <div key={e.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="px-2 py-0.5 rounded font-semibold bg-blue-100 text-blue-700">
                        {e.name}
                      </span>
                      <span className="text-slate-500">
                        {e.paymentCount} دفعات · {e.refundCount} استردادات{" "}
                        {canRev ? `· $${formatNumber(e.netRevenue, 2)}` : ""}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{
                          width: `${(e.netRevenue / maxEmpRev) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Package breakdown */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
              توزيع الباقات
            </h4>
            {pkgStats.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">لا توجد بيانات</p>
            ) : (
              <div className="space-y-3">
                {pkgStats.map((p) => (
                  <div key={p.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="px-2 py-0.5 rounded font-semibold bg-purple-100 text-purple-700">
                        {p.name}
                      </span>
                      <span className="text-slate-500">
                        {p.paymentCount} · {p.refundCount} استردادات
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-purple-400 transition-all duration-500"
                        style={{
                          width: `${(p.paymentCount / Math.max(...pkgStats.map((x) => x.paymentCount), 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
