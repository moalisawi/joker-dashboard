"use client";

import { useState, useMemo } from "react";
import type { Subscriber } from "@/types";
import { formatNumber, ARABIC_MONTHS, RESIDENCE_COUNTRIES, PHONE_COUNTRIES } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useEmployeeNames } from "@/hooks/useEmployeeNames";
import { SlidersHorizontal } from "lucide-react";
import { CHART_PALETTE } from "@/lib/statusColors";

interface Props {
  subscribers: Subscriber[];
}

function getResidenceLabel(v: string) {
  return (
    RESIDENCE_COUNTRIES.find((c) => c.value === v)?.name ||
    PHONE_COUNTRIES.find((c) => c.iso === v)?.name ||
    v || "-"
  );
}

const EMP_COLORS: Record<string, { bar: string; badge: string }> = {
  حنان: { bar: CHART_PALETTE[3], badge: "bg-blue-100 text-blue-700" },
  ميار: { bar: CHART_PALETTE[0], badge: "bg-blue-100 text-blue-700" },
  ميدو: { bar: CHART_PALETTE[2], badge: "bg-orange-100 text-orange-700" },
};

export default function AdvancedStats({ subscribers }: Props) {
  const { can } = useAuthStore();
  const canRev = can("canViewRevenue");
  const employeeNames = useEmployeeNames();

  const [filterPkg, setFilterPkg]         = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterMonth, setFilterMonth]     = useState("");
  const [filterEmp, setFilterEmp]         = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [open, setOpen]                   = useState(false);

  // Build dynamic filter options from data
  const countries = useMemo(
    () => [...new Set(subscribers.map((s) => s.residence).filter(Boolean))].sort(),
    [subscribers]
  );
  const months = useMemo(
    () =>
      [...new Set(subscribers.map((s) => (s.date || "").slice(0, 7)).filter(Boolean))].sort().reverse(),
    [subscribers]
  );
  const paymentMethods = useMemo(
    () => [...new Set(subscribers.map((s) => s.payment).filter(Boolean))].sort(),
    [subscribers]
  );

  const filtered = useMemo(() => {
    return subscribers.filter(
      (s) =>
        (!filterPkg     || s.package === filterPkg) &&
        (!filterCountry || s.residence === filterCountry) &&
        (!filterMonth   || (s.date || "").slice(0, 7) === filterMonth) &&
        (!filterEmp     || s.convincedBy === filterEmp) &&
        (!filterPayment || s.payment === filterPayment)
    );
  }, [subscribers, filterPkg, filterCountry, filterMonth, filterEmp, filterPayment]);

  const totals = useMemo(() => ({
    count:   filtered.length,
    revenue: filtered.reduce((a, s) => a + s.netAmountUSD,       0),
    paid:    filtered.reduce((a, s) => a + s.paidAmountUSD,      0),
    rem:     filtered.reduce((a, s) => a + s.remainingAmountUSD, 0),
  }), [filtered]);

  const empStats = useMemo(() => {
    return employeeNames.map((emp) => {
      const d = filtered.filter((s) => s.convincedBy === emp);
      return { name: emp, count: d.length, rev: d.reduce((a, s) => a + s.netAmountUSD, 0) };
    }).sort((a, b) => b.rev - a.rev);
  }, [filtered, employeeNames]);
  const maxEmpRev = Math.max(...empStats.map((e) => e.rev), 1);

  const pmStats = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((s) => { if (s.payment) map[s.payment] = (map[s.payment] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);
  const maxPm = Math.max(...pmStats.map(([, c]) => c), 1);

  const hasFilters = filterPkg || filterCountry || filterMonth || filterEmp || filterPayment;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <h3 className="font-bold text-slate-800">الإحصائيات المتقدمة</h3>
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
          <select value={filterPkg} onChange={(e) => setFilterPkg(e.target.value)}
            className="form-input w-auto">
            <option value="">كل الباقات</option>
            <option value="فضية">فضية</option>
            <option value="ذهبية">ذهبية</option>
          </select>
          <select value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)}
            className="form-input w-auto">
            <option value="">كل الموظفين</option>
            {employeeNames.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
            className="form-input w-auto">
            <option value="">كل الأشهر</option>
            {months.map((m) => {
              const [y, mo] = m.split("-");
              return <option key={m} value={m}>{ARABIC_MONTHS[Number(mo) - 1]} {y}</option>;
            })}
          </select>
          <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)}
            className="form-input w-auto">
            <option value="">كل الدول</option>
            {countries.map((c) => (
              <option key={c} value={c}>{getResidenceLabel(c)}</option>
            ))}
          </select>
          <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}
            className="form-input w-auto">
            <option value="">كل طرق الدفع</option>
            {paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {hasFilters && (
            <button
              onClick={() => { setFilterPkg(""); setFilterCountry(""); setFilterMonth(""); setFilterEmp(""); setFilterPayment(""); }}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2"
            >
              مسح الكل
            </button>
          )}
        </div>
      )}

      <div className="p-5">
        {/* Summary numbers */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "الاشتراكات",  value: formatNumber(totals.count),        cls: "text-slate-800" },
            { label: "الإيرادات",   value: canRev ? `$${formatNumber(totals.revenue, 2)}` : "—", cls: "text-emerald-700" },
            { label: "المحصّل",     value: canRev ? `$${formatNumber(totals.paid, 2)}`    : "—", cls: "text-blue-700"    },
            { label: "المتبقي",     value: canRev ? `$${formatNumber(totals.rem, 2)}`     : "—", cls: "text-amber-700"   },
          ].map((c) => (
            <div key={c.label} className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">{c.label}</p>
              <p className={`text-xl font-black ${c.cls}`}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Employee breakdown */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
              أداء الموظفين
            </h4>
            <div className="space-y-3">
              {empStats.map((e) => {
                const style = EMP_COLORS[e.name] || { bar: "#5B5FEF", badge: "bg-indigo-100 text-indigo-700" };
                return (
                  <div key={e.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`px-2 py-0.5 rounded font-semibold ${style.badge}`}>{e.name}</span>
                      <span className="text-slate-500">
                        {e.count} مشترك{canRev ? ` · $${formatNumber(e.rev, 2)}` : ""}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(e.rev / maxEmpRev) * 100}%`, background: style.bar }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment method breakdown */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
              طرق الدفع
            </h4>
            {pmStats.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">لا توجد بيانات</p>
            ) : (
              <div className="space-y-2">
                {pmStats.map(([method, count]) => (
                  <div key={method}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-600">{method}</span>
                      <span className="font-semibold text-slate-700">{count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-400 transition-all duration-500"
                        style={{ width: `${(count / maxPm) * 100}%` }}
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
