"use client";

import { useQuery } from "@tanstack/react-query";
import { computeBalance } from "../services/paymentMethodBalance.service";
import { paymentMethodKeys } from "../keys";
import type { BalancePeriod } from "../types";

export function usePaymentMethodBalanceQuery(
  methodId: string | undefined,
  period: BalancePeriod
) {
  return useQuery({
    queryKey: paymentMethodKeys.balance(methodId ?? "", period),
    queryFn:  () => computeBalance(methodId!, period),
    enabled:  !!methodId,
    staleTime: 60_000,
  });
}
