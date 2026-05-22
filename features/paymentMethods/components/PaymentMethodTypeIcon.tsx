"use client";

import { Wallet, Building2, Banknote, Bitcoin, Globe } from "lucide-react";
import type { PaymentMethodType } from "../types";

const ICONS: Record<PaymentMethodType, (size: number) => React.ReactNode> = {
  ewallet:       (s) => <Wallet    size={s} />,
  bank:          (s) => <Building2 size={s} />,
  cash:          (s) => <Banknote  size={s} />,
  crypto:        (s) => <Bitcoin   size={s} />,
  international: (s) => <Globe     size={s} />,
};

const CONFIG: Record<PaymentMethodType, { bg: string; label: string }> = {
  ewallet:       { bg: "bg-blue-500/25 text-blue-600",    label: "محفظة إلكترونية" },
  bank:          { bg: "bg-teal-500/25 text-teal-600",    label: "حساب بنكي" },
  cash:          { bg: "bg-slate-400/25 text-slate-500",  label: "كاش" },
  crypto:        { bg: "bg-purple-500/25 text-purple-600",label: "كريبتو" },
  international: { bg: "bg-amber-500/25 text-amber-600",  label: "دولي" },
};

interface Props {
  type: PaymentMethodType;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function PaymentMethodTypeIcon({ type, showLabel = false, size = "md" }: Props) {
  const cfg     = CONFIG[type];
  const iconSize = size === "sm" ? 13 : 18;
  const dim      = size === "sm" ? "w-6 h-6" : "w-9 h-9";
  return (
    <div className="flex items-center gap-2">
      <div className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
        {ICONS[type](iconSize)}
      </div>
      {showLabel && <span className="text-sm text-default-600">{cfg.label}</span>}
    </div>
  );
}

export function getTypeLabel(type: PaymentMethodType): string {
  return CONFIG[type]?.label ?? type;
}
