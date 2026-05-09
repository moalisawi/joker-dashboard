"use client";

import { useMemo } from "react";
import { formatNumber } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import type { PaymentTransaction } from "@/types";

interface Props {
  payments: PaymentTransaction[];
}

const CURRENCIES = [
  {
    code: "ILS",
    label: "إجمالي الشيكل",
    symbol: "₪",
    accentBorder: "border-t-blue-500",
    iconBg: "bg-blue-50",
    iconText: "text-blue-600",
    badge: "bg-slate-100 text-slate-600",
  },
  {
    code: "JOD",
    label: "إجمالي الدينار",
    symbol: "JD",
    accentBorder: "border-t-amber-500",
    iconBg: "bg-amber-50",
    iconText: "text-amber-600",
    badge: "bg-slate-100 text-slate-600",
  },
  {
    code: "EGP",
    label: "إجمالي الجنيه",
    symbol: "ج.م",
    accentBorder: "border-t-orange-500",
    iconBg: "bg-orange-50",
    iconText: "text-orange-600",
    badge: "bg-slate-100 text-slate-600",
  },
  {
    code: "USD",
    label: "إجمالي الدولار",
    symbol: "$",
    accentBorder: "border-t-emerald-500",
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
    badge: "bg-slate-100 text-slate-600",
    showTotal: true,
  },
] as const;

export default function CurrencyCounters({ payments }: Props) {
  const { can } = useAuthStore();
  if (!can("canViewRevenue")) return null;

  const totals = useMemo(() => {
    const t: Record<string, number> = { ILS: 0, JOD: 0, EGP: 0, USD: 0 };
    let totalUSDAll = 0;
    payments.forEach((p) => {
      const c = p.currencyOriginal || "USD";
      if (c in t) t[c] += p.amountOriginal;
      totalUSDAll += p.amountUSD;
    });
    return { byCurrency: t, totalUSDAll };
  }, [payments]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {CURRENCIES.map((cur) => (
        <div
          key={cur.code}
          className={`
            group relative bg-white rounded-2xl p-5 border border-t-[3px] overflow-hidden
            ${cur.accentBorder}
            shadow-[0_1px_3px_rgba(15,23,42,0.05),_0_4px_12px_rgba(15,23,42,0.04)]
            hover:shadow-[0_4px_16px_rgba(15,23,42,0.09),_0_10px_30px_rgba(15,23,42,0.06)]
            hover:-translate-y-0.5 transition-all duration-200
            border-l-[rgba(15,23,42,0.07)] border-r-[rgba(15,23,42,0.07)] border-b-[rgba(15,23,42,0.07)]
          `}
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cur.iconBg} transition-transform duration-200 group-hover:scale-110`}>
              <span className={`text-sm font-black ${cur.iconText}`}>{cur.symbol}</span>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${cur.badge}`}>
              {cur.code}
            </span>
          </div>

          <p className="font-semibold mb-1.5 tracking-wide uppercase text-slate-400" style={{ fontSize: "0.68rem" }}>{cur.label}</p>
          <p className="text-2xl font-black tabular-nums leading-none tracking-tight text-slate-900">
            {formatNumber(totals.byCurrency[cur.code] ?? 0, 2)}{" "}
            <span className="text-sm font-semibold text-slate-400">{cur.symbol}</span>
          </p>

          {cur.code === "USD" && (
            <p className="text-xs mt-2 font-medium text-slate-400">
              ≈ ${formatNumber(totals.totalUSDAll, 2)} مجمّع
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
