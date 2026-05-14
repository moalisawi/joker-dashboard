"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, query, where, orderBy, onSnapshot, getDocs, type Query } from "firebase/firestore";
import { db } from "@/lib/firestore";
import type { RefundTransaction } from "@/types";

interface UseRefundsOptions {
  subscriberId?: string;
  dateRange?:    { start: string; end: string };
  limit?:        number;
}

function buildRefundsQuery(options: UseRefundsOptions): Query {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const constraints: any[] = [orderBy("refundDate", "desc")];
  if (options.subscriberId) constraints.push(where("subscriberId", "==", options.subscriberId));
  if (options.dateRange)    constraints.push(where("refundDate", ">=", options.dateRange.start), where("refundDate", "<=", options.dateRange.end));
  return query(collection(db, "refunds"), ...constraints);
}

export function useRefunds(options: UseRefundsOptions = {}) {
  const qc       = useQueryClient();
  const queryKey = ["refunds", options.subscriberId ?? "", options.dateRange?.start ?? "", options.dateRange?.end ?? ""] as const;

  const { data: allRefunds = [], isLoading, error } = useQuery<RefundTransaction[]>({
    queryKey,
    queryFn: async () => {
      const snap = await getDocs(buildRefundsQuery(options));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RefundTransaction));
    },
    staleTime: Infinity,
  });

  const refunds = options.limit ? allRefunds.slice(0, options.limit) : allRefunds;

  useEffect(() => {
    const q     = buildRefundsQuery(options);
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RefundTransaction));
      qc.setQueryData<RefundTransaction[]>(queryKey, data);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.subscriberId, options.dateRange?.start, options.dateRange?.end]);

  return {
    refunds,
    loading: isLoading,
    error:   error instanceof Error ? error.message : null,
  };
}
