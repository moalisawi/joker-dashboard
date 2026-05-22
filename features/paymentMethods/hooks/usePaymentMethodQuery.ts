"use client";

import { useQuery } from "@tanstack/react-query";
import { paymentMethodService } from "../services/paymentMethod.service";
import { paymentMethodKeys } from "../keys";

export function usePaymentMethodQuery(id: string | undefined) {
  return useQuery({
    queryKey: paymentMethodKeys.detail(id ?? ""),
    queryFn:  () => paymentMethodService.getById(id!),
    enabled:  !!id,
  });
}
