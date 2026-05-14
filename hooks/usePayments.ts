"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, query, where, orderBy, onSnapshot, getDocs, type Query } from "firebase/firestore";
import { db } from "@/lib/firestore";
import type { PaymentTransaction } from "@/types";

interface UsePaymentsOptions {
  subscriberId?:  string;
  dateRange?:     { start: string; end: string };
  paymentMethod?: string;
  limit?:         number;
}

function buildPaymentsQuery(options: UsePaymentsOptions): Query {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const constraints: any[] = [orderBy("date", "desc")];
  if (options.subscriberId)       constraints.push(where("subscriberId",    "==", options.subscriberId));
  if (options.dateRange)          constraints.push(where("date", ">=", options.dateRange.start), where("date", "<=", options.dateRange.end));
  if (options.paymentMethod)      constraints.push(where("paymentMethod",   "==", options.paymentMethod));
  return query(collection(db, "payments"), ...constraints);
}

export function usePayments(options: UsePaymentsOptions = {}) {
  const qc       = useQueryClient();
  const queryKey = ["payments", options.subscriberId ?? "", options.dateRange?.start ?? "", options.dateRange?.end ?? "", options.paymentMethod ?? ""] as const;

  const { data: allPayments = [], isLoading, error } = useQuery<PaymentTransaction[]>({
    queryKey,
    queryFn: async () => {
      const snap = await getDocs(buildPaymentsQuery(options));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentTransaction));
    },
    staleTime: Infinity,
  });

  // Apply client-side limit
  const payments = options.limit ? allPayments.slice(0, options.limit) : allPayments;

  useEffect(() => {
    const q     = buildPaymentsQuery(options);
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentTransaction));
      qc.setQueryData<PaymentTransaction[]>(queryKey, data);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.subscriberId, options.dateRange?.start, options.dateRange?.end, options.paymentMethod]);

  return {
    payments,
    loading: isLoading,
    error:   error instanceof Error ? error.message : null,
  };
}
