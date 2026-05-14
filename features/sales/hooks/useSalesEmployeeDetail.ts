"use client";

import { useMemo } from "react";
import { useEmployee }         from "@/features/users/hooks";
import { useSubscribersQuery } from "@/features/subscribers";
import { buildSalesMetrics, filterEmployeeSubscribers } from "@/features/sales/lib/salesMetrics";
import type { SalesEmployeeMetrics } from "@/features/sales/lib/salesMetrics";
import type { Subscriber } from "@/types";

export function useSalesEmployeeDetail(uid: string | undefined): {
  metrics:     SalesEmployeeMetrics | null;
  subscribers: Subscriber[];
  isLoading:   boolean;
} {
  const { data: employee,    isLoading: empLoading } = useEmployee(uid);
  const { data: allSubs = [], isLoading: subLoading } = useSubscribersQuery();

  const result = useMemo(() => {
    if (!employee || !uid) return { metrics: null, subscribers: [] };
    const subs    = filterEmployeeSubscribers(allSubs, uid);
    const metrics = buildSalesMetrics(employee, allSubs, 6);
    return { metrics, subscribers: subs };
  }, [employee, allSubs, uid]);

  return { ...result, isLoading: empLoading || subLoading };
}
