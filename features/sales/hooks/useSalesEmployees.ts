"use client";

import { useMemo } from "react";
import { useActiveEmployees } from "@/features/users/hooks";
import { useSubscribersQuery } from "@/features/subscribers";
import { buildAllSalesMetrics } from "@/features/sales/lib/salesMetrics";
import type { SalesEmployeeMetrics } from "@/features/sales/lib/salesMetrics";

/**
 * Joins active sales employees with subscriber-derived metrics.
 * All computation is client-side — no extra Firestore queries.
 */
export function useSalesEmployees(): {
  data:      SalesEmployeeMetrics[];
  isLoading: boolean;
} {
  const { data: employees = [], isLoading: empLoading } = useActiveEmployees();
  const { data: subscribers = [], isLoading: subLoading } = useSubscribersQuery();

  const data = useMemo(
    () => buildAllSalesMetrics(employees, subscribers),
    [employees, subscribers]
  );

  return { data, isLoading: empLoading || subLoading };
}
