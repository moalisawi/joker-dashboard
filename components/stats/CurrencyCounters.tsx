"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { formatNumber } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCountUp } from "@/lib/animations";
import type { PaymentTransaction } from "@/types";

interface Props {
  payments: PaymentTransaction[];
}

const CURRENCIES = [
  {
    code: "USD",
    label: "الدولار الأمريكي",
    symbol: "$",
    flag: "🇺🇸",
    accent: "#5B5FEF",
    accentBg: "rgba(91,95,239,0.07)",
    accentBorder: "rgba(91,95,239,0.16)",
    accentText: "#5B5FEF",
    showTotal: true,
  },
  {
    code: "ILS",
    label: "الشيكل الإسرائيلي",
    symbol: "₪",
    flag: "🇮🇱",
    accent: "#22C55E",
    accentBg: "rgba(34,197,94,0.07)",
    accentBorder: "rgba(34,197,94,0.18)",
    accentText: "#16a34a",
    showTotal: false,
  },
  {
    code: "JOD",
    label: "الدينار الأردني",
    symbol: "JD",
    flag: "🇯🇴",
    accent: "#F59E0B",
    accentBg: "rgba(245,158,11,0.07)",
    accentBorder: "rgba(245,158,11,0.20)",
    accentText: "#B45309",
    showTotal: false,
  },
  {
    code: "EGP",
    label: "الجنيه المصري",
    symbol: "ج.م",
    flag: "🇪🇬",
    accent: "#EF4444",
    accentBg: "rgba(239,68,68,0.06)",
    accentBorder: "rgba(239,68,68,0.16)",
    accentText: "#DC2626",
    showTotal: false,
  },
] as const;

function AnimatedAmount({ value, decimals = 2 }: { value: number; decimals?: number }) {
  const animated = useCountUp(value, 950);
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatNumber(animated, decimals)}</span>;
}

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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
      {CURRENCIES.map((cur, i) => {
        const amount = totals.byCurrency[cur.code] ?? 0;
        return (
          <motion.div
            key={cur.code}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1], delay: i * 0.07 }}
            whileHover={{ y: -3 }}
            className="relative overflow-hidden cursor-default"
            style={{
              background: "#FFFFFF",
              borderRadius: 22,
              padding: "20px 22px 18px",
              border: `1px solid ${cur.accentBorder}`,
              boxShadow: `var(--jk-shadow-stat)`,
              transition: "box-shadow 0.25s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                `0 2px 4px rgba(16,20,26,.04), 0 12px 32px -8px ${cur.accent}28`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "var(--jk-shadow-stat)";
            }}
          >
            {/* Subtle top accent line */}
            <div style={{
              position: "absolute", top: 0, insetInlineStart: 0, insetInlineEnd: 0,
              height: 3, borderRadius: "22px 22px 0 0",
              background: `linear-gradient(90deg, ${cur.accent}00, ${cur.accent}88, ${cur.accent}00)`,
              pointerEvents: "none",
            }} />

            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              {/* Flag */}
              <div style={{
                width: 42, height: 42, borderRadius: 13,
                background: cur.accentBg,
                border: `1px solid ${cur.accentBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, flexShrink: 0,
              }}>
                {cur.flag}
              </div>

              {/* Code badge */}
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                padding: "4px 12px", borderRadius: 999,
                background: cur.accentBg,
                color: cur.accentText,
                border: `1px solid ${cur.accentBorder}`,
              }}>
                {cur.code}
              </span>
            </div>

            {/* Amount */}
            <p style={{
              color: "var(--jk-text)",
              fontSize: "clamp(20px, 2.5vw, 26px)",
              fontWeight: 800,
              lineHeight: 1, letterSpacing: "-0.028em",
              margin: 0,
            }}>
              <AnimatedAmount value={amount} decimals={2} />
              {" "}
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--jk-subtle)" }}>
                {cur.symbol}
              </span>
            </p>

            {/* Label */}
            <p style={{ color: "var(--jk-muted)", fontSize: 12.5, fontWeight: 500, marginTop: 6 }}>
              {cur.label}
            </p>

            {cur.code === "USD" && totals.totalUSDAll !== amount && (
              <p style={{
                color: "var(--jk-subtle)", fontSize: 11.5, marginTop: 6,
                paddingTop: 6, borderTop: "1px solid var(--jk-divider)",
              }}>
                ≈ ${formatNumber(totals.totalUSDAll, 0)} مجمّع
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
