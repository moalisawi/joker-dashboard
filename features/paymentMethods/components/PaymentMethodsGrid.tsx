"use client";

import { CreditCard } from "lucide-react";
import { PaymentMethodCard } from "./PaymentMethodCard";
import type { PaymentMethod, BalancePeriod } from "../types";

interface Props {
  methods:      PaymentMethod[];
  period:       BalancePeriod;
  onEdit:       (m: PaymentMethod) => void;
  onToggle:     (m: PaymentMethod) => void;
  onDelete:     (m: PaymentMethod) => void;
  onViewPayers: (m: PaymentMethod) => void;
  onExport:     (m: PaymentMethod) => void;
}

export function PaymentMethodsGrid({
  methods, period, onEdit, onToggle, onDelete, onViewPayers, onExport,
}: Props) {
  if (methods.length === 0) {
    return (
      <div
        className="rounded-2xl flex flex-col items-center justify-center py-20 gap-3"
        style={{
          background: "var(--surface)",
          border:     "1px solid var(--border)",
          boxShadow:  "var(--shadow-card)",
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "#83A2DB18", border: "1px solid #83A2DB28" }}
        >
          <CreditCard size={24} style={{ color: "#83A2DB" }} />
        </div>
        <p className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
          لا توجد طرق دفع بعد
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          أضف طريقة دفع جديدة للبدء في تتبع الإيرادات
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {methods.map((m) => (
        <PaymentMethodCard
          key={m.id}
          method={m}
          period={period}
          onEdit={onEdit}
          onToggle={onToggle}
          onDelete={onDelete}
          onViewPayers={onViewPayers}
          onExport={onExport}
        />
      ))}
    </div>
  );
}
