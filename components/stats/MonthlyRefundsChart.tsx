"use client";

import { useMemo } from "react";
import { formatNumber, ARABIC_MONTHS } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useMonthlyAnalytics } from "@/hooks/useMonthlyAnalytics";

export default function MonthlyRefundsChart() {
  const { can } = useAuthStore();
  const canRev = can("canViewRevenue");

  const { analytics, loading } = useMonthlyAnalytics();

  // Sort by month and prepare chart data
  const chartData = useMemo(() => {
    return analytics
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((a) => {
        const [year, month] = a.month.split("-");
        const monthName = ARABIC_MONTHS[Number(month) - 1];
        return {
          month: a.month,
          label: `${monthName} ${year}`,
          payments: a.totalPaymentsUSD || 0,
          refunds: a.totalRefundsUSD || 0,
          netRevenue: a.netRevenueUSD || 0,
          paymentCount: a.paymentCount || 0,
          refundCount: a.refundCount || 0,
          withdrawalCount: a.withdrawalCount || 0,
        };
      });
  }, [analytics]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <p className="text-slate-500">جاري تحميل البيانات...</p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <p className="text-slate-500">لا توجد بيانات</p>
      </div>
    );
  }

  // Find max values for scaling
  const maxPayment = Math.max(...chartData.map((d) => d.payments), 1);
  const maxRefund = Math.max(...chartData.map((d) => d.refunds), 1);

  const totalPayments = chartData.reduce((s, d) => s + Number(d.payments), 0);
  const totalRefunds = chartData.reduce((s, d) => s + Number(d.refunds), 0);
  const totalNetRevenue = chartData.reduce((s, d) => s + Number(d.netRevenue), 0);
  const refundRate = totalPayments > 0 ? ((totalRefunds / totalPayments) * 100).toFixed(1) : "0.0";

  const summaryCards = [
    {
      label: "إجمالي المدفوعات",
      value: `$${formatNumber(totalPayments, 2)}`,
      color: "text-green-600",
    },
    {
      label: "إجمالي الاستردادات",
      value: `$${formatNumber(totalRefunds, 2)}`,
      color: "text-red-600",
    },
    {
      label: "صافي الإيراد",
      value: `$${formatNumber(totalNetRevenue, 2)}`,
      color: "text-emerald-600",
    },
    {
      label: "معدل الاستردادات",
      value: `${refundRate}%`,
      color: "text-amber-600",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-50">
        <h3 className="font-bold text-slate-800">الإيرادات والاستردادات الشهرية</h3>
        <p className="text-xs text-slate-400 mt-1">مقارنة بين المدفوعات والاستردادات لكل شهر</p>
      </div>

      <div className="p-5">
        {canRev ? (
          <div className="space-y-6">
            {chartData.map((data) => (
              <div key={data.month} className="space-y-2">
                {/* Month label */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{data.label}</span>
                  <div className="flex gap-4 text-xs">
                    <span className="text-green-600">
                      💰 ${formatNumber(data.payments, 2)}
                    </span>
                    <span className="text-red-600">
                      🔄 ${formatNumber(data.refunds, 2)}
                    </span>
                    <span className="text-emerald-600 font-semibold">
                      📊 ${formatNumber(data.netRevenue, 2)}
                    </span>
                  </div>
                </div>

                {/* Stacked bar chart */}
                <div className="flex gap-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                  {/* Payments bar */}
                  <div
                    className="bg-gradient-to-r from-green-400 to-green-500 rounded-l-lg transition-all duration-300 hover:shadow-lg cursor-pointer relative group"
                    style={{ width: `${(data.payments / maxPayment) * 80}%` }}
                    title={`المدفوعات: $${formatNumber(data.payments, 2)} (${data.paymentCount} دفعة)`}
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 flex items-center justify-center rounded-l-lg">
                      <span className="text-white text-xs font-bold">
                        ${formatNumber(data.payments, 0)}
                      </span>
                    </div>
                  </div>

                  {/* Refunds bar */}
                  <div
                    className="bg-gradient-to-r from-red-400 to-red-500 rounded-r-lg transition-all duration-300 hover:shadow-lg cursor-pointer relative group"
                    style={{ width: `${(data.refunds / maxRefund) * 20}%` }}
                    title={`الاستردادات: $${formatNumber(data.refunds, 2)} (${data.refundCount} استرداد)`}
                  >
                    {data.refunds > 0 && (
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 flex items-center justify-center rounded-r-lg">
                        <span className="text-white text-xs font-bold">
                          ${formatNumber(data.refunds, 0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex justify-between text-xs text-slate-500">
                  <span>
                    {data.paymentCount} دفعة{data.refundCount > 0 ? ` · ${data.refundCount} استرجاع` : ""}
                    {data.withdrawalCount > 0 ? ` · ${data.withdrawalCount} منسحب` : ""}
                  </span>
                  <span>
                    {data.refunds > 0
                      ? `نسبة استرجاع: ${((data.refunds / data.payments) * 100).toFixed(1)}%`
                      : "بدون استرجاعات"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm">
              ليس لديك صلاحية لعرض بيانات الإيرادات
            </p>
          </div>
        )}

        {/* Summary */}
        {canRev && chartData.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {summaryCards.map((stat) => (
                <div key={stat.label} className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
                  <p className={`font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
