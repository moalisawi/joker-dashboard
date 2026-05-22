"use client";

import { Spinner } from "@heroui/react";
import { X } from "lucide-react";
import { usePaymentMethodPayersQuery } from "../hooks/usePaymentMethodPayersQuery";
import type { PaymentMethod, BalancePeriod } from "../types";

const PERIOD_LABELS: Record<BalancePeriod, string> = {
  currentMonth: "الشهر الحالي",
  last30:       "آخر 30 يوم",
  lifetime:     "كل الوقت",
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  method: PaymentMethod | null;
  period: BalancePeriod;
}

export function PaymentMethodPayersModal({ isOpen, onClose, method, period }: Props) {
  const { data: payers, isLoading } = usePaymentMethodPayersQuery(
    method?.id,
    period
  );

  const sorted = [...(payers ?? [])].sort((a, b) =>
    b.paymentDate.localeCompare(a.paymentDate)
  );

  if (!isOpen || !method) return null;

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 50 }}
      onClick={onClose}
    >
      <div
        className="modal-panel max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-default-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold">المشتركون — {method.name}</h2>
            <p className="text-sm text-default-400 mt-0.5">
              {PERIOD_LABELS[period]} · {sorted.length} دفعة
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-10 text-default-400">
              لا توجد دفعات لهذه الطريقة في هذه الفترة
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-default-100">
                    <th className="text-right pb-2.5 font-medium text-default-500 px-2">المشترك</th>
                    <th className="text-right pb-2.5 font-medium text-default-500 px-2">الدولة</th>
                    <th className="text-right pb-2.5 font-medium text-default-500 px-2">الباقة</th>
                    <th className="text-right pb-2.5 font-medium text-default-500 px-2">التاريخ</th>
                    <th className="text-left  pb-2.5 font-medium text-default-500 px-2">المبلغ</th>
                    <th className="text-left  pb-2.5 font-medium text-default-500 px-2">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => (
                    <tr
                      key={p.paymentId}
                      className="border-b border-default-50 hover:bg-default-50 transition-colors"
                    >
                      <td className="py-2.5 px-2 font-medium">{p.subscriberName}</td>
                      <td className="py-2.5 px-2 text-default-500">{p.country || "—"}</td>
                      <td className="py-2.5 px-2 text-default-500">{p.packageType || "—"}</td>
                      <td className="py-2.5 px-2 text-default-500">{p.paymentDate}</td>
                      <td className="py-2.5 px-2 text-left font-semibold">
                        {p.amountOriginal.toLocaleString()} {p.currencyOriginal}
                      </td>
                      <td className="py-2.5 px-2 text-left text-default-400">
                        ${p.amountUSD.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-default-100 flex-shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-default-200 text-sm font-medium hover:bg-default-100 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
