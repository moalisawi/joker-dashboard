"use client";

import { useQuery } from "@tanstack/react-query";
import { paymentMethodService } from "../services/paymentMethod.service";
import { residenceToPaymentCountry } from "../utils/countryMapping";
import type { PaymentMethod } from "../types";

export function useActiveMethodsForResidenceQuery(
  residence: string | null | undefined
): { methods: PaymentMethod[]; isLoading: boolean } {
  const countryCode = residence ? residenceToPaymentCountry(residence) : null;

  const { data, isLoading } = useQuery({
    queryKey: ["paymentMethods", "active", countryCode ?? "global"],
    queryFn:  () => paymentMethodService.getActiveByCountry(countryCode),
    staleTime: 60_000,
  });

  return { methods: data ?? [], isLoading };
}
