"use client";

import { useMemo } from "react";
import { useSubscribers } from "@/hooks/useSubscribers";
import { usePayments }    from "@/hooks/usePayments";
import { employeePerformanceFromSubscribers } from "@/lib/analytics/calculations";

export function useEmployeePerformance() {
  const { subscribers, loading: loadingSubs } = useSubscribers();
  const { payments,    loading: loadingPay  } = usePayments({});

  const loading = loadingSubs || loadingPay;

  const performance = useMemo(
    () => employeePerformanceFromSubscribers(subscribers),
    [subscribers]
  );

  const paymentsByEmployee = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of payments) {
      const name = p.createdBy ?? "";
      if (name) map[name] = (map[name] ?? 0) + (p.amountUSD ?? 0);
    }
    return map;
  }, [payments]);

  return { performance, paymentsByEmployee, loading };
}
