"use client";

import { CreditCard, CheckCircle, DollarSign, Users } from "lucide-react";
import { Spinner } from "@heroui/react";
import type { PaymentMethod, BalancePeriod } from "../types";
import { useAllMethodsBalanceQuery } from "../hooks/useAllMethodsBalanceQuery";

const ACC = {
  blue:   "#5B5FEF",
  emerald:"#5B5FEF",
  amber:  "#F59E0B",
  violet: "#3B82F6",
};

interface Props {
  methods: PaymentMethod[];
  period:  BalancePeriod;
}

function KpiCard({
  accent,
  icon,
  label,
  value,
  loading,
}: {
  accent:  string;
  icon:    React.ReactNode;
  label:   string;
  value:   string | number;
  loading?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{
        background:   "var(--surface)",
        border:       "1px solid var(--border)",
        boxShadow:    "var(--shadow-card)",
      }}
    >
      <div
        className="h-10 w-10 flex items-center justify-center rounded-xl shrink-0"
        style={{ background: `${accent}18`, border: `1px solid ${accent}28` }}
      >
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p
          className="text-[11px] font-medium uppercase tracking-wider truncate"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </p>
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <p
            className="text-lg font-black tabular-nums leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
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
        accent={ACC.blue}
        icon={<CreditCard size={18} />}
        label="إجمالي طرق الدفع"
        value={total}
      />
      <KpiCard
        accent={ACC.emerald}
        icon={<CheckCircle size={18} />}
        label="المفعّلة"
        value={active}
      />
      <KpiCard
        accent={ACC.amber}
        icon={<DollarSign size={18} />}
        label="إجمالي الدخل"
        value={`$${totalUSD.toFixed(2)}`}
        loading={isLoading && methods.length > 0}
      />
      <KpiCard
        accent={ACC.violet}
        icon={<Users size={18} />}
        label="المشتركون"
        value={payerCount}
        loading={isLoading && methods.length > 0}
      />
    </div>
  );
}
