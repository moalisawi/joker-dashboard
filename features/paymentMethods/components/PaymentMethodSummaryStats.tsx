"use client";

import { CreditCard, CheckCircle, DollarSign, Users } from "lucide-react";
import { Spinner } from "@heroui/react";
import type { PaymentMethod, BalancePeriod } from "../types";
import { useAllMethodsBalanceQuery } from "../hooks/useAllMethodsBalanceQuery";

interface Props {
  methods: PaymentMethod[];
  period:  BalancePeriod;
}

function KpiCard({
  accent, glow, icon, label, value, loading,
}: {
  accent:   string;
  glow:     string;
  icon:     React.ReactNode;
  label:    string;
  value:    string | number;
  loading?: boolean;
}) {
  return (
    <div style={{
      borderRadius: 20,
      background: "rgba(255,255,255,0.72)",
      backdropFilter: "blur(20px) saturate(1.6)",
      WebkitBackdropFilter: "blur(20px) saturate(1.6)",
      border: "1px solid rgba(255,255,255,0.82)",
      boxShadow: `0 1px 3px rgba(15,23,42,0.05), 0 6px 24px ${glow}`,
      padding: "16px 18px",
      display: "flex", alignItems: "center", gap: 14,
      position: "relative", overflow: "hidden",
      transition: "transform .2s ease, box-shadow .2s ease",
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px rgba(15,23,42,0.06), 0 12px 36px ${glow}`;
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      (e.currentTarget as HTMLElement).style.boxShadow = `0 1px 3px rgba(15,23,42,0.05), 0 6px 24px ${glow}`;
    }}
    >
      {/* Accent glow top-left */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 80% 60% at 0% 0%, ${glow} 0%, transparent 60%)`,
        borderRadius: "inherit",
      }} />

      <div style={{
        width: 42, height: 42, borderRadius: 13, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${accent}12`, border: `1.5px solid ${accent}28`,
        color: accent, position: "relative",
      }}>
        {icon}
      </div>

      <div style={{ minWidth: 0, position: "relative" }}>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "#9CA3AF",
          marginBottom: 4,
        }}>
          {label}
        </p>
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <p style={{
            fontSize: 22, fontWeight: 900, color: "#111827",
            fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em",
            lineHeight: 1,
          }}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

export function PaymentMethodSummaryStats({ methods, period }: Props) {
  const total  = methods.length;
  const active = methods.filter((m) => m.status === "active").length;
  const { totalUSD, payerCount, isLoading } = useAllMethodsBalanceQuery(methods, period);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        accent="#5B5FEF" glow="rgba(91,95,239,0.12)"
        icon={<CreditCard size={18} />}
        label="إجمالي طرق الدفع"
        value={total}
      />
      <KpiCard
        accent="#10B981" glow="rgba(16,185,129,0.12)"
        icon={<CheckCircle size={18} />}
        label="المفعّلة"
        value={active}
      />
      <KpiCard
        accent="#F59E0B" glow="rgba(245,158,11,0.12)"
        icon={<DollarSign size={18} />}
        label="إجمالي الدخل"
        value={`$${totalUSD.toFixed(2)}`}
        loading={isLoading && methods.length > 0}
      />
      <KpiCard
        accent="#3B82F6" glow="rgba(59,130,246,0.12)"
        icon={<Users size={18} />}
        label="المشتركون"
        value={payerCount}
        loading={isLoading && methods.length > 0}
      />
    </div>
  );
}
