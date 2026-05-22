"use client";

import { useMemo } from "react";
import { formatNumber } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import type { PaymentTransaction } from "@/types";

interface Props {
  payments: PaymentTransaction[];
}

const CURRENCIES = [
  { code: "ILS",  label: "إجمالي الشيكل",  symbol: "₪",   iconColor: "#5B5FEF" },
  { code: "JOD",  label: "إجمالي الدينار", symbol: "JD",  iconColor: "#F59E0B" },
  { code: "EGP",  label: "إجمالي الجنيه",  symbol: "ج.م", iconColor: "#EF4444" },
  { code: "USD",  label: "إجمالي الدولار", symbol: "$",   iconColor: "#3B82F6", showTotal: true },
] as const;

export default function CurrencyCounters({ payments }: Props) {
  const { can } = useAuthStore();
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

  if (!can("canViewRevenue")) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {CURRENCIES.map((cur) => (
        <div
          key={cur.code}
          className="group relative"
          style={{
            background: "var(--jk-surface)",
            border: "1px solid var(--jk-border)",
            borderRadius: 22,
            padding: 22,
            boxShadow: "var(--jk-shadow-stat)",
            transition: "transform .25s ease",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <div
              style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "#F3F5F8", color: cur.iconColor,
                border: "1px solid var(--jk-border)",
                fontSize: 14, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {cur.symbol}
            </div>
            <span
              style={{
                background: `${cur.iconColor}24`,
                color: cur.iconColor,
                borderRadius: 999,
                border: `1px solid ${cur.iconColor}48`,
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {cur.code}
            </span>
          </div>

          <p style={{ color: "var(--jk-text)", fontSize: 30, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums", margin: 0 }}>
            {formatNumber(totals.byCurrency[cur.code] ?? 0, 2)}{" "}
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--jk-subtle)" }}>{cur.symbol}</span>
          </p>
          <p style={{ color: "var(--jk-muted)", fontSize: 13, fontWeight: 500, marginTop: 6 }}>{cur.label}</p>

          {cur.code === "USD" && (
            <p style={{ color: "var(--jk-subtle)", fontSize: 12, marginTop: 8 }}>
              ≈ ${formatNumber(totals.totalUSDAll, 2)} مجمّع
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
