"use client";

import { useQueries } from "@tanstack/react-query";
import { computeBalance } from "../services/paymentMethodBalance.service";
import { paymentMethodKeys } from "../keys";
import type { PaymentMethod, BalancePeriod } from "../types";

export function useAllMethodsBalanceQuery(
  methods: PaymentMethod[],
  period: BalancePeriod
) {
  // Reuses the same query keys as individual card balance queries → cache hits
  const results = useQueries({
    queries: methods.map((m) => ({
      queryKey: paymentMethodKeys.balance(m.id, period),
      queryFn:  () => computeBalance(m.id, period),
      staleTime: 60_000,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);

  let totalUSD    = 0;
  let payerCount  = 0;

  results.forEach((r) => {
    if (!r.data) return;
    totalUSD   += r.data.totalUSD;
    payerCount += r.data.payerCount;
  });

  return { totalUSD, payerCount, isLoading };
}
